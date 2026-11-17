const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const portalPath = path.join(__dirname, '..', 'public', 'JS', 'portal.js');
const publicPath = path.join(__dirname, '..', 'public');
const homeHtml = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8');

function loadPortal() {
  assert.ok(fs.existsSync(portalPath), 'portal behavior module is not implemented yet');
  return require(portalPath);
}

test('routes payday and daily budget requests to the PangaSiku calculator page', () => {
  const { routeToolQuery } = loadPortal();
  assert.equal(routeToolQuery('help me plan until payday'), 'services/pangasiku.html#calculator');
  assert.equal(routeToolQuery('daily budget'), 'services/pangasiku.html#calculator');
});

test('routes purchase affordability requests to the affordability tool', () => {
  const { routeToolQuery } = loadPortal();
  assert.equal(routeToolQuery('can I afford a purchase?'), 'services/affordability.html');
});

test('routes recurring expense and monthly planning requests to their existing tools', () => {
  const { routeToolQuery } = loadPortal();
  assert.equal(routeToolQuery('find my subscriptions'), 'services/micro-leaks.html');
  assert.equal(routeToolQuery('plan monthly rent and essentials'), 'services/vukamonth.html');
});

test('returns no route for empty or unrelated tool-finder queries', () => {
  const { routeToolQuery } = loadPortal();
  assert.equal(routeToolQuery('   '), null);
  assert.equal(routeToolQuery('write a poem'), null);
});

test('keeps the responsive navigation and account routes in the landing page', () => {
  assert.match(homeHtml, /id="primary-navigation"/);
  assert.match(homeHtml, /class="menu"[^>]*aria-controls="primary-navigation"[^>]*aria-expanded="false"/);
  assert.match(homeHtml, /auth\.html\?auth=login/);
  assert.match(homeHtml, /auth\.html\?auth=register/);
  assert.match(fs.readFileSync(portalPath, 'utf8'), /has-bubble-menu/);
  const landingCss = fs.readFileSync(path.join(publicPath, 'CSS', 'premium.css'), 'utf8');
  assert.match(landingCss, /\.landing-page \.header>nav\{position:static/);
  assert.match(landingCss, /\.has-bubble-menu \.landing-page \.header>nav\{position:absolute/);
  assert.match(landingCss, /prefers-reduced-motion:reduce/);
});

test('provides a useful tool-directory fallback when JavaScript is unavailable', () => {
  assert.match(homeHtml, /<form class="tool-finder"[^>]*action="services\.html"[^>]*method="get"/);
  assert.doesNotMatch(homeHtml, /data-tool-finder-directory[^>]*hidden/);
});

test('keeps account announcements off the public landing page', () => {
  assert.doesNotMatch(homeHtml, /announcements-section|account-announcement/);
  assert.match(fs.readFileSync(path.join(publicPath, 'account.html'), 'utf8'), /account-announcement/);
});

test('preserves the landing calculator, contact, FAQ, and four service cards', () => {
  assert.match(homeHtml, /data-save-plan/);
  assert.match(homeHtml, /id="contact-form"/);
  assert.match(homeHtml, /class="faq-question"/);
  assert.equal([...homeHtml.matchAll(/<article class="feature-card/g)].length, 4);
  assert.doesNotMatch(homeHtml, /data-service-deck|data-deck-card|data-deck-controls/);
  assert.doesNotMatch(fs.readFileSync(portalPath, 'utf8'), /initServiceDeck/);
});

test('matches cached landing assets despite version query strings', () => {
  const worker = fs.readFileSync(path.join(publicPath, 'service-worker.js'), 'utf8');
  assert.match(worker, /caches\.match\(request,\s*\{\s*ignoreSearch:\s*true/);
});

test('all local landing-page assets and navigation destinations exist', () => {
  const references = [...homeHtml.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  const missing = references.filter((reference) => {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) return false;
    const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    return pathname && !fs.existsSync(path.resolve(publicPath, pathname));
  });
  assert.deepEqual(missing, []);
});

