// Katalog produk sekarang disimpan di database (data/db.json),
// dikelola lewat Admin Panel. File ini tinggal jembatan ke db.js
// supaya bot.js tidak perlu tahu detail penyimpanan.

const db = require('./db');

function getAllProducts() {
  return db.getAllProducts();
}

function getProductById(id) {
  return db.getProductById(id);
}

function takeStock(productId) {
  return db.takeOneStock(productId);
}

function getStockCount(productId) {
  return db.getStock(productId).length;
}

module.exports = { getAllProducts, getProductById, takeStock, getStockCount };
