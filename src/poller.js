const autogopay = require('./autogopay');
const store = require('./store');

const POLL_INTERVAL_MS = 5000; // cek status tiap 5 detik
const MAX_POLL_MS = 16 * 60 * 1000; // stop otomatis setelah 16 menit (QRIS expired di 15 menit)

const activePolls = new Map(); // transaction_id -> intervalId

/**
 * Mulai polling otomatis untuk satu transaksi. Berjalan di background,
 * tidak perlu user menekan tombol apapun.
 */
function startPolling(transactionId, telegram, sendPaidNotification) {
  if (activePolls.has(transactionId)) return; // sudah jalan, jangan dobel

  const startedAt = Date.now();

  const intervalId = setInterval(async () => {
    // safety net: kalau kelamaan (harusnya sudah expired duluan di AutoGoPay), stop
    if (Date.now() - startedAt > MAX_POLL_MS) {
      stopPolling(transactionId);
      return;
    }

    const tx = store.getTransaction(transactionId);
    if (!tx) {
      stopPolling(transactionId); // transaksi tidak dikenal, hentikan
      return;
    }

    // kalau sudah selesai (misal via webhook / cek manual), stop
    if (['settlement', 'expire', 'cancel'].includes(tx.status)) {
      stopPolling(transactionId);
      return;
    }

    try {
      const result = await autogopay.checkQrisStatus(transactionId);

      if (result.transaction_status === 'settlement') {
        store.updateStatus(transactionId, 'settlement');
        stopPolling(transactionId);
        await sendPaidNotification(tx.chatId, transactionId);
      } else if (result.transaction_status === 'expire' || result.transaction_status === 'cancel') {
        store.updateStatus(transactionId, result.transaction_status);
        stopPolling(transactionId);
        const label = result.transaction_status === 'expire' ? 'Kedaluwarsa ⌛' : 'Dibatalkan 🚫';
        await telegram
          .sendMessage(tx.chatId, `Pembayaran untuk Order ID \`${tx.orderId}\` berstatus: ${label}`, {
            parse_mode: 'Markdown',
          })
          .catch(() => {});
      }
      // kalau masih "pending", diamkan saja, interval berikutnya cek lagi
    } catch (err) {
      // jangan hentikan polling hanya karena satu request gagal (misal jaringan sempat lambat)
      console.error(`[POLL] Gagal cek status ${transactionId}:`, err.response?.data || err.message);
    }
  }, POLL_INTERVAL_MS);

  activePolls.set(transactionId, intervalId);
}

function stopPolling(transactionId) {
  const intervalId = activePolls.get(transactionId);
  if (intervalId) {
    clearInterval(intervalId);
    activePolls.delete(transactionId);
  }
}

module.exports = { startPolling, stopPolling };
