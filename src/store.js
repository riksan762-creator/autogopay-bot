// Penyimpanan transaksi. Sekarang ditulis ke database (data/db.json)
// supaya riwayat transaksi tidak hilang saat bot di-restart, dan bisa
// dilihat lewat Admin Panel. Fungsi & nama tetap sama seperti sebelumnya
// supaya bot.js/poller.js/webhookServer.js tidak perlu diubah.

const db = require('./db');

function saveTransaction(transactionId, data) {
  db.saveTransaction(transactionId, data);
}

function getTransaction(transactionId) {
  return db.getTransaction(transactionId);
}

function updateStatus(transactionId, status) {
  return db.updateStatus(transactionId, status);
}

// Cegah notifikasi/pengiriman akun dobel kalau webhook & auto-poll
// kebetulan mendeteksi PAID hampir bersamaan.
function markNotified(transactionId, deliveredAccount) {
  return db.markNotified(transactionId, deliveredAccount);
}

module.exports = { saveTransaction, getTransaction, updateStatus, markNotified };
