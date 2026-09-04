# AutoGoPay Telegram Bot (QRIS GoPay)

Bot Telegram sederhana untuk jualan online: pilih produk → generate QRIS via
[AutoGoPay](https://autogopay.site) → notifikasi otomatis saat PAID.

Mengikuti dokumentasi resmi AutoGoPay: base URL `https://v1-gateway.autogopay.site`,
endpoint `/qris/generate`, `/qris/status`, `/qris/cancel`, dan webhook
`transaction.received` dengan verifikasi `X-Signature` (HMAC-SHA256).

## Struktur Project

```
autogopay-bot/
├── index.js                # entry point
├── src/
│   ├── config.js            # load .env
│   ├── products.js          # katalog produk (edit di sini)
│   ├── autogopay.js         # client API AutoGoPay + verifikasi signature
│   ├── store.js             # penyimpanan transaksi (in-memory)
│   ├── bot.js                # logic bot Telegram (Telegraf)
│   └── webhookServer.js     # server Express penerima webhook
├── .env.example
├── .gitignore
└── package.json
```

## 1. Persiapan

- Node.js >= 18
- Bot Telegram sudah dibuat via [@BotFather](https://t.me/BotFather) → simpan **Bot Token**
- Akun [AutoGoPay](https://autogopay.site) sudah punya **API Key** (dashboard) dan provider
  GoPay sudah terhubung
- VPS dengan akses publik (untuk terima webhook)

## 2. Install

```bash
git clone <repo-kamu>
cd autogopay-bot
npm install
cp .env.example .env
nano .env   # isi BOT_TOKEN dan AUTOGOPAY_API_KEY
```

Isi `.env`:

```
BOT_TOKEN=isi_token_dari_botfather
AUTOGOPAY_API_KEY=isi_api_key_dari_dashboard_autogopay
AUTOGOPAY_BASE_URL=https://v1-gateway.autogopay.site
PORT=3000
WEBHOOK_PATH=/webhook/autogopay
```

## 3. Jalankan (mode testing)

```bash
npm start
```

Bot berjalan dengan **polling** (tidak butuh SSL/domain untuk sisi Telegram-nya),
sementara server Express jalan di `PORT` untuk menerima webhook dari AutoGoPay.

Test langsung di Telegram: `/start` → pilih produk → `Beli` → scan QRIS.

## 4. Konfigurasi Webhook AutoGoPay (WAJIB untuk notifikasi PAID otomatis)

AutoGoPay mengirim notifikasi pembayaran lewat **HTTP POST ke URL yang kamu daftarkan
di dashboard AutoGoPay** (bukan lewat parameter API), jadi ini perlu di-setup manual:

1. Pastikan VPS kamu bisa diakses publik lewat domain **HTTPS** (wajib di production).
   Contoh: pasang Nginx reverse proxy ke `localhost:3000`, lalu aktifkan SSL (certbot).
2. Buka dashboard AutoGoPay → Settings → **Callback URL**, isi:
   ```
   https://domainkamu.com/webhook/autogopay
   ```
   (path harus sama dengan `WEBHOOK_PATH` di `.env`)
3. Simpan. AutoGoPay auto-poller akan mengecek status setiap 3 detik dan mengirim
   webhook otomatis ke URL tersebut saat pembayaran QRIS GoPay lunas.

**Tanpa domain/HTTPS**, notifikasi PAID otomatis tidak akan masuk — tapi kamu tetap
bisa cek status manual lewat tombol **"Cek Status Pembayaran"** di bot, yang langsung
memanggil endpoint `/qris/status`.

### Contoh reverse proxy Nginx (opsional, ringkas)

```nginx
server {
    listen 80;
    server_name domainkamu.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Lalu jalankan `certbot --nginx -d domainkamu.com` untuk SSL gratis.

## 5. Jalankan Terus-menerus di VPS (PM2)

```bash
npm install -g pm2
pm2 start index.js --name autogopay-bot
pm2 save
pm2 startup   # ikuti instruksi yang muncul agar auto-start saat VPS reboot
```

Cek log:

```bash
pm2 logs autogopay-bot
```

## 6. Alur Pembayaran

1. User `/start` → bot tampilkan menu produk (inline keyboard)
2. User pilih produk → bot tampilkan detail + tombol **Beli**
3. User tekan **Beli** → bot panggil `POST /qris/generate` dengan `amount` dari harga produk
4. Bot kirim foto QR (`qr_url`) + tombol **Cek Status Pembayaran** dan **Buka Halaman Pembayaran** (`checkout_url`)
5. User bayar via GoPay/e-wallet apapun yang support QRIS
6. Dua cara deteksi PAID:
   - **Otomatis**: AutoGoPay auto-poller mendeteksi pembayaran → kirim webhook `transaction.received` ke server kita → server verifikasi `X-Signature` → bot kirim pesan "✅ PEMBAYARAN BERHASIL"
   - **Manual**: User tekan tombol **Cek Status Pembayaran** → bot panggil `POST /qris/status`

## 7. Catatan Keamanan & Produksi

- `.env` **tidak** ikut ke GitHub (sudah masuk `.gitignore`). Jangan pernah commit API Key/Bot Token.
- Signature webhook **wajib** diverifikasi (sudah diimplementasikan di `autogopay.js` → `verifyWebhookSignature`) — jangan skip ini, supaya orang lain tidak bisa palsukan notifikasi PAID.
- `store.js` saat ini **in-memory** (hilang saat restart/proses crash). Untuk produksi nyata, ganti ke database (SQLite/Postgres/Redis) supaya transaksi yang sedang pending tidak hilang saat bot restart.
- Batas nominal QRIS GoPay: Rp1 – Rp10.000.000 per transaksi (sesuai dokumentasi AutoGoPay).
- QRIS expired otomatis 15 menit setelah dibuat.

## 8. Menambah / Mengubah Produk

Edit langsung `src/products.js`:

```js
{
  id: 'p4',
  name: 'Nama Produk Baru',
  price: 15000,
  description: 'Deskripsi singkat produk.',
},
```

Tidak perlu ubah bagian lain — menu, detail produk, dan alur pembayaran otomatis
mengikuti data ini.
