// Penyimpanan transaksi sederhana di memori (untuk tahap testing).
// PENTING: data hilang tiap restart proses. Untuk produksi, ganti dengan
// database (Redis/SQLite/Postgres) supaya tahan restart & bisa multi-instance.

const transactions = new Map(); // transaction_id -> { chatId, messageId, productId, productName, amount, status }

function saveTransaction(transactionId, data) {
  transactions.set(transactionId, { ...data, status: data.status || 'pending' });
}

function getTransaction(transactionId) {
  return transactions.get(transactionId) || null;
}

function updateStatus(transactionId, status) {
  const tx = transactions.get(transactionId);
  if (!tx) return null;
  tx.status = status;
  transactions.set(transactionId, tx);
  return tx;
}

module.exports = { saveTransaction, getTransaction, updateStatus };
