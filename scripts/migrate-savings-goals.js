const path = require('node:path');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();
const { migrateSavingsGoals } = require('../server/migrations/savings-goals.js');

const databasePath = process.env.BILAFORM_DB_PATH || path.join(__dirname, '..', 'bilaform.db');
if (!fs.existsSync(databasePath)) {
  console.error(`Savings-goal migration stopped: database file not found at ${databasePath}. No file was created.`);
  process.exit(1);
}
const db = new sqlite3.Database(databasePath, (openError) => {
  if (openError) return finish(openError);
  db.run('PRAGMA foreign_keys = ON', (pragmaError) => {
    if (pragmaError) return finish(pragmaError);
    migrateSavingsGoals(db, { databasePath })
      .then((result) => {
        if (result.applied) console.log(`Savings-goal tables added. Database backup: ${result.backupPath}`);
        else console.log('Savings-goal schema is already present. No database changes were made.');
        finish();
      })
      .catch(finish);
  });
});

function finish(error) {
  if (error) console.error(`Savings-goal migration stopped: ${error.message}`);
  db.close((closeError) => {
    if (closeError) console.error(`Could not close the migration database: ${closeError.message}`);
    if (error || closeError) process.exitCode = 1;
  });
}
