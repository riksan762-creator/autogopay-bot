const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const { getAllProducts, getProductById } = require('./products');
const autogopay = require('./autogopay');
const store = require('./store');
const poller = require('./poller');

const bot = new Telegraf(config.botToken);

// Penting: tanpa ini, error tak terduga di dalam handler manapun
// (misal callback query kedaluwarsa karena koneksi lambat) akan
// membuat SELURUH proses bot crash. Dengan ini, error cukup di-log
// dan bot tetap hidup.
bot.catch((err, ctx) => {
  console.error(`[BOT] Error pada update ${ctx.updateType}:`, err.message);
});

function formatRupiah(n) {
  return `Rp${Number(n).toLocaleString('id-ID')}`;
}

function productMenuKeyboard() {
  const products = getAllProducts();
  const rows = products.map((p) => [
    Markup.button.callback(`${p.name} - ${formatRupiah(p.price)}`, `prod_${p.id}`),
  ]);
  return Markup.inlineKeyboard(rows);
}

function productDetailKeyboard(productId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🛒 Beli', `buy_${productId}`)],
    [Markup.button.callback('⬅️ Kembali ke menu', 'menu')],
  ]);
}

function paymentKeyboard(transactionId, checkoutUrl) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Cek Sekarang (opsional)', `check_${transactionId}`)],
    [Markup.button.url('🔗 Buka Halaman Pembayaran', checkoutUrl)],
  ]);
}

// ---------- Commands ----------

bot.start((ctx) => {
  ctx.reply(
    `Halo, ${ctx.from.first_name}! 👋\nSelamat datang di toko online kami.\n\nSilakan pilih produk di bawah ini:`,
    productMenuKeyboard()
  );
});

bot.command('menu', (ctx) => {
  ctx.reply('Daftar produk:', productMenuKeyboard());
});

bot.action('menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Daftar produk:', productMenuKeyboard());
});

// ---------- Pilih produk ----------

bot.action(/^prod_(.+)$/, async (ctx) => {
  const productId = ctx.match[1];
  const product = getProductById(productId);
  await ctx.answerCbQuery();

  if (!product) {
    return ctx.reply('Produk tidak ditemukan.');
  }

  await ctx.editMessageText(
    `*${product.name}*\n${product.description}\n\nHarga: *${formatRupiah(product.price)}*`,
    {
      parse_mode: 'Markdown',
      ...productDetailKeyboard(product.id),
    }
  );
});

// ---------- Tombol Beli -> generate QRIS ----------

bot.action(/^buy_(.+)$/, async (ctx) => {
  const productId = ctx.match[1];
  const product = getProductById(productId);
  await ctx.answerCbQuery();

  if (!product) {
    return ctx.reply('Produk tidak ditemukan.');
  }

  const loadingMsg = await ctx.reply('⏳ Membuat QRIS pembayaran, mohon tunggu...');

  try {
    const qris = await autogopay.generateQris(product.price);

    store.saveTransaction(qris.transaction_id, {
      chatId: ctx.chat.id,
      productId: product.id,
      productName: product.name,
      amount: qris.amount,
      orderId: qris.order_id,
      status: qris.transaction_status,
    });

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    const caption =
      `🧾 *Pesanan Baru*\n` +
      `Produk: ${product.name}\n` +
      `Jumlah: *${formatRupiah(qris.amount)}*\n` +
      `Order ID: \`${qris.order_id}\`\n` +
      `Kedaluwarsa: ${qris.expiry_time}\n\n` +
      `Silakan scan QRIS di bawah ini menggunakan aplikasi GoPay/e-wallet kamu, atau klik tombol "Buka Halaman Pembayaran".\n\n` +
      `🔄 Bot akan otomatis mengecek pembayaran setiap beberapa detik — begitu terbayar, notifikasi PAID akan langsung dikirim tanpa perlu tekan tombol apapun.`;

    const sentMsg = await ctx.replyWithPhoto(qris.qr_url, {
      caption,
      parse_mode: 'Markdown',
      ...paymentKeyboard(qris.transaction_id, qris.checkout_url),
    });

    // simpan message_id supaya webhook nanti bisa update pesan yang sama
    const tx = store.getTransaction(qris.transaction_id);
    tx.messageId = sentMsg.message_id;
    store.saveTransaction(qris.transaction_id, tx);

    // mulai auto-polling di background - user tidak perlu tekan apapun
    poller.startPolling(qris.transaction_id, ctx.telegram, sendPaidNotification);
  } catch (err) {
    console.error('[BUY] Gagal generate QRIS:', err.response?.data || err.message);
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    await ctx.reply(
      '❌ Gagal membuat QRIS pembayaran. Coba lagi beberapa saat, atau hubungi admin.'
    );
  }
});

// ---------- Cek status manual ----------

bot.action(/^check_(.+)$/, async (ctx) => {
  const transactionId = ctx.match[1];

  try {
    const result = await autogopay.checkQrisStatus(transactionId);
    store.updateStatus(transactionId, result.transaction_status);

    const statusText = describeStatus(result.transaction_status);
    try {
      await ctx.answerCbQuery(statusText, { show_alert: true });
    } catch (cbErr) {
      // callback query sudah kedaluwarsa (>15 detik) karena koneksi lambat -
      // kirim sebagai pesan biasa saja, jangan biarkan ini melempar error lagi
      await ctx.reply(statusText).catch(() => {});
    }

    if (result.transaction_status === 'settlement') {
      poller.stopPolling(transactionId);
      await sendPaidNotification(ctx.chat.id, transactionId);
    } else if (result.transaction_status === 'expire' || result.transaction_status === 'cancel') {
      poller.stopPolling(transactionId);
    }
  } catch (err) {
    console.error('[CHECK] Gagal cek status:', err.response?.data || err.message);
    try {
      await ctx.answerCbQuery('Gagal mengecek status. Coba lagi.', { show_alert: true });
    } catch (cbErr) {
      await ctx.reply('❌ Gagal mengecek status pembayaran. Coba lagi.').catch(() => {});
    }
  }
});

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

/**
 * Dipanggil dari action "Cek Status" ATAU dari webhook server saat
 * AutoGoPay mengirim notifikasi transaction.received dengan status PAID.
 */
async function sendPaidNotification(chatId, transactionId) {
  const tx = store.getTransaction(transactionId);
  const productName = tx?.productName || '-';
  const amount = tx?.amount ? formatRupiah(tx.amount) : '-';

  await bot.telegram.sendMessage(
    chatId,
    `✅ *PEMBAYARAN BERHASIL*\n\nProduk: ${productName}\nJumlah: ${amount}\nTransaction ID: \`${transactionId}\`\n\nTerima kasih sudah berbelanja! 🎉`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = { bot, sendPaidNotification };
