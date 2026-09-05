const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');


/*
|--------------------------------------------------------------------------
| AXIOS CLIENT
|--------------------------------------------------------------------------
*/


const client = axios.create({
  baseURL: config.autogopay.baseUrl,
  timeout: 10000,


  headers: {
    Authorization: `Bearer ${config.autogopay.apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },


  // Hindari retry otomatis yang tidak diperlukan.
  maxRedirects: 3,
});


/*
|--------------------------------------------------------------------------
| GENERATE QRIS
|--------------------------------------------------------------------------
*/


async function generateQris(amount) {
  const start = Date.now();


  try {
    const res = await client.post(
      '/qris/generate',
      { amount }
    );


    const elapsed = Date.now() - start;


    console.log(
      `[AUTOGOPAY] Generate QRIS: ${elapsed}ms`
    );


    const body = res.data;


    if (!body?.success) {
      throw new Error(
        body?.message ||
        'Gagal membuat QRIS'
      );
    }


    if (!body?.data) {
      throw new Error(
        'Response QRIS tidak memiliki data.'
      );
    }


    return body.data;
  } catch (err) {
    const elapsed = Date.now() - start;


    console.error(
      `[AUTOGOPAY] Generate QRIS gagal setelah ${elapsed}ms:`,
      err?.response?.data ||
      err?.message ||
      err
    );


    throw err;
  }
}


/*
|--------------------------------------------------------------------------
| CHECK STATUS QRIS
|--------------------------------------------------------------------------
*/


async function checkQrisStatus(transactionId) {
  const start = Date.now();


  try {
    const res = await client.post(
      '/qris/status',
      {
        transaction_id: transactionId,
      }
    );


    const elapsed = Date.now() - start;


    console.log(
      `[AUTOGOPAY] Check status ${transactionId}: ${elapsed}ms`
    );


    const body = res.data;


    /*
     * Response normal:
     *
     * {
     *   success: true,
     *   data: {
     *     transaction_status: "pending"
     *   }
     * }
     */


    if (body?.data?.transaction_status) {
      return body.data;
    }


    /*
     * Beberapa response pending dari API:
     *
     * success:false
     * message:"Transaction pending"
     */


    const msg = String(
      body?.message || ''
    ).toLowerCase();


    if (msg.includes('pending')) {
      return {
        transaction_id: transactionId,
        transaction_status: 'pending',
      };
    }


    if (
      msg.includes('settlement') ||
      msg.includes('paid') ||
      msg.includes('success')
    ) {
      return {
        transaction_id: transactionId,
        transaction_status: 'settlement',
      };
    }


    if (msg.includes('expire')) {
      return {
        transaction_id: transactionId,
        transaction_status: 'expire',
      };
    }


    if (msg.includes('cancel')) {
      return {
        transaction_id: transactionId,
        transaction_status: 'cancel',
      };
    }


    throw new Error(
      body?.message ||
      'Gagal cek status transaksi'
    );
  } catch (err) {
    const elapsed = Date.now() - start;


    console.error(
      `[AUTOGOPAY] Check status gagal setelah ${elapsed}ms:`,
      err?.response?.data ||
      err?.message ||
      err
    );


    throw err;
  }
}


/*
|--------------------------------------------------------------------------
| CANCEL QRIS
|--------------------------------------------------------------------------
*/


async function cancelQris(transactionId) {
  const start = Date.now();


  try {
    const res = await client.post(
      '/qris/cancel',
      {
        transaction_id: transactionId,
      }
    );


    console.log(
      `[AUTOGOPAY] Cancel QRIS ${transactionId}: ${
        Date.now() - start
      }ms`
    );


    return res.data;
  } catch (err) {
    console.error(
      '[AUTOGOPAY] Cancel QRIS gagal:',
      err?.response?.data ||
      err?.message ||
      err
    );


    throw err;
  }
}


/*
|--------------------------------------------------------------------------
| WEBHOOK SIGNATURE
|--------------------------------------------------------------------------
*/


function verifyWebhookSignature(
  rawBody,
  signatureHeader
) {
  if (!signatureHeader) {
    return false;
  }


  try {
    const expected = crypto
      .createHmac(
        'sha256',
        config.autogopay.apiKey
      )
      .update(rawBody)
      .digest('hex');


    const expectedBuffer =
      Buffer.from(expected, 'utf8');


    const receivedBuffer =
      Buffer.from(
        String(signatureHeader).trim(),
        'utf8'
      );


    /*
     * timingSafeEqual membutuhkan ukuran
     * buffer yang sama.
     */
    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {
      return false;
    }


    return crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    );
  } catch (err) {
    console.error(
      '[AUTOGOPAY] Signature verification error:',
      err.message
    );


    return false;
  }
}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/


module.exports = {
  generateQris,
  checkQrisStatus,
  cancelQris,
  verifyWebhookSignature,
};