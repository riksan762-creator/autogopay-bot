const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

function seedData() {
  return {
    products: [
      {
        id: 'vpn-id-30',
        name: 'VPN Premium Indonesia (30 Hari)',
        price: 15000,
        description: 'Server Indonesia, kecepatan tinggi, aktif 30 hari.',
      },
      {
        id: 'vpn-sg-30',
        name: 'VPN Premium Singapore (30 Hari)',
        price: 20000,
        description: 'Server Singapore, cocok untuk streaming & gaming, aktif 30 hari.',
      },
    ],
    stock: {
      // productId -> array of string kredensial akun yang belum terjual
      'vpn-id-30': [],
      'vpn-sg-30': [],
    },
    transactions: [], // riwayat transaksi untuk ditampilkan di admin panel
    settings: {
      welcomeText: 'Halo, {name}! 👋\nSelamat datang di toko online kami.\n\nSilakan pilih produk di bawah ini:',
      bannerUrl: '', // kosongkan kalau tidak mau pakai banner gambar
      footerText: '',
    },
    blockedUsers: [], // array of chatId (number/string) yang diblokir
    activityLogs: [], // riwayat aksi admin
  };
}

function ensureDbFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData(), null, 2));
  }
}

function loadDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const db = JSON.parse(raw);

  // Migrasi otomatis untuk db.json lama yang belum punya field baru
  let migrated = false;
  if (!db.settings) {
    db.settings = seedData().settings;
    migrated = true;
  }
  if (!db.blockedUsers) {
    db.blockedUsers = [];
    migrated = true;
  }
  if (!db.activityLogs) {
    db.activityLogs = [];
    migrated = true;
  }
  if (migrated) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }

  return db;
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---------- Products ----------

function getAllProducts() {
  const db = loadDb();
  return db.products.map((p) => ({ ...p, stockCount: (db.stock[p.id] || []).length }));
}

function getProductById(id) {
  const db = loadDb();
  const product = db.products.find((p) => p.id === id);
  if (!product) return null;
  return { ...product, stockCount: (db.stock[id] || []).length };
}

function addProduct({ id, name, price, description }) {
  const db = loadDb();
  if (db.products.some((p) => p.id === id)) {
    throw new Error(`Product ID "${id}" sudah dipakai, pilih ID lain.`);
  }
  db.products.push({ id, name, price: Number(price), description: description || '' });
  db.stock[id] = db.stock[id] || [];
  saveDb(db);
}

function updateProduct(id, { name, price, description }) {
  const db = loadDb();
  const product = db.products.find((p) => p.id === id);
  if (!product) throw new Error('Produk tidak ditemukan');
  if (name !== undefined) product.name = name;
  if (price !== undefined) product.price = Number(price);
  if (description !== undefined) product.description = description;
  saveDb(db);
}

function deleteProduct(id) {
  const db = loadDb();
  db.products = db.products.filter((p) => p.id !== id);
  delete db.stock[id];
  saveDb(db);
}

// ---------- Stock (akun VPN) ----------

function getStock(productId) {
  const db = loadDb();
  return db.stock[productId] || [];
}

function addStockLines(productId, lines) {
  const db = loadDb();
  if (!db.stock[productId]) db.stock[productId] = [];
  const cleaned = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  db.stock[productId].push(...cleaned);
  saveDb(db);
  return cleaned.length;
}

/**
 * Ambil satu akun dari stok (FIFO) dan hapus dari daftar tersedia.
 * Dipanggil otomatis saat pembayaran terkonfirmasi.
 */
function takeOneStock(productId) {
  const db = loadDb();
  const list = db.stock[productId] || [];
  if (list.length === 0) return null;
  const account = list.shift();
  saveDb(db);
  return account;
}

// ---------- Transactions ----------

function saveTransaction(transactionId, data) {
  const db = loadDb();
  const idx = db.transactions.findIndex((t) => t.transactionId === transactionId);
  const record = {
    transactionId,
    chatId: data.chatId,
    productId: data.productId,
    productName: data.productName,
    amount: data.amount,
    orderId: data.orderId,
    status: data.status || 'pending',
    notified: data.notified || false,
    deliveredAccount: data.deliveredAccount || null,
    createdAt: data.createdAt || new Date().toISOString(),
  };
  if (idx >= 0) {
    db.transactions[idx] = record;
  } else {
    db.transactions.unshift(record); // terbaru di atas
  }
  saveDb(db);
  return record;
}

function getTransaction(transactionId) {
  const db = loadDb();
  return db.transactions.find((t) => t.transactionId === transactionId) || null;
}

function updateStatus(transactionId, status) {
  const db = loadDb();
  const tx = db.transactions.find((t) => t.transactionId === transactionId);
  if (!tx) return null;
  tx.status = status;
  saveDb(db);
  return tx;
}

function markNotified(transactionId, deliveredAccount) {
  const db = loadDb();
  const tx = db.transactions.find((t) => t.transactionId === transactionId);
  if (!tx) return null;
  tx.notified = true;
  if (deliveredAccount) tx.deliveredAccount = deliveredAccount;
  saveDb(db);
  return tx;
}

function getAllTransactions(limit = 100) {
  const db = loadDb();
  return db.transactions.slice(0, limit);
}

// ---------- Pelanggan (agregat dari transaksi) ----------

function getCustomers() {
  const db = loadDb();
  const map = new Map(); // chatId -> agregat

  for (const t of db.transactions) {
    if (!map.has(t.chatId)) {
      map.set(t.chatId, {
        chatId: t.chatId,
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: t.createdAt,
      });
    }
    const c = map.get(t.chatId);
    if (t.status === 'settlement') {
      c.totalOrders += 1;
      c.totalSpent += Number(t.amount) || 0;
    }
    if (new Date(t.createdAt) > new Date(c.lastOrderAt)) {
      c.lastOrderAt = t.createdAt;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}

// ---------- Statistik ringkas untuk dashboard ----------

function getStats() {
  const db = loadDb();
  const paid = db.transactions.filter((t) => t.status === 'settlement');
  const totalRevenue = paid.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalOrders = paid.length;
  const totalCustomers = new Set(db.transactions.map((t) => t.chatId)).size;
  const totalStock = Object.values(db.stock).reduce((sum, list) => sum + list.length, 0);
  return { totalRevenue, totalOrders, totalCustomers, totalStock };
}

module.exports = {
  getAllProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  getStock,
  addStockLines,
  takeOneStock,
  saveTransaction,
  getTransaction,
  updateStatus,
  markNotified,
  getAllTransactions,
  getCustomers,
  getStats,
  getSettings,
  updateSettings,
  isBlocked,
  blockUser,
  unblockUser,
  addLog,
  getLogs,
  exportBackup,
  restoreBackup,
};

// ---------- Pengaturan (Konfigurasi) ----------

function getSettings() {
  const db = loadDb();
  return db.settings;
}

function updateSettings({ welcomeText, bannerUrl, footerText }) {
  const db = loadDb();
  if (welcomeText !== undefined) db.settings.welcomeText = welcomeText;
  if (bannerUrl !== undefined) db.settings.bannerUrl = bannerUrl;
  if (footerText !== undefined) db.settings.footerText = footerText;
  saveDb(db);
  return db.settings;
}

// ---------- Blokir User ----------

function isBlocked(chatId) {
  const db = loadDb();
  return db.blockedUsers.some((id) => String(id) === String(chatId));
}

function blockUser(chatId) {
  const db = loadDb();
  if (!db.blockedUsers.some((id) => String(id) === String(chatId))) {
    db.blockedUsers.push(chatId);
    saveDb(db);
  }
}

function unblockUser(chatId) {
  const db = loadDb();
  db.blockedUsers = db.blockedUsers.filter((id) => String(id) !== String(chatId));
  saveDb(db);
}

// ---------- Activity Logs ----------

function addLog(action, detail) {
  const db = loadDb();
  db.activityLogs.unshift({
    action,
    detail: detail || '',
    at: new Date().toISOString(),
  });
  // batasi 500 log terakhir biar file tidak membengkak
  db.activityLogs = db.activityLogs.slice(0, 500);
  saveDb(db);
}

function getLogs(limit = 200) {
  const db = loadDb();
  return db.activityLogs.slice(0, limit);
}

// ---------- Backup & Restore ----------

function exportBackup() {
  return loadDb();
}

function restoreBackup(newDb) {
  if (!newDb || typeof newDb !== 'object' || !Array.isArray(newDb.products)) {
    throw new Error('File backup tidak valid.');
  }
  // Pastikan field wajib ada, biar tidak crash kalau backup dari versi lama
  newDb.stock = newDb.stock || {};
  newDb.transactions = newDb.transactions || [];
  newDb.settings = newDb.settings || seedData().settings;
  newDb.blockedUsers = newDb.blockedUsers || [];
  newDb.activityLogs = newDb.activityLogs || [];
  saveDb(newDb);
}
