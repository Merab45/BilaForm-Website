const path = require('node:path');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();
const { migrateAuthSecurity } = require('../server/migrations/auth-security.js');

const databasePath = process.env.BILAFORM_DB_PATH || path.join(__dirname, '..', 'bilaform.db');
if (!fs.existsSync(databasePath)) {
  console.error(`Authentication migration stopped: database file not found at ${databasePath}. No file was created.`);
  process.exit(1);
}
const db = new sqlite3.Database(databasePath, (openError) => {
  if (openError) return finish(openError);
  db.run('PRAGMA foreign_keys = ON', (pragmaError) => {
    if (pragmaError) return finish(pragmaError);
    migrateAuthSecurity(db, { databasePath })
      .then((result) => {
        if (result.applied) console.log(`Authentication schema added. Database backup: ${result.backupPath}`);
        else console.log('Authentication schema is already present. No database changes were made.');
        finish();
      })
      .catch(finish);
  });
});

function finish(error) {
  if (error) console.error(`Authentication migration stopped: ${error.message}`);
  db.close((closeError) => {
    if (closeError) console.error(`Could not close the migration database: ${closeError.message}`);
    if (error || closeError) process.exitCode = 1;
  });
}
