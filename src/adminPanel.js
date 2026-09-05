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

const NAV = [
  { key: 'dashboard', href: '/admin', icon: '📊', label: 'Dashboard' },
  { key: 'settings', href: '/admin/settings', icon: '⚙️', label: 'Konfigurasi' },
  { key: 'orders', href: '/admin/orders', icon: '💳', label: 'Transaksi' },
  { key: 'products', href: '/admin/products', icon: '📦', label: 'Produk & Markup' },
  { key: 'customers', href: '/admin/customers', icon: '👥', label: 'Kelola User' },
  { key: 'logs', href: '/admin/logs', icon: '📝', label: 'Activity Logs' },
  { key: 'broadcast', href: '/admin/broadcast', icon: '📢', label: 'Broadcast' },
  { key: 'backup', href: '/admin/backup', icon: '💾', label: 'Backup & Restore' },
];

function layout(title, bodyHtml, activeKey = '') {
  const navHtml = NAV.map(
    (n) => `<a href="${n.href}" class="navlink${n.key === activeKey ? ' active' : ''}"><span class="navicon">${n.icon}</span>${n.label}</a>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} - Admin Panel</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; background: #0b0d12; color: #e6e6e6; }
  .shell { display: flex; min-height: 100vh; }
  .sidebar { width: 250px; background: #10131b; border-right: 1px solid #1e2330; padding: 18px 12px; flex-shrink: 0; }
  .brand { display: flex; align-items: center; gap: 10px; padding: 8px 10px 20px; font-weight: 700; font-size: 16px; }
  .brand .dot { width: 32px; height: 32px; border-radius: 8px; background: #4f7cff; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .navsection { color: #6b7280; font-size: 11px; letter-spacing: 1px; padding: 6px 10px; text-transform: uppercase; }
  .navlink { display: flex; align-items: center; gap: 10px; color: #9aa4b2; text-decoration: none; padding: 11px 12px; border-radius: 10px; font-size: 14px; margin-bottom: 2px; }
  .navicon { font-size: 16px; width: 20px; text-align: center; }
  .navlink.active { background: #1c2536; color: #7ba1ff; }
  .navlink:hover { background: #161b26; color: #fff; }
  .topbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #1e2330; }
  .topbar h1 { font-size: 18px; margin: 0; }
  .content { flex: 1; min-width: 0; }
  main { padding: 20px 24px; max-width: 1000px; }
  .card { background: #10131b; border: 1px solid #1e2330; border-radius: 14px; padding: 20px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #1e2330; vertical-align: top; }
  th { color: #9aa4b2; font-weight: 600; font-size: 12px; text-transform: uppercase; }
  input, textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #262d3d; background: #0b0d12; color: #fff; font-size: 14px; margin-top: 4px; }
  label { font-size: 13px; color: #9aa4b2; display: block; margin-top: 12px; }
  button, .btn { background: #4f7cff; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 12px; }
  button.danger, .btn.danger { background: #e5484d; }
  button.secondary, .btn.secondary { background: #1c2536; color: #cbd5e1; }
  .badge { padding: 3px 10px; border-radius: 999px; font-size: 12px; }
  .badge.ok { background: #103a24; color: #4ade80; }
  .badge.warn { background: #3a2e10; color: #fbbf24; }
  .badge.bad { background: #3a1414; color: #f87171; }
  .muted { color: #9aa4b2; font-size: 13px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; }
  .row > * { flex: 1; min-width: 140px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 18px; }
  .stat-card { background: #10131b; border: 1px solid #1e2330; border-radius: 14px; padding: 18px; }
  .stat-card .label { color: #9aa4b2; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-card .value { font-size: 24px; font-weight: 700; margin-top: 8px; }
  code { background: #0b0d12; padding: 2px 6px; border-radius: 6px; }
  form.inline { display: inline; margin: 0; }
  @media (max-width: 800px) {
    .shell { flex-direction: column; }
    .sidebar { width: 100%; display: flex; overflow-x: auto; gap: 4px; padding: 10px; }
    .brand { display: none; }
    .navlink { flex-shrink: 0; }
    .navsection { display: none; }
  }
</style>
</head>
<body>
<div class="shell">
  <div class="sidebar">
    <div class="brand"><span class="dot">🤖</span> Admin Panel</div>
    <div class="navsection">Menu</div>
    ${navHtml}
    <a href="/admin/logout" class="navlink" style="margin-top:16px;"><span class="navicon">🚪</span>Keluar</a>
  </div>
  <div class="content">
    <div class="topbar"><h1>${esc(title)}</h1></div>
    <main>${bodyHtml}</main>
  </div>
</div>
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
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #0b0d12; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .box { background: #10131b; border: 1px solid #1e2330; padding: 28px; border-radius: 14px; width: 90%; max-width: 340px; }
  h1 { font-size: 18px; margin-top: 0; }
  input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #262d3d; background: #0b0d12; color: #fff; margin-top: 6px; margin-bottom: 14px; font-size: 14px; }
  label { font-size: 13px; color: #9aa4b2; }
  button { width: 100%; background: #4f7cff; color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 14px; cursor: pointer; }
  .error { background: #3a1414; color: #f87171; padding: 10px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
</style>
</head>
<body>
  <div class="box">
    <h1>🔐 Admin Panel Login</h1>
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
      .map(
        (p) => `
      <tr>
        <td><strong>${esc(p.name)}</strong><br/><span class="muted">${esc(p.id)}</span></td>
        <td>${formatRupiah(p.price)}</td>
        <td>${p.stockCount > 0 ? `<span class="badge ok">${p.stockCount} tersedia</span>` : `<span class="badge bad">Habis</span>`}</td>
        <td>
          <a class="btn secondary" href="/admin/products/${p.id}/stock">Kelola Stok</a>
          <a class="btn secondary" href="/admin/products/${p.id}/edit">Edit</a>
          <form class="inline" method="POST" action="/admin/products/${p.id}/delete" onsubmit="return confirm('Yakin hapus produk ini beserta stoknya?');">
            <button class="danger" type="submit">Hapus</button>
          </form>
        </td>
      </tr>`
      )
      .join('');

    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Daftar Produk</h2>
        <table>
          <thead><tr><th>Produk</th><th>Harga Jual</th><th>Stok</th><th>Aksi</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="muted">Belum ada produk.</td></tr>'}</tbody>
        </table>
        <a class="btn" href="/admin/products/new">+ Tambah Produk Baru</a>
      </div>`;
    res.send(layout('Produk & Markup', body, 'products'));
  });

  app.get('/admin/products/new', requireAdmin, (req, res) => {
    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Tambah Produk Baru</h2>
        <form method="POST" action="/admin/products">
          <label>ID Produk (unik, tanpa spasi, contoh: vpn-jp-30)</label>
          <input type="text" name="id" required pattern="[a-z0-9\\-]+" />
          <label>Nama Produk</label>
          <input type="text" name="name" required />
          <label>Harga Jual (Rp)</label>
          <input type="number" name="price" min="1" required />
          <label>Deskripsi</label>
          <textarea name="description" rows="3"></textarea>
          <button type="submit">Simpan Produk</button>
        </form>
      </div>`;
    res.send(layout('Tambah Produk', body, 'products'));
  });

  app.post('/admin/products', requireAdmin, (req, res) => {
    try {
      const { id, name, price, description } = req.body;
      db.addProduct({ id: id.trim(), name, price, description });
      db.addLog('ADD_PRODUCT', `Produk baru: ${name} (${id})`);
      res.redirect('/admin/products');
    } catch (err) {
      res.send(layout('Error', `<div class="card"><p>❌ ${esc(err.message)}</p><a class="btn" href="/admin/products/new">Kembali</a></div>`, 'products'));
    }
  });

  app.get('/admin/products/:id/edit', requireAdmin, (req, res) => {
    const product = db.getProductById(req.params.id);
    if (!product) return res.redirect('/admin/products');
    const body = `
      <div class="card">
        <h2 style="margin-top:0;">Edit Produk</h2>
        <form method="POST" action="/admin/products/${product.id}">
          <label>ID Produk</label>
          <input type="text" value="${esc(product.id)}" disabled />
          <label>Nama Produk</label>
          <input type="text" name="name" value="${esc(product.name)}" required />
          <label>Harga Jual (Rp)</label>
          <input type="number" name="price" value="${product.price}" min="1" required />
          <label>Deskripsi</label>
          <textarea name="description" rows="3">${esc(product.description)}</textarea>
          <button type="submit">Simpan Perubahan</button>
        </form>
      </div>`;
    res.send(layout('Edit Produk', body, 'products'));
  });

  app.post('/admin/products/:id', requireAdmin, (req, res) => {
    const { name, price, description } = req.body;
    db.updateProduct(req.params.id, { name, price, description });
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
