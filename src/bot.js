const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const { getAllProducts, getProductById, takeStock } = require('./products');
const autogopay = require('./autogopay');
const store = require('./store');
const poller = require('./poller');
const db = require('./db');
const sshProvision = require('./sshProvision');


const bot = new Telegraf(config.botToken);


/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/


const processingBuy = new Set();


/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
|--------------------------------------------------------------------------
*/


bot.catch((err, ctx) => {
  console.error(
    `[BOT ERROR] update=${ctx?.updateType || 'unknown'}:`,
    err?.response?.data || err?.message || err
  );
});


/*
|--------------------------------------------------------------------------
| BLOKIR USER (dicek sebelum command/tombol apapun diproses)
|--------------------------------------------------------------------------
*/


bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id || ctx.from?.id;
  if (chatId && db.isBlocked(chatId)) {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('🚫 Kamu diblokir dan tidak bisa menggunakan bot ini.', { show_alert: true }).catch(() => {});
    } else {
      await ctx.reply('🚫 Kamu diblokir dan tidak bisa menggunakan bot ini.').catch(() => {});
    }
    return; // stop di sini, jangan lanjut ke handler manapun
  }
  return next();
});


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/


function formatRupiah(n) {
  const number = Number(n);


  if (!Number.isFinite(number)) {
    return 'Rp0';
  }


  return `Rp${number.toLocaleString('id-ID')}`;
}


/**
 * Menjawab callback query tanpa membuat handler crash
 * kalau callback sudah expired.
 */
async function safeAnswerCbQuery(ctx, text = '') {
  try {
    await ctx.answerCbQuery(text);
    return true;
  } catch (err) {
    // Callback Telegram bisa expired.
    // Jangan sampai membuat proses bot error.
    return false;
  }
}


/**
 * Kirim pesan error secara aman.
 */
async function safeReply(ctx, text) {
  try {
    return await ctx.reply(text);
  } catch (err) {
    console.error('[SAFE REPLY ERROR]', err.message);
    return null;
  }
}


/**
 * Edit pesan secara aman.
 */
async function safeEditMessageText(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (err) {
    console.error('[EDIT MESSAGE ERROR]', err.message);
    return null;
  }
}


/*
|--------------------------------------------------------------------------
| KEYBOARDS
|--------------------------------------------------------------------------
*/


function productMenuKeyboard() {
  const products = getAllProducts();


  if (!Array.isArray(products) || products.length === 0) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Refresh', 'menu')],
    ]);
  }


  const rows = products.map((p) => {
    let label;
    if (p.type === 'auto') {
      label = `${p.name} - Mulai ${formatRupiah(p.price)} (Auto)`;
    } else if (p.stockCount > 0) {
      label = `${p.name} - ${formatRupiah(p.price)} (Stok: ${p.stockCount})`;
    } else {
      label = `${p.name} - HABIS`;
    }
    return [Markup.button.callback(label, `prod_${p.id}`)];
  });


  return Markup.inlineKeyboard(rows);
}


function productDetailKeyboard(productId, inStock) {
  const rows = [];


  if (inStock) {
    rows.push([
      Markup.button.callback(
        '🛒 Beli',
        `buy_${productId}`
      ),
    ]);
  }


  rows.push([
    Markup.button.callback(
      '⬅️ Kembali ke menu',
      'menu'
    ),
  ]);


  return Markup.inlineKeyboard(rows);
}


function durationKeyboard(product) {
  const rows = (product.durations || []).map((d, i) => [
    Markup.button.callback(
      `${d.label} - ${formatRupiah(d.price)}`,
      `durbuy_${product.id}_${i}`
    ),
  ]);


  rows.push([
    Markup.button.callback('⬅️ Kembali ke menu', 'menu'),
  ]);


  return Markup.inlineKeyboard(rows);
}


function paymentKeyboard(transactionId, checkoutUrl) {
  const buttons = [
    [
      Markup.button.callback(
        '🔄 Cek Sekarang',
        `check_${transactionId}`
      ),
    ],
  ];


  // Hanya tambahkan URL jika valid.
  if (
    typeof checkoutUrl === 'string' &&
    checkoutUrl.startsWith('http')
  ) {
    buttons.push([
      Markup.button.url(
        '🔗 Buka Halaman Pembayaran',
        checkoutUrl
      ),
    ]);
  }


  return Markup.inlineKeyboard(buttons);
}


/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/


bot.start(async (ctx) => {
  try {
    const name = ctx.from?.first_name || 'Kak';
    const settings = db.getSettings();
    const welcomeText = (settings.welcomeText || 'Halo, {name}! Selamat datang.').replace(
      /\{name\}/g,
      name
    );

    if (settings.bannerUrl) {
      await ctx.replyWithPhoto(settings.bannerUrl, {
        caption: welcomeText,
        ...productMenuKeyboard(),
      }).catch(async () => {
        // kalau banner gagal dimuat (URL rusak/expired), tetap kirim teks + menu
        await ctx.reply(welcomeText, productMenuKeyboard());
      });
    } else {
      await ctx.reply(welcomeText, productMenuKeyboard());
    }
  } catch (err) {
    console.error('[START ERROR]', err.message);
  }
});


/*
|--------------------------------------------------------------------------
| MENU COMMAND
|--------------------------------------------------------------------------
*/


bot.command('menu', async (ctx) => {
  try {
    await ctx.reply(
      'Daftar produk:',
      productMenuKeyboard()
    );
  } catch (err) {
    console.error('[MENU COMMAND ERROR]', err.message);
  }
});


/*
|--------------------------------------------------------------------------
| MENU BUTTON
|--------------------------------------------------------------------------
*/


bot.action('menu', async (ctx) => {
  try {
    /*
     * Jalankan answer callback dan edit secara paralel.
     * Jadi kita tidak perlu menunggu answerCbQuery selesai
     * sebelum mulai mengubah pesan.
     */
    await Promise.allSettled([
      safeAnswerCbQuery(ctx),
      safeEditMessageText(
        ctx,
        'Daftar produk:',
        productMenuKeyboard()
      ),
    ]);
  } catch (err) {
    console.error('[MENU ACTION ERROR]', err.message);
  }
});


/*
|--------------------------------------------------------------------------
| PRODUCT DETAIL
|--------------------------------------------------------------------------
*/


bot.action(/^prod_(.+)$/, async (ctx) => {
  const productId = ctx.match[1];


  try {
    const product = getProductById(productId);


    /*
     * Callback dijawab segera.
     */
    const answerPromise = safeAnswerCbQuery(ctx);


    if (!product) {
      await answerPromise;
      return safeReply(ctx, '❌ Produk tidak ditemukan.');
    }


    /*
     * Jawab callback + edit pesan secara paralel.
     */
    if (product.type === 'auto') {
      const durationLines = (product.durations || [])
        .map((d) => `• ${d.label}: ${formatRupiah(d.price)}`)
        .join('\n') || 'Belum ada pilihan durasi diatur admin.';

      await Promise.allSettled([
        answerPromise,
        safeEditMessageText(
          ctx,
          `*${product.name}*\n` +
            `${product.description}\n\n` +
            `Pilihan Durasi:\n${durationLines}\n\n` +
            `⚡ Akun dibuat otomatis begitu pembayaran terkonfirmasi.`,
          {
            parse_mode: 'Markdown',
            ...durationKeyboard(product),
          }
        ),
      ]);
      return;
    }

    const stockLine =
      product.stockCount > 0
        ? `Stok tersedia: ${product.stockCount}`
        : '⚠️ Stok sedang habis';

    await Promise.allSettled([
      answerPromise,
      safeEditMessageText(
        ctx,
        `*${product.name}*\n` +
          `${product.description}\n\n` +
          `Harga: *${formatRupiah(product.price)}*\n` +
          `${stockLine}`,
        {
          parse_mode: 'Markdown',
          ...productDetailKeyboard(product.id, product.stockCount > 0),
        }
      ),
    ]);
  } catch (err) {
    console.error(
      '[PRODUCT ERROR]',
      err?.response?.data || err.message
    );


    await safeReply(
      ctx,
      '❌ Terjadi kesalahan saat membuka produk.'
    );
  }
});


/*
|--------------------------------------------------------------------------
| BUY PRODUCT
|--------------------------------------------------------------------------
*/


bot.action(/^buy_(.+)$/, async (ctx) => {
  const productId = ctx.match[1];


  /*
   * Buat ID unik berdasarkan chat + product.
   * Mencegah user menekan tombol Beli berkali-kali
   * secara bersamaan.
   */
  const lockKey = `${ctx.chat?.id}:${productId}`;


  if (processingBuy.has(lockKey)) {
    await safeAnswerCbQuery(
      ctx,
      '⏳ Pesanan sedang diproses...'
    );


    return;
  }


  processingBuy.add(lockKey);


  let loadingMsg = null;


  const totalStart = Date.now();


  try {
    const product = getProductById(productId);


    /*
     * Jawab callback secepat mungkin.
     */
    await safeAnswerCbQuery(ctx);


    if (!product) {
      return safeReply(ctx, '❌ Produk tidak ditemukan.');
    }


    if (product.stockCount <= 0) {
      return safeReply(
        ctx,
        '⚠️ Maaf, stok untuk produk ini sedang habis.\nSilakan pilih produk lain atau hubungi admin.'
      );
    }


    /*
     * Kirim loading.
     */
    loadingMsg = await ctx.reply(
      '⏳ Membuat QRIS pembayaran...\nMohon tunggu sebentar.'
    );


    if (!loadingMsg) {
      throw new Error('Gagal membuat pesan loading.');
    }


    /*
     * REQUEST AUTOGOPAY
     */
    const apiStart = Date.now();


    const qris = await autogopay.generateQris(
      product.price
    );


    const apiTime = Date.now() - apiStart;


    console.log(
      `[TIMING] AutoGoPay generateQris: ${apiTime}ms`
    );


    /*
     * Validasi response AutoGoPay.
     */
    if (!qris || !qris.transaction_id) {
      throw new Error(
        'Response AutoGoPay tidak memiliki transaction_id.'
      );
    }


    if (!qris.qr_url) {
      throw new Error(
        'Response AutoGoPay tidak memiliki qr_url.'
      );
    }


    /*
     * SIMPAN TRANSAKSI
     */
    store.saveTransaction(
      qris.transaction_id,
      {
        chatId: ctx.chat.id,
        productId: product.id,
        productName: product.name,
        amount: qris.amount,
        orderId: qris.order_id,
        status: qris.transaction_status,
      }
    );


    /*
     * CAPTION QRIS
     */
    const caption =
      `🧾 *Pesanan Baru*\n\n` +
      `Produk: ${product.name}\n` +
      `Jumlah: *${formatRupiah(qris.amount)}*\n` +
      `Order ID: \`${qris.order_id}\`\n` +
      `Kedaluwarsa: ${qris.expiry_time}\n\n` +
      `Silakan scan QRIS menggunakan aplikasi ` +
      `e-wallet kamu, atau klik tombol pembayaran.\n\n` +
      `🔄 Bot akan otomatis mengecek pembayaran.`;


    /*
     * EDIT LOADING MENJADI QRIS
     */
    const telegramStart = Date.now();


    await ctx.telegram.editMessageMedia(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      {
        type: 'photo',
        media: qris.qr_url,
        caption,
        parse_mode: 'Markdown',
      },
      paymentKeyboard(
        qris.transaction_id,
        qris.checkout_url
      )
    );


    const telegramTime = Date.now() - telegramStart;


    console.log(
      `[TIMING] Telegram QRIS: ${telegramTime}ms`
    );


    /*
     * SIMPAN MESSAGE ID
     */
    const tx = store.getTransaction(
      qris.transaction_id
    );


    if (tx) {
      tx.messageId = loadingMsg.message_id;


      store.saveTransaction(
        qris.transaction_id,
        tx
      );
    }


    /*
     * MULAI POLLING
     *
     * Tidak ditunggu dengan await supaya user
     * tidak perlu menunggu proses polling.
     */
    try {
      poller.startPolling(
        qris.transaction_id,
        ctx.telegram,
        sendPaidNotification
      );
    } catch (pollErr) {
      console.error(
        '[POLLER START ERROR]',
        pollErr.message
      );
    }


    const totalTime = Date.now() - totalStart;


    console.log(
      `[TIMING] TOTAL BUY -> QRIS: ${totalTime}ms`
    );
  } catch (err) {
    console.error(
      '[BUY ERROR]',
      err?.response?.data || err?.message || err
    );


    /*
     * Hapus pesan loading jika masih ada.
     */
    if (loadingMsg?.message_id) {
      try {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          loadingMsg.message_id
        );
      } catch (_) {
        // Tidak masalah jika pesan sudah berubah/terhapus.
      }
    }


    await safeReply(
      ctx,
      '❌ Gagal membuat QRIS pembayaran.\n\n' +
        'Silakan coba lagi beberapa saat.'
    );
  } finally {
    processingBuy.delete(lockKey);
  }
});


/*
|--------------------------------------------------------------------------
| BUY PRODUCT (AUTO-PROVISIONING, DENGAN DURASI)
|--------------------------------------------------------------------------
*/


bot.action(/^durbuy_(.+)_(\d+)$/, async (ctx) => {
  const productId = ctx.match[1];
  const durationIndex = Number(ctx.match[2]);
  const lockKey = `${ctx.chat?.id}:${productId}:${durationIndex}`;

  if (processingBuy.has(lockKey)) {
    await safeAnswerCbQuery(ctx, '⏳ Pesanan sedang diproses...');
    return;
  }
  processingBuy.add(lockKey);

  let loadingMsg = null;

  try {
    const product = getProductById(productId);
    await safeAnswerCbQuery(ctx);

    if (!product || product.type !== 'auto') {
      return safeReply(ctx, '❌ Produk tidak ditemukan.');
    }

    const duration = (product.durations || [])[durationIndex];
    if (!duration) {
      return safeReply(ctx, '❌ Pilihan durasi tidak valid, silakan pilih ulang dari menu.');
    }

    loadingMsg = await ctx.reply('⏳ Membuat QRIS pembayaran...\nMohon tunggu sebentar.');
    if (!loadingMsg) throw new Error('Gagal membuat pesan loading.');

    const qris = await autogopay.generateQris(duration.price);

    if (!qris || !qris.transaction_id) {
      throw new Error('Response AutoGoPay tidak memiliki transaction_id.');
    }
    if (!qris.qr_url) {
      throw new Error('Response AutoGoPay tidak memiliki qr_url.');
    }

    store.saveTransaction(qris.transaction_id, {
      chatId: ctx.chat.id,
      productId: product.id,
      productName: `${product.name} (${duration.label})`,
      amount: qris.amount,
      orderId: qris.order_id,
      status: qris.transaction_status,
      durationDays: duration.days,
      durationLabel: duration.label,
    });

    const caption =
      `🧾 *Pesanan Baru*\n\n` +
      `Produk: ${product.name}\n` +
      `Durasi: ${duration.label} (${duration.days} hari)\n` +
      `Jumlah: *${formatRupiah(qris.amount)}*\n` +
      `Order ID: \`${qris.order_id}\`\n` +
      `Kedaluwarsa: ${qris.expiry_time}\n\n` +
      `Silakan scan QRIS menggunakan aplikasi e-wallet kamu, atau klik tombol pembayaran.\n\n` +
      `⚡ Akun akan dibuat & dikirim otomatis begitu pembayaran terkonfirmasi.`;

    await ctx.telegram.editMessageMedia(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      { type: 'photo', media: qris.qr_url, caption, parse_mode: 'Markdown' },
      paymentKeyboard(qris.transaction_id, qris.checkout_url)
    );

    const tx = store.getTransaction(qris.transaction_id);
    if (tx) {
      tx.messageId = loadingMsg.message_id;
      store.saveTransaction(qris.transaction_id, tx);
    }

    try {
      poller.startPolling(qris.transaction_id, ctx.telegram, sendPaidNotification);
    } catch (pollErr) {
      console.error('[POLLER START ERROR]', pollErr.message);
    }
  } catch (err) {
    console.error('[DURBUY ERROR]', err?.response?.data || err?.message || err);
    if (loadingMsg?.message_id) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (_) {}
    }
    await safeReply(ctx, '❌ Gagal membuat QRIS pembayaran.\n\nSilakan coba lagi beberapa saat.');
  } finally {
    processingBuy.delete(lockKey);
  }
});


/*
|--------------------------------------------------------------------------
| CHECK PAYMENT STATUS
|--------------------------------------------------------------------------
*/


bot.action(/^check_(.+)$/, async (ctx) => {
  const transactionId = ctx.match[1];


  try {
    /*
     * Callback langsung dijawab agar tombol Telegram
     * tidak terlihat loading terlalu lama.
     */
    const callbackPromise = safeAnswerCbQuery(
      ctx,
      '⏳ Mengecek pembayaran...'
    );


    /*
     * Request ke AutoGoPay.
     */
    const result =
      await autogopay.checkQrisStatus(
        transactionId
      );


    /*
     * Update database/store.
     */
    if (result?.transaction_status) {
      store.updateStatus(
        transactionId,
        result.transaction_status
      );
    }


    await callbackPromise;


    const status =
      result?.transaction_status || 'unknown';


    const statusText = describeStatus(status);


    /*
     * Status PAID
     */
    if (status === 'settlement') {
      poller.stopPolling(transactionId);


      await sendPaidNotification(
        ctx.chat.id,
        transactionId
      );


      return;
    }


    /*
     * Expired / Cancel
     */
    if (
      status === 'expire' ||
      status === 'cancel'
    ) {
      poller.stopPolling(transactionId);
    }


    /*
     * Kirim status sebagai alert.
     *
     * Callback sebelumnya sudah dijawab,
     * jadi gunakan pesan biasa.
     */
    await safeReply(
      ctx,
      statusText
    );
  } catch (err) {
    console.error(
      '[CHECK ERROR]',
      err?.response?.data || err?.message || err
    );


    await safeReply(
      ctx,
      '❌ Gagal mengecek status pembayaran.\n' +
        'Silakan coba lagi.'
    );
  }
});


/*
|--------------------------------------------------------------------------
| PAYMENT STATUS TEXT
|--------------------------------------------------------------------------
*/


function describeStatus(status) {
  switch (status) {
    case 'pending':
      return '⏳ Status: Menunggu pembayaran';


    case 'settlement':
      return '✅ Status: PAID / Sudah dibayar';


    case 'expire':
      return '⌛ Status: Kedaluwarsa';


    case 'cancel':
      return '🚫 Status: Dibatalkan';


    default:
      return `Status: ${status}`;
  }
}


/*
|--------------------------------------------------------------------------
| PAID NOTIFICATION
|--------------------------------------------------------------------------
*/


async function sendPaidNotification(
  chatId,
  transactionId
) {
  try {
    const tx =
      store.getTransaction(transactionId);


    if (!tx) {
      console.error(
        `[PAID] Transaction tidak ditemukan: ${transactionId}`
      );


      return;
    }


    /*
     * Cegah kirim notifikasi/ambil stok dobel kalau
     * webhook & auto-poll mendeteksi PAID hampir bersamaan.
     */
    if (tx.notified) {
      return;
    }
    store.markNotified(transactionId);


    const productName =
      tx.productName || '-';


    const amount =
      tx.amount
        ? formatRupiah(tx.amount)
        : '-';


    const product = getProductById(tx.productId);
    let deliveryText;

    if (product && product.type === 'auto') {
      /*
       * AUTO-PROVISIONING via SSH
       */
      deliveryText = await provisionAutoAccount(tx, product);
    } else {
      /*
       * Ambil satu akun dari stok manual untuk dikirim ke pembeli.
       */
      const account = takeStock(tx.productId);

      if (account) {
        deliveryText =
          `\n\n🔑 *Detail Akun Kamu:*\n` +
          `\`\`\`\n${account}\n\`\`\``;
        store.markNotified(transactionId, account);
      } else {
        deliveryText =
          '\n\n⚠️ Stok akun baru saja habis di saat bersamaan. ' +
          'Admin akan mengirimkan akun secara manual segera.';
      }
    }


    await bot.telegram.sendMessage(
      chatId,
      `✅ *PEMBAYARAN BERHASIL*\n\n` +
        `Produk: ${productName}\n` +
        `Jumlah: ${amount}\n` +
        `Transaction ID: \`${transactionId}\`` +
        `${deliveryText}\n\n` +
        `Terima kasih sudah berbelanja! 🎉`,
      {
        parse_mode: 'Markdown',
      }
    );
  } catch (err) {
    console.error(
      '[PAID NOTIFICATION ERROR]',
      err?.response?.data || err?.message || err
    );
  }
}


/**
 * Buat akun baru otomatis lewat SSH ke server VPN, berdasarkan
 * command template yang diatur admin di panel. Mengembalikan teks
 * yang siap ditempel ke pesan notifikasi pembeli.
 */
async function provisionAutoAccount(tx, product) {
  try {
    const server = db.getServerById(product.serverId);
    if (!server) {
      db.addLog('PROVISION_FAILED', `Server tidak ditemukan untuk produk ${product.id} (tx ${tx.transactionId})`);
      return '\n\n⚠️ Gagal membuat akun otomatis (server belum diatur admin). Admin akan proses manual.';
    }
    if (!product.commandTemplate) {
      db.addLog('PROVISION_FAILED', `Command template kosong untuk produk ${product.id} (tx ${tx.transactionId})`);
      return '\n\n⚠️ Gagal membuat akun otomatis (template command belum diatur admin). Admin akan proses manual.';
    }

    const prefix = (product.protocol || 'vpn').slice(0, 4);
    const { username, password } = sshProvision.generateCredentials(prefix);
    const days = tx.durationDays || 30;

    const command = sshProvision.fillTemplate(product.commandTemplate, {
      username,
      password,
      days,
    });

    const result = await sshProvision.runCommand(server, command, 30000);

    store.markNotified(tx.transactionId, `${username}:${password}`);
    db.addLog(
      'PROVISION_SUCCESS',
      `Akun ${username} dibuat di server ${server.name} untuk produk ${product.id}`
    );

    const scriptOutput = (result.stdout || '').trim();

    return (
      `\n\n🔑 *Detail Akun Kamu:*\n` +
      `Username: \`${username}\`\n` +
      `Password: \`${password}\`\n` +
      `Durasi: ${days} hari\n` +
      (scriptOutput
        ? `\n📋 *Output dari server:*\n\`\`\`\n${scriptOutput.slice(0, 800)}\n\`\`\``
        : '')
    );
  } catch (err) {
    console.error('[PROVISION ERROR]', err.message);
    db.addLog(
      'PROVISION_FAILED',
      `Error provisioning produk ${product.id} (tx ${tx.transactionId}): ${err.message}`
    );
    return (
      '\n\n⚠️ Pembayaran kamu berhasil, tapi akun sedang gagal dibuat otomatis ' +
      '(server sedang bermasalah). Admin akan segera memprosesnya secara manual, mohon tunggu.'
    );
  }
}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/


module.exports = {
  bot,
  sendPaidNotification,
};
