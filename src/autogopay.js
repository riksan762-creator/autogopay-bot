const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

const client = axios.create({
  baseURL: config.autogopay.baseUrl,
  timeout: 15000,
  headers: {
    Authorization: `Bearer ${config.autogopay.apiKey}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Generate QRIS GoPay baru.
 * Docs: POST /qris/generate  { amount }
 * Response.data berisi: transaction_id, order_id, amount, transaction_status,
 * qr_string, qr_url, checkout_url, transaction_time, expiry_time
 */
async function generateQris(amount) {
  const res = await client.post('/qris/generate', { amount });
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Gagal membuat QRIS');
  }
  return res.data.data;
}

/**
 * Cek status transaksi QRIS GoPay.
 * Docs: POST /qris/status  { transaction_id }
 * transaction_status: pending | settlement | expire | cancel
 */
async function checkQrisStatus(transactionId) {
  const res = await client.post('/qris/status', { transaction_id: transactionId });
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Gagal cek status transaksi');
  }
  return res.data.data;
}

/**
 * Batalkan QRIS yang masih pending.
 * Docs: POST /qris/cancel  { transaction_id }
 */
async function cancelQris(transactionId) {
  const res = await client.post('/qris/cancel', { transaction_id: transactionId });
  return res.data;
}

/**
 * Verifikasi X-Signature webhook AutoGoPay.
 * Docs: HMAC-SHA256 atas raw JSON body, secret = API Key.
 * rawBody harus berupa Buffer/string PERSIS seperti yang diterima (belum di-parse ulang).
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', config.autogopay.apiKey)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    // panjang buffer beda -> otomatis tidak valid
    return false;
  }
}

module.exports = {
  generateQris,
  checkQrisStatus,
  cancelQris,
  verifyWebhookSignature,
};
