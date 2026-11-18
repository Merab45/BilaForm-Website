const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.join(__dirname, '..', 'public');
const read = (file) => fs.readFileSync(path.join(publicRoot, file), 'utf8');
const home = read('index.html');

test('home stays focused and links to existing public pages', () => {
  assert.match(home, /id="top"/);
  assert.match(home, /id="features"/);
  assert.match(home, /id="how"/);
  assert.doesNotMatch(home, /id="calculator"|id="journal"|id="faq"|id="contact"/);
  for (const href of ['about.html', 'services.html', 'how-it-works.html', 'contact.html', 'auth.html?auth=login', 'auth.html?auth=register']) {
    assert.ok(home.includes(`href="${href}"`), `Home navigation needs ${href}`);
    assert.ok(fs.existsSync(path.join(publicRoot, href.split('?')[0])), `Page for ${href} must exist`);
  }
});

test('PangaSiku owns the calculator and no Home link points at the removed anchor', () => {
  assert.match(read('services/pangasiku.html'), /id="calculator"/);
  assert.match(read('services/pangasiku.html'), /JS\/pangasiku\.js/);
  assert.doesNotMatch(home, /index\.html#calculator|href="#calculator"/);
  assert.match(read('how-it-works.html'), /id="faq"/);
});

test('account navigation uses refresh-safe protected view URLs', () => {
  const account = read('account.html');
  for (const view of ['overview', 'plans', 'settings', 'security']) {
    assert.ok(account.includes(`account.html?view=${view}`), `Dashboard needs a direct ${view} link`);
  }
  assert.match(read('JS/account.js'), /URLSearchParams\(window\.location\.search\)/);
  assert.match(read('JS/account.js'), /dashboardViews = new Set/);
  assert.match(account, /data-sidebar-toggle/);
});

test('authentication retains the fixed PangaSiku resume destination', () => {
  assert.match(read('JS/auth.js'), /returnTarget === 'pangasiku'/);
  assert.match(read('JS/auth.js'), /services\/pangasiku\.html\?resume=1/);
  assert.match(read('JS/auth.js'), /returnTarget === 'goals'.*account\.html\?view=goals/s);
  assert.match(read('JS/pangasiku.js'), /sessionStorage/);
});

test('existing signed-in announcement remains account-only', () => {
  assert.doesNotMatch(home, /account-announcement|announcements-section/);
  assert.match(read('account.html'), /account-announcement/);
  assert.match(read('JS/account.js'), /account-announcement'\)\.hidden = false/);
});
