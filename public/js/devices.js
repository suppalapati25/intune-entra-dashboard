/**
 * Devices Module — Enhanced Intune device inventory with search, filter, sort, and CSV export
 */
window.Devices = (() => {
    let allDevices = [];
    let filteredDevices = [];
    let sortCol = 'deviceName';
    let sortDir = 'asc';

    async function load() {
        try {
            const resp = await fetch('/api/devices/intune');
            if (!resp.ok) throw new Error('Failed to fetch devices');
            const data = await resp.json();
            allDevices = data.value || [];
            buildFilterOptions();
            applyFilters();
        } catch (err) {
            console.error('Devices load error:', err);
            document.getElementById('deviceTableContainer').innerHTML =
                `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Failed to Load Devices</h3><p>${err.message}</p></div>`;
        }
    }

    function buildFilterOptions() {
        // Dynamically populate OS filter from actual device data
        const osSet = new Set(allDevices.map(d => d.operatingSystem).filter(Boolean));
        const osFilter = document.getElementById('filterOS');
        if (osFilter) {
            const current = osFilter.value;
            osFilter.innerHTML = '<option value="">All OS</option>';
            [...osSet].sort().forEach(os => {
                osFilter.innerHTML += `<option value="${os}">${os}</option>`;
            });
            osFilter.value = current;
        }
    }

    function applyFilters() {
        const search = (document.getElementById('deviceSearch')?.value || '').toLowerCase();
        const osFilter = document.getElementById('filterOS')?.value || '';
        const compFilter = document.getElementById('filterCompliance')?.value || '';

        filteredDevices = allDevices.filter(d => {
            if (search) {
                const searchStr = [d.deviceName, d.userPrincipalName, d.model, d.serialNumber, d.manufacturer, d.userDisplayName, d.emailAddress]
                    .filter(Boolean).join(' ').toLowerCase();
                if (!searchStr.includes(search)) return false;
            }
            if (osFilter && d.operatingSystem !== osFilter) return false;
            if (compFilter && d.complianceState !== compFilter) return false;
            return true;
        });

        // Sort
        filteredDevices.sort((a, b) => {
            let va = a[sortCol] || '';
            let vb = b[sortCol] || '';
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        renderTable();
    }

    function renderTable() {
        const container = document.getElementById('deviceTableContainer');

        if (filteredDevices.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📱</div>
                    <h3>No Devices Found</h3>
                    <p>No devices match your current filters. Try adjusting your search or filter criteria.</p>
                </div>
            `;
            return;
        }

        const columns = [
            { key: 'deviceName', label: 'Device Name' },
            { key: 'userPrincipalName', label: 'User' },
            { key: 'operatingSystem', label: 'OS' },
            { key: 'osVersion', label: 'Version' },
            { key: 'complianceState', label: 'Compliance' },
            { key: 'isEncrypted', label: 'Encrypted' },
            { key: 'managedDeviceOwnerType', label: 'Ownership' },
            { key: 'manufacturer', label: 'Manufacturer' },
            { key: 'model', label: 'Model' },
            { key: 'serialNumber', label: 'Serial #' },
            { key: 'lastSyncDateTime', label: 'Last Sync' },
        ];

        container.innerHTML = `
            <div class="table-container" style="max-height:calc(100vh - 260px);overflow:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${columns.map(c => `
                                <th class="${sortCol === c.key ? 'sorted' : ''}" data-col="${c.key}">
                                    ${c.label}
                                    <span class="sort-icon">${sortCol === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredDevices.map(d => `
                            <tr data-id="${d.id}">
                                <td><strong>${esc(d.deviceName || '—')}</strong></td>
                                <td>
                                    <div style="font-size:0.82rem;">${esc(d.userDisplayName || d.userPrincipalName || '—')}</div>
                                    ${d.emailAddress && d.emailAddress !== d.userPrincipalName ?
                `<div style="font-size:0.7rem;color:var(--text-muted);">${esc(d.emailAddress)}</div>` : ''}
                                </td>
                                <td><span class="os-icon">${osIcon(d.operatingSystem)} ${esc(d.operatingSystem || '—')}</span></td>
                                <td style="font-size:0.78rem;">${esc(d.osVersion || '—')}</td>
                                <td>${complianceBadge(d.complianceState)}</td>
                                <td>${d.isEncrypted ? '<span class="badge badge-success">🔒 Yes</span>' : '<span class="badge badge-error">🔓 No</span>'}</td>
                                <td>${ownershipBadge(d.managedDeviceOwnerType)}</td>
                                <td style="font-size:0.8rem;">${esc(d.manufacturer || '—')}</td>
                                <td style="font-size:0.8rem;">${esc(d.model || '—')}</td>
                                <td style="font-size:0.75rem;font-family:monospace;">${esc(d.serialNumber || '—')}</td>
                                <td>${formatDate(d.lastSyncDateTime)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="padding:12px 16px;font-size:0.78rem;color:var(--text-muted);display:flex;justify-content:space-between;">
                <span>Showing ${filteredDevices.length} of ${allDevices.length} devices</span>
                <span>Last refreshed: ${new Date().toLocaleTimeString('en-AU')}</span>
            </div>
        `;

        // Sort click handlers
        container.querySelectorAll('th[data-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (sortCol === col) {
                    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    sortCol = col;
                    sortDir = 'asc';
                }
                applyFilters();
            });
        });

        // Row click → detail
        container.querySelectorAll('tbody tr[data-id]').forEach(tr => {
            tr.addEventListener('click', () => {
                const device = allDevices.find(d => d.id === tr.dataset.id);
                if (device) window.DeviceDetail.show(device);
            });
        });
    }

    function exportCSV() {
        if (filteredDevices.length === 0) {
            window.App.toast('No devices to export', 'info');
            return;
        }
        const headers = [
            'Device Name', 'User', 'Email', 'OS', 'Version', 'Compliance', 'Encrypted',
            'Ownership', 'Manufacturer', 'Model', 'Serial Number', 'IMEI', 'Wi-Fi MAC',
            'Last Sync', 'Enrolled Date', 'Management Agent', 'Jailbroken', 'Supervised',
            'Total Storage (GB)', 'Free Storage (GB)'
        ];
        const rows = filteredDevices.map(d => [
            d.deviceName, d.userPrincipalName || '', d.emailAddress || '',
            d.operatingSystem, d.osVersion,
            d.complianceState, d.isEncrypted ? 'Yes' : 'No',
            d.managedDeviceOwnerType || '', d.manufacturer, d.model, d.serialNumber,
            d.imei || '', d.wiFiMacAddress || '',
            d.lastSyncDateTime || '', d.enrolledDateTime || '',
            d.managementAgent || '', d.jailBroken || '', d.isSupervised ? 'Yes' : 'No',
            d.totalStorageSpaceInBytes ? (d.totalStorageSpaceInBytes / (1024 ** 3)).toFixed(1) : '',
            d.freeStorageSpaceInBytes ? (d.freeStorageSpaceInBytes / (1024 ** 3)).toFixed(1) : ''
        ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`));

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `intune-devices-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        window.App.toast(`Exported ${filteredDevices.length} devices to CSV`, 'success');
    }

    // Helpers
    function esc(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function osIcon(os) {
        const icons = { Windows: '🪟', iOS: '📱', Android: '🤖', macOS: '🍎', 'iPhone OS': '📱', Linux: '🐧' };
        return icons[os] || '💻';
    }

    function complianceBadge(state) {
        const badges = {
            compliant: '<span class="badge badge-success">✓ Compliant</span>',
            noncompliant: '<span class="badge badge-error">✕ Non-Compliant</span>',
            inGracePeriod: '<span class="badge badge-warning">⏳ Grace Period</span>',
            unknown: '<span class="badge badge-neutral">? Unknown</span>',
            configManager: '<span class="badge badge-info">⚙ Config Manager</span>',
        };
        return badges[state] || `<span class="badge badge-neutral">${esc(state || 'Unknown')}</span>`;
    }

    function ownershipBadge(type) {
        if (type === 'company') return '<span class="badge badge-info">🏢 Corporate</span>';
        if (type === 'personal') return '<span class="badge badge-neutral">👤 Personal</span>';
        return '<span class="badge badge-neutral">— Unknown</span>';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        const formatted = d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeAgo = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`;

        const color = diffDays > 30 ? 'var(--status-warning)' : diffDays > 7 ? 'var(--text-muted)' : 'var(--status-success)';
        return `<div style="font-size:0.8rem;">${formatted}</div><div style="font-size:0.7rem;color:${color};">${timeAgo}</div>`;
    }

    return { load, applyFilters, exportCSV };
})();
