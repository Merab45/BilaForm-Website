const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { calculateRecurringCosts } = require('../public/JS/micro-leaks.js');

test('micro-leak estimates convert daily, weekly and monthly costs into useful totals', () => {
  const totals = calculateRecurringCosts([
    { amount: 100, frequency: 'daily' },
    { amount: 500, frequency: 'weekly' },
    { amount: 1000, frequency: 'monthly' },
  ]);
  assert.equal(totals.annual, 74500);
  assert.ok(Math.abs(totals.monthly - ((100 * 365 / 12) + (500 * 52 / 12) + 1000)) < 1e-9);
  assert.deepEqual(calculateRecurringCosts([]), { monthly: 0, annual: 0 });
});

test('micro-leak tool clearly states that entries are local and session-only', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'services', 'micro-leaks.html'), 'utf8');
  assert.match(html, /data-leak-form/);
  assert.match(html, /data-leak-monthly/);
  assert.match(html, /data-leak-annual/);
  assert.match(html, /not saved to your BilaForm account/);
  assert.match(html, /micro-leaks\.js/);
});
