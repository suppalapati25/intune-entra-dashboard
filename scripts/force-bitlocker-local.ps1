<#
.SYNOPSIS
    Silently enables BitLocker on the OS drive and backs up the recovery key to Microsoft Entra ID (Azure AD).
.DESCRIPTION
    This script is designed to be deployed remotely via Microsoft Intune (Devices -> Scripts) or any RMM tool.
    It checks if the OS drive is already encrypted. If not, it verifies TPM presence, enables BitLocker with 
    XTS-AES 256, and immediately backs up the recovery password to Entra ID.
#>

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message)
    $Stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Write-Output "[$Stamp] $Message"
}

Write-Log "--- Starting BitLocker silent enablement script ---"

# 1. Check if BitLocker is already enabled
try {
    $Drive = Get-BitLockerVolume -MountPoint $env:SystemDrive
    if ($Drive.VolumeStatus -eq "FullyEncrypted" -or $Drive.VolumeStatus -eq "EncryptionInProgress") {
        Write-Log "BitLocker is already enabled or currently encrypting on $($env:SystemDrive)."
        exit 0
    }
} catch {
    Write-Log "WARNING: Could not get BitLocker volume status. Ensure the BitLocker module is available."
}

# 2. Check TPM Status
try {
    $Tpm = Get-Tpm
    if (-not $Tpm.TpmPresent -or -not $Tpm.TpmReady) {
        Write-Log "ERROR: TPM is not present or not ready. Cannot silently enable BitLocker without TPM."
        exit 1
    }
    Write-Log "TPM is ready and provisioned."
} catch {
    Write-Log "ERROR: Failed to query TPM status. Run as Administrator."
    exit 1
}

# 3. Enable BitLocker with TPM protector and XTS-AES 256
try {
    Write-Log "Starting BitLocker encryption (Used Space Only, XTS-AES 256, TPM Protector)..."
    # Using -SkipHardwareTest to allow script to proceed silently without rebooting immediately
    Enable-BitLocker -MountPoint $env:SystemDrive -EncryptionMethod XtsAes256 -TpmProtector -UsedSpaceOnly -SkipHardwareTest -ErrorAction Stop
    Write-Log "BitLocker encryption initiated successfully."
} catch {
    Write-Log "ERROR: Failed to enable BitLocker: $_"
    exit 1
}

# 4. Backup Recovery Key to Entra ID
try {
    Write-Log "Configuring Recovery Password and backing up to Entra ID..."
    
    # Reload drive state
    $Drive = Get-BitLockerVolume -MountPoint $env:SystemDrive
    $KeyProtector = ($Drive | Select-Object -ExpandProperty KeyProtector | Where-Object { $_.KeyProtectorType -eq 'RecoveryPassword' })
    
    # Add Recovery Password if it doesn't exist
    if (-not $KeyProtector) {
        Write-Log "Adding Recovery Password protector..."
        Add-BitLockerKeyProtector -MountPoint $env:SystemDrive -RecoveryPasswordProtector | Out-Null
        $Drive = Get-BitLockerVolume -MountPoint $env:SystemDrive
        $KeyProtector = ($Drive | Select-Object -ExpandProperty KeyProtector | Where-Object { $_.KeyProtectorType -eq 'RecoveryPassword' })
    }

    if ($KeyProtector) {
        BackupToAAD-BitLockerKeyProtector -MountPoint $env:SystemDrive -KeyProtectorId $KeyProtector.KeyProtectorId
        Write-Log "✅ Successfully backed up recovery key to Entra ID."
    } else {
        Write-Log "WARNING: Could not find or create a RecoveryPassword protector to backup."
    }
} catch {
    Write-Log "WARNING: Failed to backup key to Entra ID: $_"
}

Write-Log "--- Script completed successfully ---"
exit 0
