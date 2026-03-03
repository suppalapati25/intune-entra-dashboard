/**
 * Device Detail Module — Enhanced slide-out panel with comprehensive device info
 */
window.DeviceDetail = (() => {
    function show(device) {
        const overlay = document.getElementById('detailOverlay');
        const nameEl = document.getElementById('detailDeviceName');
        const body = document.getElementById('detailPanelBody');

        nameEl.textContent = device.deviceName || 'Device Details';

        const totalGB = device.totalStorageSpaceInBytes ? (device.totalStorageSpaceInBytes / (1024 ** 3)).toFixed(1) : '—';
        const freeGB = device.freeStorageSpaceInBytes ? (device.freeStorageSpaceInBytes / (1024 ** 3)).toFixed(1) : '—';
        const usedGB = (device.totalStorageSpaceInBytes && device.freeStorageSpaceInBytes)
            ? ((device.totalStorageSpaceInBytes - device.freeStorageSpaceInBytes) / (1024 ** 3)).toFixed(1) : '—';
        const storagePercent = device.totalStorageSpaceInBytes
            ? Math.round((device.freeStorageSpaceInBytes / device.totalStorageSpaceInBytes) * 100) : 0;

        const lastSync = device.lastSyncDateTime ? new Date(device.lastSyncDateTime).toLocaleString('en-AU') : '—';
        const enrollDate = device.enrolledDateTime ? new Date(device.enrolledDateTime).toLocaleString('en-AU') : '—';
        const daysSinceSync = device.lastSyncDateTime
            ? Math.floor((new Date() - new Date(device.lastSyncDateTime)) / (1000 * 60 * 60 * 24)) : null;
        const compGraceDays = device.complianceGracePeriodExpirationDateTime
            ? Math.floor((new Date(device.complianceGracePeriodExpirationDateTime) - new Date()) / (1000 * 60 * 60 * 24)) : null;

        body.innerHTML = `
            <!-- Health Indicators -->
            <div class="detail-section">
                <div class="detail-section-title">Health Status</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${compBadge(device.complianceState)}
                    ${device.isEncrypted
                ? '<span class="badge badge-success">🔒 Encrypted</span>'
                : '<span class="badge badge-error">🔓 Not Encrypted</span>'}
                    ${device.isSupervised
                ? '<span class="badge badge-info">👁️ Supervised</span>'
                : ''}
                    ${daysSinceSync !== null && daysSinceSync > 30
                ? '<span class="badge badge-warning">⏳ Stale</span>'
                : '<span class="badge badge-success">🟢 Active</span>'}
                    ${device.jailBroken === 'True'
                ? '<span class="badge badge-error">⚠️ Jailbroken</span>'
                : ''}
                    ${ownershipBadge(device.managedDeviceOwnerType)}
                    ${device.autopilotEnrolled
                ? '<span class="badge badge-info">🚀 Autopilot</span>'
                : ''}
                    ${device.azureADRegistered
                ? '<span class="badge badge-success">☁️ Azure AD</span>'
                : '<span class="badge badge-neutral">☁️ Not AAD</span>'}
                </div>
            </div>

            <!-- Device Info -->
            <div class="detail-section">
                <div class="detail-section-title">Device Information</div>
                <div class="detail-grid">
                    ${field('Device Name', device.deviceName)}
                    ${field('Device ID', device.id, true)}
                    ${field('Manufacturer', device.manufacturer)}
                    ${field('Model', device.model)}
                    ${field('Serial Number', device.serialNumber)}
                    ${field('Physical Memory (GB)', device.physicalMemoryInBytes ? (device.physicalMemoryInBytes / (1024 ** 3)).toFixed(1) : null)}
                    ${field('IMEI', device.imei)}
                    ${field('MEID', device.meid)}
                    ${field('Phone Number', device.phoneNumber)}
                    ${field('Subscriber Carrier', device.subscriberCarrier)}
                </div>
            </div>

            <!-- Network -->
            <div class="detail-section">
                <div class="detail-section-title">Network</div>
                <div class="detail-grid">
                    ${field('Wi-Fi MAC', device.wiFiMacAddress)}
                    ${field('Ethernet MAC', device.ethernetMacAddress)}
                    ${field('IP Address', device.activationLockBypassCode || '—')}
                </div>
            </div>

            <!-- OS Info -->
            <div class="detail-section">
                <div class="detail-section-title">Operating System</div>
                <div class="detail-grid">
                    ${field('OS', device.operatingSystem)}
                    ${field('OS Version', device.osVersion)}
                    ${field('Android Security Patch', device.androidSecurityPatchLevel)}
                    ${field('Build Number', device.operatingSystemVersion)}
                </div>
            </div>

            <!-- User Info -->
            <div class="detail-section">
                <div class="detail-section-title">User Assignment</div>
                <div class="detail-grid">
                    ${field('User Display Name', device.userDisplayName)}
                    ${field('User Principal Name', device.userPrincipalName)}
                    ${field('Email', device.emailAddress)}
                    ${field('User ID', device.userId, true)}
                </div>
            </div>

            <!-- Enrollment -->
            <div class="detail-section">
                <div class="detail-section-title">Enrollment & Management</div>
                <div class="detail-grid">
                    ${field('Enrollment Type', formatEnrollment(device.deviceEnrollmentType))}
                    ${field('Enrolled Date', enrollDate)}
                    ${field('Last Sync', lastSync)}
                    ${field('Days Since Sync', daysSinceSync !== null ? daysSinceSync + ' days' : '—')}
                    ${field('Management Agent', device.managementAgent)}
                    ${field('Management State', device.managementState)}
                    ${field('Device Registration', device.deviceRegistrationState)}
                    ${field('Device Category', device.deviceCategoryDisplayName)}
                    ${field('Ownership', formatOwnership(device.managedDeviceOwnerType))}
                    ${field('Exchange Access State', device.exchangeAccessState)}
                    ${field('Exchange Access Reason', device.exchangeAccessStateReason)}
                    ${device.partnerReportedThreatState ? field('Threat State', device.partnerReportedThreatState) : ''}
                </div>
            </div>

            <!-- Storage -->
            <div class="detail-section">
                <div class="detail-section-title">Storage</div>
                <div class="detail-grid">
                    ${field('Total Storage', totalGB + ' GB')}
                    ${field('Used Storage', usedGB + ' GB')}
                    ${field('Free Storage', freeGB + ' GB')}
                </div>
                <div style="margin-top:12px;">
                    <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;">
                        <span>${usedGB} GB used</span><span>${storagePercent}% free</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${storagePercent < 10 ? 'red' : storagePercent < 30 ? 'amber' : 'green'}"
                             style="width:${100 - storagePercent}%"></div>
                    </div>
                </div>
            </div>

            <!-- Security -->
            <div class="detail-section">
                <div class="detail-section-title">Security & Compliance</div>
                <div class="detail-grid">
                    ${field('Compliance State', device.complianceState)}
                    ${compGraceDays !== null ? field('Grace Period Expires', compGraceDays > 0 ? 'In ' + compGraceDays + ' days' : 'Expired') : ''}
                    ${field('Encrypted', device.isEncrypted ? '✅ Yes' : '❌ No')}
                    ${field('Jailbroken/Rooted', device.jailBroken || 'Unknown')}
                    ${field('Supervised', device.isSupervised ? '✅ Yes' : '❌ No')}
                    ${field('Autopilot Enrolled', device.autopilotEnrolled ? '✅ Yes' : '❌ No')}
                    ${field('Azure AD Registered', device.azureADRegistered ? '✅ Yes' : '❌ No')}
                    ${field('Azure AD Device ID', device.azureADDeviceId, true)}
                    ${field('EAS Device ID', device.easDeviceId, true)}
                    ${device.remoteAssistanceSessionUrl ? field('Remote Assistance', device.remoteAssistanceSessionUrl) : ''}
                </div>
            </div>

            <!-- Device Issues -->
            <div class="detail-section">
                <div class="detail-section-title">Detected Issues</div>
                <div id="detailDeviceIssues">
                    <div class="spinner-container" style="padding:20px;"><div class="spinner"></div></div>
                </div>
            </div>

            <!-- Raw Data Toggle -->
            <div class="detail-section">
                <div class="detail-section-title" style="cursor:pointer;" onclick="document.getElementById('rawDataSection').style.display = document.getElementById('rawDataSection').style.display === 'none' ? 'block' : 'none'">
                    📋 Raw Device Data <span style="font-size:0.7rem;color:var(--text-muted);">(click to toggle)</span>
                </div>
                <div id="rawDataSection" style="display:none;max-height:300px;overflow-y:auto;background:var(--bg-glass);border-radius:var(--radius-sm);padding:12px;">
                    <pre style="font-size:0.7rem;color:var(--text-secondary);white-space:pre-wrap;word-break:break-word;">${escapeHtml(JSON.stringify(device, null, 2))}</pre>
                </div>
            </div>
        `;

        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        // Load device-specific issues
        loadDeviceIssues(device.id);
    }

    async function loadDeviceIssues(deviceId) {
        try {
            const resp = await fetch(`/api/devices/issues/${deviceId}`);
            if (!resp.ok) throw new Error('Failed');
            const data = await resp.json();
            const container = document.getElementById('detailDeviceIssues');
            const items = data.issues?.items || [];

            if (items.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.85rem;">
                        🎉 No issues detected for this device
                    </div>
                `;
                return;
            }

            container.innerHTML = items.map(issue => `
                <div style="padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm);border:1px solid var(--border-primary);margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span class="badge severity-${issue.severity}">${issue.severity.toUpperCase()}</span>
                        <span style="font-weight:600;font-size:0.85rem;">${issue.title}</span>
                    </div>
                    <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">${issue.description}</p>
                    ${issue.remediation ? `
                    <details style="margin-bottom:8px;">
                        <summary style="cursor:pointer;font-size:0.8rem;color:var(--accent-blue);font-weight:500;">🔧 Remediation Steps</summary>
                        <ul style="font-size:0.78rem;color:var(--text-secondary);line-height:1.6;margin-top:6px;padding-left:20px;">
                            ${issue.remediation.map(step => `<li>${step}</li>`).join('')}
                        </ul>
                    </details>` : ''}
                    <a href="${issue.learnMore}" target="_blank" class="learn-more-link">📖 Learn more</a>
                </div>
            `).join('');
        } catch {
            document.getElementById('detailDeviceIssues').innerHTML =
                '<div style="color:var(--text-muted);font-size:0.85rem;">Could not load issues</div>';
        }
    }

    function hide() {
        document.getElementById('detailOverlay').classList.remove('open');
        document.body.style.overflow = '';
    }

    function field(label, value, mono) {
        const style = mono ? 'font-family:monospace;font-size:0.72rem;word-break:break-all;' : '';
        return `
            <div class="detail-field">
                <div class="detail-field-label">${label}</div>
                <div class="detail-field-value" style="${style}">${escapeHtml(value ?? '—')}</div>
            </div>
        `;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function compBadge(state) {
        const badges = {
            compliant: '<span class="badge badge-success">✓ Compliant</span>',
            noncompliant: '<span class="badge badge-error">✕ Non-Compliant</span>',
            inGracePeriod: '<span class="badge badge-warning">⏳ Grace Period</span>',
            unknown: '<span class="badge badge-neutral">? Unknown</span>',
        };
        return badges[state] || '<span class="badge badge-neutral">Unknown</span>';
    }

    function ownershipBadge(type) {
        if (type === 'company') return '<span class="badge badge-info">🏢 Corporate</span>';
        if (type === 'personal') return '<span class="badge badge-neutral">👤 Personal</span>';
        return '';
    }

    function formatOwnership(type) {
        const map = { company: 'Corporate-owned', personal: 'Personal (BYOD)' };
        return map[type] || type || '—';
    }

    function formatEnrollment(type) {
        const labels = {
            userEnrollment: 'User Enrollment',
            deviceEnrollmentManager: 'Device Enrollment Manager',
            appleBulkWithUser: 'Apple DEP (User)',
            appleBulkWithoutUser: 'Apple DEP (No User)',
            windowsAzureADJoin: 'Azure AD Join',
            windowsBulkUserless: 'Windows Bulk',
            windowsAutoEnrollment: 'Auto Enrollment',
            windowsBulkAzureDomainJoin: 'Bulk Azure Domain Join',
            windowsCoManagement: 'Co-Management',
            androidEnterpriseFullyManaged: 'Android Enterprise (Fully Managed)',
            androidEnterpriseDedicatedDevice: 'Android Enterprise (Dedicated)',
            androidEnterpriseWorkProfile: 'Android Enterprise (Work Profile)',
            androidEnterpriseCorporateWorkProfile: 'Android Enterprise (Corp Work Profile)',
        };
        return labels[type] || type || '—';
    }

    return { show, hide };
})();
