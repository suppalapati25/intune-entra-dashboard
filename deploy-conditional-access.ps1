<#
.SYNOPSIS
  Enterprise Conditional Access Policy Deployment
  Creates 5 best-practice CA policies in Microsoft Entra ID via Graph API

.NOTES
  All policies are deployed in REPORT-ONLY mode (safe, doesn't block anyone).
#>

$ErrorActionPreference = "Continue"
$tenantId = "3f6dd2a4-41aa-4714-a2ff-8a36aa8ded71"
$clientId = "3a65dee4-7af5-4bd9-b715-a7e160f363d4"

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "   Conditional Access Policy Deployment" -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

# ── Connect ──
Write-Host "  [Step 1] Connecting to Microsoft Graph..." -ForegroundColor Yellow
Connect-MgGraph -TenantId $tenantId -Scopes "Application.ReadWrite.All","Policy.ReadWrite.ConditionalAccess","Policy.Read.All" -NoWelcome
Write-Host "    Connected!" -ForegroundColor Green

# ── Add permission to app registration ──
Write-Host "  [Step 2] Updating app permissions..." -ForegroundColor Yellow
$app = Get-MgApplication -Filter "appId eq '$clientId'"
Write-Host "    App: $($app.DisplayName)" -ForegroundColor Gray

$graphId = "00000003-0000-0000-c000-000000000000"
$caPermId = "ad902697-1014-4ef5-81ef-2b4301988e8c"
$graphEntry = $app.RequiredResourceAccess | Where-Object { $_.ResourceAppId -eq $graphId }
$existingIds = @()
if ($graphEntry) { $existingIds = $graphEntry.ResourceAccess | ForEach-Object { $_.Id } }
if ($existingIds -notcontains $caPermId) {
    $newPerm = [Microsoft.Graph.PowerShell.Models.MicrosoftGraphResourceAccess]@{ Id = $caPermId; Type = "Scope" }
    $graphEntry.ResourceAccess = @($graphEntry.ResourceAccess) + @($newPerm)
    $all = @()
    foreach ($r in $app.RequiredResourceAccess) {
        if ($r.ResourceAppId -eq $graphId) { $all += $graphEntry } else { $all += $r }
    }
    Update-MgApplication -ApplicationId $app.Id -RequiredResourceAccess $all
    Write-Host "    Added CA permission!" -ForegroundColor Green
} else {
    Write-Host "    Permission already present." -ForegroundColor Gray
}

# Grant consent
$sp = Get-MgServicePrincipal -Filter "appId eq '$clientId'"
$graphSp = Get-MgServicePrincipal -Filter "appId eq '$graphId'"
$grant = Get-MgOauth2PermissionGrant -Filter "clientId eq '$($sp.Id)' and resourceId eq '$($graphSp.Id)'" -ErrorAction SilentlyContinue
if ($grant -and $grant.Scope -notmatch "Policy.ReadWrite.ConditionalAccess") {
    $updated = $grant.Scope + " Policy.ReadWrite.ConditionalAccess Policy.Read.All"
    Update-MgOauth2PermissionGrant -OAuth2PermissionGrantId $grant.Id -Scope $updated
    Write-Host "    Consent updated!" -ForegroundColor Green
} else {
    Write-Host "    Consent already granted." -ForegroundColor Gray
}

# ── Helper to create a policy ──
function New-CAPolicy {
    param([string]$JsonBody, [string]$Name)
    try {
        $result = Invoke-MgGraphRequest -Method POST -Uri "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" -Body $JsonBody -ContentType "application/json"
        Write-Host "    Created: $Name" -ForegroundColor Green
        Write-Host "    ID: $($result.id)  |  State: REPORT-ONLY" -ForegroundColor Gray
    } catch {
        Write-Host "    Error creating ${Name}: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ══════════════════════════════════════════════════════════════
# POLICY 1: Require MFA for All Users
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  [Step 3] Creating: Require MFA for All Users..." -ForegroundColor Yellow

$json1 = @'
{
    "displayName": "Enterprise - Require MFA for All Users",
    "state": "enabledForReportingButNotEnforced",
    "conditions": {
        "users": { "includeUsers": ["All"] },
        "applications": { "includeApplications": ["All"] },
        "clientAppTypes": ["browser", "mobileAppsAndDesktopClients"]
    },
    "grantControls": {
        "operator": "OR",
        "builtInControls": ["mfa"]
    }
}
'@
New-CAPolicy -JsonBody $json1 -Name "Require MFA for All Users"

# ══════════════════════════════════════════════════════════════
# POLICY 2: Require Compliant Device
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  [Step 4] Creating: Require Compliant Device..." -ForegroundColor Yellow

$json2 = @'
{
    "displayName": "Enterprise - Require Compliant Device",
    "state": "enabledForReportingButNotEnforced",
    "conditions": {
        "users": { "includeUsers": ["All"] },
        "applications": { "includeApplications": ["All"] },
        "platforms": { "includePlatforms": ["android", "iOS", "windows"] },
        "clientAppTypes": ["browser", "mobileAppsAndDesktopClients"]
    },
    "grantControls": {
        "operator": "OR",
        "builtInControls": ["compliantDevice"]
    }
}
'@
New-CAPolicy -JsonBody $json2 -Name "Require Compliant Device"

# ══════════════════════════════════════════════════════════════
# POLICY 3: Block Legacy Authentication
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  [Step 5] Creating: Block Legacy Authentication..." -ForegroundColor Yellow

$json3 = @'
{
    "displayName": "Enterprise - Block Legacy Authentication",
    "state": "enabledForReportingButNotEnforced",
    "conditions": {
        "users": { "includeUsers": ["All"] },
        "applications": { "includeApplications": ["All"] },
        "clientAppTypes": ["exchangeActiveSync", "other"]
    },
    "grantControls": {
        "operator": "OR",
        "builtInControls": ["block"]
    }
}
'@
New-CAPolicy -JsonBody $json3 -Name "Block Legacy Authentication"

# ══════════════════════════════════════════════════════════════
# POLICY 4: Require MFA for Admin Roles
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  [Step 6] Creating: Require MFA for Admin Roles..." -ForegroundColor Yellow

$json4 = @'
{
    "displayName": "Enterprise - Require MFA for Admins",
    "state": "enabledForReportingButNotEnforced",
    "conditions": {
        "users": {
            "includeRoles": [
                "62e90394-69f5-4237-9190-012177145e10",
                "e8611ab8-c189-46e8-94e1-60213ab1f814",
                "194ae4cb-b126-40b2-bd5b-6091b380977d",
                "b1be1c3e-b65d-4f19-8427-f6fa0d97feb9",
                "29232cdf-9323-42fd-ade2-1d097af3e4de",
                "f28a1f50-f6e7-4571-818b-6a12f2af6b6c",
                "fe930be7-5e62-47db-91af-98c3a49a38b1",
                "c4e39bd9-1100-46d3-8c65-fb160da0071f",
                "3a2c62db-5318-420d-8d74-23affee5d9d5"
            ]
        },
        "applications": { "includeApplications": ["All"] },
        "clientAppTypes": ["browser", "mobileAppsAndDesktopClients"]
    },
    "grantControls": {
        "operator": "AND",
        "builtInControls": ["mfa"]
    }
}
'@
New-CAPolicy -JsonBody $json4 -Name "Require MFA for Admins"

# ══════════════════════════════════════════════════════════════
# POLICY 5: Block High-Risk Sign-Ins
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  [Step 7] Creating: Block High-Risk Sign-Ins..." -ForegroundColor Yellow

$json5 = @'
{
    "displayName": "Enterprise - Block High-Risk Sign-Ins",
    "state": "enabledForReportingButNotEnforced",
    "conditions": {
        "users": { "includeUsers": ["All"] },
        "applications": { "includeApplications": ["All"] },
        "signInRiskLevels": ["high"],
        "clientAppTypes": ["browser", "mobileAppsAndDesktopClients"]
    },
    "grantControls": {
        "operator": "OR",
        "builtInControls": ["block"]
    }
}
'@
New-CAPolicy -JsonBody $json5 -Name "Block High-Risk Sign-Ins"

# ── Summary ──
Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Green
Write-Host "   Deployment Complete!" -ForegroundColor Green
Write-Host "  =====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  5 CA policies created in REPORT-ONLY mode:" -ForegroundColor White
Write-Host "    1. Require MFA for All Users" -ForegroundColor White
Write-Host "    2. Require Compliant Device" -ForegroundColor White
Write-Host "    3. Block Legacy Authentication" -ForegroundColor White
Write-Host "    4. Require MFA for Admin Roles" -ForegroundColor White
Write-Host "    5. Block High-Risk Sign-Ins" -ForegroundColor White
Write-Host ""
Write-Host "  REPORT-ONLY = logs what WOULD happen, blocks nobody." -ForegroundColor Yellow
Write-Host "  Review impact, then switch to 'On' when ready." -ForegroundColor Yellow
Write-Host ""
Write-Host "  View them: https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess/ConditionalAccessBlade/Policies" -ForegroundColor Cyan
Write-Host ""

Disconnect-MgGraph 2>$null | Out-Null
