require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const db = require('./db');
const bootstrap = require('./bootstrap');

const PROD = process.env.NODE_ENV === 'production';
let SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  if (PROD) { console.error('JWT_SECRET مفقود أو أقصر من 32 حرفًا. أضفه في متغيرات البيئة.'); process.exit(1); }
  SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('[DEV] لا يوجد JWT_SECRET، تم توليد مفتاح مؤقت (ستخرج من الحساب عند كل إعادة تشغيل).');
}

const { primary, allowed: ALLOWED } = bootstrap(db);
const primaryTeacher = () => db.prepare(
  'SELECT t.id, t.full_name FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.email = ?').get(primary);

const app = express();
app.set('trust proxy', 1); // خلف بروكسي الاستضافة (Render/Railway) لكي يعمل الـ rate limit و HTTPS بشكل صحيح
app.use(helmet({
  contentSecurityPolicy: { directives: { upgradeInsecureRequests: PROD ? [] : null } },
  hsts: PROD,
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// الحماية: كل الحسابات المسموحة تعمل على مادة الدكتور الأساسي
function auth(kind) {
  return (req, res, next) => {
    try {
      const { uid } = jwt.verify(req.cookies.token || '', SECRET);
      const u = db.prepare('SELECT id, email, password_hash FROM users WHERE id = ?').get(uid);
      if (!u || !u.password_hash || !ALLOWED.includes(u.email)) throw new Error('no user');
      const t = primaryTeacher();
      const own = db.prepare('SELECT full_name FROM teachers WHERE user_id = ?').get(u.id);
      req.user = { id: u.id, teacher_id: t.id, full_name: own ? own.full_name : u.email };
      next();
    } catch {
      if (kind === 'api') return res.status(401).json({ error: 'يجب تسجيل الدخول' });
      res.redirect('/login');
    }
  };
}

require('./routes/auth')(app, { auth, SECRET, PROD, ALLOWED });
require('./routes/attendance')(app, auth);
require('./routes/records')(app, auth);
require('./routes/reports')(app, auth);
require('./routes/roster')(app, auth);

const page = (f) => (req, res) => res.sendFile(path.join(__dirname, 'public', f));
app.get('/', page('index.html'));
app.get('/login', page('login.html'));
app.get('/a/:token', page('student.html'));
app.get('/dashboard', auth('page'), page('dashboard.html'));
app.get('/display', auth('page'), page('display.html'));
app.get('/lectures', auth('page'), page('lectures.html'));
app.get('/lectures/:id', auth('page'), page('lecture.html'));
app.get('/stats', auth('page'), page('stats.html'));
app.get('/roster', auth('page'), page('roster.html'));
app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).send('الصفحة غير موجودة'));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'خطأ في الخادم' });
});
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`يعمل على المنفذ ${PORT}`);
  console.log(`الحسابات المسموحة: ${ALLOWED.join(', ')}`);
});
