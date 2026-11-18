const fs = require('node:fs');

const SAVINGS_GOAL_TABLES = new Set(['savings_goals', 'savings_contributions']);

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function backupDatabase(db, destination) {
  return new Promise((resolve, reject) => {
    let backup;
    backup = db.backup(destination, (error) => {
      if (error) return reject(error);
      backup.step(-1, (stepError, completed) => {
        if (stepError) return reject(stepError);
        if (!completed) return reject(new Error('SQLite backup did not complete.'));
        resolve();
      });
    });
  });
}

function execute(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (!error) return resolve();
      db.exec('ROLLBACK', () => reject(error));
    });
  });
}

async function migrateSavingsGoals(db, { databasePath, backupPath } = {}) {
  const rows = await new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('savings_goals', 'savings_contributions')", (error, result) => error ? reject(error) : resolve(result));
  });
  const present = new Set(rows.map((row) => row.name));
  if (present.size === SAVINGS_GOAL_TABLES.size) return { applied: false, backupPath: null };
  if (present.size) throw new Error('Savings-goal schema is partially present. Restore or inspect the database backup before continuing.');

  const usersTable = await get(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'");
  if (!usersTable) throw new Error('The BilaForm users table is missing. Initialize the existing application database before migrating savings goals.');
  if (!databasePath || !fs.existsSync(databasePath)) throw new Error('Database file not found. No migration was applied.');

  const destination = backupPath || `${databasePath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  if (fs.existsSync(destination)) throw new Error(`Backup destination already exists: ${destination}`);
  await backupDatabase(db, destination);

  const schema = `BEGIN IMMEDIATE;
CREATE TABLE savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount INTEGER NOT NULL CHECK (target_amount BETWEEN 1 AND 1000000000),
  current_amount INTEGER NOT NULL DEFAULT 0 CHECK (current_amount BETWEEN 0 AND 1000000000),
  target_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX savings_goals_user_latest ON savings_goals(user_id, status, target_date, id);
CREATE TABLE savings_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  entry_type TEXT NOT NULL DEFAULT 'contribution' CHECK (entry_type IN ('initial', 'contribution')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX savings_contributions_goal_latest ON savings_contributions(user_id, goal_id, created_at DESC, id DESC);
CREATE TRIGGER savings_goal_initial_contribution
AFTER INSERT ON savings_goals WHEN NEW.current_amount > 0
BEGIN
  INSERT INTO savings_contributions (user_id, goal_id, amount, entry_type) VALUES (NEW.user_id, NEW.id, NEW.current_amount, 'initial');
END;
CREATE TRIGGER savings_goal_contribution
AFTER UPDATE OF current_amount ON savings_goals WHEN NEW.current_amount > OLD.current_amount
BEGIN
  INSERT INTO savings_contributions (user_id, goal_id, amount, entry_type) VALUES (NEW.user_id, NEW.id, NEW.current_amount - OLD.current_amount, 'contribution');
END;
COMMIT;`;

  await execute(db, schema);
  return { applied: true, backupPath: destination };
}

module.exports = { migrateSavingsGoals };
