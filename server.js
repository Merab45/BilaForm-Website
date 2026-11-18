// BilaForm API and static site server. SQLite creates its database on first run.
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATABASE_FILE = process.env.BILAFORM_DB_PATH || path.join(__dirname, 'bilaform.db');
const production = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (production ? '' : 'local-development-secret-change-before-deploy');

if (!JWT_SECRET) {
  console.error('Set JWT_SECRET before running BilaForm in production.');
  process.exit(1);
}
if (production && Buffer.byteLength(JWT_SECRET, 'utf8') < 32) {
  console.error('JWT_SECRET must contain at least 32 bytes in production.');
  process.exit(1);
}

const db = new sqlite3.Database(DATABASE_FILE);
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(error) {
    if (error) reject(error);
    else resolve({ id: this.lastID, changes: this.changes });
  });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
});

async function initializeDatabase() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cash INTEGER NOT NULL CHECK (cash >= 0),
    essentials INTEGER NOT NULL CHECK (essentials >= 0),
    buffer INTEGER NOT NULL CHECK (buffer >= 0),
    days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 366),
    daily_safe INTEGER NOT NULL CHECK (daily_safe >= 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE INDEX IF NOT EXISTS budgets_user_latest ON budgets(user_id, updated_at DESC, id DESC)`);
  await run(`CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('vukamonth')),
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run('CREATE INDEX IF NOT EXISTS plans_user_latest ON plans(user_id, created_at DESC, id DESC)');
  await run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

// Only allow configured cross-origin clients; same-origin browser requests need no CORS headers.
const allowedOrigin = process.env.CORS_ORIGIN || '';
const localPreviewOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;
app.use(cors({
  origin(origin, callback) {
    // Same-origin calls need no CORS header; local Live Server previews do.
    const isAllowed = !origin || origin === allowedOrigin
      || (!production && localPreviewOrigin.test(origin));
    callback(null, isAllowed);
  },
  credentials: false,
}));
app.use(express.json({ limit: '12kb', type: 'application/json' }));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});
// Never let the browser or service worker cache account or contact API responses.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Small per-process rate limiter for public write endpoints.
const rateBuckets = new Map();
function rateLimit({ limit, windowMs }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    let bucket = rateBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    if (bucket.count > limit) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    return next();
  };
}

const authRateLimit = rateLimit({ limit: 12, windowMs: 15 * 60 * 1000 });
const contactRateLimit = rateLimit({ limit: 5, windowMs: 10 * 60 * 1000 });
const cleanText = (value) => typeof value === 'string' ? value.trim() : '';
const normalizeEmail = (value) => cleanText(value).toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const validAmount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;
const validGoalDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

function readSavingsGoal(body) {
  const name = cleanText(body?.name);
  const { target_amount: targetAmount, current_amount: currentAmount = 0, target_date: targetDate } = body || {};
  if (!name || name.length > 80) return { error: 'Goal name must be 1 to 80 characters.' };
  if (!Number.isSafeInteger(targetAmount) || targetAmount < 1 || targetAmount > 1_000_000_000) {
    return { error: 'Enter a whole-number target between KES 1 and KES 1,000,000,000.' };
  }
  if (!validAmount(currentAmount) || currentAmount > targetAmount) {
    return { error: 'Amount already saved must be a whole KES amount no greater than the target.' };
  }
  if (!validGoalDate(targetDate)) return { error: 'Choose a valid target date.' };
  return { name, target_amount: targetAmount, current_amount: currentAmount, target_date: targetDate };
}

function readBudget(body) {
  const { cash, essentials, buffer, days } = body || {};
  if (![cash, essentials, buffer].every(validAmount)) return { error: 'Enter whole-number KES amounts from 0 to 1,000,000,000.' };
  if (!Number.isSafeInteger(days) || days < 1 || days > 366) return { error: 'Days to payday must be a whole number between 1 and 366.' };
  const unreserved = cash - essentials - buffer;
  return {
    cash, essentials, buffer, days,
    daily_safe: Math.floor(Math.max(0, unreserved) / days),
    remaining_after_reserves: unreserved,
    needs_reset: unreserved <= 0,
  };
}

function signToken(user) {
  return jwt.sign({ sub: String(user.id), name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d', issuer: 'bilaform' });
}

function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Sign in to use this feature.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'bilaform' });
    req.user = { id: Number(payload.sub), name: payload.name, email: payload.email };
    if (!Number.isSafeInteger(req.user.id) || req.user.id < 1) throw new Error('Invalid account');
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

function requireSavingsGoalsSchema(req, res, next) {
  all("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('savings_goals', 'savings_contributions')")
    .then((tables) => {
      if (tables.length !== 2) return res.status(503).json({ error: 'Savings Goals is not set up on this server yet. Apply the backed-up database migration first.' });
      return next();
    })
    .catch(next);
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'bilaform-api' }));

app.post('/api/runway', rateLimit({ limit: 120, windowMs: 60 * 1000 }), (req, res) => {
  const budget = readBudget(req.body);
  if (budget.error) return res.status(400).json({ error: budget.error });
  return res.set('Cache-Control', 'no-store').json(budget);
});

app.post('/api/auth/register', authRateLimit, async (req, res, next) => {
  try {
    const name = cleanText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 bytes.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, passwordHash]);
    const user = { id: result.id, name, email };
    return res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'An account with that email already exists.' });
    return next(error);
  }
});

app.post('/api/auth/login', authRateLimit, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!validEmail(email) || !password || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ error: 'Enter your email and password.' });
    const row = await get('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
    if (!row || !(await bcrypt.compare(password, row.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const user = { id: row.id, name: row.name, email: row.email };
    return res.json({ token: signToken(user), user });
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/auth/profile', requireAuth, async (req, res, next) => {
  try {
    const name = cleanText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    await run('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.id]);
    return res.json({ user: await get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'That email address is already in use.' });
    return next(error);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(401).json({ error: 'This account no longer exists. Please sign in again.' });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/budgets', requireAuth, async (req, res, next) => {
  try {
    const budget = readBudget(req.body);
    if (budget.error) return res.status(400).json({ error: budget.error });
    const result = await run(
      'INSERT INTO budgets (user_id, cash, essentials, buffer, days, daily_safe) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, budget.cash, budget.essentials, budget.buffer, budget.days, budget.daily_safe],
    );
    const saved = await get('SELECT cash, essentials, buffer, days, daily_safe, updated_at FROM budgets WHERE id = ?', [result.id]);
    return res.status(201).json({ budget: { ...saved, remaining_after_reserves: budget.remaining_after_reserves, needs_reset: budget.needs_reset } });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/budgets', requireAuth, async (req, res, next) => {
  try {
    const budgets = await new Promise((resolve, reject) => db.all(
      'SELECT id, cash, essentials, buffer, days, daily_safe, updated_at FROM budgets WHERE user_id = ? ORDER BY updated_at DESC, id DESC',
      [req.user.id], (error, rows) => error ? reject(error) : resolve(rows),
    ));
    return res.json({ budgets });
  } catch (error) { return next(error); }
});

app.delete('/api/budgets/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid saved plan.' });
    const result = await run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!result.changes) return res.status(404).json({ error: 'Saved plan not found.' });
    return res.json({ deleted: true });
  } catch (error) { return next(error); }
});

app.get('/api/budgets/latest', requireAuth, async (req, res, next) => {
  try {
    const budget = await get(
      'SELECT cash, essentials, buffer, days, daily_safe, updated_at FROM budgets WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1',
      [req.user.id],
    );
    return res.json({ budget: budget || null });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/plans', requireAuth, async (req, res, next) => {
  try {
    const rows = await new Promise((resolve, reject) => db.all(
      'SELECT id, plan_type, name, data, created_at FROM plans WHERE user_id = ? ORDER BY created_at DESC, id DESC',
      [req.user.id], (error, result) => error ? reject(error) : resolve(result),
    ));
    return res.json({ plans: rows.map((row) => ({ ...row, data: JSON.parse(row.data) })) });
  } catch (error) { return next(error); }
});

app.post('/api/plans', requireAuth, async (req, res, next) => {
  try {
    const name = cleanText(req.body?.name);
    const { type, data } = req.body || {};
    if (type !== 'vukamonth') return res.status(400).json({ error: 'Choose a supported plan type.' });
    if (!name || name.length > 60) return res.status(400).json({ error: 'Plan name must be 1 to 60 characters.' });
    const categories = ['food', 'transport', 'rent', 'electricity', 'water', 'savings', 'other'];
    if (!data || !Number.isSafeInteger(data.income) || data.income < 0 || data.income > 1000000000
      || !categories.every((key) => Number.isSafeInteger(data[key]) && data[key] >= 0 && data[key] <= 1000000000)) {
      return res.status(400).json({ error: 'Enter whole-number KES values for income and each allocation.' });
    }
    const result = await run('INSERT INTO plans (user_id, plan_type, name, data) VALUES (?, ?, ?, ?)', [req.user.id, type, name, JSON.stringify(data)]);
    const plan = await get('SELECT id, plan_type, name, data, created_at FROM plans WHERE id = ?', [result.id]);
    return res.status(201).json({ plan: { ...plan, data: JSON.parse(plan.data) } });
  } catch (error) { return next(error); }
});

app.delete('/api/plans/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid saved plan.' });
    const result = await run('DELETE FROM plans WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!result.changes) return res.status(404).json({ error: 'Saved plan not found.' });
    return res.json({ deleted: true });
  } catch (error) { return next(error); }
});

async function savingsGoalForUser(id, userId) {
  const goal = await get('SELECT id, name, target_amount, current_amount, target_date, status, created_at, updated_at FROM savings_goals WHERE id = ? AND user_id = ?', [id, userId]);
  if (!goal) return null;
  goal.contributions = await all('SELECT id, amount, entry_type, created_at FROM savings_contributions WHERE goal_id = ? AND user_id = ? ORDER BY created_at DESC, id DESC', [id, userId]);
  return goal;
}

app.get('/api/savings-goals', requireAuth, requireSavingsGoalsSchema, async (req, res, next) => {
  try {
    const goals = await all("SELECT id, name, target_amount, current_amount, target_date, status, created_at, updated_at FROM savings_goals WHERE user_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, target_date, id DESC", [req.user.id]);
    const contributions = await all('SELECT id, goal_id, amount, entry_type, created_at FROM savings_contributions WHERE user_id = ? ORDER BY created_at DESC, id DESC', [req.user.id]);
    const grouped = new Map();
    contributions.forEach((contribution) => {
      const entries = grouped.get(contribution.goal_id) || [];
      entries.push({ id: contribution.id, amount: contribution.amount, entry_type: contribution.entry_type, created_at: contribution.created_at });
      grouped.set(contribution.goal_id, entries);
    });
    return res.json({ goals: goals.map((goal) => ({ ...goal, contributions: grouped.get(goal.id) || [] })) });
  } catch (error) { return next(error); }
});

app.post('/api/savings-goals', requireAuth, requireSavingsGoalsSchema, async (req, res, next) => {
  try {
    const goal = readSavingsGoal(req.body);
    if (goal.error) return res.status(400).json({ error: goal.error });
    const status = goal.current_amount >= goal.target_amount ? 'completed' : 'active';
    const result = await run('INSERT INTO savings_goals (user_id, name, target_amount, current_amount, target_date, status) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, goal.name, goal.target_amount, goal.current_amount, goal.target_date, status]);
    return res.status(201).json({ goal: await savingsGoalForUser(result.id, req.user.id) });
  } catch (error) { return next(error); }
});

app.put('/api/savings-goals/:id', requireAuth, requireSavingsGoalsSchema, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid savings goal.' });
    const current = await get('SELECT id, current_amount, status FROM savings_goals WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!current) return res.status(404).json({ error: 'Savings goal not found.' });
    const goal = readSavingsGoal({ ...req.body, current_amount: current.current_amount });
    if (goal.error) return res.status(400).json({ error: goal.error });
    if (goal.target_amount < current.current_amount) return res.status(400).json({ error: 'Target amount cannot be less than the amount already saved.' });
    const requestedStatus = req.body?.status ?? current.status;
    if (!['active', 'paused', 'completed'].includes(requestedStatus)) return res.status(400).json({ error: 'Choose active, paused or completed status.' });
    const status = current.current_amount >= goal.target_amount ? 'completed' : requestedStatus;
    const result = await run('UPDATE savings_goals SET name = ?, target_amount = ?, target_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND current_amount <= ?', [goal.name, goal.target_amount, goal.target_date, status, id, req.user.id, goal.target_amount]);
    if (!result.changes) return res.status(409).json({ error: 'The target must cover the amount already saved. Refresh and try again.' });
    return res.json({ goal: await savingsGoalForUser(id, req.user.id) });
  } catch (error) { return next(error); }
});

app.post('/api/savings-goals/:id/contributions', requireAuth, requireSavingsGoalsSchema, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const amount = req.body?.amount;
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid savings goal.' });
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000) return res.status(400).json({ error: 'Enter a whole-number contribution between KES 1 and KES 1,000,000,000.' });
    const result = await run(`UPDATE savings_goals
      SET current_amount = current_amount + ?,
          status = CASE WHEN current_amount + ? >= target_amount THEN 'completed' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND status = 'active' AND current_amount + ? <= target_amount`, [amount, amount, id, req.user.id, amount]);
    if (!result.changes) {
      const goal = await get('SELECT id, status, target_amount, current_amount FROM savings_goals WHERE id = ? AND user_id = ?', [id, req.user.id]);
      if (!goal) return res.status(404).json({ error: 'Savings goal not found.' });
      if (goal.status !== 'active') return res.status(409).json({ error: 'Resume this savings goal before adding a contribution.' });
      return res.status(400).json({ error: `Contribution exceeds the remaining ${goal.target_amount - goal.current_amount} KES.` });
    }
    return res.status(201).json({ goal: await savingsGoalForUser(id, req.user.id) });
  } catch (error) { return next(error); }
});

app.delete('/api/savings-goals/:id', requireAuth, requireSavingsGoalsSchema, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid savings goal.' });
    const result = await run('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!result.changes) return res.status(404).json({ error: 'Savings goal not found.' });
    return res.json({ deleted: true });
  } catch (error) { return next(error); }
});

app.post('/api/contact', contactRateLimit, async (req, res, next) => {
  try {
    const name = cleanText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const message = cleanText(req.body?.message);
    if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Enter a name between 2 and 100 characters.' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (message.length < 10 || message.length > 5000) return res.status(400).json({ error: 'Message must be between 10 and 5,000 characters.' });
    await run('INSERT INTO messages (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
    return res.status(201).json({ message: 'Thanks for contacting BilaForm. Your message has been received.' });
  } catch (error) {
    return next(error);
  }
});

// The static app remains usable offline; authenticated API features require this server.
app.use(express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: production ? '1h' : 0 }));
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((req, res) => res.status(404).type('text').send('Page not found'));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ error: 'Request body must be valid JSON.' });
  console.error('BilaForm request failed:', error.message);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

if (require.main === module) {
  initializeDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`BilaForm is available at http://127.0.0.1:${PORT}`));
  }).catch((error) => {
    console.error('Could not initialize BilaForm database:', error.message);
    process.exit(1);
  });
} else {
  module.exports = { app, db, initializeDatabase };
}
