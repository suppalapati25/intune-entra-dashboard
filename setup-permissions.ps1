# Add Intune/Device API permissions and redirect URI to existing Azure AD App Registration
# Uses Microsoft Graph PowerShell SDK

$ErrorActionPreference = "Stop"

$tenantId = "3f6dd2a4-41aa-4714-a2ff-8a36aa8ded71"
$clientId = "3a65dee4-7af5-4bd9-b715-a7e160f363d4"
$redirectUri = "http://localhost:3001/api/auth/callback"

# Microsoft Graph API resource ID
$graphResourceId = "00000003-0000-0000-c000-000000000000"

# Required delegated permission IDs (Microsoft Graph)
$requiredPermissions = @(
    @{ Id = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"; Type = "Scope" }, # User.Read
    @{ Id = "f51be20a-0571-4572-bb3f-fdd3f487c400"; Type = "Scope" }, # DeviceManagementManagedDevices.Read.All
    @{ Id = "4edf5f54-4c14-4b17-9baf-e0b42571a9a0"; Type = "Scope" }, # DeviceManagementConfiguration.Read.All
    @{ Id = "951183d1-1a61-466f-a6d1-1fde911bfd95"; Type = "Scope" }, # Device.Read.All
    @{ Id = "06da0dbc-49e2-44d2-8312-53f166ab848a"; Type = "Scope" }  # Directory.Read.All
)

Write-Host "`n  Configuring Azure AD App Registration for Intune Dashboard" -ForegroundColor Cyan
Write-Host "  =========================================================`n"

# Check if Microsoft.Graph module is installed
if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Applications)) {
    Write-Host "  Installing Microsoft.Graph.Applications module..." -ForegroundColor Yellow
    Install-Module Microsoft.Graph.Applications -Scope CurrentUser -Force -AllowClobber
}

# Connect to Microsoft Graph
Write-Host "  Connecting to Microsoft Graph (browser login will open)..." -ForegroundColor Yellow
Connect-MgGraph -TenantId $tenantId -Scopes "Application.ReadWrite.All" -NoWelcome

# Get the app
Write-Host "  Finding app registration $clientId..." -ForegroundColor Yellow
$app = Get-MgApplication -Filter "appId eq '$clientId'"

if (-not $app) {
    Write-Host "  ERROR: App registration not found!" -ForegroundColor Red
    exit 1
}

Write-Host "  Found: $($app.DisplayName)" -ForegroundColor Green

# --- Add redirect URI ---
Write-Host "  Adding redirect URI: $redirectUri..." -ForegroundColor Yellow
$currentRedirects = $app.Web.RedirectUris
if ($currentRedirects -notcontains $redirectUri) {
    $updatedRedirects = @($currentRedirects) + @($redirectUri)
    Update-MgApplication -ApplicationId $app.Id -Web @{ RedirectUris = $updatedRedirects }
    Write-Host "  Redirect URI added!" -ForegroundColor Green
} else {
    Write-Host "  Redirect URI already exists, skipping." -ForegroundColor Gray
}

# --- Add API permissions ---
Write-Host "  Adding Intune/Device API permissions..." -ForegroundColor Yellow

$currentResources = $app.RequiredResourceAccess

# Find existing Microsoft Graph entry or create new one
$graphEntry = $currentResources | Where-Object { $_.ResourceAppId -eq $graphResourceId }

if ($graphEntry) {
    $existingIds = $graphEntry.ResourceAccess | ForEach-Object { $_.Id }
    $newPerms = @()
    foreach ($perm in $requiredPermissions) {
        if ($existingIds -notcontains $perm.Id) {
            $newPerms += [Microsoft.Graph.PowerShell.Models.MicrosoftGraphResourceAccess]@{
                Id   = $perm.Id
                Type = $perm.Type
            }
        }
    }
    
    if ($newPerms.Count -gt 0) {
        $allPerms = @($graphEntry.ResourceAccess) + $newPerms
        $graphEntry.ResourceAccess = $allPerms
        
        # Update the full required resource access list
        $updatedResources = @()
        foreach ($res in $currentResources) {
            if ($res.ResourceAppId -eq $graphResourceId) {
                $updatedResources += $graphEntry
            } else {
                $updatedResources += $res
            }
        }
        
        Update-MgApplication -ApplicationId $app.Id -RequiredResourceAccess $updatedResources
        Write-Host "  Added $($newPerms.Count) new permission(s)!" -ForegroundColor Green
    } else {
        Write-Host "  All permissions already configured, skipping." -ForegroundColor Gray
    }
} else {
    # No Graph entry exists, create new one
    $resourceAccess = $requiredPermissions | ForEach-Object {
        [Microsoft.Graph.PowerShell.Models.MicrosoftGraphResourceAccess]@{
            Id   = $_.Id
            Type = $_.Type
        }
    }
    $newGraphEntry = [Microsoft.Graph.PowerShell.Models.MicrosoftGraphRequiredResourceAccess]@{
        ResourceAppId  = $graphResourceId
        ResourceAccess = $resourceAccess
    }
    $updatedResources = @($currentResources) + @($newGraphEntry)
    Update-MgApplication -ApplicationId $app.Id -RequiredResourceAccess $updatedResources
    Write-Host "  Added Microsoft Graph permissions entry!" -ForegroundColor Green
}

# --- Grant admin consent ---
Write-Host "  Granting admin consent..." -ForegroundColor Yellow
$sp = Get-MgServicePrincipal -Filter "appId eq '$clientId'"
$graphSp = Get-MgServicePrincipal -Filter "appId eq '$graphResourceId'"

foreach ($perm in $requiredPermissions) {
    try {
        $existing = Get-MgOauth2PermissionGrant -Filter "clientId eq '$($sp.Id)' and resourceId eq '$($graphSp.Id)'" -ErrorAction SilentlyContinue
        if (-not $existing) {
            New-MgOauth2PermissionGrant -ClientId $sp.Id -ResourceId $graphSp.Id -ConsentType "AllPrincipals" -Scope ($requiredPermissions | ForEach-Object {
                # Map IDs to scope names
                switch ($_.Id) {
                    "e1fe6dd8-ba31-4d61-89e7-88639da4683d" { "User.Read" }
                    "f51be20a-0571-4572-bb3f-fdd3f487c400" { "DeviceManagementManagedDevices.Read.All" }
                    "4edf5f54-4c14-4b17-9baf-e0b42571a9a0" { "DeviceManagementConfiguration.Read.All" }
                    "951183d1-1a61-466f-a6d1-1fde911bfd95" { "Device.Read.All" }
                    "06da0dbc-49e2-44d2-8312-53f166ab848a" { "Directory.Read.All" }
                }
            } | Join-String -Separator " ") | Out-Null
            Write-Host "  Admin consent granted!" -ForegroundColor Green
        } else {
            # Update existing grant to include new scopes
            $currentScope = $existing.Scope
            $allScopes = @("User.Read", "DeviceManagementManagedDevices.Read.All", "DeviceManagementConfiguration.Read.All", "Device.Read.All", "Directory.Read.All")
            $currentScopeList = $currentScope -split " "
            $newScopes = ($currentScopeList + $allScopes | Select-Object -Unique) -join " "
            
            if ($newScopes -ne $currentScope) {
                Update-MgOauth2PermissionGrant -OAuth2PermissionGrantId $existing.Id -Scope $newScopes
                Write-Host "  Admin consent updated with new scopes!" -ForegroundColor Green
            } else {
                Write-Host "  Admin consent already includes all scopes." -ForegroundColor Gray
            }
        }
        break  # Only need to do this once
    } catch {
        Write-Host "  Warning: Could not auto-grant consent: $_" -ForegroundColor Yellow
        Write-Host "  You may need to grant consent manually in Azure Portal." -ForegroundColor Yellow
    }
}

Write-Host "`n  Setup complete!`n" -ForegroundColor Green
Write-Host "  Your Intune Dashboard is ready at: http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Restart the server if it's already running.`n"

Disconnect-MgGraph | Out-Null
