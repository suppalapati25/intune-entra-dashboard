# ============================================================
# Enterprise Compliance Policy Deployment Script
# Creates best-practice compliance policies in Microsoft Intune
# via Microsoft Graph API
# ============================================================

$ErrorActionPreference = "Continue"

$tenantId  = "3f6dd2a4-41aa-4714-a2ff-8a36aa8ded71"
$clientId  = "3a65dee4-7af5-4bd9-b715-a7e160f363d4"

Write-Host "`n  =====================================================" -ForegroundColor Cyan
Write-Host "   Enterprise Compliance Policy Deployment" -ForegroundColor Cyan
Write-Host "  =====================================================`n" -ForegroundColor Cyan

# ── Step 1: Add ReadWrite permission to app registration ──
Write-Host "  [Step 1/4] Adding ReadWrite permission to app registration..." -ForegroundColor Yellow

Connect-MgGraph -TenantId $tenantId -Scopes @(
    "Application.ReadWrite.All",
    "DeviceManagementConfiguration.ReadWrite.All"
) -NoWelcome

$app = Get-MgApplication -Filter "appId eq '$clientId'"
Write-Host "    App: $($app.DisplayName)" -ForegroundColor Gray

# Add DeviceManagementConfiguration.ReadWrite.All (delegated) permission
$graphResourceId = "00000003-0000-0000-c000-000000000000"
$rwPermId = "0883f392-0a7a-443d-8c76-16a6d39c7b63"  # DeviceManagementConfiguration.ReadWrite.All

$currentResources = $app.RequiredResourceAccess
$graphEntry = $currentResources | Where-Object { $_.ResourceAppId -eq $graphResourceId }

if ($graphEntry) {
    $existingIds = $graphEntry.ResourceAccess | ForEach-Object { $_.Id }
    if ($existingIds -notcontains $rwPermId) {
        $newPerm = [Microsoft.Graph.PowerShell.Models.MicrosoftGraphResourceAccess]@{
            Id   = $rwPermId
            Type = "Scope"
        }
        $allPerms = @($graphEntry.ResourceAccess) + @($newPerm)
        $graphEntry.ResourceAccess = $allPerms

        $updatedResources = @()
        foreach ($res in $currentResources) {
            if ($res.ResourceAppId -eq $graphResourceId) {
                $updatedResources += $graphEntry
            } else {
                $updatedResources += $res
            }
        }
        Update-MgApplication -ApplicationId $app.Id -RequiredResourceAccess $updatedResources
        Write-Host "    Added ReadWrite permission!" -ForegroundColor Green
    } else {
        Write-Host "    ReadWrite permission already exists." -ForegroundColor Gray
    }
}

# Grant admin consent for the new scope
Write-Host "    Granting admin consent..." -ForegroundColor Yellow
$sp = Get-MgServicePrincipal -Filter "appId eq '$clientId'"
$graphSp = Get-MgServicePrincipal -Filter "appId eq '$graphResourceId'"
$existing = Get-MgOauth2PermissionGrant -Filter "clientId eq '$($sp.Id)' and resourceId eq '$($graphSp.Id)'" -ErrorAction SilentlyContinue
if ($existing) {
    $currentScope = $existing.Scope
    if ($currentScope -notmatch "DeviceManagementConfiguration.ReadWrite.All") {
        $newScope = "$currentScope DeviceManagementConfiguration.ReadWrite.All"
        Update-MgOauth2PermissionGrant -OAuth2PermissionGrantId $existing.Id -Scope $newScope
        Write-Host "    Admin consent updated!" -ForegroundColor Green
    } else {
        Write-Host "    Admin consent already granted." -ForegroundColor Gray
    }
}

# ── Step 2: Create Windows 10/11 Enterprise Compliance Policy ──
Write-Host "`n  [Step 2/4] Creating Windows 10/11 compliance policy..." -ForegroundColor Yellow

$windowsPolicy = @{
    "@odata.type"       = "#microsoft.graph.windows10CompliancePolicy"
    displayName         = "Enterprise - Windows 10/11 Security Baseline"
    description         = "Enterprise-grade compliance policy enforcing encryption, firewall, antivirus, OS updates, password complexity, and secure boot. Non-compliant devices are blocked from corporate resources via Conditional Access."

    # ── OS Version Requirements ──
    osMinimumVersion    = "10.0.19045"    # Minimum: Windows 10 22H2
    mobileOsMinimumVersion = "10.0.19045"

    # ── Password Requirements ──
    passwordRequired              = $true
    passwordMinimumLength         = 8
    passwordRequiredType          = "alphanumeric"    # Require letters + numbers
    passwordMinutesOfInactivityBeforeLock = 15         # Lock after 15 min idle
    passwordExpirationDays        = 90                 # Force change every 90 days
    passwordPreviousPasswordBlockCount = 5             # Remember last 5 passwords

    # ── Encryption ──
    bitLockerEnabled    = $true           # Require BitLocker disk encryption
    storageRequireEncryption = $true      # Require storage encryption

    # ── Device Security ──
    secureBootEnabled   = $true           # Require UEFI Secure Boot
    tpmRequired         = $true           # Require TPM 2.0 chip
    codeIntegrityEnabled = $true          # Require code integrity (HVCI)

    # ── Firewall ──
    activeFirewallRequired = $true        # Windows Firewall must be ON

    # ── Antivirus & Anti-spyware ──
    antivirusRequired       = $true       # Antivirus must be active
    antiSpywareRequired     = $true       # Anti-spyware must be active
    defenderEnabled         = $true       # Microsoft Defender must be running
    rtpEnabled              = $true       # Real-time protection ON
    signatureOutOfDate      = $false      # Definitions must be current

    # ── Actions for non-compliance ──
    scheduledActionsForRule = @(
        @{
            ruleName = "PasswordRequired"
            scheduledActionConfigurations = @(
                @{
                    actionType              = "block"
                    gracePeriodHours        = 72   # 3-day grace period before blocking
                    notificationTemplateId  = ""
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-MgGraphRequest -Method POST `
        -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceCompliancePolicies" `
        -Body $windowsPolicy `
        -ContentType "application/json"
    Write-Host "    Created: $($result.displayName) (ID: $($result.id))" -ForegroundColor Green
} catch {
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ── Step 3: Create iOS/iPadOS Enterprise Compliance Policy ──
Write-Host "`n  [Step 3/4] Creating iOS/iPadOS compliance policy..." -ForegroundColor Yellow

$iosPolicy = @{
    "@odata.type"       = "#microsoft.graph.iosCompliancePolicy"
    displayName         = "Enterprise - iOS/iPadOS Security Baseline"
    description         = "Enterprise-grade compliance policy for iOS and iPadOS devices. Enforces minimum OS version, passcode requirements, jailbreak detection, and managed email profile."

    # ── OS Version ──
    osMinimumVersion    = "16.0"          # Minimum iOS 16

    # ── Passcode ──
    passcodeRequired              = $true
    passcodeMinimumLength         = 6
    passcodeBlockSimple           = $true  # Block simple passcodes (1234, 1111)
    passcodeRequiredType          = "alphanumeric"
    passcodeMinutesOfInactivityBeforeLock = 5
    passcodeExpirationDays        = 90
    passcodePreviousPasscodeBlockCount = 5

    # ── Security ──
    securityBlockJailbrokenDevices = $true  # Block jailbroken devices
    managedEmailProfileRequired    = $true  # Require managed email

    # ── Actions for non-compliance ──
    scheduledActionsForRule = @(
        @{
            ruleName = "PasswordRequired"
            scheduledActionConfigurations = @(
                @{
                    actionType              = "block"
                    gracePeriodHours        = 24   # 1-day grace period
                    notificationTemplateId  = ""
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-MgGraphRequest -Method POST `
        -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceCompliancePolicies" `
        -Body $iosPolicy `
        -ContentType "application/json"
    Write-Host "    Created: $($result.displayName) (ID: $($result.id))" -ForegroundColor Green
} catch {
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ── Step 4: Create Android Enterprise Compliance Policy ──
Write-Host "`n  [Step 4/4] Creating Android compliance policy..." -ForegroundColor Yellow

$androidPolicy = @{
    "@odata.type"       = "#microsoft.graph.androidCompliancePolicy"
    displayName         = "Enterprise - Android Security Baseline"
    description         = "Enterprise-grade compliance policy for Android devices. Enforces minimum OS version, password requirements, encryption, rooting detection, and blocks apps from unknown sources."

    # ── OS Version ──
    osMinimumVersion    = "13.0"          # Minimum Android 13

    # ── Password ──
    passwordRequired              = $true
    passwordMinimumLength         = 6
    passwordRequiredType          = "alphanumeric"
    passwordMinutesOfInactivityBeforeLock = 5
    passwordExpirationDays        = 90
    passwordPreviousPasswordBlockCount = 5

    # ── Security ──
    securityBlockJailbrokenDevices  = $true   # Block rooted devices
    storageRequireEncryption        = $true   # Require encryption
    securityPreventInstallAppsFromUnknownSources = $true  # Block sideloading

    # ── Actions for non-compliance ──
    scheduledActionsForRule = @(
        @{
            ruleName = "PasswordRequired"
            scheduledActionConfigurations = @(
                @{
                    actionType              = "block"
                    gracePeriodHours        = 24
                    notificationTemplateId  = ""
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-MgGraphRequest -Method POST `
        -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceCompliancePolicies" `
        -Body $androidPolicy `
        -ContentType "application/json"
    Write-Host "    Created: $($result.displayName) (ID: $($result.id))" -ForegroundColor Green
} catch {
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ── Done ──
Write-Host "`n  =====================================================" -ForegroundColor Cyan
Write-Host "   Deployment Complete!" -ForegroundColor Green
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3 enterprise compliance policies created:" -ForegroundColor White
Write-Host "    1. Windows 10/11 Security Baseline" -ForegroundColor White
Write-Host "    2. iOS/iPadOS Security Baseline" -ForegroundColor White
Write-Host "    3. Android Security Baseline" -ForegroundColor White
Write-Host ""
Write-Host "  IMPORTANT: These policies are created but NOT yet assigned" -ForegroundColor Yellow
Write-Host "  to any device groups. You need to assign them in Intune" -ForegroundColor Yellow
Write-Host "  Admin Center to start enforcing them." -ForegroundColor Yellow
Write-Host ""
Write-Host "  View them at: https://intune.microsoft.com/#view/" -ForegroundColor Cyan
Write-Host "    Microsoft_Intune_DeviceSettings/DevicesComplianceMenu/policies" -ForegroundColor Cyan
Write-Host ""

Disconnect-MgGraph 2>$null | Out-Null
