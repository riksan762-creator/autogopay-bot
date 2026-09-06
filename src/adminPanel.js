const session = require('express-session');
const config = require('./config');
const db = require('./db');
const { bot } = require('./bot');

function formatRupiah(n) {
  return `Rp${Number(n).toLocaleString('id-ID')}`;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  orders: '<path d="M4 17l6-6-4-4M20 7l-6 6 4 4" stroke-linecap="round" stroke-linejoin="round"/>',
  products: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 13v8" stroke-linecap="round"/>',
  customers: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke-linecap="round"/><circle cx="17.5" cy="9" r="2.5"/><path d="M15 14.2c2.8.4 4.7 2.4 4.7 5.8" stroke-linecap="round"/>',
  logs: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke-linecap="round" stroke-linejoin="round"/>',
  broadcast: '<path d="M3 11v2a2 2 0 0 0 2 2h1l5 4V5L6 9H5a2 2 0 0 0-2 2z" stroke-linejoin="round"/><path d="M16 8.5a4 4 0 0 1 0 7M19 5.5a8.5 8.5 0 0 1 0 13" stroke-linecap="round"/>',
  backup: '<path d="M12 3v12M7 10l5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke-linecap="round"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke-linecap="round"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" stroke-linejoin="round"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 4h6" stroke-linecap="round"/><circle cx="9" cy="14" r="1.3"/><circle cx="15" cy="14" r="1.3"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="7.5" r="0.8" fill="currentColor" stroke="none"/><circle cx="7" cy="16.5" r="0.8" fill="currentColor" stroke="none"/>',
};

function svgIcon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICONS[name] || ''}</svg>`;
}

const NAV = [
  { key: 'dashboard', href: '/admin', icon: 'dashboard', label: 'Dashboard' },
  { key: 'settings', href: '/admin/settings', icon: 'settings', label: 'Konfigurasi' },
  { key: 'orders', href: '/admin/orders', icon: 'orders', label: 'Transaksi' },
  { key: 'products', href: '/admin/products', icon: 'products', label: 'Produk & Markup' },
  { key: 'vpnservers', href: '/admin/vpn-servers', icon: 'server', label: 'VPN Management' },
  { key: 'customers', href: '/admin/customers', icon: 'customers', label: 'Kelola User' },
  { key: 'logs', href: '/admin/logs', icon: 'logs', label: 'Activity Logs' },
  { key: 'broadcast', href: '/admin/broadcast', icon: 'broadcast', label: 'Broadcast' },
  { key: 'backup', href: '/admin/backup', icon: 'backup', label: 'Backup & Restore' },
];

function layout(title, bodyHtml, activeKey = '') {
  const navHtml = NAV.map(
    (n) =>
      `<a href="${n.href}" class="navlink${n.key === activeKey ? ' active' : ''}"><span class="navicon">${svgIcon(n.icon)}</span>${n.label}</a>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} - Admin Panel</title>
<script>
  // Terapkan tema tersimpan SEBELUM halaman dirender, biar tidak "kedip"
  (function () {
    var saved = localStorage.getItem('admin-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  })();
</script>
<style>
  * { box-sizing: border-box; }
  :root[data-theme="dark"] {
    --bg: #0b0d12; --panel: #10131b; --border: #1e2330; --text: #e6e6e6;
    --muted: #9aa4b2; --accent: #4f7cff; --accent-soft: #1c2536; --accent-text: #7ba1ff;
    --hover: #161b26; --input-bg: #0b0d12;
  }
  :root[data-theme="light"] {
    --bg: #f4f6fb; --panel: #ffffff; --border: #e3e7ef; --text: #1c2230;
    --muted: #6b7280; --accent: #4f7cff; --accent-soft: #e8edff; --accent-text: #3457d5;
    --hover: #f0f3fb; --input-bg: #ffffff;
  }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; background: var(--bg); color: var(--text); transition: background 0.15s, color 0.15s; }
  .shell { display: flex; min-height: 100vh; }
  .sidebar { width: 250px; background: var(--panel); border-right: 1px solid var(--border); padding: 18px 12px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .brand { display: flex; align-items: center; gap: 10px; padding: 8px 10px 20px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px; }
  .brand .dot { width: 34px; height: 34px; border-radius: 9px; background: var(--accent); display: flex; align-items: center; justify-content: center; color: #fff; }
  .navsection { color: var(--muted); font-size: 11px; letter-spacing: 1px; padding: 6px 10px; text-transform: uppercase; }
  .navlink { display: flex; align-items: center; gap: 12px; color: var(--muted); text-decoration: none; padding: 11px 12px; border-radius: 10px; font-size: 14px; margin-bottom: 2px; }
  .navicon { display: flex; }
  .navlink.active { background: var(--accent-soft); color: var(--accent-text); }
  .navlink:hover { background: var(--hover); color: var(--text); }
  .topbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg); z-index: 5; }
  .topbar-left { display: flex; align-items: center; gap: 14px; }
  .topbar h1 { font-size: 18px; margin: 0; }
  .hamburger { display: none; background: none; border: none; color: var(--text); cursor: pointer; padding: 6px; }
  .topbar-right { display: flex; align-items: center; gap: 10px; }
  .icon-btn { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border); background: var(--panel); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .admin-pill { display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel); color: var(--text); text-decoration: none; font-size: 14px; }
  .admin-avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
  .content { flex: 1; min-width: 0; }
  main { padding: 20px 24px; max-width: 1000px; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; }
  input, textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); font-size: 14px; margin-top: 4px; }
  label { font-size: 13px; color: var(--muted); display: block; margin-top: 12px; }
  button, .btn { background: var(--accent); color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 12px; }
  button.danger, .btn.danger { background: #e5484d; }
  button.secondary, .btn.secondary { background: var(--accent-soft); color: var(--accent-text); }
  .badge { padding: 3px 10px; border-radius: 999px; font-size: 12px; }
  .badge.ok { background: #103a24; color: #4ade80; }
  .badge.warn { background: #3a2e10; color: #fbbf24; }
  .badge.bad { background: #3a1414; color: #f87171; }
  .muted { color: var(--muted); font-size: 13px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; }
  .row > * { flex: 1; min-width: 140px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 18px; }
  .stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
  .stat-card .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-card .value { font-size: 24px; font-weight: 700; margin-top: 8px; }
  code { background: var(--bg); padding: 2px 6px; border-radius: 6px; }
  form.inline { display: inline; margin: 0; }
  .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 8; }
  @media (max-width: 800px) {
    .hamburger { display: flex; }
    .sidebar { position: fixed; left: 0; top: 0; z-index: 9; transform: translateX(-100%); transition: transform 0.2s; box-shadow: 0 0 30px rgba(0,0,0,0.4); }
    .sidebar.open { transform: translateX(0); }
    .overlay.open { display: block; }
    main { padding: 16px; }
  }
</style>
</head>
<body>
<div class="shell">
  <div class="overlay" id="overlay" onclick="toggleSidebar(false)"></div>
  <div class="sidebar" id="sidebar">
    <div class="brand"><span class="dot">${svgIcon('bot', 20)}</span> ADMIN BOT</div>
    <div class="navsection">Menu</div>
    ${navHtml}
    <a href="/admin/logout" class="navlink" style="margin-top:16px;"><span class="navicon">${svgIcon('logout')}</span>Keluar</a>
  </div>
  <div class="content">
    <div class="topbar">
      <div class="topbar-left">
        <button class="hamburger" onclick="toggleSidebar(true)">${svgIcon('menu', 22)}</button>
        <h1>${esc(title)}</h1>
      </div>
      <div class="topbar-right">
        <button class="icon-btn" id="themeToggle" onclick="toggleTheme()" title="Ganti tema"></button>
        <a href="/admin/logout" class="admin-pill"><span class="admin-avatar">A</span>Admin</a>
      </div>
    </div>
    <main>${bodyHtml}</main>
  </div>
</div>
<script>
  function toggleSidebar(open) {
    document.getElementById('sidebar').classList.toggle('open', open);
    document.getElementById('overlay').classList.toggle('open', open);
  }
  function renderThemeIcon() {
    var theme = document.documentElement.getAttribute('data-theme');
    document.getElementById('themeToggle').innerHTML =
      theme === 'dark'
        ? '${svgIcon('sun', 18)}'
        : '${svgIcon('moon', 18)}';
  }
  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('admin-theme', next);
    renderThemeIcon();
  }
  renderThemeIcon();
</script>
</body>
</html>`;
}

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Login - Admin Panel</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #0b0d12; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .box { background: #10131b; border: 1px solid #1e2330; padding: 32px 28px; border-radius: 16px; width: 90%; max-width: 340px; }
  .box .dot { width: 44px; height: 44px; border-radius: 12px; background: #4f7cff; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
  h1 { font-size: 18px; margin: 0 0 20px; }
  input { width: 100%; padding: 11px; border-radius: 8px; border: 1px solid #262d3d; background: #0b0d12; color: #fff; margin-top: 6px; margin-bottom: 14px; font-size: 14px; }
  label { font-size: 13px; color: #9aa4b2; }
  button { width: 100%; background: #4f7cff; color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600; }
  .error { background: #3a1414; color: #f87171; padding: 10px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
</style>
</head>
<body>
  <div class="box">
    <div class="dot">${svgIcon('bot', 22)}</div>
    <h1>Masuk ke Admin Panel</h1>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <form method="POST" action="/admin/login">
      <label>Username</label>
      <input type="text" name="username" required autofocus />
      <label>Password</label>
      <input type="password" name="password" required />
      <button type="submit">Masuk</button>
    </form>
  </div>
</body>
</html>`;
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

function mountAdminPanel(app) {
  app.use(
    session({
      secret: config.admin.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 12 * 60 * 60 * 1000 },
    })
  );

  // ---------- Login ----------

  app.get('/admin/login', (req, res) => res.send(loginPage()));

  app.post('/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    if (username === config.admin.username && password === config.admin.password) {
      req.session.isAdmin = true;
      return res.redirect('/admin');
    }
    res.send(loginPage('Username atau password salah.'));
  });

  app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/admin/login'));
  });

  // ---------- Dashboard ----------

  app.get('/admin', requireAdmin, (req, res) => {
    const stats = db.getStats();
    const recentOrders = db.getAllTransactions(5);

    const rows = recentOrders
      .map((t) => {
        let badge = `<span class="badge warn">Pending</span>`;
        if (t.status === 'settlement') badge = `<span class="badge ok">PAID</span>`;
        if (t.status === 'expire') badge = `<span class="badge bad">Expired</span>`;
        if (t.status === 'cancel') badge = `<span class="badge bad">Dibatalkan</span>`;
        return `<tr><td>${esc(t.productName)}</td><td>${formatRupiah(t.amount)}</td><td>${badge}</td></tr>`;
      })
      .join('');

    const body = `
      <div class="stats">
        <div class="stat-card"><div class="label">Total Pendapatan</div><div class="value">${formatRupiah(stats.totalRevenue)}</div></div>
        <div class="stat-card"><div class="label">Pesanan Sukses</div><div class="value">${stats.totalOrders}</div></div>
        <div class="stat-card"><div class="label">Total Pelanggan</div><div class="value">${stats.totalCustomers}</div></div>
        <div class="stat-card"><div class="label">Stok Akun Tersisa</div><div class="value">${stats.totalStock}</div></div>
      </div>
      <div class="card">
        <h2 style="margin-top:0;">Transaksi Terbaru</h2>
        <table>
          <thead><tr><th>Produk</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3" class="muted">Belum ada transaksi.</td></tr>'}</tbody>
        </table>
        <a class="btn secondary" href="/admin/orders">Lihat Semua Transaksi</a>
      </div>`;

    res.send(layout('Dashboard', body, 'dashboard'));
  });

  // ---------- Konfigurasi ----------

  app.get('/admin/settings', requireAdmin, (req, res) => {
    const settings = db.getSettings();
    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Teks & Banner Bot</h2>
        <p class="muted">Ini yang tampil saat user pertama kali mengetik <code>/start</code>. Gunakan <code>{name}</code> untuk menyisipkan nama pembeli otomatis.</p>
        <form method="POST" action="/admin/settings">
          <label>Teks Sambutan</label>
          <textarea name="welcomeText" rows="5">${esc(settings.welcomeText)}</textarea>
          <label>URL Gambar Banner (opsional, kosongkan jika tidak perlu)</label>
          <input type="text" name="bannerUrl" value="${esc(settings.bannerUrl)}" placeholder="https://contoh.com/banner.jpg" />
          <label>Teks Footer (opsional, belum dipakai di semua pesan, untuk pengembangan selanjutnya)</label>
          <textarea name="footerText" rows="2">${esc(settings.footerText)}</textarea>
          <button type="submit">Simpan Konfigurasi</button>
        </form>
      </div>`;
    res.send(layout('Konfigurasi', body, 'settings'));
  });

  app.post('/admin/settings', requireAdmin, (req, res) => {
    const { welcomeText, bannerUrl, footerText } = req.body;
    db.updateSettings({ welcomeText, bannerUrl, footerText });
    db.addLog('UPDATE_SETTINGS', 'Konfigurasi teks/banner bot diperbarui');
    res.redirect('/admin/settings');
  });

  // ---------- Produk & Markup ----------

  app.get('/admin/products', requireAdmin, (req, res) => {
    const products = db.getAllProducts();
    const rows = products
      .map((p) => {
        let priceStockCol;
        if (p.type === 'auto') {
          const durSummary = (p.durations || [])
            .map((d) => `${d.label}: ${formatRupiah(d.price)}`)
            .join('<br/>');
          priceStockCol = `<span class="badge ok">Auto</span><br/><span class="muted">${durSummary || 'Belum ada durasi'}</span>`;
        } else {
          priceStockCol = `${formatRupiah(p.price)}<br/>${
            p.stockCount > 0
              ? `<span class="badge ok">${p.stockCount} tersedia</span>`
              : `<span class="badge bad">Habis</span>`
          }`;
        }

        const stockAction =
          p.type === 'stock'
            ? `<a class="btn secondary" href="/admin/products/${p.id}/stock">Kelola Stok</a>`
            : '';

        return `
      <tr>
        <td><strong>${esc(p.name)}</strong><br/><span class="muted">${esc(p.id)}</span></td>
        <td>${priceStockCol}</td>
        <td>
          ${stockAction}
          <a class="btn secondary" href="/admin/products/${p.id}/edit">Edit</a>
          <form class="inline" method="POST" action="/admin/products/${p.id}/delete" onsubmit="return confirm('Yakin hapus produk ini beserta stoknya?');">
            <button class="danger" type="submit">Hapus</button>
          </form>
        </td>
      </tr>`;
      })
      .join('');

    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Daftar Produk</h2>
        <table>
          <thead><tr><th>Produk</th><th>Harga / Stok</th><th>Aksi</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3" class="muted">Belum ada produk.</td></tr>'}</tbody>
        </table>
        <a class="btn" href="/admin/products/new">+ Tambah Produk Baru</a>
      </div>`;
    res.send(layout('Produk & Markup', body, 'products'));
  });

  function productFormScript() {
    return `
      <script>
        function toggleProductType() {
          var type = document.querySelector('input[name="type"]:checked').value;
          document.getElementById('stockFields').style.display = type === 'stock' ? 'block' : 'none';
          document.getElementById('autoFields').style.display = type === 'auto' ? 'block' : 'none';
        }
      </script>`;
  }

  function durationRowsHtml(durations) {
    const rows = durations && durations.length ? durations : [{}, {}, {}];
    return rows
      .slice(0, 5)
      .map(
        (d) => `
        <div class="row">
          <div><label>Label (mis. Per Minggu)</label><input type="text" name="durLabel" value="${esc(d.label || '')}" /></div>
          <div><label>Jumlah Hari</label><input type="number" name="durDays" value="${d.days || ''}" min="1" /></div>
          <div><label>Harga (Rp)</label><input type="number" name="durPrice" value="${d.price || ''}" min="1" /></div>
        </div>`
      )
      .join('');
  }

  app.get('/admin/products/new', requireAdmin, (req, res) => {
    const servers = db.getServers();
    const serverOptions = servers.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.ip)})</option>`).join('');

    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Tambah Produk Baru</h2>
        <form method="POST" action="/admin/products">
          <label>ID Produk (unik, tanpa spasi, contoh: vpn-jp-30)</label>
          <input type="text" name="id" required pattern="[a-z0-9\\-]+" />
          <label>Nama Produk</label>
          <input type="text" name="name" required />
          <label>Deskripsi</label>
          <textarea name="description" rows="3"></textarea>

          <label>Tipe Produk</label>
          <div class="row">
            <label><input type="radio" name="type" value="stock" checked onchange="toggleProductType()" /> Stok Manual (kredensial ditempel admin)</label>
            <label><input type="radio" name="type" value="auto" onchange="toggleProductType()" /> Auto-Provisioning (dibuat otomatis via SSH)</label>
          </div>

          <div id="stockFields">
            <label>Harga Jual (Rp)</label>
            <input type="number" name="price" min="1" />
          </div>

          <div id="autoFields" style="display:none;">
            ${servers.length === 0 ? '<p class="muted">⚠️ Belum ada server VPN. Tambah dulu di menu <a href="/admin/vpn-servers">VPN Management</a>.</p>' : ''}
            <label>Server VPN</label>
            <select name="serverId"><option value="">- pilih server -</option>${serverOptions}</select>
            <label>Protokol</label>
            <select name="protocol">
              <option value="ssh">SSH</option>
              <option value="vmess">VMess</option>
              <option value="vless">VLess</option>
              <option value="trojan">Trojan</option>
              <option value="shadowsocks">Shadowsocks</option>
            </select>
            <label>Command Template (gunakan {username}, {password}, {days})</label>
            <textarea name="commandTemplate" rows="2" placeholder="bash /root/addssh.sh {username} {password} {days}"></textarea>
            <label style="margin-top:16px;">Pilihan Durasi & Harga</label>
            <p class="muted">Isi minimal 1 baris. Kosongkan baris yang tidak dipakai.</p>
            ${durationRowsHtml()}
          </div>

          <button type="submit">Simpan Produk</button>
        </form>
      </div>
      ${productFormScript()}`;
    res.send(layout('Tambah Produk', body, 'products'));
  });

  function parseDurationsFromBody(body) {
    const labels = [].concat(body.durLabel || []);
    const days = [].concat(body.durDays || []);
    const prices = [].concat(body.durPrice || []);
    const durations = [];
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] && days[i] && prices[i]) {
        durations.push({ label: labels[i], days: Number(days[i]), price: Number(prices[i]) });
      }
    }
    return durations;
  }

  app.post('/admin/products', requireAdmin, (req, res) => {
    try {
      const { id, name, price, description, type, serverId, protocol, commandTemplate } = req.body;
      const durations = parseDurationsFromBody(req.body);
      db.addProduct({ id: id.trim(), name, price, description, type, serverId, protocol, commandTemplate, durations });
      db.addLog('ADD_PRODUCT', `Produk baru: ${name} (${id}) [${type}]`);
      res.redirect('/admin/products');
    } catch (err) {
      res.send(layout('Error', `<div class="card"><p>❌ ${esc(err.message)}</p><a class="btn" href="/admin/products/new">Kembali</a></div>`, 'products'));
    }
  });

  app.get('/admin/products/:id/edit', requireAdmin, (req, res) => {
    const product = db.getProductById(req.params.id);
    if (!product) return res.redirect('/admin/products');

    const servers = db.getServers();
    const serverOptions = servers
      .map((s) => `<option value="${esc(s.id)}" ${product.serverId === s.id ? 'selected' : ''}>${esc(s.name)} (${esc(s.ip)})</option>`)
      .join('');

    const protocolOptions = ['ssh', 'vmess', 'vless', 'trojan', 'shadowsocks']
      .map((p) => `<option value="${p}" ${product.protocol === p ? 'selected' : ''}>${p.toUpperCase()}</option>`)
      .join('');

    const isAuto = product.type === 'auto';

    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Edit Produk</h2>
        <p class="muted">Tipe produk (${isAuto ? 'Auto-Provisioning' : 'Stok Manual'}) tidak bisa diubah setelah dibuat. Hapus &amp; buat produk baru jika perlu ganti tipe.</p>
        <form method="POST" action="/admin/products/${product.id}">
          <label>ID Produk</label>
          <input type="text" value="${esc(product.id)}" disabled />
          <label>Nama Produk</label>
          <input type="text" name="name" value="${esc(product.name)}" required />
          <label>Deskripsi</label>
          <textarea name="description" rows="3">${esc(product.description)}</textarea>

          ${
            isAuto
              ? `
          <label>Server VPN</label>
          <select name="serverId"><option value="">- pilih server -</option>${serverOptions}</select>
          <label>Protokol</label>
          <select name="protocol">${protocolOptions}</select>
          <label>Command Template (gunakan {username}, {password}, {days})</label>
          <textarea name="commandTemplate" rows="2">${esc(product.commandTemplate || '')}</textarea>
          <label style="margin-top:16px;">Pilihan Durasi & Harga</label>
          ${durationRowsHtml(product.durations)}
          `
              : `
          <label>Harga Jual (Rp)</label>
          <input type="number" name="price" value="${product.price}" min="1" required />
          `
          }

          <button type="submit">Simpan Perubahan</button>
        </form>
      </div>`;
    res.send(layout('Edit Produk', body, 'products'));
  });

  app.post('/admin/products/:id', requireAdmin, (req, res) => {
    const { name, price, description, serverId, protocol, commandTemplate } = req.body;
    const durations = parseDurationsFromBody(req.body);
    db.updateProduct(req.params.id, { name, price, description, serverId, protocol, commandTemplate, durations });
    db.addLog('EDIT_PRODUCT', `Produk diedit: ${req.params.id}`);
    res.redirect('/admin/products');
  });

  app.post('/admin/products/:id/delete', requireAdmin, (req, res) => {
    db.deleteProduct(req.params.id);
    db.addLog('DELETE_PRODUCT', `Produk dihapus: ${req.params.id}`);
    res.redirect('/admin/products');
  });

  app.get('/admin/products/:id/stock', requireAdmin, (req, res) => {
    const product = db.getProductById(req.params.id);
    if (!product) return res.redirect('/admin/products');
    const stock = db.getStock(product.id);
    const stockRows = stock.map((line, i) => `<tr><td>${i + 1}</td><td><code>${esc(line)}</code></td></tr>`).join('');

    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Kelola Stok: ${esc(product.name)}</h2>
        <p class="muted">Stok saat ini: <strong>${stock.length}</strong> akun tersedia</p>
        <label>Tambah Stok (satu akun per baris)</label>
        <form method="POST" action="/admin/products/${product.id}/stock">
          <textarea name="lines" rows="6" placeholder="user1:pass1&#10;user2:pass2&#10;user3:pass3"></textarea>
          <button type="submit">Tambahkan ke Stok</button>
        </form>
      </div>
      <div class="card">
        <h2 style="margin-top:0;">Daftar Stok Tersedia</h2>
        <table>
          <thead><tr><th>#</th><th>Kredensial</th></tr></thead>
          <tbody>${stockRows || '<tr><td colspan="2" class="muted">Stok kosong.</td></tr>'}</tbody>
        </table>
      </div>
      <a class="btn secondary" href="/admin/products">⬅️ Kembali ke Daftar Produk</a>`;
    res.send(layout('Kelola Stok', body, 'products'));
  });

  app.post('/admin/products/:id/stock', requireAdmin, (req, res) => {
    const lines = (req.body.lines || '').split('\n');
    const added = db.addStockLines(req.params.id, lines);
    db.addLog('ADD_STOCK', `${added} akun ditambahkan ke ${req.params.id}`);
    res.redirect(`/admin/products/${req.params.id}/stock`);
  });

  // ---------- VPN Management (server untuk auto-provisioning) ----------

  app.get('/admin/vpn-servers', requireAdmin, (req, res) => {
    const servers = db.getServers();
    const rows = servers
      .map(
        (s) => `
      <tr>
        <td><strong>${esc(s.name)}</strong><br/><span class="muted">${esc(s.id)}</span></td>
        <td>${esc(s.ip)}:${esc(s.sshPort)}</td>
        <td>${esc(s.sshUser)}</td>
        <td>${esc(s.isp) || '-'}</td>
        <td>
          <a class="btn secondary" href="/admin/vpn-servers/${s.id}/edit">Edit</a>
          <form class="inline" method="POST" action="/admin/vpn-servers/${s.id}/delete" onsubmit="return confirm('Yakin hapus server ini? Produk auto yang memakainya akan gagal jalan.');">
            <button class="danger" type="submit">Hapus</button>
          </form>
        </td>
      </tr>`
      )
      .join('');

    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Daftar Server VPN</h2>
        <p class="muted">Server ini dipakai untuk membuat akun otomatis via SSH saat ada produk tipe "Auto-Provisioning" yang dibeli.</p>
        <table>
          <thead><tr><th>Nama</th><th>IP:Port</th><th>User SSH</th><th>ISP</th><th>Aksi</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">Belum ada server.</td></tr>'}</tbody>
        </table>
        <a class="btn" href="/admin/vpn-servers/new">+ Tambah Server Baru</a>
      </div>
      <div class="card">
        <p class="muted">🔒 <strong>Keamanan:</strong> Password SSH disimpan di file <code>data/db.json</code> di VPS bot ini. Pastikan file itu tidak pernah ikut ter-upload ke GitHub (sudah otomatis diabaikan lewat <code>.gitignore</code>) dan VPS ini aman dari akses orang lain.</p>
      </div>`;
    res.send(layout('VPN Management', body, 'vpnservers'));
  });

  app.get('/admin/vpn-servers/new', requireAdmin, (req, res) => {
    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Tambah Server VPN</h2>
        <form method="POST" action="/admin/vpn-servers">
          <label>ID Server (unik, tanpa spasi, contoh: sg-1)</label>
          <input type="text" name="id" required pattern="[a-z0-9\\-]+" />
          <label>Nama Server</label>
          <input type="text" name="name" required placeholder="Server Singapore 1" />
          <div class="row">
            <div><label>IP Address</label><input type="text" name="ip" required placeholder="103.xx.xx.xx" /></div>
            <div><label>SSH Port</label><input type="number" name="sshPort" value="22" /></div>
          </div>
          <div class="row">
            <div><label>SSH Username</label><input type="text" name="sshUser" value="root" /></div>
            <div><label>SSH Password</label><input type="password" name="sshPassword" required /></div>
          </div>
          <label>ISP / Provider (opsional)</label>
          <input type="text" name="isp" placeholder="DigitalOcean, Vultr, Biznet, dll" />
          <label>Catatan (opsional)</label>
          <textarea name="notes" rows="2"></textarea>
          <button type="submit">Simpan Server</button>
        </form>
      </div>`;
    res.send(layout('Tambah Server VPN', body, 'vpnservers'));
  });

  app.post('/admin/vpn-servers', requireAdmin, (req, res) => {
    try {
      const { id, name, ip, sshPort, sshUser, sshPassword, isp, notes } = req.body;
      db.addServer({ id: id.trim(), name, ip, sshPort, sshUser, sshPassword, isp, notes });
      db.addLog('ADD_SERVER', `Server baru: ${name} (${ip})`);
      res.redirect('/admin/vpn-servers');
    } catch (err) {
      res.send(layout('Error', `<div class="card"><p>❌ ${esc(err.message)}</p><a class="btn" href="/admin/vpn-servers/new">Kembali</a></div>`, 'vpnservers'));
    }
  });

  app.get('/admin/vpn-servers/:id/edit', requireAdmin, (req, res) => {
    const server = db.getServerById(req.params.id);
    if (!server) return res.redirect('/admin/vpn-servers');
    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Edit Server VPN</h2>
        <form method="POST" action="/admin/vpn-servers/${server.id}">
          <label>ID Server</label>
          <input type="text" value="${esc(server.id)}" disabled />
          <label>Nama Server</label>
          <input type="text" name="name" value="${esc(server.name)}" required />
          <div class="row">
            <div><label>IP Address</label><input type="text" name="ip" value="${esc(server.ip)}" required /></div>
            <div><label>SSH Port</label><input type="number" name="sshPort" value="${server.sshPort}" /></div>
          </div>
          <div class="row">
            <div><label>SSH Username</label><input type="text" name="sshUser" value="${esc(server.sshUser)}" /></div>
            <div><label>SSH Password (kosongkan jika tidak ingin mengubah)</label><input type="password" name="sshPassword" placeholder="••••••••" /></div>
          </div>
          <label>ISP / Provider</label>
          <input type="text" name="isp" value="${esc(server.isp)}" />
          <label>Catatan</label>
          <textarea name="notes" rows="2">${esc(server.notes)}</textarea>
          <button type="submit">Simpan Perubahan</button>
        </form>
      </div>`;
    res.send(layout('Edit Server VPN', body, 'vpnservers'));
  });

  app.post('/admin/vpn-servers/:id', requireAdmin, (req, res) => {
    const { name, ip, sshPort, sshUser, sshPassword, isp, notes } = req.body;
    db.updateServer(req.params.id, { name, ip, sshPort, sshUser, sshPassword, isp, notes });
    db.addLog('EDIT_SERVER', `Server diedit: ${req.params.id}`);
    res.redirect('/admin/vpn-servers');
  });

  app.post('/admin/vpn-servers/:id/delete', requireAdmin, (req, res) => {
    db.deleteServer(req.params.id);
    db.addLog('DELETE_SERVER', `Server dihapus: ${req.params.id}`);
    res.redirect('/admin/vpn-servers');
  });

  // ---------- Transaksi ----------

  app.get('/admin/orders', requireAdmin, (req, res) => {
    const transactions = db.getAllTransactions(200);
    const rows = transactions
      .map((t) => {
        let badge = `<span class="badge warn">Pending</span>`;
        if (t.status === 'settlement') badge = `<span class="badge ok">PAID</span>`;
        if (t.status === 'expire') badge = `<span class="badge bad">Expired</span>`;
        if (t.status === 'cancel') badge = `<span class="badge bad">Dibatalkan</span>`;
        const waktu = new Date(t.createdAt).toLocaleString('id-ID');
        return `<tr>
          <td>${waktu}</td>
          <td>${esc(t.productName)}<br/><span class="muted">Chat ID: ${esc(t.chatId)}</span></td>
          <td>${formatRupiah(t.amount)}</td>
          <td>${badge}</td>
          <td>${t.deliveredAccount ? `<code>${esc(t.deliveredAccount)}</code>` : '-'}</td>
        </tr>`;
      })
      .join('');

    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Riwayat Transaksi (200 terbaru)</h2>
        <table>
          <thead><tr><th>Waktu</th><th>Produk / Pembeli</th><th>Jumlah</th><th>Status</th><th>Akun Terkirim</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">Belum ada transaksi.</td></tr>'}</tbody>
        </table>
      </div>`;
    res.send(layout('Transaksi', body, 'orders'));
  });

  // ---------- Kelola User ----------

  app.get('/admin/customers', requireAdmin, (req, res) => {
    const customers = db.getCustomers();
    const rows = customers
      .map((c) => {
        const waktu = new Date(c.lastOrderAt).toLocaleString('id-ID');
        const blocked = db.isBlocked(c.chatId);
        return `<tr>
          <td>${esc(c.chatId)}</td>
          <td>${c.totalOrders}</td>
          <td>${formatRupiah(c.totalSpent)}</td>
          <td>${waktu}</td>
          <td>${blocked ? '<span class="badge bad">Diblokir</span>' : '<span class="badge ok">Aktif</span>'}</td>
          <td>
            <a class="btn secondary" href="/admin/broadcast?to=${c.chatId}">Kirim Pesan</a>
            <form class="inline" method="POST" action="/admin/customers/${c.chatId}/${blocked ? 'unblock' : 'block'}">
              <button class="${blocked ? '' : 'danger'}" type="submit">${blocked ? 'Buka Blokir' : 'Blokir'}</button>
            </form>
          </td>
        </tr>`;
      })
      .join('');

    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Daftar User (${customers.length})</h2>
        <p class="muted">Diurutkan dari total belanja terbesar. User yang diblokir tidak bisa lagi menggunakan bot.</p>
        <table>
          <thead><tr><th>Chat ID</th><th>Jml Pembelian</th><th>Total Belanja</th><th>Order Terakhir</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="muted">Belum ada user.</td></tr>'}</tbody>
        </table>
      </div>`;
    res.send(layout('Kelola User', body, 'customers'));
  });

  app.post('/admin/customers/:chatId/block', requireAdmin, (req, res) => {
    db.blockUser(req.params.chatId);
    db.addLog('BLOCK_USER', `User ${req.params.chatId} diblokir`);
    res.redirect('/admin/customers');
  });

  app.post('/admin/customers/:chatId/unblock', requireAdmin, (req, res) => {
    db.unblockUser(req.params.chatId);
    db.addLog('UNBLOCK_USER', `User ${req.params.chatId} dibuka blokirnya`);
    res.redirect('/admin/customers');
  });

  // ---------- Activity Logs ----------

  app.get('/admin/logs', requireAdmin, (req, res) => {
    const logs = db.getLogs(200);
    const rows = logs
      .map((l) => `<tr><td>${new Date(l.at).toLocaleString('id-ID')}</td><td><span class="badge warn">${esc(l.action)}</span></td><td>${esc(l.detail)}</td></tr>`)
      .join('');
    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Activity Logs (200 terbaru)</h2>
        <table>
          <thead><tr><th>Waktu</th><th>Aksi</th><th>Detail</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3" class="muted">Belum ada aktivitas tercatat.</td></tr>'}</tbody>
        </table>
      </div>`;
    res.send(layout('Activity Logs', body, 'logs'));
  });

  // ---------- Broadcast ----------

  app.get('/admin/broadcast', requireAdmin, (req, res) => {
    const prefillTo = req.query.to || '';
    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Kirim Pesan / Broadcast</h2>
        <p class="muted">Kosongkan "Chat ID Tujuan" untuk mengirim ke <strong>SEMUA user</strong> yang pernah order.</p>
        <form method="POST" action="/admin/broadcast">
          <label>Chat ID Tujuan (kosongkan untuk broadcast ke semua)</label>
          <input type="text" name="to" value="${esc(prefillTo)}" placeholder="Contoh: 123456789" />
          <label>Isi Pesan</label>
          <textarea name="message" rows="5" placeholder="Contoh: Promo spesial hari ini!" required></textarea>
          <button type="submit" onclick="return confirm('Kirim pesan ini sekarang?');">Kirim</button>
        </form>
      </div>`;
    res.send(layout('Broadcast', body, 'broadcast'));
  });

  app.post('/admin/broadcast', requireAdmin, async (req, res) => {
    const { to, message } = req.body;
    const targets = to && to.trim() ? [to.trim()] : db.getCustomers().map((c) => c.chatId);

    let success = 0;
    let failed = 0;
    for (const chatId of targets) {
      try {
        await bot.telegram.sendMessage(chatId, message);
        success += 1;
      } catch (err) {
        failed += 1;
        console.error(`[BROADCAST] Gagal kirim ke ${chatId}:`, err.message);
      }
    }
    db.addLog('BROADCAST', `Terkirim ke ${success} user, gagal ${failed} (target: ${to ? to : 'SEMUA'})`);

    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Hasil Broadcast</h2>
        <p>✅ Berhasil terkirim: <strong>${success}</strong></p>
        <p>❌ Gagal terkirim: <strong>${failed}</strong> ${failed > 0 ? '<span class="muted">(kemungkinan user pernah blokir bot)</span>' : ''}</p>
        <a class="btn" href="/admin/broadcast">Kirim Lagi</a>
      </div>`;
    res.send(layout('Hasil Broadcast', body, 'broadcast'));
  });

  // ---------- Backup & Restore ----------

  app.get('/admin/backup', requireAdmin, (req, res) => {
    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Download Backup</h2>
        <p class="muted">Simpan file ini secara rutin (misal tiap hari) sebagai cadangan seluruh data: produk, stok, transaksi, pengaturan, dan daftar user.</p>
        <a class="btn" href="/admin/backup/download">⬇️ Download db.json Sekarang</a>
      </div>
      <div class="card">
        <h2 style="margin-top:0;">Restore dari Backup</h2>
        <p class="muted">⚠️ Ini akan MENIMPA seluruh data yang ada sekarang dengan isi file backup. Pastikan file benar sebelum lanjut.</p>
        <p class="muted">Buka file backup <code>.json</code> kamu dengan text editor (Notepad/aplikasi Files di HP), copy semua isinya, lalu tempel di sini:</p>
        <form method="POST" action="/admin/backup/restore">
          <label>Isi JSON Backup</label>
          <textarea name="rawJson" rows="8" placeholder="Tempel isi file backup-xxxx.json di sini" required></textarea>
          <button type="submit" class="danger" onclick="return confirm('Yakin? Data saat ini akan ditimpa sepenuhnya.');">Restore Sekarang</button>
        </form>
      </div>`;
    res.send(layout('Backup & Restore', body, 'backup'));
  });

  app.get('/admin/backup/download', requireAdmin, (req, res) => {
    const backup = db.exportBackup();
    const filename = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));
  });

  // Restore lewat textarea (paste JSON langsung) - tanpa perlu dependency upload file tambahan
  app.post('/admin/backup/restore', requireAdmin, (req, res) => {
    try {
      const raw = req.body.rawJson;
      if (!raw || !raw.trim()) {
        throw new Error('Tempel isi JSON backup di kotak teks yang tersedia (upload file langsung belum didukung, silakan buka file .json dengan text editor lalu copy-paste isinya).');
      }
      const parsed = JSON.parse(raw);
      db.restoreBackup(parsed);
      db.addLog('RESTORE_BACKUP', 'Data dipulihkan dari backup');
      res.send(layout('Restore Berhasil', `<div class="card"><p>✅ Data berhasil dipulihkan dari backup.</p><a class="btn" href="/admin">Ke Dashboard</a></div>`, 'backup'));
    } catch (err) {
      res.send(layout('Restore Gagal', `<div class="card"><p>❌ ${esc(err.message)}</p><a class="btn secondary" href="/admin/backup">Kembali</a></div>`, 'backup'));
    }
  });
}

module.exports = mountAdminPanel;
