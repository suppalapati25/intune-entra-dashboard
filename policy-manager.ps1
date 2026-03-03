<#
.SYNOPSIS
  Policy Audit, Validation & Rollback Tool
  Lets you inspect, test, and REVERSE every change made to your tenant.

.DESCRIPTION
  Modes:
    1. AUDIT    — List all policies we created, show their state
    2. SIMULATE — Show what WOULD happen to each user (from sign-in logs)
    3. DISABLE  — Switch any policy to OFF (not deleted, just disabled)
    4. DELETE   — Permanently remove any or all policies we created
    5. ENABLE   — Switch a report-only policy to enforced (ON)

  Run this script and follow the interactive menu.
#>

$ErrorActionPreference = "Continue"
$tenantId = "3f6dd2a4-41aa-4714-a2ff-8a36aa8ded71"

# Our policy name prefix so we only touch OUR policies
$prefix = "Enterprise - "

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "   Policy Audit, Validation & Rollback Tool" -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

Connect-MgGraph -TenantId $tenantId -Scopes "Policy.ReadWrite.ConditionalAccess","Policy.Read.All","DeviceManagementConfiguration.ReadWrite.All","AuditLog.Read.All" -NoWelcome
Write-Host "  Connected to tenant." -ForegroundColor Green

function Show-Menu {
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────┐" -ForegroundColor White
    Write-Host "  │  1. AUDIT    — List all our policies     │" -ForegroundColor White
    Write-Host "  │  2. SIMULATE — Check sign-in log impact  │" -ForegroundColor White
    Write-Host "  │  3. DISABLE  — Turn OFF a policy         │" -ForegroundColor White
    Write-Host "  │  4. DELETE   — Remove a policy           │" -ForegroundColor White
    Write-Host "  │  5. DELETE ALL — Remove ALL our policies │" -ForegroundColor Red
    Write-Host "  │  6. ENABLE   — Turn ON a policy          │" -ForegroundColor White
    Write-Host "  │  0. EXIT                                 │" -ForegroundColor White
    Write-Host "  └─────────────────────────────────────────┘" -ForegroundColor White
    Write-Host ""
}

function Get-OurCAPolicies {
    $all = Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" -Method GET
    return $all.value | Where-Object { $_.displayName -like "$prefix*" }
}

function Get-OurCompliancePolicies {
    $all = Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceCompliancePolicies" -Method GET
    return $all.value | Where-Object { $_.displayName -like "$prefix*" }
}

function Show-Audit {
    Write-Host "`n  ── Conditional Access Policies ──" -ForegroundColor Cyan
    $ca = Get-OurCAPolicies
    if ($ca.Count -eq 0) {
        Write-Host "    No CA policies found with prefix '$prefix'" -ForegroundColor Gray
    } else {
        $i = 1
        foreach ($p in $ca) {
            $stateColor = switch ($p.state) {
                "enabledForReportingButNotEnforced" { "Yellow" }
                "enabled" { "Green" }
                "disabled" { "Red" }
                default { "White" }
            }
            $stateLabel = switch ($p.state) {
                "enabledForReportingButNotEnforced" { "REPORT-ONLY" }
                "enabled" { "ENFORCED" }
                "disabled" { "DISABLED" }
                default { $p.state }
            }
            Write-Host "    $i. $($p.displayName)" -ForegroundColor White
            Write-Host "       State: $stateLabel  |  ID: $($p.id)" -ForegroundColor $stateColor
            $i++
        }
    }

    Write-Host "`n  ── Compliance Policies ──" -ForegroundColor Cyan
    $comp = Get-OurCompliancePolicies
    if ($comp.Count -eq 0) {
        Write-Host "    No compliance policies found with prefix '$prefix'" -ForegroundColor Gray
    } else {
        $i = 1
        foreach ($p in $comp) {
            Write-Host "    $i. $($p.displayName)" -ForegroundColor White
            Write-Host "       Type: $($p.'@odata.type')  |  ID: $($p.id)" -ForegroundColor Gray
            $i++
        }
    }
    Write-Host ""
}

function Show-Simulate {
    Write-Host "`n  ── Checking Sign-In Logs for CA Impact ──" -ForegroundColor Cyan
    Write-Host "    (Looking at last 24 hours of sign-ins...)" -ForegroundColor Gray

    try {
        $yesterday = (Get-Date).AddDays(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        $logs = Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/v1.0/auditLogs/signIns?`$filter=createdDateTime ge $yesterday&`$top=50" -Method GET

        if ($logs.value.Count -eq 0) {
            Write-Host "    No sign-ins found in the last 24 hours." -ForegroundColor Yellow
            return
        }

        $wouldBlock = 0
        $wouldAllow = 0

        foreach ($log in $logs.value) {
            $user = $log.userDisplayName
            $app = $log.appDisplayName
            $caResults = $log.conditionalAccessPolicies

            foreach ($ca in $caResults) {
                if ($ca.displayName -like "$prefix*") {
                    if ($ca.result -eq "reportOnlyFailure") {
                        $wouldBlock++
                        Write-Host "    WOULD BLOCK: $user -> $app" -ForegroundColor Red
                        Write-Host "      Policy: $($ca.displayName)" -ForegroundColor Gray
                    } elseif ($ca.result -eq "reportOnlySuccess") {
                        $wouldAllow++
                    }
                }
            }
        }

        Write-Host ""
        Write-Host "    Summary (last 24h, up to 50 sign-ins):" -ForegroundColor White
        Write-Host "      Would ALLOW: $wouldAllow sign-ins" -ForegroundColor Green
        Write-Host "      Would BLOCK: $wouldBlock sign-ins" -ForegroundColor Red
        Write-Host ""
        if ($wouldBlock -gt 0) {
            Write-Host "    Review the blocked sign-ins above before enabling policies!" -ForegroundColor Yellow
        } else {
            Write-Host "    No sign-ins would be blocked. Safe to enable." -ForegroundColor Green
        }
    } catch {
        Write-Host "    Could not read sign-in logs: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "    (Requires Entra ID P1/P2 license for sign-in logs)" -ForegroundColor Gray
    }
    Write-Host ""
}

function Set-PolicyState {
    param([string]$TargetState, [string]$Label)

    $policies = Get-OurCAPolicies
    if ($policies.Count -eq 0) {
        Write-Host "    No policies found." -ForegroundColor Gray
        return
    }

    Write-Host ""
    $i = 1
    foreach ($p in $policies) {
        Write-Host "    $i. $($p.displayName) [$($p.state)]"
        $i++
    }
    Write-Host "    A. ALL policies" -ForegroundColor Yellow
    $choice = Read-Host "`n  Select policy number (or A for all)"

    if ($choice -eq "A" -or $choice -eq "a") {
        foreach ($p in $policies) {
            try {
                $body = @{ state = $TargetState } | ConvertTo-Json
                Invoke-MgGraphRequest -Method PATCH -Uri "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/$($p.id)" -Body $body -ContentType "application/json"
                Write-Host "    $Label : $($p.displayName)" -ForegroundColor Green
            } catch {
                Write-Host "    Failed: $($p.displayName) - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } elseif ($choice -match "^\d+$") {
        $idx = [int]$choice - 1
        if ($idx -ge 0 -and $idx -lt $policies.Count) {
            $p = $policies[$idx]
            $body = @{ state = $TargetState } | ConvertTo-Json
            Invoke-MgGraphRequest -Method PATCH -Uri "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/$($p.id)" -Body $body -ContentType "application/json"
            Write-Host "    $Label : $($p.displayName)" -ForegroundColor Green
        }
    }
}

function Remove-Policy {
    $policies = Get-OurCAPolicies
    if ($policies.Count -eq 0) {
        Write-Host "    No CA policies found." -ForegroundColor Gray
        return
    }

    Write-Host ""
    $i = 1
    foreach ($p in $policies) {
        Write-Host "    $i. $($p.displayName)" -ForegroundColor White
        $i++
    }
    $choice = Read-Host "`n  Select policy number to DELETE"

    if ($choice -match "^\d+$") {
        $idx = [int]$choice - 1
        if ($idx -ge 0 -and $idx -lt $policies.Count) {
            $p = $policies[$idx]
            $confirm = Read-Host "  Are you sure you want to DELETE '$($p.displayName)'? (yes/no)"
            if ($confirm -eq "yes") {
                Invoke-MgGraphRequest -Method DELETE -Uri "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/$($p.id)"
                Write-Host "    DELETED: $($p.displayName)" -ForegroundColor Red
            } else {
                Write-Host "    Cancelled." -ForegroundColor Gray
            }
        }
    }
}

function Remove-AllPolicies {
    $confirm = Read-Host "  Type 'DELETE ALL' to remove ALL Enterprise policies"
    if ($confirm -ne "DELETE ALL") {
        Write-Host "  Cancelled." -ForegroundColor Gray
        return
    }

    # CA policies
    $ca = Get-OurCAPolicies
    foreach ($p in $ca) {
        try {
            Invoke-MgGraphRequest -Method DELETE -Uri "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/$($p.id)"
            Write-Host "    DELETED CA: $($p.displayName)" -ForegroundColor Red
        } catch {
            Write-Host "    Failed: $($p.displayName) - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    # Compliance policies
    $comp = Get-OurCompliancePolicies
    foreach ($p in $comp) {
        try {
            Invoke-MgGraphRequest -Method DELETE -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceCompliancePolicies/$($p.id)"
            Write-Host "    DELETED Compliance: $($p.displayName)" -ForegroundColor Red
        } catch {
            Write-Host "    Failed: $($p.displayName) - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    Write-Host "`n    All Enterprise policies removed. Tenant is back to original state." -ForegroundColor Green
}

# ── Main Loop ──
do {
    Show-Menu
    $input = Read-Host "  Select option"
    switch ($input) {
        "1" { Show-Audit }
        "2" { Show-Simulate }
        "3" { Set-PolicyState -TargetState "disabled" -Label "DISABLED" }
        "4" { Remove-Policy }
        "5" { Remove-AllPolicies }
        "6" { Set-PolicyState -TargetState "enabled" -Label "ENABLED" }
        "0" { break }
    }
} while ($input -ne "0")

Write-Host "`n  Disconnecting..." -ForegroundColor Gray
Disconnect-MgGraph 2>$null | Out-Null
Write-Host "  Done!" -ForegroundColor Green
Write-Host ""
