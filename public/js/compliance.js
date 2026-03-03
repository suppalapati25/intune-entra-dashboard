/**
 * Compliance Module — displays compliance policies with device status breakdowns
 */
window.Compliance = (() => {
    async function load() {
        try {
            const resp = await fetch('/api/compliance/summary');
            if (!resp.ok) throw new Error('Failed to fetch compliance data');
            const data = await resp.json();
            render(data);
        } catch (err) {
            console.error('Compliance load error:', err);
            document.getElementById('complianceSummary').innerHTML =
                '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Failed to Load</h3><p>' + err.message + '</p></div>';
        }
    }

    function render(data) {
        const c = document.getElementById('complianceSummary');
        const p = data.policies || [];
        if (!p.length) {
            c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🛡️</div><h3>No Policies</h3><p>No compliance policies found.</p></div>';
            return;
        }
        let tC = 0, tN = 0, tE = 0;
        p.forEach(x => { tC += x.compliant; tN += x.nonCompliant; tE += x.error; });
        c.innerHTML = '<div class="kpi-grid" style="margin-bottom:28px;">'
            + kpi('🛡️', data.totalPolicies, 'Total Policies', 'green')
            + kpi('✅', tC, 'Compliant', 'green')
            + kpi('❌', tN, 'Non-Compliant', 'red')
            + kpi('⚠️', tE, 'Errors', 'amber')
            + '</div><h3 style="font-size:1.05rem;font-weight:600;margin-bottom:16px;">Policy Breakdown</h3>'
            + p.map(renderPolicy).join('');
    }

    function kpi(icon, val, label, color) {
        return '<div class="kpi-card ' + color + '"><div class="kpi-icon">' + icon + '</div><div class="kpi-value">' + val + '</div><div class="kpi-label">' + label + '</div></div>';
    }

    function renderPolicy(p) {
        const t = p.compliant + p.nonCompliant + p.error + p.conflict + p.notApplicable + p.inGracePeriod;
        const pct = t > 0 ? Math.round((p.compliant / t) * 100) : 0;
        const col = pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red';
        const plat = { 'windows10CompliancePolicy': '🪟 Windows', 'iosCompliancePolicy': '📱 iOS', 'androidCompliancePolicy': '🤖 Android', 'macOSCompliancePolicy': '🍎 macOS' };
        return '<div class="policy-card"><div style="display:flex;justify-content:space-between;"><div><div class="policy-name">' + esc(p.policyName) + '</div><div class="policy-platform">' + (plat[p.platform] || p.platform) + '</div></div><div style="text-align:right;"><div style="font-size:1.5rem;font-weight:800;color:var(--status-' + (pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'error') + ');">' + pct + '%</div><div style="font-size:.72rem;color:var(--text-muted);">compliant</div></div></div><div class="progress-bar" style="margin-bottom:14px;"><div class="progress-fill ' + col + '" style="width:' + pct + '%"></div></div><div class="policy-stats"><div class="policy-stat"><span class="policy-stat-dot green"></span>Compliant: <strong>' + p.compliant + '</strong></div><div class="policy-stat"><span class="policy-stat-dot red"></span>Non-Compliant: <strong>' + p.nonCompliant + '</strong></div><div class="policy-stat"><span class="policy-stat-dot amber"></span>Error: <strong>' + p.error + '</strong></div><div class="policy-stat"><span class="policy-stat-dot blue"></span>Grace: <strong>' + p.inGracePeriod + '</strong></div><div class="policy-stat"><span class="policy-stat-dot gray"></span>N/A: <strong>' + p.notApplicable + '</strong></div></div></div>';
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

    return { load };
})();
