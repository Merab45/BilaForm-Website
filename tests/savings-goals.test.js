const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bilaform-goals-'));
process.env.BILAFORM_DB_PATH = path.join(temporary, 'test.db');
process.env.JWT_SECRET = 'test-only-secret-long-enough-for-local-api-tests';
process.env.NODE_ENV = 'test';
const { app, db, initializeDatabase } = require('../server.js');
const { migrateSavingsGoals } = require('../server/migrations/savings-goals.js');
const { calculateGoalProgress } = require('../public/JS/savings-goals.js');
let apiServer;

after(async () => {
  if (apiServer?.listening) await new Promise((resolve) => apiServer.close(resolve));
  await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(temporary, { recursive: true, force: true });
});

test('goal progress calculates remaining KES, percentage and time-based contribution guides', () => {
  const result = calculateGoalProgress({ target_amount: 10000, current_amount: 2500, target_date: '2026-12-01' }, '2026-11-01');
  assert.equal(result.remaining, 7500);
  assert.equal(result.percent, 25);
  assert.equal(result.monthlyContribution, 7500);
  assert.equal(result.weeklyContribution, 1500);
  assert.equal(calculateGoalProgress({ target_amount: 1000, current_amount: 1000, target_date: '2026-12-01' }, '2026-11-01').remaining, 0);
  assert.equal(calculateGoalProgress({ target_amount: 1000, current_amount: 0, target_date: '2026-10-01' }, '2026-11-01').overdue, true);
  assert.equal(calculateGoalProgress({ target_amount: 1000, current_amount: 0, target_date: 'invalid' }, '2026-11-01').weeklyContribution, 0);
});

test('the protected dashboard exposes the savings goals view and loads its interface', () => {
  const account = fs.readFileSync(path.join(__dirname, '..', 'public', 'account.html'), 'utf8');
  const accountScript = fs.readFileSync(path.join(__dirname, '..', 'public', 'JS', 'account.js'), 'utf8');
  const authScript = fs.readFileSync(path.join(__dirname, '..', 'public', 'JS', 'auth.js'), 'utf8');
  const apiConfig = fs.readFileSync(path.join(__dirname, '..', 'public', 'JS', 'api-config.js'), 'utf8');
  const worker = fs.readFileSync(path.join(__dirname, '..', 'public', 'service-worker.js'), 'utf8');
  assert.match(account, /account\.html\?view=goals/);
  assert.match(account, /data-account-panel="goals"[^>]*data-savings-goals/);
  assert.match(account, /savings-goals\.js\?v=/);
  assert.match(account, /api-config\.js\?v=/);
  assert.match(accountScript, /'goals'/);
  assert.match(authScript, /account\.html\?view=goals/);
  assert.match(worker, /\.\/JS\/savings-goals\.js/);
  assert.match(worker, /\.\/JS\/api-config\.js/);
  assert.match(apiConfig, /BILAFORM_API_BASE_URL/);
});

test('savings-goal migration creates a pre-migration backup and is safe to rerun', async () => {
  await initializeDatabase();
  await runDb('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', ['Migration sentinel', 'sentinel@example.test', 'test-only']);
  const backupPath = path.join(temporary, 'before-savings-goals.sqlite');
  const result = await migrateSavingsGoals(db, { databasePath: process.env.BILAFORM_DB_PATH, backupPath });
  assert.equal(result.applied, true);
  assert.equal(result.backupPath, backupPath);
  assert.equal(fs.existsSync(backupPath), true);
  const backedUpUser = await queryDatabase(backupPath, "SELECT name FROM users WHERE email = 'sentinel@example.test'");
  assert.equal(backedUpUser.name, 'Migration sentinel');
  const absentFromBackup = await queryDatabase(backupPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'savings_goals'");
  assert.equal(absentFromBackup, undefined);
  const repeated = await migrateSavingsGoals(db, { databasePath: process.env.BILAFORM_DB_PATH, backupPath: path.join(temporary, 'should-not-exist.sqlite') });
  assert.deepEqual(repeated, { applied: false, backupPath: null });
  assert.equal(fs.existsSync(path.join(temporary, 'should-not-exist.sqlite')), false);
});

test('savings goals API authenticates users and scopes create, update, contributions and delete', async (t) => {
  await initializeDatabase();
  apiServer = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const origin = `http://127.0.0.1:${apiServer.address().port}`;
  for (const previewOrigin of ['http://127.0.0.1:5173', 'http://localhost:3000']) {
    const preflight = await fetch(`${origin}/api/auth/register`, {
      method: 'OPTIONS',
      headers: { Origin: previewOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), previewOrigin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  }
  t.after(async () => {
    if (apiServer.listening) await new Promise((resolve) => apiServer.close(resolve));
  });

  assert.equal((await fetch(`${origin}/api/savings-goals`)).status, 401);
  const owner = await register(origin, 'Goal Owner', 'goal-owner@example.test');
  const otherUser = await register(origin, 'Another User', 'goal-other@example.test');
  const loginResponse = await fetch(`${origin}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'goal-owner@example.test', password: 'ValidTestPassword123' }),
  });
  assert.equal(loginResponse.status, 200);
  assert.equal((await loginResponse.json()).user.id, owner.user.id);
  const ownerLoginCookie = loginResponse.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${origin}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'goal-owner@example.test', password: 'wrong-password' }),
  })).status, 401);
  const invalidResponse = await request(origin, '/api/savings-goals', ownerLoginCookie, 'POST', {
    name: 'School fees', target_amount: 10000, current_amount: 11000, target_date: '2026-12-01',
  });
  assert.equal(invalidResponse.status, 400);

  const createdResponse = await request(origin, '/api/savings-goals', ownerLoginCookie, 'POST', {
    name: 'School fees', target_amount: 10000, current_amount: 2500, target_date: '2026-12-01',
  });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).goal;
  assert.equal(created.current_amount, 2500);
  assert.equal(created.contributions[0].amount, 2500);
  assert.equal(created.contributions[0].entry_type, 'initial');

  const hiddenFromOther = await request(origin, '/api/savings-goals', otherUser.cookie);
  assert.deepEqual((await hiddenFromOther.json()).goals, []);
  assert.equal((await request(origin, `/api/savings-goals/${created.id}`, otherUser.cookie, 'PUT', { status: 'paused' })).status, 404);
  assert.equal((await request(origin, `/api/savings-goals/${created.id}`, otherUser.cookie, 'DELETE')).status, 404);

  const contributionResponse = await request(origin, `/api/savings-goals/${created.id}/contributions`, ownerLoginCookie, 'POST', { amount: 7500 });
  assert.equal(contributionResponse.status, 201);
  const contributed = (await contributionResponse.json()).goal;
  assert.equal(contributed.current_amount, 10000);
  assert.equal(contributed.status, 'completed');
  assert.equal(contributed.contributions.reduce((sum, item) => sum + item.amount, 0), 10000);
  assert.equal((await request(origin, `/api/savings-goals/${created.id}/contributions`, ownerLoginCookie, 'POST', { amount: 1 })).status, 409);

  const updatedResponse = await request(origin, `/api/savings-goals/${created.id}`, ownerLoginCookie, 'PUT', {
    name: 'School fees fund', target_amount: 12000, target_date: '2027-02-01', status: 'paused',
  });
  assert.equal(updatedResponse.status, 200);
  const updated = (await updatedResponse.json()).goal;
  assert.equal(updated.name, 'School fees fund');
  assert.equal(updated.current_amount, 10000);
  assert.equal(updated.status, 'paused');
  assert.equal((await request(origin, `/api/savings-goals/${created.id}/contributions`, ownerLoginCookie, 'POST', { amount: 100 })).status, 409);
  assert.equal((await request(origin, `/api/savings-goals/${created.id}`, ownerLoginCookie, 'DELETE')).status, 200);
  assert.deepEqual((await (await request(origin, '/api/savings-goals', ownerLoginCookie)).json()).goals, []);
});

async function register(origin, name, email) {
  const response = await fetch(`${origin}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'ValidTestPassword123' }),
  });
  assert.equal(response.status, 201);
  return { user: await response.json().then((body) => body.user), cookie: response.headers.get('set-cookie').split(';')[0] };
}

function runDb(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, (error) => error ? reject(error) : resolve()));
}

function queryDatabase(file, sql) {
  return new Promise((resolve, reject) => {
    const backup = new sqlite3.Database(file, (openError) => {
      if (openError) return reject(openError);
      backup.get(sql, (queryError, row) => backup.close((closeError) => {
        if (queryError) reject(queryError);
        else if (closeError) reject(closeError);
        else resolve(row);
      }));
    });
  });
}

function request(origin, route, cookie, method = 'GET', body) {
  return fetch(`${origin}${route}`, {
    method,
    headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
