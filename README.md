# AutoGoPay Telegram Bot — Reseller VPN (QRIS GoPay)

Bot Telegram untuk jualan akun VPN premium (Indonesia/Singapore/dll):
pilih produk → generate QRIS via [AutoGoPay](https://autogopay.site) → auto-cek
pembayaran tiap 5 detik → begitu PAID, akun VPN otomatis dikirim ke pembeli.
Dilengkapi **Admin Panel** berbasis web untuk kelola produk, stok akun, dan
riwayat pesanan — tanpa perlu install database server (MySQL/Postgres) di VPS.

## Struktur Project

```
autogopay-bot/
├── index.js                 # entry point
├── data/
│   └── db.json               # database (auto-dibuat saat pertama jalan)
├── src/
│   ├── config.js              # load .env
│   ├── db.js                  # database sederhana berbasis file JSON
│   ├── products.js            # jembatan ke db.js (produk & stok)
│   ├── autogopay.js           # client API AutoGoPay + verifikasi signature
│   ├── store.js               # jembatan ke db.js (transaksi)
│   ├── poller.js               # auto-cek status pembayaran tiap 5 detik
│   ├── bot.js                  # logic bot Telegram (Telegraf)
│   ├── adminPanel.js           # panel web admin (/admin)
│   └── webhookServer.js        # server Express (webhook + admin panel)
├── .env.example
├── .gitignore
└── package.json
```

## 1. Persiapan

- Node.js >= 18
- Bot Telegram sudah dibuat via [@BotFather](https://t.me/BotFather) → simpan **Bot Token**
- Akun [AutoGoPay](https://autogopay.site) sudah punya **API Key** + **Activation Key aktif**
  (dibeli lewat `@AutoGopayBot` di Telegram, supaya provider GoPay benar-benar terhubung)
- VPS Ubuntu dengan akses publik

## 2. Install

```bash
git clone <repo-kamu>
cd autogopay-bot
npm install
cp .env.example .env
nano .env
```

Isi `.env`:

```
BOT_TOKEN=isi_token_dari_botfather
AUTOGOPAY_API_KEY=isi_api_key_dari_dashboard_autogopay
AUTOGOPAY_BASE_URL=https://v1-gateway.autogopay.site
PORT=3000
WEBHOOK_PATH=/webhook/autogopay

ADMIN_USERNAME=admin
ADMIN_PASSWORD=ganti_dengan_password_kuat
SESSION_SECRET=ganti_dengan_string_acak_panjang
```

⚠️ **WAJIB ganti** `ADMIN_PASSWORD` dan `SESSION_SECRET` dari nilai default —
ini yang melindungi panel admin kamu.

## 3. Jalankan

```bash
npm install -g pm2
pm2 start index.js --name autogopay-bot
pm2 save
pm2 startup   # ikuti instruksi tambahan yang muncul (hanya berhasil di VPS Linux asli)
```

Cek log:
```bash
pm2 logs autogopay-bot
```

## 4. Akses Admin Panel

Buka browser: `http://IP_VPS_KAMU:3000/admin`

⚠️ Port `3000` biasanya diblokir firewall VPS secara default. Buka aksesnya:
```bash
ufw allow 3000
```
(Kalau provider VPS-nya punya firewall terpisah di dashboard — DigitalOcean/Vultr/dll —
buka juga port 3000 di sana.)

Login pakai `ADMIN_USERNAME` / `ADMIN_PASSWORD` dari `.env`.

### Yang bisa dilakukan di Admin Panel:

- **Tambah/Edit/Hapus produk** — nama, harga, deskripsi
- **Kelola stok akun VPN** — paste banyak akun sekaligus (satu baris = satu akun,
  format bebas, misal `user:pass` atau `email|password|expired`), sistem otomatis
  ngirim satu-satu ke pembeli sesuai urutan (FIFO) begitu mereka bayar
- **Riwayat Pesanan** — lihat semua transaksi, status (pending/PAID/expired), dan
  akun mana yang sudah terkirim ke pembeli mana

> 🔒 **Keamanan**: akses di atas masih HTTP biasa (belum HTTPS), jadi password bisa
> "kelihatan" kalau ada yang menyadap jaringan. Untuk penggunaan serius/produksi,
> pasang domain + SSL (lihat bagian 6) dan akses admin panel lewat
> `https://domainkamu.com/admin`, atau batasi akses port 3000 hanya dari IP kamu
> lewat `ufw allow from IP_KAMU to any port 3000`.

## 5. Alur Penjualan (Otomatis Penuh)

1. User `/start` → bot tampilkan menu produk + jumlah stok tersedia
2. User pilih produk → kalau stok habis, tombol "Beli" otomatis disembunyikan
3. User tekan **Beli** → bot cek stok sekali lagi → generate QRIS via AutoGoPay
4. Bot kirim QR + link pembayaran, lalu **otomatis cek status tiap 5 detik** di
   background (tidak perlu user pencet apapun)
5. Begitu terdeteksi **PAID**: bot ambil satu akun dari stok, kirim ke user, dan
   catat di riwayat pesanan — kalau ternyata stok baru saja habis (kasus langka),
   user diberi tahu admin akan kirim manual
6. Kalau ada domain+SSL, webhook `transaction.received` dari AutoGoPay juga bisa
   memicu hal yang sama secara real-time (kode sudah mendukung keduanya, saling
   melengkapi, dan dijamin tidak mengirim akun dobel)

## 6. Konfigurasi Webhook AutoGoPay (opsional, butuh domain+HTTPS)

Auto-polling tiap 5 detik di atas **sudah cukup** untuk kebanyakan kebutuhan tanpa
domain. Kalau nanti kamu punya domain + SSL dan mau notifikasi lebih instan:

1. Pasang Nginx reverse proxy ke `localhost:3000`, aktifkan SSL (`certbot`)
2. Dashboard AutoGoPay → Settings → Callback URL:
   ```
   https://domainkamu.com/webhook/autogopay
   ```

### Contoh reverse proxy Nginx

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
Lalu: `certbot --nginx -d domainkamu.com`

## 7. Backup Data

Semua data (produk, stok, riwayat transaksi) ada di **satu file**:
```
data/db.json
```
Backup rutin file ini (misal copy ke Google Drive tiap hari) — kalau file ini
hilang, semua data produk/stok/riwayat ikut hilang.

```bash
# contoh backup manual
cp data/db.json data/db.backup-$(date +%Y%m%d).json
```

## 8. Catatan Keamanan

- `.env` **tidak** ikut ke GitHub (sudah di `.gitignore`)
- Signature webhook **wajib** diverifikasi (`autogopay.js` → `verifyWebhookSignature`)
- Ganti `ADMIN_PASSWORD` dan `SESSION_SECRET` dari default
- Batas nominal QRIS GoPay: Rp1 – Rp10.000.000 per transaksi
- QRIS expired otomatis 15 menit setelah dibuat
