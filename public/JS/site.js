// BilaForm browser interactions and API connections.
const byId = (id) => document.getElementById(id);
const money = (value) => `KES ${Math.floor(Math.max(0, value)).toLocaleString('en-KE')}`;
// VS Code Live Server is a static preview on port 5501. Route its API calls
// to Express; normal npm-start browsing stays same-origin.
const API_ROOT = ['5500', '5501'].includes(location.port)
  && ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://127.0.0.1:8000/api'
  : '/api';
const inputIds = ['cash', 'essentials', 'buffer', 'days'];
const calcError = byId('calc-error');
const resultPanel = document.querySelector('.calc .result');
let calculationSequence = 0;
let calculationTimer;
let pendingSave = false;

function readInputs() {
  const fields = inputIds.map(byId);
  fields.forEach((input) => input.setAttribute('aria-invalid', String(!input.value.trim() || !input.validity.valid)));
  const invalid = fields.find((input) => !input.value.trim() || !input.validity.valid);
  if (invalid) {
    calcError.textContent = invalid.id === 'days'
      ? 'Enter a whole number of days from 1 to 366.'
      : 'Enter a whole KES amount from 0 to 1,000,000,000.';
    calcError.hidden = false;
    return null;
  }
  const budget = Object.fromEntries(fields.map((input) => [input.id, Number(input.value)]));
  if (![budget.cash, budget.essentials, budget.buffer].every((amount) => Number.isSafeInteger(amount) && amount <= 1_000_000_000)
    || !Number.isSafeInteger(budget.days) || budget.days < 1 || budget.days > 366) {
    calcError.textContent = 'Check the amounts and days entered. Use whole numbers within the limits shown.';
    calcError.hidden = false;
    return null;
  }
  calcError.hidden = true;
  calcError.textContent = '';
  return budget;
}

function showBudget(budget) {
  const remainder = budget.cash - budget.essentials - budget.buffer;
  const daily = Math.floor(Math.max(0, remainder) / budget.days);
  byId('daily').textContent = money(daily);
  byId('badge').textContent = remainder <= 0 ? 'PLAN NEEDS A RESET' : 'BUFFER KEPT ✓';
  byId('badge').classList.toggle('reset', remainder <= 0);
  byId('runway-breakdown').textContent = `${money(budget.cash)} less ${money(budget.essentials)} essentials and ${money(budget.buffer)} buffer leaves ${money(Math.max(0, remainder))} across ${budget.days} day${budget.days === 1 ? '' : 's'}.`;
  resultPanel.setAttribute('aria-busy', 'false');
  updatePurchaseSimulator(budget, daily);
  return daily;
}

// Calculate locally immediately; when the API is available it confirms the same result.
function updateRunway() {
  const sequence = ++calculationSequence;
  clearTimeout(calculationTimer);
  resultPanel.setAttribute('aria-busy', 'false');
  const budget = readInputs();
  if (!budget) return;
  showBudget(budget);
  calculationTimer = setTimeout(async () => {
    resultPanel.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(`${API_ROOT}/runway`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(budget),
      });
      if (!response.ok) return;
      const result = await response.json();
      if (sequence !== calculationSequence) return;
      byId('daily').textContent = money(result.daily_safe);
      byId('badge').textContent = result.needs_reset ? 'PLAN NEEDS A RESET' : 'BUFFER KEPT ✓';
      byId('badge').classList.toggle('reset', result.needs_reset);
    } catch {
      // Offline use keeps the same locally calculated value and remains available.
    } finally {
      if (sequence === calculationSequence) resultPanel.setAttribute('aria-busy', 'false');
    }
  }, 120);
}

inputIds.forEach((id) => byId(id).addEventListener('input', updateRunway));

function updatePurchaseSimulator(budget = readInputs(), daily = null) {
  const priceInput = byId('purchase-price');
  const feedback = byId('purchase-feedback');
  if (!priceInput || !feedback || !budget) return;
  const price = priceInput.value === '' ? null : Number(priceInput.value);
  if (price === null) {
    feedback.textContent = 'Enter a purchase amount to see the impact.';
    feedback.className = 'purchase-feedback';
    return;
  }
  if (!Number.isSafeInteger(price) || price < 0 || price > 1_000_000_000) {
    feedback.textContent = 'Enter a whole KES amount from 0 to 1,000,000,000.';
    feedback.className = 'purchase-feedback is-warning';
    return;
  }
  const currentDaily = daily ?? Math.floor(Math.max(0, budget.cash - budget.essentials - budget.buffer) / budget.days);
  const afterPurchase = budget.cash - price - budget.essentials - budget.buffer;
  const nextDaily = Math.floor(Math.max(0, afterPurchase) / budget.days);
  if (afterPurchase < 0) {
    feedback.textContent = `${money(price)} would exceed the amount available after essentials and your buffer by ${money(Math.abs(afterPurchase))}. Your plan needs a reset before this purchase.`;
    feedback.className = 'purchase-feedback is-warning';
  } else if (nextDaily < currentDaily) {
    feedback.textContent = `After this ${money(price)} purchase, your daily guide would move from ${money(currentDaily)} to ${money(nextDaily)} for ${budget.days} days.`;
    feedback.className = 'purchase-feedback is-caution';
  } else {
    feedback.textContent = `Your daily guide would remain ${money(nextDaily)} after setting aside ${money(price)} for this purchase.`;
    feedback.className = 'purchase-feedback is-positive';
  }
}
byId('purchase-price')?.addEventListener('input', () => updatePurchaseSimulator());

// Account state is deliberately limited to the requested JWT and display profile.
const accountDialog = byId('account-dialog');
const authFeedback = document.querySelector('.auth-feedback');
const tokenKey = 'bilaform.auth.token';
const userKey = 'bilaform.auth.user';
let accountToken = localStorage.getItem(tokenKey) || '';
let accountUser = null;
try { accountUser = JSON.parse(localStorage.getItem(userKey) || 'null'); } catch { localStorage.removeItem(userKey); }

function setAuthFeedback(message, isError = false) {
  authFeedback.textContent = message;
  authFeedback.hidden = !message;
  authFeedback.classList.toggle('is-error', isError);
}

function showAuth(mode = 'login') {
  const isRegister = mode === 'register';
  byId('account-notice-title').textContent = isRegister ? 'Create your BilaForm account.' : 'Welcome back.';
  document.querySelectorAll('[data-auth-tab]').forEach((tab) => {
    const active = tab.dataset.authTab === mode;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-auth-form]').forEach((form) => { form.hidden = form.dataset.authForm !== mode; });
  setAuthFeedback('');
  if (!accountDialog.open) accountDialog.showModal();
  accountDialog.querySelector(`[data-auth-form="${mode}"] input`)?.focus();
}

function renderAccount() {
  const loggedIn = Boolean(accountToken && accountUser?.name);
  document.querySelector('[data-user-name]').hidden = !loggedIn;
  document.querySelector('[data-user-name]').textContent = loggedIn ? `Hi, ${accountUser.name}` : '';
  document.querySelector('[data-logout]').hidden = !loggedIn;
  const navbarLogin = document.querySelector('.navbar-login');
  if (navbarLogin) navbarLogin.hidden = loggedIn;
  const openAuth = document.querySelector('[data-open-auth]');
  if (openAuth) openAuth.hidden = loggedIn;
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(accountToken ? { Authorization: `Bearer ${accountToken}` } : {}), ...options.headers };
  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, { ...options, headers });
  } catch {
    throw new Error('BilaForm could not reach its API. In VS Code, run “BilaForm: Start API” from Terminal → Run Task, then try again.');
  }
  let payload = {};
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  if (!isJson && !response.ok) {
    throw new Error('This preview is not connected to BilaForm’s API. Start the API with the VS Code task “BilaForm: Start API”, then try again.');
  }
  try { if (isJson) payload = await response.json(); } catch { /* Use the standard API error below. */ }
  if (!response.ok) {
    if (response.status === 401 && accountToken) clearAccount();
    throw new Error(payload.error || 'The request could not be completed.');
  }
  return payload;
}

function clearAccount() {
  accountToken = '';
  accountUser = null;
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  renderAccount();
}

async function loadLatestBudget() {
  if (!accountToken) return;
  try {
    const { budget } = await apiRequest('/budgets/latest');
    if (!budget) return;
    byId('cash').value = budget.cash;
    byId('essentials').value = budget.essentials;
    byId('buffer').value = budget.buffer;
    byId('days').value = budget.days;
    updateRunway();
    document.querySelector('[data-save-status]').textContent = 'Your latest saved plan is loaded.';
  } catch (error) {
    document.querySelector('[data-save-status]').textContent = error.message;
  }
}

document.querySelectorAll('[data-open-auth], [data-account-mode]').forEach((button) => {
  button.addEventListener('click', () => showAuth(button.dataset.accountMode === 'signup' ? 'register' : 'login'));
});
document.querySelectorAll('[data-auth-tab]').forEach((tab) => {
  tab.addEventListener('click', () => showAuth(tab.dataset.authTab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-auth-tab]')];
    const current = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    showAuth(tabs[next].dataset.authTab);
    tabs[next].focus();
  });
});
document.querySelector('.account-notice-close').addEventListener('click', () => accountDialog.close());
accountDialog.addEventListener('click', (event) => { if (event.target === accountDialog) accountDialog.close(); });

document.querySelectorAll('[data-auth-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const mode = form.dataset.authForm;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    setAuthFeedback(mode === 'register' ? 'Creating your account…' : 'Signing you in…');
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const payload = await apiRequest(mode === 'register' ? '/auth/register' : '/auth/login', {
        method: 'POST', body: JSON.stringify(data),
      });
      accountToken = payload.token;
      accountUser = payload.user;
      localStorage.setItem(tokenKey, accountToken);
      localStorage.setItem(userKey, JSON.stringify(accountUser));
      renderAccount();
      form.reset();
      accountDialog.close();
      document.querySelector('[data-save-status]').textContent = `Signed in as ${accountUser.name}.`;
      if (pendingSave) {
        pendingSave = false;
        await savePlan();
      } else {
        await loadLatestBudget();
      }
      window.location.assign('account.html');
    } catch (error) {
      setAuthFeedback(error.message, true);
    } finally {
      submit.disabled = false;
    }
  });
});

document.querySelector('[data-logout]').addEventListener('click', () => {
  clearAccount();
  document.querySelector('[data-save-status]').textContent = 'You have been logged out. Your current numbers remain on this device.';
});

async function savePlan() {
  const budget = readInputs();
  if (!budget) return;
  const status = document.querySelector('[data-save-status]');
  if (!accountToken) {
    pendingSave = true;
    showAuth('login');
    setAuthFeedback('Log in or create an account to save this plan.');
    return;
  }
  status.textContent = 'Saving your plan…';
  try {
    await apiRequest('/budgets', { method: 'POST', body: JSON.stringify(budget) });
    status.textContent = 'Your latest PangaSiku plan is saved to your account.';
  } catch (error) {
    status.textContent = error.message;
  }
}
document.querySelector('[data-save-plan]').addEventListener('click', savePlan);
renderAccount();
if (accountToken) loadLatestBudget();
const requestedAuthMode = new URLSearchParams(window.location.search).get('auth');
if (requestedAuthMode === 'login' || requestedAuthMode === 'register') showAuth(requestedAuthMode);

// Keep the mobile menu's visual and accessibility state synchronized.
const menuButton = document.querySelector('.menu');
const nav = document.querySelector('#primary-navigation');
function closeMenu() { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }
menuButton.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menuButton.focus(); } });

// Mark the current homepage section in the navigation as it enters view.
const sectionLinks = [...nav.querySelectorAll('a[href^="#"]')];
const observedSections = sectionLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      sectionLinks.forEach((link) => {
        const active = link.hash === `#${entry.target.id}`;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-20% 0px -65% 0px' });
  observedSections.forEach((section) => sectionObserver.observe(section));
}

// FAQ answers animate in document flow and remain keyboard accessible.
const faqItems = [...document.querySelectorAll('.faq-item')];
const canHoverFAQ = window.matchMedia('(hover: hover) and (pointer: fine)');
function setFAQOpen(item, open) {
  faqItems.forEach((other) => {
    const isOpen = other === item && open;
    other.classList.toggle('is-open', isOpen);
    other.querySelector('.faq-question').setAttribute('aria-expanded', String(isOpen));
    other.querySelector('.faq-answer').setAttribute('aria-hidden', String(!isOpen));
  });
}
faqItems.forEach((item) => {
  const question = item.querySelector('.faq-question');
  question.addEventListener('click', (event) => {
    if (canHoverFAQ.matches && event.detail > 0) { setFAQOpen(item, true); return; }
    setFAQOpen(item, question.getAttribute('aria-expanded') !== 'true');
  });
  item.addEventListener('pointerenter', (event) => { if (canHoverFAQ.matches && event.pointerType === 'mouse') setFAQOpen(item, true); });
  item.addEventListener('pointerleave', (event) => { if (canHoverFAQ.matches && event.pointerType === 'mouse') setFAQOpen(item, false); });
});

// Send the contact note to the SQLite-backed contact endpoint.
const contactForm = byId('contact-form');
contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('[data-contact-status]');
  const submit = contactForm.querySelector('[type="submit"]');
  const payload = Object.fromEntries(new FormData(contactForm).entries());
  submit.disabled = true;
  status.textContent = 'Sending your message…';
  try {
    const result = await apiRequest('/contact', { method: 'POST', body: JSON.stringify(payload), headers: {} });
    status.textContent = result.message;
    contactForm.reset();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

// Show a back-to-top control only after the reader has scrolled down.
const backToTop = document.querySelector('.back-to-top');
function syncBackToTop() {
  const visible = window.scrollY > 500;
  backToTop.classList.toggle('is-visible', visible);
  backToTop.setAttribute('aria-hidden', String(!visible));
  backToTop.tabIndex = visible ? 0 : -1;
}
window.addEventListener('scroll', syncBackToTop, { passive: true });
syncBackToTop();

// The install action appears only when the browser offers a PWA install prompt.
const installButton = document.querySelector('.install-button');
const headerActions = document.querySelector('.header-actions');
const installInMobileMenu = window.matchMedia('(max-width: 650px)');
let installPrompt;
function placeInstallButton() { (installInMobileMenu.matches ? nav : headerActions).append(installButton); }
placeInstallButton();
installInMobileMenu.addEventListener('change', placeInstallButton);
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; installButton.hidden = false; });
installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});
window.addEventListener('appinstalled', () => { installButton.hidden = true; installPrompt = null; });

// Fade in supporting cards as they enter view, respecting reduced motion.
const revealItems = document.querySelectorAll('.benefit-card, .feature-card, .start-grid li');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  revealItems.forEach((item) => item.classList.add('reveal'));
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (!entry.isIntersecting) return; entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => revealObserver.observe(item));
}

// Secure origins get offline support; account and contact APIs need the Node server.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch((error) => console.error('BilaForm offline support could not start:', error)));
}

updateRunway();
