const config = require('./src/config');
const { bot } = require('./src/bot');
const createWebhookServer = require('./src/webhookServer');

async function main() {
  // Jalankan server webhook (untuk menerima notifikasi PAID dari AutoGoPay)
  const app = createWebhookServer();
  app.listen(config.port, () => {
    console.log(`[SERVER] Webhook server jalan di port ${config.port}`);
    console.log(`[SERVER] Endpoint webhook: POST ${config.webhookPath}`);
  });

  // Jalankan bot Telegram (mode polling, cocok untuk VPS tanpa domain/SSL)
  await bot.launch();
  console.log('[BOT] Telegram bot aktif (polling mode).');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('[FATAL] Gagal menjalankan aplikasi:', err);
  process.exit(1);
});
