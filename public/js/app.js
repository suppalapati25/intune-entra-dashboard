/**
 * App Module — router, navigation, and initialization
 */
window.App = (() => {
    const views = {
        dashboard: { el: 'dashboardView', title: 'Dashboard', loader: () => window.Dashboard.load() },
        inventory: { el: 'inventoryView', title: 'Device Inventory', loader: () => window.Devices.load() },
        entra: { el: 'entraView', title: 'Entra Devices', loader: () => loadEntraDevices() },
        issues: { el: 'issuesView', title: 'Issues & Remediation', loader: () => window.Issues.load() },
        compliance: { el: 'complianceView', title: 'Compliance', loader: () => window.Compliance.load() },
    };

    let currentView = null;
    const loadedViews = new Set();

    async function init() {
        const authenticated = await window.Auth.checkAuth();
        if (!authenticated) {
            window.Auth.showLogin();
            return;
        }
        window.Auth.showApp();
        setupEventListeners();
        navigate('dashboard');
    }

    function setupEventListeners() {
        // Nav items
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigate(item.dataset.view);
            });
        });

        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            if (currentView) {
                loadedViews.delete(currentView);
                const view = views[currentView];
                if (view?.loader) view.loader();
                toast('Refreshing data…', 'info');
            }
        });

        // Mobile menu
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('open');
        });

        // Detail panel close
        document.getElementById('detailCloseBtn')?.addEventListener('click', () => {
            window.DeviceDetail.hide();
        });
        document.getElementById('detailOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) window.DeviceDetail.hide();
        });

        // Device search
        document.getElementById('deviceSearch')?.addEventListener('input', debounce(() => {
            window.Devices.applyFilters();
        }, 300));

        // Device filters
        document.getElementById('filterOS')?.addEventListener('change', () => window.Devices.applyFilters());
        document.getElementById('filterCompliance')?.addEventListener('change', () => window.Devices.applyFilters());

        // Export CSV
        document.getElementById('exportBtn')?.addEventListener('click', () => window.Devices.exportCSV());

        // Issue filters
        document.getElementById('filterSeverity')?.addEventListener('change', () => window.Issues.applyFilters());
        document.getElementById('filterCategory')?.addEventListener('change', () => window.Issues.applyFilters());

        // Entra search
        document.getElementById('entraSearch')?.addEventListener('input', debounce(() => {
            filterEntraDevices();
        }, 300));

        // Close sidebar on mobile nav click
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    document.getElementById('sidebar')?.classList.remove('open');
                }
            });
        });
    }

    function navigate(viewName) {
        const view = views[viewName];
        if (!view) return;

        currentView = viewName;

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if (navItem) navItem.classList.add('active');

        // Update header
        document.getElementById('headerTitle').textContent = view.title;

        // Switch view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const viewEl = document.getElementById(view.el);
        if (viewEl) viewEl.classList.add('active');

        // Load data if not loaded yet
        if (!loadedViews.has(viewName) && view.loader) {
            view.loader();
            loadedViews.add(viewName);
        }
    }

    // ── Entra Devices ──
    let entraDevices = [];

    async function loadEntraDevices() {
        try {
            const resp = await fetch('/api/devices/entra');
            if (!resp.ok) throw new Error('Failed to fetch Entra devices');
            const data = await resp.json();
            entraDevices = data.value || [];
            renderEntraTable(entraDevices);
        } catch (err) {
            document.getElementById('entraTableContainer').innerHTML =
                '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Failed to Load</h3><p>' + err.message + '</p></div>';
        }
    }

    function filterEntraDevices() {
        const q = (document.getElementById('entraSearch')?.value || '').toLowerCase();
        const filtered = q
            ? entraDevices.filter(d => [d.displayName, d.operatingSystem, d.deviceId].filter(Boolean).join(' ').toLowerCase().includes(q))
            : entraDevices;
        renderEntraTable(filtered);
    }

    function renderEntraTable(devices) {
        const c = document.getElementById('entraTableContainer');
        if (!devices.length) {
            c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔑</div><h3>No Entra Devices</h3><p>No devices found in Entra ID.</p></div>';
            return;
        }
        c.innerHTML = '<div class="table-container" style="max-height:calc(100vh - 260px);overflow-y:auto;"><table class="data-table"><thead><tr>'
            + '<th>Display Name</th><th>OS</th><th>OS Version</th><th>Trust Type</th><th>Registration</th><th>Compliant</th><th>Enabled</th><th>Last Activity</th>'
            + '</tr></thead><tbody>'
            + devices.map(d => '<tr>'
                + '<td><strong>' + esc(d.displayName || '—') + '</strong></td>'
                + '<td>' + esc(d.operatingSystem || '—') + '</td>'
                + '<td>' + esc(d.operatingSystemVersion || '—') + '</td>'
                + '<td><span class="badge badge-info">' + esc(d.trustType || '—') + '</span></td>'
                + '<td>' + (d.isManaged ? '<span class="badge badge-success">Managed</span>' : '<span class="badge badge-neutral">Unmanaged</span>') + '</td>'
                + '<td>' + (d.isCompliant ? '<span class="badge badge-success">Yes</span>' : d.isCompliant === false ? '<span class="badge badge-error">No</span>' : '<span class="badge badge-neutral">N/A</span>') + '</td>'
                + '<td>' + (d.accountEnabled ? '✅' : '❌') + '</td>'
                + '<td>' + fmtDate(d.approximateLastSignInDateTime) + '</td>'
                + '</tr>').join('')
            + '</tbody></table></div>'
            + '<div style="padding:12px 16px;font-size:.78rem;color:var(--text-muted);">Showing ' + devices.length + ' of ' + entraDevices.length + ' Entra devices</div>';
    }

    // ── Utilities ──
    function toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const t = document.createElement('div');
        t.className = 'toast ' + type;
        t.innerHTML = message;
        container.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4000);
    }

    function debounce(fn, ms) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

    function fmtDate(s) {
        if (!s) return '—';
        return new Date(s).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    // Boot
    document.addEventListener('DOMContentLoaded', init);

    return { navigate, toast };
})();
