const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fileURLToPath, pathToFileURL } = require('node:url');

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
  for (const view of ['overview', 'plans', 'goals', 'settings', 'security']) {
    assert.ok(account.includes(`account.html?view=${view}`), `Dashboard needs a direct ${view} link`);
  }
  assert.doesNotMatch(account, /data-account-panel="activity"|My Activities/);
  assert.match(read('JS/account.js'), /requestedView === 'activity' \? 'plans' : requestedView/);
  assert.match(read('JS/account.js'), /URLSearchParams\(window\.location\.search\)/);
  assert.match(read('JS/account.js'), /dashboardViews = new Set/);
  assert.match(read('JS/account.js'), /\['plans', 'activity'\]\.includes\(requestedView\)/);
  assert.doesNotMatch(account, /data-sidebar-toggle|☰/);
  assert.match(read('CSS/account.css'), /@media\(max-width:720px\)\{\.dashboard-nav\{display:grid/);
});

test('public pages use one consistent main navigation and separate account actions', () => {
  const files = walkHtml(publicRoot).filter((file) => !file.includes(`${path.sep}BilaForm-Android-Prototype${path.sep}`));
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('id="primary-navigation"')) continue;
    assert.equal((html.match(/id="primary-navigation"/g) || []).length, 1, `${path.relative(publicRoot, file)} has one primary navigation`);
    assert.equal((html.match(/class="header"/g) || []).length, 1, `${path.relative(publicRoot, file)} has one public header`);
    const nav = html.match(/<nav id="primary-navigation"[\s\S]*?<\/nav>/i)?.[0] || '';
    for (const href of ['index.html', 'services.html', 'blog/index.html', 'about.html', 'contact.html']) {
      assert.ok(nav.includes(href), `${path.relative(publicRoot, file)} navigation links to ${href}`);
    }
    assert.doesNotMatch(html, /class="menu"/);
  }
});

test('local page links and fragments resolve to existing destinations', () => {
  for (const file of walkHtml(publicRoot)) {
    const html = fs.readFileSync(file, 'utf8');
    const ids = new Set([...html.matchAll(/\b(?:id|name)=["']([^"']+)["']/gi)].map((match) => match[1]));
    for (const [, href] of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) {
        if (href.startsWith('#')) assert.ok(ids.has(decodeURIComponent(href.slice(1))), `${path.relative(publicRoot, file)} links to missing ${href}`);
        continue;
      }
      const destination = new URL(href, pathToFileURL(file));
      if (destination.protocol !== 'file:') continue;
      let target = fileURLToPath(destination);
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      assert.ok(fs.existsSync(target), `${path.relative(publicRoot, file)} links to missing ${href}`);
      if (destination.hash) {
        const targetHtml = fs.readFileSync(target, 'utf8');
        const targetIds = new Set([...targetHtml.matchAll(/\b(?:id|name)=["']([^"']+)["']/gi)].map((match) => match[1]));
        assert.ok(targetIds.has(decodeURIComponent(destination.hash.slice(1))), `${path.relative(publicRoot, file)} links to missing fragment ${href}`);
      }
    }
  }
});

function walkHtml(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walkHtml(file) : file.endsWith('.html') ? [file] : [];
  });
}

test('authentication retains the fixed PangaSiku resume destination', () => {
  assert.match(read('JS/auth.js'), /target === 'pangasiku'/);
  assert.match(read('JS/auth.js'), /services\/pangasiku\.html\?resume=1/);
  assert.match(read('JS/auth.js'), /target === 'goals'.*account\.html\?view=goals/s);
  assert.match(read('JS/auth.js'), /target === 'plans'.*account\.html\?view=plans/s);
  assert.match(read('JS/pangasiku.js'), /sessionStorage/);
});

test('browser-first Supabase authentication and private data setup remain configured', () => {
  const client = read('JS/supabase-client.js');
  const authScript = read('JS/auth.js');
  const authPage = read('auth.html');
  const dataAdapter = read('JS/bilaform-data.js');
  assert.match(client, /sdk\.createClient/);
  assert.match(client, /persistSession:\s*true/);
  assert.match(authScript, /client\.auth\.signUp/);
  assert.match(authScript, /client\.auth\.signInWithPassword/);
  assert.match(authScript, /services\/pangasiku\.html\?resume=1/);
  assert.match(authScript, /data-auth-form="reset-request"/);
  assert.match(authScript, /data-auth-form="reset-complete"/);
  assert.match(authPage, /supabase-client\.js/);
  assert.match(dataAdapter, /from\('daily_spending'\)/);
  assert.match(read('../supabase/migrations/20261119_pangasiku_guided_plan.sql'), /enable row level security/);
});

test('existing signed-in announcement remains account-only', () => {
  assert.doesNotMatch(home, /account-announcement|announcements-section/);
  assert.match(read('account.html'), /account-announcement/);
  assert.match(read('JS/account.js'), /account-announcement'\)\.hidden = false/);
});
