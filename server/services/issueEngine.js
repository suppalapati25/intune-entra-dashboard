/**
 * Device Issue Detection & Remediation Engine
 * Analyzes Intune managed device data and returns issues with detailed remediation steps.
 */

const ISSUE_DEFINITIONS = [
    {
        id: 'non-compliant',
        category: 'Compliance',
        severity: 'critical',
        title: 'Device Non-Compliant',
        check: (d) => d.complianceState === 'noncompliant',
        getDescription: (d) =>
            `Device "${d.deviceName}" is marked as non-compliant with organizational policies. This means the device does not meet one or more required security or configuration standards set by your IT administrator.`,
        remediation: [
            'Open the Company Portal app on the affected device and check which policies are failing.',
            'Navigate to Intune Admin Center → Devices → Compliance policies to see which specific settings are not met.',
            'Common causes include: outdated OS, missing encryption, weak password policy, or missing required apps.',
            'On the device, go to Settings → Update & Security → Windows Update and install all pending updates.',
            'Ensure BitLocker encryption is enabled: Settings → Update & Security → Device encryption.',
            'Verify antivirus (Windows Defender) is active and definitions are up to date.',
            'After making changes, open Company Portal and tap "Check status" to trigger a re-evaluation.',
            'If the device remains non-compliant after 24 hours, consider re-enrolling it in Intune.',
        ],
        learnMore: 'https://learn.microsoft.com/en-us/mem/intune/protect/device-compliance-get-started',
    },
    {
        id: 'os-outdated',
        category: 'Security',
        severity: 'high',
        title: 'Operating System Outdated',
        check: (d) => {
            if (!d.osVersion || !d.operatingSystem) return false;
            const os = d.operatingSystem.toLowerCase();
            const ver = d.osVersion;
            if (os === 'windows' && ver.startsWith('10.0.1')) {
                const build = parseInt(ver.split('.')[2], 10);
                return build < 19045; // Below Windows 10 22H2
            }
            if (os === 'ios' || os === 'iphone os') {
                const major = parseInt(ver.split('.')[0], 10);
                return major < 16;
            }
            if (os === 'android') {
                const major = parseInt(ver.split('.')[0], 10);
                return major < 13;
            }
            if (os === 'macos') {
                const major = parseInt(ver.split('.')[0], 10);
                return major < 13;
            }
            return false;
        },
        getDescription: (d) =>
            `Device "${d.deviceName}" is running ${d.operatingSystem} version ${d.osVersion}, which is below the recommended minimum. Outdated operating systems lack critical security patches and may be vulnerable to known exploits.`,
        remediation: [
            'Windows: Go to Settings → Update & Security → Windows Update → Check for updates. Install all available updates including feature updates.',
            'iOS: Go to Settings → General → Software Update and install the latest version.',
            'Android: Go to Settings → System → System Update and check for updates.',
            'macOS: Go to System Preferences → Software Update and install available updates.',
            'If the device cannot update (hardware too old), consider replacing it with a newer model that supports current OS versions.',
            'In Intune, you can create Update Rings (Windows) or Update policies (iOS/macOS) to enforce automatic updates.',
            'Consider setting up Windows Update for Business to manage update deployment across your fleet.',
            'Schedule updates during off-hours to minimize user disruption using Intune update rings.',
        ],
        learnMore: 'https://learn.microsoft.com/en-us/mem/intune/protect/windows-update-for-business-configure',
    },
    {
        id: 'stale-device',
        category: 'Management',
        severity: 'medium',
        title: 'Stale Device (No Recent Sync)',
        check: (d) => {
            if (!d.lastSyncDateTime) return true;
            const lastSync = new Date(d.lastSyncDateTime);
            const daysSince = (new Date() - lastSync) / (1000 * 60 * 60 * 24);
            return daysSince > 30;
        },
        getDescription: (d) => {
            const lastSync = d.lastSyncDateTime
                ? new Date(d.lastSyncDateTime).toLocaleDateString()
                : 'Never';
            const daysSince = d.lastSyncDateTime
                ? Math.floor((new Date() - new Date(d.lastSyncDateTime)) / (1000 * 60 * 60 * 24))
                : 'N/A';
            return `Device "${d.deviceName}" has not synced with Intune since ${lastSync} (${daysSince} days ago). This means the device is not receiving policy updates, security configurations, or app deployments.`;
        },
        remediation: [
            'First, verify if the device is still in active use. Contact the assigned user to confirm.',
            'If the device is still in use: Open the Company Portal app and trigger a manual sync.',
            'On Windows: Go to Settings → Accounts → Access work or school → Click your account → Info → Sync.',
            'On iOS/Android: Open the Company Portal app → Devices → Select device → Check status.',
            'If the device is lost or retired: In Intune Admin Center, select the device and choose "Retire" (removes company data) or "Wipe" (factory reset).',
            'Check network connectivity on the device — Intune requires internet access to sync.',
            'Verify the device enrollment is still valid — the user may have removed the MDM profile.',
            'Consider setting up a compliance policy that marks devices as non-compliant after X days without sync.',
            'For bulk cleanup: Use Intune device cleanup rules to auto-remove devices that haven\'t synced in 90+ days.',
        ],
        learnMore: 'https://learn.microsoft.com/en-us/mem/intune/remote-actions/devices-wipe',
    },
    {
        id: 'not-encrypted',
        category: 'Security',
        severity: 'critical',
        title: 'Device Not Encrypted',
        check: (d) => d.isEncrypted === false,
        getDescription: (d) =>
            `Device "${d.deviceName}" does not have disk encryption enabled. Without encryption, data on the device can be accessed if the device is lost or stolen, posing a significant data breach risk.`,
        remediation: [
            'Windows: Enable BitLocker encryption via Settings → Update & Security → Device encryption (or BitLocker Drive Encryption in Control Panel).',
            'If BitLocker is not available, ensure the device has a TPM 2.0 chip and UEFI Secure Boot enabled in BIOS.',
            'macOS: Enable FileVault via System Preferences → Security & Privacy → FileVault tab → Turn On FileVault.',
            'iOS: Encryption is automatic when a device passcode is set. Ensure a passcode is configured.',
            'Android: Go to Settings → Security → Encrypt phone/tablet (may vary by manufacturer).',
            'Deploy an Intune Endpoint Protection configuration profile that enforces BitLocker encryption with the following recommended settings:',
            '  - Require device encryption: Yes',
            '  - BitLocker OS drive encryption method: XTS-AES 256-bit',
            '  - BitLocker fixed drive encryption: Required',
            '  - Store recovery keys in Azure AD: Yes',
            'After enabling encryption, recovery keys are automatically escrowed to Azure AD for retrieval if needed.',
            'Monitor encryption status via Intune → Devices → Monitor → Encryption report.',
        ],
        learnMore: 'https://learn.microsoft.com/en-us/mem/intune/protect/encrypt-devices',
    },
    {
        id: 'jailbroken',
        category: 'Security',
        severity: 'critical',
        title: 'Jailbroken / Rooted Device',
        check: (d) => d.jailBroken === 'True' || d.jailBroken === true,
        getDescription: (d) =>
            `Device "${d.deviceName}" has been detected as jailbroken (iOS) or rooted (Android). Jailbroken/rooted devices bypass security controls, making them highly vulnerable to malware and unauthorized access. Corporate data on this device is at significant risk.`,
        remediation: [
            'IMMEDIATE ACTION: Block the device from accessing corporate resources using Conditional Access policies.',
            'In Intune, the device should automatically be marked non-compliant if you have a compliance policy checking for jailbreak status.',
            'Contact the device owner and instruct them to restore the device to factory settings to remove the jailbreak/root.',
            'iOS: Connect to a computer, open iTunes/Finder, and restore the device. This will remove the jailbreak.',
            'Android: Flash the official firmware from the manufacturer\'s website to remove root.',
            'After restoring, re-enroll the device in Intune via Company Portal.',
            'Create a Conditional Access policy: Azure AD → Security → Conditional Access → New policy → Conditions → Device state → Exclude compliant devices.',
            'Consider implementing an Intune compliance policy with "Require device to be at or under the Device Threat Level" to automatically detect and block compromised devices.',
            'Deploy Microsoft Defender for Endpoint to detect future jailbreak/root attempts.',
        ],
        learnMore: 'https://learn.microsoft.com/en-us/mem/intune/protect/compliance-policy-create-ios',
    },
    {
        id: 'storage-critical',
        category: 'Performance',
        severity: 'medium',
        title: 'Critical Storage Space',
        check: (d) => {
            if (!d.totalStorageSpaceInBytes || !d.freeStorageSpaceInBytes) return false;
            const freePercent = (d.freeStorageSpaceInBytes / d.totalStorageSpaceInBytes) * 100;
            return freePercent < 10;
        },
        getDescription: (d) => {
            const totalGB = (d.totalStorageSpaceInBytes / (1024 ** 3)).toFixed(1);
            const freeGB = (d.freeStorageSpaceInBytes / (1024 ** 3)).toFixed(1);
            const freePercent = ((d.freeStorageSpaceInBytes / d.totalStorageSpaceInBytes) * 100).toFixed(1);
            return `Device "${d.deviceName}" has critically low storage: ${freeGB} GB free out of ${totalGB} GB total (${freePercent}% free). Low storage can cause OS update failures, application crashes, and prevent new security policies from being applied.`;
        },
        remediation: [
            'Windows: Run Disk Cleanup (cleanmgr.exe) → Check all categories → Click "Clean up system files" for additional space.',
            'Windows: Go to Settings → System → Storage → Turn on Storage Sense to automatically free up space.',
            'Remove unused applications: Settings → Apps → Apps & features → Sort by size → Uninstall unused apps.',
            'Clear temporary files: Settings → System → Storage → Temporary files → Remove files.',
            'Move large files (documents, media) to OneDrive or a network share.',
            'Check the Downloads folder and Recycle Bin — these often contain forgotten large files.',
            'For managed devices, use Intune PowerShell scripts to automate cleanup tasks across the fleet.',
            'Consider deploying a proactive remediation script in Intune that monitors disk space and cleans temp files automatically.',
            'If the device consistently runs low on storage, consider upgrading the storage hardware or replacing the device.',
        ],
        learnMore: 'https://learn.microsoft.com/en-us/mem/intune/fundamentals/remediations',
    },
    {
        id: 'managed-not-supervised',
        category: 'Management',
        severity: 'low',
        title: 'Device Not Supervised (iOS)',
        check: (d) => {
            const os = (d.operatingSystem || '').toLowerCase();
            return (os === 'ios' || os === 'iphone os') && d.isSupervised === false;
        },
        getDescription: (d) =>
            `iOS device "${d.deviceName}" is enrolled but not in supervised mode. Supervised mode provides IT administrators with significantly more control over the device, including the ability to silently install apps, restrict features, and enable single-app mode.`,
        remediation: [
            'Supervised mode can only be enabled during initial device setup — it cannot be applied to an already-enrolled device without wiping it.',
            'To convert: Back up user data, wipe the device, and re-enroll through Apple Business Manager (ABM) or Apple School Manager (ASM) with an Automated Device Enrollment (ADE) profile.',
            'In the ADE enrollment profile (Intune → Devices → iOS/iPadOS → Enrollment → Enrollment program tokens), ensure "Supervised" is set to Yes.',
            'For new devices: Purchase through Apple Business Manager to automatically get ADE enrollment, which enables supervision.',
            'For existing devices: You can use Apple Configurator 2 (Mac required) to add devices to ABM for ADE enrollment.',
            'Benefits of supervision: Silent app installation, web content filtering, restricting AirDrop, app lock (kiosk mode), global proxy, and more.',
            'This is a low-severity issue — unsupervised devices are still managed, but have fewer available management actions.',
        ],
        learnMore: 'https://learn.microsoft.com/en-us/mem/intune/enrollment/device-enrollment-program-enroll-ios',
    },
    {
        id: 'no-primary-user',
        category: 'Management',
        severity: 'low',
        title: 'No Primary User Assigned',
        check: (d) => !d.userPrincipalName && !d.emailAddress,
        getDescription: (d) =>
            `Device "${d.deviceName}" does not have a primary user assigned. Without a user association, it's difficult to determine who is responsible for the device, apply user-targeted policies, and troubleshoot issues.`,
        remediation: [
            'In Intune Admin Center, navigate to Devices → All devices → Select the device → Properties.',
            'Under "Primary user", click "Change primary user" and assign the appropriate user.',
            'For shared devices (kiosks, conference rooms), this may be acceptable. Consider using "Shared device" enrollment profiles instead.',
            'For Windows Autopilot devices, the primary user is typically set during the Out-of-Box Experience (OOBE). If it wasn\'t assigned, manually update it.',
            'Review your enrollment process to ensure users are properly signed in during device setup.',
        ],
        learnMore: 'https://learn.microsoft.com/en-us/mem/intune/remote-actions/find-primary-user',
    },
];

/**
 * Analyze an array of device objects and return all detected issues with remediation.
 * @param {Array} devices - Array of Intune managedDevice objects
 * @returns {Array} Array of issue objects grouped by severity
 */
function analyzeDeviceIssues(devices) {
    const allIssues = [];

    devices.forEach((device) => {
        ISSUE_DEFINITIONS.forEach((issueDef) => {
            if (issueDef.check(device)) {
                allIssues.push({
                    id: `${issueDef.id}-${device.id}`,
                    issueType: issueDef.id,
                    category: issueDef.category,
                    severity: issueDef.severity,
                    title: issueDef.title,
                    description: issueDef.getDescription(device),
                    remediation: issueDef.remediation,
                    learnMore: issueDef.learnMore,
                    device: {
                        id: device.id,
                        name: device.deviceName,
                        os: device.operatingSystem,
                        osVersion: device.osVersion,
                        model: device.model,
                        manufacturer: device.manufacturer,
                        userPrincipalName: device.userPrincipalName,
                        lastSync: device.lastSyncDateTime,
                        complianceState: device.complianceState,
                    },
                });
            }
        });
    });

    // Sort by severity: critical > high > medium > low
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allIssues.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

    // Build summary
    const summary = {
        total: allIssues.length,
        critical: allIssues.filter((i) => i.severity === 'critical').length,
        high: allIssues.filter((i) => i.severity === 'high').length,
        medium: allIssues.filter((i) => i.severity === 'medium').length,
        low: allIssues.filter((i) => i.severity === 'low').length,
        byCategory: {},
    };

    allIssues.forEach((issue) => {
        if (!summary.byCategory[issue.category]) {
            summary.byCategory[issue.category] = 0;
        }
        summary.byCategory[issue.category]++;
    });

    return { summary, items: allIssues };
}

module.exports = { analyzeDeviceIssues };
