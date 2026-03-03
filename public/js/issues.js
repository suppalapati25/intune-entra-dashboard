/**
 * Issues & Remediation Module — full issue analysis with expandable remediation cards
 */
window.Issues = (() => {
    let allIssues = [];
    let issuesSummary = null;

    async function load() {
        try {
            const resp = await fetch('/api/devices/issues');
            if (!resp.ok) throw new Error('Failed to fetch issues');
            const data = await resp.json();
            issuesSummary = data.issues?.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
            allIssues = data.issues?.items || [];
            renderSummary();
            applyFilters();
        } catch (err) {
            console.error('Issues load error:', err);
            document.getElementById('issuesListContainer').innerHTML =
                `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Failed to Load Issues</h3><p>${err.message}</p></div>`;
        }
    }

    function renderSummary() {
        document.getElementById('criticalCount').textContent = issuesSummary.critical;
        document.getElementById('highCount').textContent = issuesSummary.high;
        document.getElementById('mediumCount').textContent = issuesSummary.medium;
        document.getElementById('lowCount').textContent = issuesSummary.low;
    }

    function applyFilters() {
        const severity = document.getElementById('filterSeverity')?.value || '';
        const category = document.getElementById('filterCategory')?.value || '';

        let filtered = allIssues;
        if (severity) filtered = filtered.filter(i => i.severity === severity);
        if (category) filtered = filtered.filter(i => i.category === category);

        // Group by issue type
        const grouped = {};
        filtered.forEach(issue => {
            if (!grouped[issue.issueType]) {
                grouped[issue.issueType] = {
                    issueType: issue.issueType,
                    title: issue.title,
                    category: issue.category,
                    severity: issue.severity,
                    remediation: issue.remediation,
                    learnMore: issue.learnMore,
                    devices: [],
                };
            }
            grouped[issue.issueType].devices.push(issue.device);
        });

        renderIssues(Object.values(grouped));
    }

    function renderIssues(groups) {
        const container = document.getElementById('issuesListContainer');

        if (groups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎉</div>
                    <h3>No Issues Found</h3>
                    <p>No device issues match your current filters. Your fleet is looking healthy!</p>
                </div>
            `;
            return;
        }

        // Sort groups by severity
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        groups.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

        container.innerHTML = groups.map((group, idx) => `
            <div class="issue-card" id="issueCard_${idx}">
                <div class="issue-card-header" onclick="window.Issues.toggleCard(${idx})">
                    <div class="issue-severity-icon ${group.severity}">
                        ${severityIcon(group.severity)}
                    </div>
                    <div class="issue-card-info">
                        <div class="issue-card-title">${esc(group.title)}</div>
                        <div class="issue-card-meta">
                            <span class="badge severity-${group.severity}">${group.severity.toUpperCase()}</span>
                            <span>📂 ${esc(group.category)}</span>
                            <span>📱 ${group.devices.length} device${group.devices.length !== 1 ? 's' : ''} affected</span>
                        </div>
                    </div>
                    <span class="issue-expand-icon">▼</span>
                </div>
                <div class="issue-card-body">
                    <div class="issue-card-content">
                        <div class="issue-description">
                            ${group.devices.length > 0 ? getIssueDescription(group) : ''}
                        </div>

                        <div class="issue-devices-label">Affected Devices (${group.devices.length})</div>
                        <div style="margin-bottom:16px;">
                            ${group.devices.map(d => `
                                <span class="issue-device-chip">
                                    💻 ${esc(d.name)} <span style="color:var(--text-muted);">— ${esc(d.os || '')} ${esc(d.osVersion || '')}</span>
                                </span>
                            `).join('')}
                        </div>

                        <div class="remediation-section">
                            <div class="remediation-title">🔧 Remediation Steps</div>
                            <ol class="remediation-steps">
                                ${group.remediation.map(step => `<li>${esc(step)}</li>`).join('')}
                            </ol>
                        </div>

                        <a href="${group.learnMore}" target="_blank" class="learn-more-link">
                            📖 Microsoft Learn Documentation →
                        </a>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function getIssueDescription(group) {
        // Generate a summary description based on the issue type
        const descriptions = {
            'non-compliant': `<strong>${group.devices.length}</strong> device(s) are not meeting your organization's compliance policies. Non-compliant devices may lack required security settings, have outdated software, or be missing required configurations. These devices may be blocked from accessing corporate resources if Conditional Access policies are in place.`,
            'os-outdated': `<strong>${group.devices.length}</strong> device(s) are running outdated operating system versions. Outdated OS versions lack critical security patches and may be vulnerable to known exploits. This increases the risk of malware infections and data breaches.`,
            'stale-device': `<strong>${group.devices.length}</strong> device(s) have not synced with Intune in over 30 days. These devices are not receiving the latest policies, app deployments, or security configurations. They may be lost, retired, or experiencing connectivity issues.`,
            'not-encrypted': `<strong>${group.devices.length}</strong> device(s) do not have disk encryption enabled. Without encryption, data on these devices is accessible if the device is lost or stolen, presenting a significant data breach risk to your organization.`,
            'jailbroken': `<strong>${group.devices.length}</strong> device(s) have been detected as jailbroken or rooted. These devices have bypassed built-in security controls and are highly vulnerable to malware and unauthorized data access. Immediate action is required.`,
            'storage-critical': `<strong>${group.devices.length}</strong> device(s) have critically low storage (less than 10% free). Low storage can cause OS update failures, application crashes, and prevent security policies from being applied correctly.`,
            'managed-not-supervised': `<strong>${group.devices.length}</strong> iOS device(s) are enrolled but not in supervised mode. Supervised mode provides significantly more management capabilities including silent app installation, feature restrictions, and single-app mode.`,
            'no-primary-user': `<strong>${group.devices.length}</strong> device(s) do not have a primary user assigned. Without a user association, user-targeted policies cannot be applied effectively, and it's difficult to track device responsibility.`,
        };
        return descriptions[group.issueType] || `${group.devices.length} device(s) affected by this issue.`;
    }

    function toggleCard(idx) {
        const card = document.getElementById(`issueCard_${idx}`);
        if (card) card.classList.toggle('expanded');
    }

    function severityIcon(severity) {
        const icons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
        return icons[severity] || '⚪';
    }

    function esc(str) {
        const div = document.createElement('div');
        div.textContent = String(str || '');
        return div.innerHTML;
    }

    return { load, applyFilters, toggleCard };
})();
