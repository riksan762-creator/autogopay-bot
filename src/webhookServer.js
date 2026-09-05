const express = require('express');
const config = require('./config');
const autogopay = require('./autogopay');
const store = require('./store');
const poller = require('./poller');
const { sendPaidNotification } = require('./bot');

function createWebhookServer() {
  const app = express();

  // Simpan raw body supaya bisa dipakai untuk verifikasi HMAC signature
  // (signature dihitung dari raw JSON, bukan dari object yang sudah di-parse ulang)
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.get('/', (_req, res) => {
    res.send('AutoGoPay Telegram Bot - webhook server aktif.');
  });

  app.post(config.webhookPath, async (req, res) => {
    const signature = req.headers['x-signature'];
    const isValid = autogopay.verifyWebhookSignature(req.rawBody, signature);

    if (!isValid) {
      console.warn('[WEBHOOK] Signature tidak valid, request ditolak.');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    // Balas 200 secepatnya (docs: return HTTP 200 dalam 10 detik),
    // proses payload sesudahnya.
    res.status(200).json({ success: true });

    try {
      const { event, transaction } = req.body;

      if (event !== 'transaction.received') {
        return;
      }

      // payment_method: QRIS (GoPay) | QRIS_SHOPEEPAY | QRIS_INTERACTIVE
      if (transaction.payment_method !== 'QRIS') {
        return; // bot ini hanya menangani QRIS GoPay
      }

      const tx = store.getTransaction(transaction.transaction_id);
      if (!tx) {
        console.warn('[WEBHOOK] transaction_id tidak dikenal:', transaction.transaction_id);
        return;
      }

      // Cek duplikat: kalau sudah PAID sebelumnya, jangan kirim notifikasi dobel
      if (tx.status === 'settlement') {
        console.log('[WEBHOOK] Duplikat webhook, transaksi sudah settlement. Skip.');
        return;
      }

      if (transaction.status === 'PAID') {
        store.updateStatus(transaction.transaction_id, 'settlement');
        poller.stopPolling(transaction.transaction_id);
        await sendPaidNotification(tx.chatId, transaction.transaction_id);
        console.log(`[WEBHOOK] Notifikasi PAID terkirim untuk ${transaction.transaction_id}`);
      }
    } catch (err) {
      console.error('[WEBHOOK] Error memproses payload:', err.message);
    }
  });

  return app;
}

module.exports = createWebhookServer;
