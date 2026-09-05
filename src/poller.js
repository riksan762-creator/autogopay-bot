const autogopay = require('./autogopay');
const store = require('./store');

const POLL_INTERVAL = 5000; // cek setiap 5 detik
const MAX_POLL_TIME = 15 * 60 * 1000; // maksimal 15 menit

const activePolls = new Map();

function startPolling(bot, transactionId, chatId) {
  if (activePolls.has(transactionId)) {
    console.log(`[POLLER] Sudah berjalan: ${transactionId}`);
    return;
  }

  console.log(`[POLLER] Mulai polling: ${transactionId}`);

  const startedAt = Date.now();
  let stopped = false;
  let checking = false;

  const stop = () => {
    stopped = true;
    activePolls.delete(transactionId);
  };

  const check = async () => {
    if (stopped) return;

    // Timeout
    if (Date.now() - startedAt >= MAX_POLL_TIME) {
      stop();
      console.log(`[POLLER] Timeout: ${transactionId}`);
      return;
    }

    // Jangan jalankan request baru kalau request sebelumnya belum selesai
    if (checking) {
      setTimeout(check, POLL_INTERVAL);
      return;
    }

    checking = true;

    try {
      const result = await autogopay.checkQrisStatus(transactionId);
      const status = result?.transaction_status;

      console.log(
        `[POLLER] ${transactionId} => ${status || 'unknown'}`
      );

      if (!status) {
        checking = false;
        if (!stopped) setTimeout(check, POLL_INTERVAL);
        return;
      }

      store.updateStatus(transactionId, status);

      // =========================
      // PEMBAYARAN BERHASIL
      // =========================
      if (status === 'settlement') {
        stop();

        const tx = store.getTransaction(transactionId);

        if (!tx) {
          console.log(
            `[POLLER] Data transaksi tidak ditemukan: ${transactionId}`
          );
          return;
        }

        // Cegah notifikasi pembayaran terkirim dua kali
        if (tx.paidNotified) {
          console.log(
            `[POLLER] Notifikasi sudah dikirim: ${transactionId}`
          );
          return;
        }

        tx.paidNotified = true;
        store.saveTransaction(transactionId, tx);

        const productName = tx.productName || '-';

        const amount = tx.amount
          ? Number(tx.amount).toLocaleString('id-ID')
          : '-';

        try {
          await bot.telegram.sendMessage(
            chatId,
            `✅ *PEMBAYARAN BERHASIL*\n\n` +
            `Produk: ${productName}\n` +
            `Jumlah: Rp ${amount}\n` +
            `Transaction ID: \`${transactionId}\`\n\n` +
            `Terima kasih sudah berbelanja! 🎉`,
            {
              parse_mode: 'Markdown',
            }
          );

          console.log(
            `[POLLER] Notifikasi berhasil dikirim: ${transactionId}`
          );
        } catch (sendError) {
          console.error(
            `[POLLER] Gagal kirim notifikasi:`,
            sendError.message
          );
        }

        return;
      }

      // =========================
      // QRIS EXPIRED
      // =========================
      if (status === 'expire') {
        stop();

        console.log(
          `[POLLER] QRIS expired: ${transactionId}`
        );

        return;
      }

      // =========================
      // QRIS CANCEL
      // =========================
      if (status === 'cancel') {
        stop();

        console.log(
          `[POLLER] QRIS dibatalkan: ${transactionId}`
        );

        return;
      }

    } catch (err) {
      console.error(
        `[POLLER] Error ${transactionId}:`,
        err.response?.data || err.message
      );
    } finally {
      checking = false;
    }

    if (!stopped) {
      setTimeout(check, POLL_INTERVAL);
    }
  };

  activePolls.set(transactionId, true);

  // Langsung cek pertama kali
  check();
}

function stopPolling(transactionId) {
  if (activePolls.has(transactionId)) {
    activePolls.delete(transactionId);

    console.log(
      `[POLLER] Polling dihentikan: ${transactionId}`
    );
  }
}

function isPolling(transactionId) {
  return activePolls.has(transactionId);
}

module.exports = {
  startPolling,
  stopPolling,
  isPolling,
};
