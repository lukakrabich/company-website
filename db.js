
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('./database.sqlite');

// Создание таблиц при первом запуске
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    type TEXT,
    category TEXT,
    description TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    delivery TEXT,
    payment TEXT,
    items TEXT,
    date TEXT,
    user_id INTEGER,
    status TEXT DEFAULT 'Новый'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER,
    name TEXT,
    text TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS seo (
    path TEXT PRIMARY KEY,
    title TEXT,
    description TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  )`);

  db.get("SELECT * FROM users WHERE email = ?", ["iloveushigetora@gmail.com"], (err, row) => {
    if (!row) {
      const password = "12345mkb";
      const saltRounds = 12;
      bcrypt.hash(password, saltRounds, (err, hash) => {
        if (!err) {
          db.run("INSERT INTO users (email, password) VALUES (?, ?)", ["iloveushigetora@gmail.com", hash], () => {
            console.log("✅ Администратор добавлен в базу данных");
          });
        }
      });
    }
  });
});

function getAllServices() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM services ORDER BY id DESC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getServiceById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM services WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function addService(name, price, type, category, description) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO services (name, price, type, category, description) VALUES (?, ?, ?, ?, ?)',
      [name, price, type, category, description],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function deleteService(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM services WHERE id = ?', [id], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function updateService(id, name, price, type, category, description) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE services SET name = ?, price = ?, type = ?, category = ?, description = ? WHERE id = ?',
      [name, price, type, category, description, id],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getAllOrders() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getOrdersByUserId(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function addOrder(name, phone, email, delivery, payment, items, userId = null, status = 'Новый') {
  return new Promise((resolve, reject) => {
    const itemsJson = JSON.stringify(items);
    const date = new Date().toLocaleString("ru-RU");

    db.run(
      'INSERT INTO orders (name, phone, email, delivery, payment, items, date, user_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, phone, email, delivery, payment, itemsJson, date, userId, status],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getReviewsByServiceId(serviceId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM reviews WHERE service_id = ?', [serviceId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function addReview(serviceId, name, text) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO reviews (service_id, name, text) VALUES (?, ?, ?)',
      [serviceId, name, text],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getSeoByPath(path) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM seo WHERE path = ?', [path], (err, row) => {
      if (err) reject(err);
      else resolve(row || { title: '', description: '' });
    });
  });
}

function updateSeo(path, title, description) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO seo (path, title, description)
       VALUES (?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET title = excluded.title, description = excluded.description`,
      [path, title, description],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function createUser(email, password) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, password], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function findUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

module.exports = {
  getAllServices,
  getServiceById,
  addService,
  deleteService,
  updateService,
  getAllOrders,
  getOrdersByUserId,
  addOrder,
  getReviewsByServiceId,
  addReview,
  getSeoByPath,
  updateSeo,
  createUser,
  findUserByEmail
};
