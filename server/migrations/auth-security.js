const fs = require('node:fs');

function backupDatabase(db, destination) {
  return new Promise((resolve, reject) => {
    const backup = db.backup(destination, (error) => {
      if (error) return reject(error);
      backup.step(-1, (stepError, completed) => {
        if (stepError) return reject(stepError);
        if (!completed) return reject(new Error('SQLite backup did not complete.'));
        resolve();
      });
    });
  });
}

function get(db, sql) {
  return new Promise((resolve, reject) => db.get(sql, (error, row) => error ? reject(error) : resolve(row)));
}

function exec(db, sql) {
  return new Promise((resolve, reject) => db.exec(sql, (error) => error ? reject(error) : resolve()));
}

async function migrateAuthSecurity(db, { databasePath, backupPath } = {}) {
  const userTable = await get(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  if (!userTable) throw new Error('The BilaForm users table is missing. No migration was applied.');

  const columns = await new Promise((resolve, reject) => db.all('PRAGMA table_info(users)', (error, rows) => error ? reject(error) : resolve(rows)));
  const hasTokenVersion = columns.some((column) => column.name === 'token_version');
  const resetTable = await get(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='password_reset_tokens'");
  if (hasTokenVersion && resetTable) return { applied: false, backupPath: null };
  if (hasTokenVersion !== Boolean(resetTable)) throw new Error('The authentication schema is partially present. Inspect or restore the database backup before continuing.');
  if (!databasePath || !fs.existsSync(databasePath)) throw new Error('Database file not found. No migration was applied.');

  const destination = backupPath || `${databasePath}.auth-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  if (fs.existsSync(destination)) throw new Error(`Backup destination already exists: ${destination}`);
  await backupDatabase(db, destination);
  const backupIntegrity = await new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    const copy = new sqlite3.Database(destination, sqlite3.OPEN_READONLY, (error) => {
      if (error) return reject(error);
      copy.get('PRAGMA integrity_check', (checkError, result) => copy.close((closeError) => {
        if (checkError) reject(checkError);
        else if (closeError) reject(closeError);
        else resolve(result?.integrity_check);
      }));
    });
  });
  if (backupIntegrity !== 'ok') throw new Error('The pre-migration backup failed SQLite integrity_check. No migration was applied.');

  try {
    await exec(db, `BEGIN IMMEDIATE;
${hasTokenVersion ? '' : 'ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0 CHECK (token_version >= 0);'}
${resetTable ? '' : `CREATE TABLE password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX password_reset_tokens_user_latest ON password_reset_tokens(user_id, created_at DESC);`}
COMMIT;`);
  } catch (error) {
    await exec(db, 'ROLLBACK').catch(() => {});
    throw error;
  }
  return { applied: true, backupPath: destination };
}

module.exports = { migrateAuthSecurity };
