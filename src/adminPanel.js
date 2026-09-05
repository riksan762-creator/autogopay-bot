const session = require('express-session');
const config = require('./config');
const db = require('./db');
const { bot } = require('./bot');

function formatRupiah(n) {
  return `Rp${Number(n).toLocaleString('id-ID')}`;
}

function layout(title, bodyHtml, activeNav = '') {
  const nav = [
    { key: 'dashboard', href: '/admin', label: 'Produk' },
    { key: 'orders', href: '/admin/orders', label: 'Riwayat Pesanan' },
    { key: 'customers', href: '/admin/customers', label: 'Pelanggan' },
    { key: 'broadcast', href: '/admin/broadcast', label: 'Broadcast' },
  ];
  const navHtml = nav
    .map(
      (n) =>
        `<a href="${n.href}" class="navlink${n.key === activeNav ? ' active' : ''}">${n.label}</a>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} - Admin Panel</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; background: #0f1115; color: #e6e6e6; }
  header { background: #161923; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
  header h1 { font-size: 18px; margin: 0; }
  nav { display: flex; gap: 8px; flex-wrap: wrap; }
  .navlink { color: #9aa4b2; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 14px; }
  .navlink.active, .navlink:hover { background: #2a2f3d; color: #fff; }
  main { padding: 20px; max-width: 900px; margin: 0 auto; }
  .card { background: #161923; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #2a2f3d; vertical-align: top; }
  th { color: #9aa4b2; font-weight: 600; }
  input, textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #2a2f3d; background: #0f1115; color: #fff; font-size: 14px; margin-top: 4px; }
  label { font-size: 13px; color: #9aa4b2; display: block; margin-top: 12px; }
  button, .btn { background: #4f7cff; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 12px; }
  button.danger, .btn.danger { background: #e5484d; }
  button.secondary, .btn.secondary { background: #2a2f3d; }
  .badge { padding: 3px 8px; border-radius: 999px; font-size: 12px; }
  .badge.ok { background: #1e3a2a; color: #4ade80; }
  .badge.warn { background: #3a2e1e; color: #fbbf24; }
  .badge.bad { background: #3a1e1e; color: #f87171; }
  .muted { color: #9aa4b2; font-size: 13px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; }
  .row > * { flex: 1; min-width: 140px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .stat-card { background: #161923; border-radius: 12px; padding: 16px; }
  .stat-card .label { color: #9aa4b2; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-card .value { font-size: 22px; font-weight: 700; margin-top: 6px; }
  form.inline { display: inline; margin: 0; }
</style>
</head>
<body>
<header>
  <h1>🛠️ Admin Panel</h1>
  <nav>${navHtml}<a href="/admin/logout" class="navlink">Keluar</a></nav>
</header>
<main>${bodyHtml}</main>
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
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #0f1115; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .box { background: #161923; padding: 28px; border-radius: 12px; width: 90%; max-width: 340px; }
  h1 { font-size: 18px; margin-top: 0; }
  input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #2a2f3d; background: #0f1115; color: #fff; margin-top: 6px; margin-bottom: 14px; font-size: 14px; }
  label { font-size: 13px; color: #9aa4b2; }
  button { width: 100%; background: #4f7cff; color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 14px; cursor: pointer; }
  .error { background: #3a1e1e; color: #f87171; padding: 10px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
</style>
</head>
<body>
  <div class="box">
    <h1>🔐 Admin Panel Login</h1>
    ${error ? `<div class="error">${error}</div>` : ''}
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
      cookie: { maxAge: 12 * 60 * 60 * 1000 }, // 12 jam
    })
  );

  // ---------- Login ----------

  app.get('/admin/login', (req, res) => {
    res.send(loginPage());
  });

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

  // ---------- Dashboard: daftar produk ----------

  app.get('/admin', requireAdmin, (req, res) => {
    const products = db.getAllProducts();
    const stats = db.getStats();

    const rows = products
      .map(
        (p) => `
      <tr>
        <td><strong>${p.name}</strong><br/><span class="muted">${p.id}</span></td>
        <td>${formatRupiah(p.price)}</td>
        <td>${
          p.stockCount > 0
            ? `<span class="badge ok">${p.stockCount} tersedia</span>`
            : `<span class="badge bad">Habis</span>`
        }</td>
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
      <div class="stats">
        <div class="stat-card"><div class="label">Total Pendapatan</div><div class="value">${formatRupiah(stats.totalRevenue)}</div></div>
        <div class="stat-card"><div class="label">Pesanan Sukses</div><div class="value">${stats.totalOrders}</div></div>
        <div class="stat-card"><div class="label">Total Pelanggan</div><div class="value">${stats.totalCustomers}</div></div>
        <div class="stat-card"><div class="label">Stok Akun Tersisa</div><div class="value">${stats.totalStock}</div></div>
      </div>

      <div class="card">
        <h2>Daftar Produk</h2>
        <table>
          <thead><tr><th>Produk</th><th>Harga</th><th>Stok</th><th>Aksi</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="muted">Belum ada produk.</td></tr>'}</tbody>
        </table>
        <a class="btn" href="/admin/products/new">+ Tambah Produk Baru</a>
      </div>`;

    res.send(layout('Produk', body, 'dashboard'));
  });

  // ---------- Tambah produk ----------

  app.get('/admin/products/new', requireAdmin, (req, res) => {
    const body = `
      <div class="card">
        <h2>Tambah Produk Baru</h2>
        <form method="POST" action="/admin/products">
          <label>ID Produk (unik, tanpa spasi, contoh: vpn-jp-30)</label>
          <input type="text" name="id" required pattern="[a-z0-9\\-]+" />
          <label>Nama Produk</label>
          <input type="text" name="name" required />
          <div class="row">
            <div>
              <label>Harga (Rp)</label>
              <input type="number" name="price" min="1" required />
            </div>
          </div>
          <label>Deskripsi</label>
          <textarea name="description" rows="3"></textarea>
          <button type="submit">Simpan Produk</button>
        </form>
      </div>`;
    res.send(layout('Tambah Produk', body, 'dashboard'));
  });

  app.post('/admin/products', requireAdmin, (req, res) => {
    try {
      const { id, name, price, description } = req.body;
      db.addProduct({ id: id.trim(), name, price, description });
      res.redirect('/admin');
    } catch (err) {
      res.send(layout('Error', `<div class="card"><p>❌ ${err.message}</p><a class="btn" href="/admin/products/new">Kembali</a></div>`));
    }
  });

  // ---------- Edit produk ----------

  app.get('/admin/products/:id/edit', requireAdmin, (req, res) => {
    const product = db.getProductById(req.params.id);
    if (!product) return res.redirect('/admin');

    const body = `
      <div class="card">
        <h2>Edit Produk</h2>
        <form method="POST" action="/admin/products/${product.id}">
          <label>ID Produk</label>
          <input type="text" value="${product.id}" disabled />
          <label>Nama Produk</label>
          <input type="text" name="name" value="${product.name}" required />
          <label>Harga (Rp)</label>
          <input type="number" name="price" value="${product.price}" min="1" required />
          <label>Deskripsi</label>
          <textarea name="description" rows="3">${product.description || ''}</textarea>
          <button type="submit">Simpan Perubahan</button>
        </form>
      </div>`;
    res.send(layout('Edit Produk', body, 'dashboard'));
  });

  app.post('/admin/products/:id', requireAdmin, (req, res) => {
    const { name, price, description } = req.body;
    db.updateProduct(req.params.id, { name, price, description });
    res.redirect('/admin');
  });

  app.post('/admin/products/:id/delete', requireAdmin, (req, res) => {
    db.deleteProduct(req.params.id);
    res.redirect('/admin');
  });

  // ---------- Kelola stok akun ----------

  app.get('/admin/products/:id/stock', requireAdmin, (req, res) => {
    const product = db.getProductById(req.params.id);
    if (!product) return res.redirect('/admin');

    const stock = db.getStock(product.id);
    const stockRows = stock
      .map((line, i) => `<tr><td>${i + 1}</td><td><code>${line}</code></td></tr>`)
      .join('');

    const body = `
      <div class="card">
        <h2>Kelola Stok: ${product.name}</h2>
        <p class="muted">Stok saat ini: <strong>${stock.length}</strong> akun tersedia</p>

        <label>Tambah Stok (satu akun per baris)</label>
        <form method="POST" action="/admin/products/${product.id}/stock">
          <textarea name="lines" rows="6" placeholder="user1:pass1&#10;user2:pass2&#10;user3:pass3"></textarea>
          <button type="submit">Tambahkan ke Stok</button>
        </form>
      </div>

      <div class="card">
        <h2>Daftar Stok Tersedia (belum terjual)</h2>
        <table>
          <thead><tr><th>#</th><th>Kredensial</th></tr></thead>
          <tbody>${stockRows || '<tr><td colspan="2" class="muted">Stok kosong.</td></tr>'}</tbody>
        </table>
      </div>

      <a class="btn secondary" href="/admin">⬅️ Kembali ke Daftar Produk</a>`;
    res.send(layout('Kelola Stok', body, 'dashboard'));
  });

  app.post('/admin/products/:id/stock', requireAdmin, (req, res) => {
    const lines = (req.body.lines || '').split('\n');
    db.addStockLines(req.params.id, lines);
    res.redirect(`/admin/products/${req.params.id}/stock`);
  });

  // ---------- Riwayat pesanan ----------

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
          <td>${t.productName}<br/><span class="muted">Chat ID: ${t.chatId}</span></td>
          <td>${formatRupiah(t.amount)}</td>
          <td>${badge}</td>
          <td>${t.deliveredAccount ? `<code>${t.deliveredAccount}</code>` : '-'}</td>
        </tr>`;
      })
      .join('');

    const body = `
      <div class="card">
        <h2>Riwayat Pesanan (200 terbaru)</h2>
        <table>
          <thead><tr><th>Waktu</th><th>Produk / Pembeli</th><th>Jumlah</th><th>Status</th><th>Akun Terkirim</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">Belum ada transaksi.</td></tr>'}</tbody>
        </table>
      </div>`;
    res.send(layout('Riwayat Pesanan', body, 'orders'));
  });

  // ---------- Pelanggan ----------

  app.get('/admin/customers', requireAdmin, (req, res) => {
    const customers = db.getCustomers();

    const rows = customers
      .map((c) => {
        const waktu = new Date(c.lastOrderAt).toLocaleString('id-ID');
        return `<tr>
          <td>${c.chatId}</td>
          <td>${c.totalOrders}</td>
          <td>${formatRupiah(c.totalSpent)}</td>
          <td>${waktu}</td>
          <td><a class="btn secondary" href="/admin/broadcast?to=${c.chatId}">Kirim Pesan</a></td>
        </tr>`;
      })
      .join('');

    const body = `
      <div class="card">
        <h2>Daftar Pelanggan (${customers.length})</h2>
        <p class="muted">Diurutkan dari total belanja terbesar.</p>
        <table>
          <thead><tr><th>Chat ID</th><th>Jml Pembelian</th><th>Total Belanja</th><th>Order Terakhir</th><th>Aksi</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">Belum ada pelanggan.</td></tr>'}</tbody>
        </table>
      </div>
      <a class="btn secondary" href="/admin/broadcast">📢 Broadcast ke Semua Pelanggan</a>`;

    res.send(layout('Pelanggan', body, 'customers'));
  });

  // ---------- Broadcast pesan ----------

  app.get('/admin/broadcast', requireAdmin, (req, res) => {
    const prefillTo = req.query.to || '';
    const body = `
      <div class="card">
        <h2>Kirim Pesan / Broadcast</h2>
        <p class="muted">Kosongkan "Chat ID Tujuan" untuk mengirim ke <strong>SEMUA pelanggan</strong> yang pernah order. Isi satu Chat ID untuk kirim ke satu orang saja.</p>
        <form method="POST" action="/admin/broadcast">
          <label>Chat ID Tujuan (kosongkan untuk broadcast ke semua)</label>
          <input type="text" name="to" value="${prefillTo}" placeholder="Contoh: 123456789" />
          <label>Isi Pesan</label>
          <textarea name="message" rows="5" placeholder="Contoh: Promo spesial hari ini, VPN Singapore diskon 20%!" required></textarea>
          <button type="submit" onclick="return confirm('Kirim pesan ini sekarang?');">Kirim</button>
        </form>
      </div>`;
    res.send(layout('Broadcast', body, 'broadcast'));
  });

  app.post('/admin/broadcast', requireAdmin, async (req, res) => {
    const { to, message } = req.body;
    let targets;

    if (to && to.trim()) {
      targets = [to.trim()];
    } else {
      targets = db.getCustomers().map((c) => c.chatId);
    }

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

    const body = `
      <div class="card">
        <h2>Hasil Broadcast</h2>
        <p>✅ Berhasil terkirim: <strong>${success}</strong></p>
        <p>❌ Gagal terkirim: <strong>${failed}</strong> ${failed > 0 ? '<span class="muted">(kemungkinan user pernah blokir bot)</span>' : ''}</p>
        <a class="btn" href="/admin/broadcast">Kirim Lagi</a>
        <a class="btn secondary" href="/admin/customers">Kembali ke Pelanggan</a>
      </div>`;
    res.send(layout('Hasil Broadcast', body, 'broadcast'));
  });
}

module.exports = mountAdminPanel;
