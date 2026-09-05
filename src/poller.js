const autogopay = require('./autogopay');
const store = require('./store');

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 16 * 60 * 1000;

// transaction_id -> timeoutId
const activePolls = new Map();

/*
|--------------------------------------------------------------------------
| START POLLING
|--------------------------------------------------------------------------
*/

function startPolling(
  transactionId,
  telegram,
  sendPaidNotification
) {
  // Jangan membuat polling ganda.
  if (activePolls.has(transactionId)) {
    return;
  }

  const startedAt = Date.now();

  /*
   * Fungsi polling menggunakan setTimeout,
   * bukan setInterval.
   *
   * Keuntungannya:
   * request berikutnya TIDAK akan dimulai
   * sebelum request sebelumnya selesai.
   */
  async function poll() {
    /*
     * Pastikan transaksi masih aktif.
     */
    if (!activePolls.has(transactionId)) {
      return;
    }

    /*
     * Safety timeout.
     */
    if (
      Date.now() - startedAt >
      MAX_POLL_MS
    ) {
      console.log(
        `[POLL] Timeout otomatis: ${transactionId}`
      );

      stopPolling(transactionId);
      return;
    }

    /*
     * Ambil transaksi.
     */
    const tx =
      store.getTransaction(transactionId);

    if (!tx) {
      console.log(
        `[POLL] Transaction tidak ditemukan: ${transactionId}`
      );

      stopPolling(transactionId);
      return;
    }

    /*
     * Kalau transaksi sudah selesai,
     * tidak perlu request API lagi.
     */
    if (
      [
        'settlement',
        'expire',
        'cancel',
      ].includes(tx.status)
    ) {
      stopPolling(transactionId);
      return;
    }

    try {
      const start = Date.now();

      const result =
        await autogopay.checkQrisStatus(
          transactionId
        );

      const elapsed =
        Date.now() - start;

      console.log(
        `[POLL] ${transactionId} -> ${
          result.transaction_status
        } (${elapsed}ms)`
      );

      /*
       * Pastikan polling belum dihentikan
       * oleh proses lain selama request API berjalan.
       */
      if (!activePolls.has(transactionId)) {
        return;
      }

      /*
       * PEMBAYARAN BERHASIL
       */
      if (
        result.transaction_status ===
        'settlement'
      ) {
        store.updateStatus(
          transactionId,
          'settlement'
        );

        stopPolling(transactionId);

        try {
          await sendPaidNotification(
            tx.chatId,
            transactionId
          );
        } catch (notifyErr) {
          console.error(
            `[POLL] Gagal mengirim notifikasi PAID ${transactionId}:`,
            notifyErr.message
          );
        }

        return;
      }

      /*
       * EXPIRE
       */
      if (
        result.transaction_status ===
        'expire'
      ) {
        store.updateStatus(
          transactionId,
          'expire'
        );

        stopPolling(transactionId);

        try {
          await telegram.sendMessage(
            tx.chatId,
            `⌛ Pembayaran untuk Order ID \`${tx.orderId}\` telah kedaluwarsa.`,
            {
              parse_mode: 'Markdown',
            }
          );
        } catch (err) {
          console.error(
            '[POLL] Gagal kirim pesan expire:',
            err.message
          );
        }

        return;
      }

      /*
       * CANCEL
       */
      if (
        result.transaction_status ===
        'cancel'
      ) {
        store.updateStatus(
          transactionId,
          'cancel'
        );

        stopPolling(transactionId);

        try {
          await telegram.sendMessage(
            tx.chatId,
            `🚫 Pembayaran untuk Order ID \`${tx.orderId}\` telah dibatalkan.`,
            {
              parse_mode: 'Markdown',
            }
          );
        } catch (err) {
          console.error(
            '[POLL] Gagal kirim pesan cancel:',
            err.message
          );
        }

        return;
      }

      /*
       * PENDING
       *
       * Jangan melakukan apa-apa.
       * Polling berikutnya dijadwalkan di bawah.
       */
    } catch (err) {
      /*
       * Error API tidak langsung menghentikan polling.
       */
      console.error(
        `[POLL] Gagal cek status ${transactionId}:`,
        err?.response?.data ||
          err?.message ||
          err
      );
    }

    /*
     * Jadwalkan request berikutnya.
     *
     * IMPORTANT:
     * Ini dilakukan setelah request sebelumnya selesai.
     * Jadi tidak ada request yang menumpuk.
     */
    if (activePolls.has(transactionId)) {
      const timeoutId = setTimeout(
        poll,
        POLL_INTERVAL_MS
      );

      activePolls.set(
        transactionId,
        timeoutId
      );
    }
  }

  /*
   * Mulai polling pertama setelah 5 detik.
   *
   * QRIS baru saja dibuat, jadi tidak perlu
   * langsung melakukan request status.
   */
  const timeoutId = setTimeout(
    poll,
    POLL_INTERVAL_MS
  );

  activePolls.set(
    transactionId,
    timeoutId
  );

  console.log(
    `[POLL] Started: ${transactionId}`
  );
}

/*
|--------------------------------------------------------------------------
| STOP POLLING
|--------------------------------------------------------------------------
*/

function stopPolling(transactionId) {
  const timeoutId =
    activePolls.get(transactionId);

  if (timeoutId) {
    clearTimeout(timeoutId);
    activePolls.delete(transactionId);

    console.log(
      `[POLL] Stopped: ${transactionId}`
    );
  }
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
  startPolling,
  stopPolling,
};
