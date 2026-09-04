// Katalog produk sederhana untuk testing.
// Untuk produksi, ganti sumber data ini ke database (MySQL/Postgres/SQLite/dll).

const PRODUCTS = [
  {
    id: 'p1',
    name: 'Voucher Wifi 1 Hari',
    price: 5000,
    description: 'Akses internet 1 hari, unlimited device.',
  },
  {
    id: 'p2',
    name: 'Voucher Wifi 1 Minggu',
    price: 25000,
    description: 'Akses internet 7 hari, unlimited device.',
  },
  {
    id: 'p3',
    name: 'Template Landing Page',
    price: 50000,
    description: 'Source code landing page siap pakai (HTML/CSS/JS).',
  },
];

function getAllProducts() {
  return PRODUCTS;
}

function getProductById(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

module.exports = { getAllProducts, getProductById };
