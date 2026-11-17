(() => {
  const TOKEN_KEY = 'bilaform.auth.token';
  const USER_KEY = 'bilaform.auth.user';
  const PENDING_KEY = 'bilaform.pendingPangasiku';
  const fields = ['cash', 'essentials', 'buffer', 'days'].map((id) => document.getElementById(id));
  const [cash, essentials, buffer, days] = fields;
  const error = document.getElementById('calc-error');
  const result = document.querySelector('.calc .result');
  const status = document.querySelector('[data-save-status]');
  const loginLink = document.querySelector('[data-pangasiku-login]');
  const saveButton = document.querySelector('[data-save-plan]');
  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const apiRoot = ['5500', '5501'].includes(location.port) && ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://127.0.0.1:8000/api' : '/api';
  let requestSequence = 0;
  let requestTimer;

  function money(value) { return `KES ${Math.floor(Math.max(0, value)).toLocaleString('en-KE')}`; }

  function readBudget() {
    fields.forEach((input) => input.setAttribute('aria-invalid', String(!input.value.trim() || !input.validity.valid)));
    const invalid = fields.find((input) => !input.value.trim() || !input.validity.valid);
    if (invalid) {
      error.textContent = invalid.id === 'days' ? 'Enter a whole number of days from 1 to 366.' : 'Enter a whole KES amount from 0 to 1,000,000,000.';
      error.hidden = false;
      return null;
    }
    const budget = Object.fromEntries(fields.map((input) => [input.id, Number(input.value)]));
    if (![budget.cash, budget.essentials, budget.buffer].every((value) => Number.isSafeInteger(value) && value <= 1_000_000_000)
      || !Number.isSafeInteger(budget.days) || budget.days < 1 || budget.days > 366) {
      error.textContent = 'Check the amounts and days entered. Use whole numbers within the limits shown.';
      error.hidden = false;
      return null;
    }
    fields.forEach((input) => input.removeAttribute('aria-invalid'));
    error.hidden = true;
    error.textContent = '';
    return budget;
  }

  function showBudget(budget) {
    const remaining = budget.cash - budget.essentials - budget.buffer;
    const daily = Math.floor(Math.max(0, remaining) / budget.days);
    document.getElementById('daily').textContent = money(daily);
    const badge = document.getElementById('badge');
    badge.textContent = remaining <= 0 ? 'PLAN NEEDS A RESET' : 'BUFFER KEPT ✓';
    badge.classList.toggle('reset', remaining <= 0);
    document.getElementById('runway-breakdown').textContent = `${money(budget.cash)} less ${money(budget.essentials)} essentials and ${money(budget.buffer)} buffer leaves ${money(Math.max(0, remaining))} across ${budget.days} day${budget.days === 1 ? '' : 's'}.`;
    result.setAttribute('aria-busy', 'false');
    updatePurchase(budget, daily);
    return daily;
  }

  function updateRunway() {
    const sequence = ++requestSequence;
    clearTimeout(requestTimer);
    const budget = readBudget();
    if (!budget) return;
    showBudget(budget);
    requestTimer = setTimeout(async () => {
      result.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch(`${apiRoot}/runway`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(budget) });
        if (!response.ok) return;
        const data = await response.json();
        if (sequence !== requestSequence) return;
        document.getElementById('daily').textContent = money(data.daily_safe);
        const badge = document.getElementById('badge');
        badge.textContent = data.needs_reset ? 'PLAN NEEDS A RESET' : 'BUFFER KEPT ✓';
        badge.classList.toggle('reset', data.needs_reset);
      } catch { /* Local results remain available offline. */ }
      finally { if (sequence === requestSequence) result.setAttribute('aria-busy', 'false'); }
    }, 120);
  }

  function updatePurchase(budget = readBudget(), daily = null) {
    const input = document.getElementById('purchase-price');
    const feedback = document.getElementById('purchase-feedback');
    if (!budget) return;
    const price = input.value === '' ? null : Number(input.value);
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
    const remainder = budget.cash - price - budget.essentials - budget.buffer;
    const nextDaily = Math.floor(Math.max(0, remainder) / budget.days);
    if (remainder < 0) {
      feedback.textContent = `${money(price)} would exceed the amount available after essentials and your buffer by ${money(Math.abs(remainder))}. Your plan needs a reset before this purchase.`;
      feedback.className = 'purchase-feedback is-warning';
    } else if (nextDaily < currentDaily) {
      feedback.textContent = `After this ${money(price)} purchase, your daily guide would move from ${money(currentDaily)} to ${money(nextDaily)} for ${budget.days} days.`;
      feedback.className = 'purchase-feedback is-caution';
    } else {
      feedback.textContent = `Your daily guide would remain ${money(nextDaily)} after setting aside ${money(price)} for this purchase.`;
      feedback.className = 'purchase-feedback is-positive';
    }
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiRoot}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token()}`, ...options.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'The request could not be completed.'), { status: response.status });
    return data;
  }

  async function saveBudget(budget = readBudget()) {
    if (!budget) return;
    loginLink.hidden = true;
    if (!token()) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(budget));
      location.assign('../auth.html?auth=login&return=pangasiku');
      return;
    }
    saveButton.disabled = true;
    status.textContent = 'Saving your plan…';
    try {
      await request('/budgets', { method: 'POST', body: JSON.stringify(budget) });
      status.textContent = 'Your PangaSiku plan is saved to your account.';
      sessionStorage.removeItem(PENDING_KEY);
    } catch (cause) {
      if (cause.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        status.textContent = 'Your session expired. Log in to save this plan.';
        loginLink.hidden = false;
      } else status.textContent = cause.message;
    } finally { saveButton.disabled = false; }
  }

  async function loadLatestBudget() {
    if (!token()) return;
    try {
      const { budget } = await request('/budgets/latest');
      if (!budget) return;
      fields.forEach((input) => { input.value = budget[input.id]; });
      updateRunway();
      status.textContent = 'Your latest saved plan is loaded.';
    } catch (cause) {
      if (cause.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
  }

  fields.forEach((input) => input.addEventListener('input', updateRunway));
  document.getElementById('purchase-price').addEventListener('input', () => updatePurchase());
  saveButton.addEventListener('click', () => saveBudget());
  updateRunway();

  const resume = new URLSearchParams(location.search).get('resume') === '1';
  if (resume) {
    const saved = sessionStorage.getItem(PENDING_KEY);
    if (saved && token()) {
      try {
        const pending = JSON.parse(saved);
        fields.forEach((input) => { input.value = pending[input.id]; });
        updateRunway();
        saveBudget(pending);
      } catch { sessionStorage.removeItem(PENDING_KEY); }
    }
  } else loadLatestBudget();
})();
