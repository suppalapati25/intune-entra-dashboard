/**
 * Dashboard Module — Enhanced KPI cards, charts, and recent issues
 */
window.Dashboard = (() => {
    let charts = {};
    let summaryData = null;
    let issuesData = null;

    async function load() {
        await Promise.all([loadSummary(), loadRecentIssues()]);
    }

    async function loadSummary() {
        try {
            const resp = await fetch('/api/devices/summary');
            if (!resp.ok) throw new Error('Failed to fetch summary');
            summaryData = await resp.json();
            renderKPIs(summaryData);
            renderCharts(summaryData);
        } catch (err) {
            console.error('Dashboard summary error:', err);
            window.App.toast('Failed to load dashboard data', 'error');
        }
    }

    function renderKPIs(data) {
        const grid = document.getElementById('kpiGrid');
        const compPct = data.totalDevices ? Math.round((data.complianceCounts.compliant / data.totalDevices) * 100) : 0;
        const encPct = data.totalDevices ? Math.round((data.encryptedCount / data.totalDevices) * 100) : 0;
        const corpPct = data.totalDevices ? Math.round((data.ownershipCounts.company / data.totalDevices) * 100) : 0;
        const storagePct = data.totalStorageGB ? Math.round((data.freeStorageGB / data.totalStorageGB) * 100) : 0;

        grid.innerHTML = `
            <div class="kpi-card blue">
                <div class="kpi-icon">💻</div>
                <div class="kpi-value">${data.totalDevices.toLocaleString()}</div>
                <div class="kpi-label">Total Managed Devices</div>
                <div class="kpi-change" style="color:var(--accent-blue);">
                    ${Object.keys(data.osCounts).length} platforms
                </div>
            </div>
            <div class="kpi-card green">
                <div class="kpi-icon">✅</div>
                <div class="kpi-value">${data.complianceCounts.compliant.toLocaleString()}</div>
                <div class="kpi-label">Compliant Devices</div>
                <div class="kpi-change" style="color:var(--status-success);">${compPct}% of fleet</div>
            </div>
            <div class="kpi-card red">
                <div class="kpi-icon">❌</div>
                <div class="kpi-value">${data.complianceCounts.nonCompliant.toLocaleString()}</div>
                <div class="kpi-label">Non-Compliant</div>
                <div class="kpi-change" style="color:var(--status-error);">
                    ${data.complianceCounts.inGracePeriod} in grace period
                </div>
            </div>
            <div class="kpi-card purple">
                <div class="kpi-icon">🔒</div>
                <div class="kpi-value">${data.encryptedCount.toLocaleString()}</div>
                <div class="kpi-label">Encrypted Devices</div>
                <div class="kpi-change" style="color:var(--accent-purple);">${encPct}% encrypted</div>
            </div>
            <div class="kpi-card amber">
                <div class="kpi-icon">⏳</div>
                <div class="kpi-value">${data.staleCount.toLocaleString()}</div>
                <div class="kpi-label">Stale Devices (>30d)</div>
                <div class="kpi-change" style="color:var(--status-warning);">
                    ${data.activeCount.toLocaleString()} active
                </div>
            </div>
            <div class="kpi-card cyan">
                <div class="kpi-icon">🏢</div>
                <div class="kpi-value">${data.ownershipCounts.company.toLocaleString()}</div>
                <div class="kpi-label">Corporate Devices</div>
                <div class="kpi-change" style="color:var(--accent-cyan);">${corpPct}% corp · ${data.ownershipCounts.personal} personal</div>
            </div>
            <div class="kpi-card pink">
                <div class="kpi-icon">💾</div>
                <div class="kpi-value">${data.freeStorageGB.toLocaleString()} GB</div>
                <div class="kpi-label">Fleet Free Storage</div>
                <div class="kpi-change" style="color:var(--accent-purple);">${storagePct}% of ${data.totalStorageGB.toLocaleString()} GB total</div>
            </div>
            <div class="kpi-card ${data.jailbrokenCount > 0 ? 'red' : 'green'}">
                <div class="kpi-icon">${data.jailbrokenCount > 0 ? '⚠️' : '🛡️'}</div>
                <div class="kpi-value">${data.jailbrokenCount > 0 ? data.jailbrokenCount : data.supervisedCount}</div>
                <div class="kpi-label">${data.jailbrokenCount > 0 ? 'Jailbroken/Rooted' : 'Supervised Devices'}</div>
                <div class="kpi-change" style="color:${data.jailbrokenCount > 0 ? 'var(--status-error)' : 'var(--status-success)'};">
                    ${data.jailbrokenCount > 0 ? 'Immediate action required' : data.noUserCount + ' with no primary user'}
                </div>
            </div>
        `;
    }

    function renderCharts(data) {
        // Destroy existing charts
        Object.values(charts).forEach(c => c.destroy());
        charts = {};

        const chartDefaults = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 12 }
                }
            }
        };

        const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

        // 1. OS Distribution - Doughnut
        const osLabels = Object.keys(data.osCounts);
        charts.os = new Chart(document.getElementById('osChart'), {
            type: 'doughnut',
            data: {
                labels: osLabels,
                datasets: [{ data: Object.values(data.osCounts), backgroundColor: colors.slice(0, osLabels.length), borderWidth: 0, hoverOffset: 8 }]
            },
            options: { ...chartDefaults, cutout: '65%', plugins: { ...chartDefaults.plugins, legend: { ...chartDefaults.plugins.legend, position: 'right' } } }
        });

        // 2. Compliance - Bar
        charts.compliance = new Chart(document.getElementById('complianceChart'), {
            type: 'bar',
            data: {
                labels: ['Compliant', 'Non-Compliant', 'Grace Period', 'Unknown'],
                datasets: [{
                    label: 'Devices',
                    data: [data.complianceCounts.compliant, data.complianceCounts.nonCompliant, data.complianceCounts.inGracePeriod, data.complianceCounts.unknown],
                    backgroundColor: ['rgba(34,197,94,0.7)', 'rgba(239,68,68,0.7)', 'rgba(245,158,11,0.7)', 'rgba(100,116,139,0.5)'],
                    borderRadius: 6, borderWidth: 0
                }]
            },
            options: {
                ...chartDefaults,
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { family: 'Inter' } }, beginAtZero: true }
                },
                plugins: { ...chartDefaults.plugins, legend: { display: false } }
            }
        });

        // 3. Manufacturer - Horizontal Bar
        const mfKeys = Object.keys(data.manufacturerCounts);
        charts.manufacturer = new Chart(document.getElementById('manufacturerChart'), {
            type: 'bar',
            data: {
                labels: mfKeys,
                datasets: [{
                    label: 'Devices',
                    data: Object.values(data.manufacturerCounts),
                    backgroundColor: colors.slice(0, mfKeys.length),
                    borderRadius: 6, borderWidth: 0
                }]
            },
            options: {
                ...chartDefaults, indexAxis: 'y',
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' }, beginAtZero: true },
                    y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } } }
                },
                plugins: { ...chartDefaults.plugins, legend: { display: false } }
            }
        });

        // 4. Ownership - Doughnut
        charts.ownership = new Chart(document.getElementById('ownershipChart'), {
            type: 'doughnut',
            data: {
                labels: ['Corporate', 'Personal', 'Unknown'],
                datasets: [{
                    data: [data.ownershipCounts.company, data.ownershipCounts.personal, data.ownershipCounts.unknown],
                    backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(139,92,246,0.8)', 'rgba(100,116,139,0.5)'],
                    borderWidth: 0, hoverOffset: 8
                }]
            },
            options: { ...chartDefaults, cutout: '65%', plugins: { ...chartDefaults.plugins, legend: { ...chartDefaults.plugins.legend, position: 'right' } } }
        });

        // 5. Encryption - Doughnut
        charts.encryption = new Chart(document.getElementById('encryptionChart'), {
            type: 'doughnut',
            data: {
                labels: ['Encrypted', 'Not Encrypted'],
                datasets: [{
                    data: [data.encryptedCount, data.notEncryptedCount],
                    backgroundColor: ['rgba(139,92,246,0.8)', 'rgba(239,68,68,0.6)'],
                    borderWidth: 0, hoverOffset: 8
                }]
            },
            options: { ...chartDefaults, cutout: '65%', plugins: { ...chartDefaults.plugins, legend: { ...chartDefaults.plugins.legend, position: 'right' } } }
        });

        // 6. Enrollment Timeline - Line
        const tlKeys = Object.keys(data.enrollmentTimeline || {});
        if (tlKeys.length > 1) {
            charts.timeline = new Chart(document.getElementById('timelineChart'), {
                type: 'line',
                data: {
                    labels: tlKeys.map(k => { const [y, m] = k.split('-'); return new Date(y, m - 1).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }); }),
                    datasets: [{
                        label: 'New Enrollments',
                        data: Object.values(data.enrollmentTimeline),
                        borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)',
                        fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#3b82f6', borderWidth: 2
                    }]
                },
                options: {
                    ...chartDefaults,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } } },
                        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' }, beginAtZero: true }
                    },
                    plugins: { ...chartDefaults.plugins, legend: { display: false } }
                }
            });
        } else {
            document.getElementById('timelineChart')?.closest('.chart-card')?.remove();
        }
    }

    async function loadRecentIssues() {
        try {
            const resp = await fetch('/api/devices/issues');
            if (!resp.ok) throw new Error('Failed to fetch issues');
            issuesData = await resp.json();

            const badge = document.getElementById('issuesBadge');
            const critCount = issuesData.issues?.summary?.critical || 0;
            if (critCount > 0) {
                badge.textContent = critCount;
                badge.style.display = '';
            }

            renderRecentIssues(issuesData.issues?.items || []);
        } catch (err) {
            console.error('Recent issues error:', err);
            document.getElementById('recentIssuesList').innerHTML =
                '<div class="empty-state"><p>Could not load issues</p></div>';
        }
    }

    function renderRecentIssues(items) {
        const container = document.getElementById('recentIssuesList');
        const criticalItems = items.filter(i => i.severity === 'critical' || i.severity === 'high').slice(0, 8);

        if (criticalItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎉</div>
                    <h3>All Clear</h3>
                    <p>No critical or high severity issues detected across your device fleet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = criticalItems.map(issue => `
            <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border-primary);">
                <span class="badge severity-${issue.severity}" style="min-width:70px;justify-content:center;">${issue.severity.toUpperCase()}</span>
                <div style="flex:1;">
                    <div style="font-weight:600;font-size:0.88rem;">${issue.title}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${issue.device.name} — ${issue.device.os} ${issue.device.osVersion || ''}</div>
                </div>
                <span style="font-size:0.75rem;color:var(--text-muted);">${issue.category}</span>
            </div>
        `).join('');
    }

    return { load };
})();
