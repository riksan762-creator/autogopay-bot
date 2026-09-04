require('dotenv').config();

const required = ['BOT_TOKEN', 'AUTOGOPAY_API_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[CONFIG] Env "${key}" belum diisi. Cek file .env kamu.`);
    process.exit(1);
  }
}

module.exports = {
  botToken: process.env.BOT_TOKEN,
  autogopay: {
    apiKey: process.env.AUTOGOPAY_API_KEY,
    baseUrl: process.env.AUTOGOPAY_BASE_URL || 'https://v1-gateway.autogopay.site',
  },
  port: Number(process.env.PORT) || 3000,
  webhookPath: process.env.WEBHOOK_PATH || '/webhook/autogopay',
};
