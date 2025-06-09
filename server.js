const { sendOrderEmail } = require('./mailer');
const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./db');
const bcrypt = require('bcrypt');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Сделать переменную user доступной во всех EJS
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware для защиты админки
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Главная
app.get('/', async (req, res) => {
  const services = await db.getAllServices();
  res.render('index', { services });
});

// Каталог с фильтрами и сортировкой
app.get('/catalog', async (req, res) => {
  const { category, minPrice, maxPrice, sort } = req.query;

  let services = await db.getAllServices();

  if (category) {
    services = services.filter(s => s.category === category);
  }
  if (minPrice) {
    services = services.filter(s => s.price >= parseFloat(minPrice));
  }
  if (maxPrice) {
    services = services.filter(s => s.price <= parseFloat(maxPrice));
  }

  if (sort === 'price_asc') {
    services.sort((a, b) => a.price - b.price);
  } else if (sort === 'price_desc') {
    services.sort((a, b) => b.price - a.price);
  } else {
    services.sort((a, b) => b.id - a.id); // Новизна
  }

  res.render('catalog', {
    services,
    category,
    minPrice,
    maxPrice,
    sort
  });
});

// Карточка услуги
app.get('/service/:id', async (req, res) => {
  const service = await db.getServiceById(req.params.id);
  const reviews = await db.getReviewsByServiceId(req.params.id);
  if (!service) return res.status(404).send('Услуга не найдена');
  res.render('service', { service, serviceReviews: reviews });
});

// Добавить отзыв
app.post('/service/:id/review', async (req, res) => {
  const { name, text } = req.body;
  await db.addReview(req.params.id, name, text);
  res.redirect(`/service/${req.params.id}`);
});

// Корзина
let cart = [];

app.get('/cart', (req, res) => {
  res.render('cart', { cart });
});

app.post('/cart/add/:id', async (req, res) => {
  const service = await db.getServiceById(req.params.id);
  if (service) cart.push(service);
  res.redirect('/cart');
});

app.post('/cart/remove/:id', (req, res) => {
  cart = cart.filter(item => item.id != req.params.id);
  res.redirect('/cart');
});

// Оформление заказа
app.get('/checkout', (req, res) => {
  res.render('checkout');
});

app.post('/checkout', async (req, res) => {
  const { name, phone, email, delivery, payment } = req.body;
  const userId = req.session.user ? req.session.user.id : null;

  // 1. Создаём заказ в базе
  await db.addOrder(name, phone, email, delivery, payment, cart, userId);

  // 2. Формируем HTML-письмо
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const itemsHtml = cart.map(item => `<li>${item.name} — ${item.price} ₽</li>`).join('');
  const html = `
    <h2>Здравствуйте, ${name}!</h2>
    <p>Спасибо за ваш заказ в Альянс Торг.</p>
    <p><strong>Список услуг:</strong></p>
    <ul>${itemsHtml}</ul>
    <p><strong>Общая сумма:</strong> ${total} ₽</p>
    <p><strong>Способ оплаты:</strong> ${payment}</p>
    <p><strong>Способ доставки:</strong> ${delivery}</p>
    <p>Мы свяжемся с вами при необходимости. Это письмо отправлено автоматически.</p>
  `;

  // 3. Отправляем письмо
  try {
    await sendOrderEmail(email, 'Ваш заказ в Альянс Торг принят', html);
    console.log(`Письмо отправлено на ${email}`);
  } catch (err) {
    console.error('Ошибка при отправке письма:', err);
  }

  // 4. Очищаем корзину и отвечаем
  cart = [];
  res.send(`Спасибо за заказ, ${name}! Подтверждение отправлено на ${email}.`);
});


// Личный кабинет
app.get('/account', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const orders = await db.getOrdersByUserId(req.session.user.id);
  res.render('account', { orders });
});

// Контакты
app.get('/contacts', (req, res) => {
  res.render('contacts');
});

// --- АДМИНКА ---
app.get('/admin', isAuthenticated, async (req, res) => {
  const services = await db.getAllServices();
  res.render('admin', { services });
});

// --- Управление заказами в админке ---
app.get('/admin/orders', isAuthenticated, async (req, res) => {
  const { status } = req.query;
  let orders = await db.getAllOrders();

  if (status) {
    orders = orders.filter(order => order.status === status);
  }

  res.render('admin-orders', { orders, status });
});


app.post('/admin/orders/:id/status', isAuthenticated, async (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  const sqlite3 = require('sqlite3').verbose();
  const localDb = new sqlite3.Database('./database.sqlite');

  localDb.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], function (err) {
    if (err) {
      console.error('Ошибка обновления статуса:', err);
    }
    res.redirect('/admin/orders');
  });
});


app.post('/admin/add', isAuthenticated, async (req, res) => {
  const { name, price, type, category, description } = req.body;
  await db.addService(name, price, type, category, description);
  res.redirect('/admin');
});

app.get('/admin/edit/:id', isAuthenticated, async (req, res) => {
  const service = await db.getServiceById(req.params.id);
  if (!service) return res.status(404).send('Услуга не найдена');
  res.render('edit', { service });
});

app.post('/admin/edit/:id', isAuthenticated, async (req, res) => {
  const { name, price, type, category, description } = req.body;
  await db.updateService(req.params.id, name, price, type, category, description);
  res.redirect('/admin');
});

app.post('/admin/delete/:id', isAuthenticated, async (req, res) => {
  await db.deleteService(req.params.id);
  res.redirect('/admin');
});

// --- АВТОРИЗАЦИЯ / РЕГИСТРАЦИЯ ---
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.findUserByEmail(email);
  if (!user) return res.send('Пользователь не найден');
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.send('Неверный пароль');
  req.session.user = user;
  res.redirect('/');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await db.createUser(email, hashed);
  res.redirect('/login');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
