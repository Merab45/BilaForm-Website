const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bilaform-auth-'));
const databasePath = path.join(temporary, 'auth.db');
process.env.BILAFORM_DB_PATH = databasePath;
process.env.JWT_SECRET = 'test-only-secret-long-enough-for-local-api-tests';
process.env.NODE_ENV = 'test';
delete process.env.RESEND_API_KEY;
delete process.env.PASSWORD_RESET_FROM;
delete process.env.PUBLIC_APP_URL;
const { app, db, initializeDatabase } = require('../server.js');
const { migrateAuthSecurity } = require('../server/migrations/auth-security.js');
let apiServer;
const originalFetch = global.fetch;

after(async () => {
  global.fetch = originalFetch;
  if (apiServer?.listening) await new Promise((resolve) => apiServer.close(resolve));
  await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(temporary, { recursive: true, force: true });
});

test('auth migration backs up the database, adds reset and revocation schema, and is repeatable', async () => {
  const legacyPath = path.join(temporary, 'legacy.db');
  const legacyDb = new sqlite3.Database(legacyPath);
  await new Promise((resolve, reject) => legacyDb.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ); INSERT INTO users (name,email,password_hash) VALUES ('Keep User','keep@example.test','hashed-value');`, (error) => error ? reject(error) : resolve()));
  const backupPath = path.join(temporary, 'before-auth.sqlite');
  const first = await migrateAuthSecurity(legacyDb, { databasePath: legacyPath, backupPath });
  assert.deepEqual(first, { applied: true, backupPath });
  const columns = await new Promise((resolve, reject) => legacyDb.all('PRAGMA table_info(users)', (error, rows) => error ? reject(error) : resolve(rows)));
  assert.ok(columns.some((column) => column.name === 'token_version'));
  const resetTable = await new Promise((resolve, reject) => legacyDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='password_reset_tokens'", (error, row) => error ? reject(error) : resolve(row)));
  assert.equal(resetTable.name, 'password_reset_tokens');
  const backupColumns = await new Promise((resolve, reject) => {
    const backup = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (error) => {
      if (error) return reject(error);
      backup.all('PRAGMA table_info(users)', (queryError, rows) => backup.close(() => queryError ? reject(queryError) : resolve(rows)));
    });
  });
  assert.equal(backupColumns.some((column) => column.name === 'token_version'), false);
  assert.deepEqual(await migrateAuthSecurity(legacyDb, { databasePath: legacyPath, backupPath: path.join(temporary, 'unused.sqlite') }), { applied: false, backupPath: null });
  await new Promise((resolve, reject) => legacyDb.close((error) => error ? reject(error) : resolve()));
});

test('registration, login, protected access, logout revocation and password recovery work end to end', async () => {
  await initializeDatabase();
  apiServer = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const origin = `http://127.0.0.1:${apiServer.address().port}`;
  const send = (route, body, session, requestOrigin) => fetch(`${origin}${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.startsWith('bilaform_session=') ? { Cookie: session } : session ? { Authorization: `Bearer ${session}` } : {}),
      ...(requestOrigin ? { Origin: requestOrigin } : {}),
    },
    body: JSON.stringify(body),
  });

  assert.equal((await send('/api/auth/login', {})).status, 400);
  assert.equal((await send('/api/auth/register', { name: 'A', email: 'bad', password: 'short' })).status, 400);

  const registeredResponse = await send('/api/auth/register', { name: 'Test Owner', email: 'Owner@example.test', password: 'OriginalPass123' });
  assert.equal(registeredResponse.status, 201);
  const registered = await registeredResponse.json();
  assert.equal(registered.token, undefined);
  const registeredCookie = registeredResponse.headers.get('set-cookie').split(';')[0];
  assert.match(registeredResponse.headers.get('set-cookie'), /HttpOnly/);
  assert.match(registeredResponse.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal((await fetch(`${origin}/api/auth/me`, { headers: { Cookie: registeredCookie } })).status, 200);
  const legacyToken = jwt.sign({ sub: String(registered.user.id), name: registered.user.name, email: registered.user.email }, process.env.JWT_SECRET, { expiresIn: '1h', issuer: 'bilaform' });
  assert.equal((await fetch(`${origin}/api/auth/me`, { headers: { Authorization: `Bearer ${legacyToken}` } })).status, 200);
  assert.equal(registered.user.email, 'owner@example.test');
  const stored = await new Promise((resolve, reject) => db.get('SELECT password_hash FROM users WHERE id = ?', [registered.user.id], (error, row) => error ? reject(error) : resolve(row)));
  assert.notEqual(stored.password_hash, 'OriginalPass123');

  assert.equal((await send('/api/auth/register', { name: 'Other Name', email: 'OWNER@example.test', password: 'OriginalPass123' })).status, 409);
  assert.equal((await send('/api/auth/login', { email: 'owner@example.test', password: 'WrongPass123' })).status, 401);
  const loginResponse = await send('/api/auth/login', { email: ' OWNER@EXAMPLE.TEST ', password: 'OriginalPass123' });
  assert.equal(loginResponse.status, 200);
  const loggedIn = await loginResponse.json();
  assert.equal(loggedIn.token, undefined);
  const loginCookie = loginResponse.headers.get('set-cookie').split(';')[0];
  const me = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: loginCookie } });
  assert.equal(me.status, 200);
  const preflight = await fetch(`${origin}/api/auth/logout`, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5501', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');

  const resetUnavailable = await send('/api/auth/password-reset/request', { email: 'owner@example.test' });
  assert.equal(resetUnavailable.status, 503);

  process.env.RESEND_API_KEY = 'test-api-key';
  process.env.PASSWORD_RESET_FROM = 'BilaForm <test@example.test>';
  process.env.PUBLIC_APP_URL = 'https://example.test/';
  let deliveredMessage;
  global.fetch = async (input, init) => {
    if (String(input) === 'https://api.resend.com/emails') {
      deliveredMessage = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: 'mock-email-id' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(input, init);
  };

  const unknownReset = await send('/api/auth/password-reset/request', { email: 'missing@example.test' });
  assert.equal(unknownReset.status, 202);
  const resetRequested = await send('/api/auth/password-reset/request', { email: 'owner@example.test' });
  assert.equal(resetRequested.status, 202);
  assert.match((await resetRequested.json()).message, /If an account exists/);
  const token = deliveredMessage.text.match(/#([a-f0-9]{64})/)[1];
  const savedResetHash = await new Promise((resolve, reject) => db.get('SELECT token_hash FROM password_reset_tokens WHERE user_id = ?', [registered.user.id], (error, row) => error ? reject(error) : resolve(row.token_hash)));
  assert.notEqual(savedResetHash, token);

  const resetResponse = await send('/api/auth/password-reset/complete', { token, password: 'NewSecurePass456' });
  assert.equal(resetResponse.status, 200);
  assert.match(resetResponse.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await fetch(`${origin}/api/auth/me`, { headers: { Cookie: loginCookie } })).status, 401);
  assert.equal((await send('/api/auth/password-reset/complete', { token, password: 'AnotherPass789' })).status, 400);
  assert.equal((await send('/api/auth/login', { email: 'owner@example.test', password: 'OriginalPass123' })).status, 401);
  const newLogin = await send('/api/auth/login', { email: 'owner@example.test', password: 'NewSecurePass456' });
  assert.equal(newLogin.status, 200);
  const newSession = await newLogin.json();
  const newCookie = newLogin.headers.get('set-cookie').split(';')[0];
  const forbiddenLogout = await send('/api/auth/logout', {}, newCookie, 'https://attacker.example');
  assert.equal(forbiddenLogout.status, 403);
  const logout = await send('/api/auth/logout', {}, newCookie);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await fetch(`${origin}/api/auth/me`, { headers: { Cookie: newCookie } })).status, 401);
  const expiredJwt = jwt.sign({ sub: String(registered.user.id), ver: 2 }, process.env.JWT_SECRET, { expiresIn: '-1s', issuer: 'bilaform' });
  assert.equal((await fetch(`${origin}/api/auth/me`, { headers: { Authorization: `Bearer ${expiredJwt}` } })).status, 401);

  const expiredToken = 'a'.repeat(64);
  const expiredHash = createHash('sha256').update(expiredToken).digest('hex');
  await new Promise((resolve, reject) => db.run('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [expiredHash, registered.user.id, Math.floor(Date.now() / 1000) - 1], (error) => error ? reject(error) : resolve()));
  assert.equal((await send('/api/auth/password-reset/complete', { token: expiredToken, password: 'ExpiredPass789' })).status, 400);
});
