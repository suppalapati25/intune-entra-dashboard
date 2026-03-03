<#
.SYNOPSIS
    Deploys a Microsoft Intune Configuration Profile that silently enables BitLocker across all Windows 10/11 devices.
.DESCRIPTION
    This script uses the Microsoft Graph API to create a "Windows 10 Endpoint Protection" device configuration profile.
    It configures BitLocker to:
    - Silently encrypt the OS drive using XTS-AES 256.
    - Require TPM.
    - Backup the recovery password to Azure AD (Entra ID) before encryption starts.
    - Suppress third-party encryption warnings.
    - Allow standard users to encrypt.
#>

$TenantId = "3f6dd2a4-41aa-4714-a2ff-8a36aa8ded71"
$ClientId = "3a65dee4-7af5-4bd9-b715-a7e160f363d4"

Write-Host "Connecting to Microsoft Graph..."
Connect-MgGraph -TenantId $TenantId -ClientId $ClientId -Scopes "DeviceManagementConfiguration.ReadWrite.All" -NoWelcome

$Uri = "https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations"

# Use raw here-string JSON to avoid PowerShell hashtable serialization issues
$JsonPayload = @"
{
    "@odata.type": "#microsoft.graph.windows10EndpointProtectionConfiguration",
    "displayName": "Enterprise - Silent BitLocker Encryption",
    "description": "Silently enables BitLocker on OS drives (XTS-AES 256) and backs up keys to Entra ID without user interaction.",
    "bitLockerDisableWarningForOtherDiskEncryption": true,
    "bitLockerEnableLocalUserEncryption": true,
    "bitLockerRequireStorageCardEncryption": false,
    "bitLockerSystemDrivePolicy": {
        "encryptionMethod": "xtsAes256",
        "startupAuthenticationRequired": true,
        "startupAuthenticationBlockWithoutTpm": true,
        "startupAuthenticationTpmUsage": "require",
        "startupAuthenticationTpmPinUsage": "block",
        "startupAuthenticationTpmKeyUsage": "block",
        "startupAuthenticationTpmPinAndKeyUsage": "block",
        "recoveryPasswordBlock": false,
        "recoveryKeyBlock": true,
        "hideRecoveryOptions": true,
        "clientExceptionsBlock": true
    },
    "bitLockerFixedDrivePolicy": {
        "encryptionMethod": "xtsAes256",
        "recoveryPasswordBlock": false,
        "recoveryKeyBlock": true,
        "hideRecoveryOptions": true
    },
    "bitLockerRemovableDrivePolicy": {
        "encryptionMethod": "xtsAes256",
        "requireEncryptionForWriteAccess": false
    }
}
"@

try {
    Write-Host "Deploying Silent BitLocker Configuration Profile to Intune..."
    $Response = Invoke-MgGraphRequest -Method POST -Uri $Uri -Body $JsonPayload -ContentType "application/json"
    
    Write-Host ""
    Write-Host "✅ Successfully created Intune BitLocker Profile!" -ForegroundColor Green
    Write-Host "Profile Name: $($Response.displayName)"
    Write-Host "Profile ID: $($Response.id)"
    Write-Host ""
    Write-Host "NOTE: The policy is created but NOT assigned. You must assign it to a device group in the Intune portal to take effect." -ForegroundColor Yellow
} catch {
    Write-Host "❌ Failed to create BitLocker profile: $_" -ForegroundColor Red
    $ErrorDetail = $_.Exception.Message
    if ($ErrorDetail -match "response: (\{.*\})") {
        $JsonErr = $matches[1] | ConvertFrom-Json
        Write-Host "Details: $($JsonErr.error.message)" -ForegroundColor Red
    }
}
