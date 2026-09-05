const autogopay = require('./autogopay');
const store = require('./store');

const POLL_INTERVAL = 5000;
const MAX_POLL_TIME = 15 * 60 * 1000;

const activePolls = new Map();

function startPolling(transactionId, telegram, sendPaidNotification) {
  if (activePolls.has(transactionId)) {
    console.log(`[POLLER] Sudah berjalan: ${transactionId}`);
    return;
  }

  const tx = store.getTransaction(transactionId);

  if (!tx) {
    console.error(
      `[POLLER] Transaksi tidak ditemukan: ${transactionId}`
    );
    return;
  }

  const chatId = tx.chatId;

  if (!chatId) {
    console.error(
      `[POLLER] chatId tidak ditemukan: ${transactionId}`
    );
    return;
  }

  console.log(
    `[POLLER] Mulai polling: ${transactionId}`
  );

  const startedAt = Date.now();

  let stopped = false;
  let checking = false;

  const stop = () => {
    stopped = true;
    activePolls.delete(transactionId);
  };

  const check = async () => {
    if (stopped) return;

    // Timeout 15 menit
    if (Date.now() - startedAt >= MAX_POLL_TIME) {
      stop();

      console.log(
        `[POLLER] Timeout: ${transactionId}`
      );

      return;
    }

    // Jangan sampai request API bertumpuk
    if (checking) {
      if (!stopped) {
        setTimeout(check, POLL_INTERVAL);
      }

      return;
    }

    checking = true;

    try {
      const result =
        await autogopay.checkQrisStatus(
          transactionId
        );

      const status =
        result?.transaction_status;

      console.log(
        `[POLLER] ${transactionId} => ${status || 'unknown'}`
      );

      if (!status) {
        return;
      }

      store.updateStatus(
        transactionId,
        status
      );

      // ==========================
      // PEMBAYARAN BERHASIL
      // ==========================

      if (status === 'settlement') {
        stop();

        const transaction =
          store.getTransaction(transactionId);

        if (!transaction) {
          console.error(
            `[POLLER] Data transaksi hilang: ${transactionId}`
          );

          return;
        }

        // Cegah notifikasi double
        if (transaction.paidNotified) {
          console.log(
            `[POLLER] Sudah dinotifikasi: ${transactionId}`
          );

          return;
        }

        transaction.paidNotified = true;

        store.saveTransaction(
          transactionId,
          transaction
        );

        try {
          await sendPaidNotification(
            chatId,
            transactionId
          );

          console.log(
            `[POLLER] Pembayaran berhasil: ${transactionId}`
          );
        } catch (err) {
          console.error(
            `[POLLER] Gagal mengirim notifikasi:`,
            err.message
          );
        }

        return;
      }

      // ==========================
      // EXPIRED
      // ==========================

      if (status === 'expire') {
        stop();

        console.log(
          `[POLLER] QRIS expired: ${transactionId}`
        );

        return;
      }

      // ==========================
      // CANCEL
      // ==========================

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
        err?.response?.data ||
        err?.message ||
        err
      );
    } finally {
      checking = false;
    }

    // Cek lagi 5 detik kemudian
    if (!stopped) {
      setTimeout(check, POLL_INTERVAL);
    }
  };

  activePolls.set(transactionId, true);

  // Cek langsung
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
