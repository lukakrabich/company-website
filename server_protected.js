
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

// Делаем переменную user доступной во всех EJS

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    return res.redirect('/login');
  }
}
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Главная
app.get('/', async (req, res) => {
  const services = await db.getAllServices();
  res.render('index', { services });
});

// Каталог
app.get('/catalog', async (req, res) => {
  const services = await db.getAllServices();
  res.render('catalog', { services });
});

// Карточка услуги
app.get('/service/:id', async (req, res) => {
  const service = await db.getServiceById(req.params.id);
  const reviews = await db.getReviewsByServiceId(req.params.id);
  if (!service) return res.status(404).send('Услуга не найдена');
  res.render('service', { service, serviceReviews: reviews });
});

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
  await db.createOrder(name, phone, email, delivery, payment, cart);
  cart = [];
  res.send(`Спасибо за заказ, ${name}! Подтверждение отправлено на ${email}.`);
});

// Личный кабинет
app.get('/account', async (req, res) => {
  const orders = await db.getAllOrders();
  res.render('account', { orders });
});

// Контакты
app.get('/contacts', (req, res) => {
  res.render('contacts');
});

// Админка
app.get('/admin', isAuthenticated, async (req, res) => {
  const services = await db.getAllServices();
  res.render('admin', { services });
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

app.post('/admin/delete/:id', isAuthenticated, async (req, res) => {
  await db.deleteService(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/edit/:id', isAuthenticated, async (req, res) => {
  const { name, price, type, category, description } = req.body;
  await db.updateService(req.params.id, name, price, type, category, description);
  res.redirect('/admin');
});

// Авторизация / Регистрация
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
