(() => {
  const USER_KEY = 'bilaform.auth.user';
  const PENDING_KEY = 'bilaform.pendingPangasiku';
  const ids = ['cash', 'essentials', 'buffer', 'days', 'other_income'];
  const fields = ids.map((id) => document.getElementById(id));
  const byId = (id) => document.getElementById(id);
  const error = byId('calc-error');
  const result = document.querySelector('.calc .result');
  const status = document.querySelector('[data-save-status]');
  const loginLink = document.querySelector('[data-pangasiku-login]');
  const saveButton = document.querySelector('[data-save-plan]');
  const expenseContainer = document.querySelector('[data-expense-items]');
  const dataApi = window.BilaFormData;
  let savedBudgetId = null;

  function money(value) { return `KES ${Math.floor(Math.max(0, value)).toLocaleString('en-KE')}`; }
  function isoToday() { return new Date().toLocaleDateString('en-CA'); }
  function daysUntil(date) {
    if (!date) return null;
    const now = new Date(`${isoToday()}T00:00:00`);
    const payday = new Date(`${date}T00:00:00`);
    return Math.ceil((payday - now) / 86400000);
  }
  async function hasSession() {
    try { if (!dataApi) throw new Error(window.BILAFORM_SUPABASE_ERROR || 'Supabase is not configured.'); await dataApi.requireUser(); return true; }
    catch { return false; }
  }
  function addExpense(item = {}) {
    const row = document.createElement('div'); row.className = 'expense-row';
    const category = document.createElement('label'); category.textContent = 'Expense';
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Essential expense category');
    ['Food and groceries', 'Transport', 'Rent and accommodation', 'Electricity and water', 'Education', 'Loan repayment', 'Medical', 'Other essential'].forEach((name) => { const option = document.createElement('option'); option.value = name; option.textContent = name; select.append(option); });
    select.value = item.category || 'Food and groceries'; category.append(select);
    const amountLabel = document.createElement('label'); amountLabel.textContent = 'KES amount';
    const amount = document.createElement('input'); amount.type = 'number'; amount.min = '0'; amount.max = '1000000000'; amount.step = '1'; amount.inputMode = 'numeric'; amount.value = item.amount ?? ''; amount.setAttribute('aria-label', 'Essential expense amount in KES'); amountLabel.append(amount);
    const dueLabel = document.createElement('label'); dueLabel.textContent = 'Due by';
    const due = document.createElement('input'); due.type = 'date'; due.value = item.due_date || ''; due.min = isoToday(); due.max = byId('payday_date').value; due.setAttribute('aria-label', 'Expense due date'); dueLabel.append(due);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'expense-remove'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove expense'); remove.addEventListener('click', () => { row.remove(); updateRunway(); });
    [select, amount, due].forEach((input) => input.addEventListener('input', updateRunway));
    row.append(category, amountLabel, dueLabel, remove); expenseContainer.append(row);
  }
  function getExpenses() {
    return [...expenseContainer.querySelectorAll('.expense-row')].map((row) => ({
      category: row.querySelector('select').value,
      amount: Number(row.querySelector('input[type="number"]').value || 0),
      due_date: row.querySelector('input[type="date"]').value || null,
    }));
  }
  function setExpenses(items) { expenseContainer.replaceChildren(); (items || []).forEach(addExpense); if (!items?.length) addExpense(); }
  function readBudget() {
    const dateValue = byId('payday_date').value;
    const derivedDays = daysUntil(dateValue);
    if (dateValue && derivedDays > 0) byId('days').value = String(derivedDays);
    const expenses = getExpenses();
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    byId('essentials').value = String(totalExpenses);
    const dueAfterPayday = dateValue && expenses.some((item) => item.due_date && item.due_date > dateValue);
    const budget = {
      cash: Number(byId('cash').value), essentials: totalExpenses, buffer: Number(byId('buffer').value),
      days: Number(byId('days').value), other_income: Number(byId('other_income').value || 0),
      cash_location: byId('cash_location').value || null, payday_date: dateValue || null, expense_items: expenses,
    };
    const invalidAmount = ['cash', 'buffer', 'other_income'].some((id) => {
      const input = byId(id); return input.value.trim() === '' || !input.validity.valid || !Number.isSafeInteger(Number(input.value));
    }) || !Number.isSafeInteger(totalExpenses) || expenses.some((item) => !Number.isSafeInteger(item.amount) || item.amount < 0 || item.amount > 1_000_000_000);
    const daysInvalid = !Number.isSafeInteger(budget.days) || budget.days < 1 || budget.days > 366 || (dateValue && derivedDays < 1);
    if (invalidAmount || daysInvalid || totalExpenses > 1_000_000_000 || dueAfterPayday) {
      error.textContent = dueAfterPayday ? 'One or more listed expenses are due after this payday. Remove them from this plan or choose the correct payday.' : dateValue && derivedDays < 1 ? 'Choose a payday date from today onwards.' : 'Enter whole KES amounts within the limits shown and a valid number of days.';
      error.hidden = false; result.setAttribute('aria-busy', 'true'); return null;
    }
    error.hidden = true; error.textContent = '';
    return budget;
  }
  function showBudget(budget) {
    const totalAvailable = budget.cash + budget.other_income;
    const remaining = totalAvailable - budget.essentials - budget.buffer;
    const daily = Math.floor(Math.max(0, remaining) / budget.days);
    byId('daily').textContent = money(daily);
    const badge = byId('badge'); badge.textContent = remaining < 0 ? 'SHORTFALL TO REVIEW' : remaining === 0 ? 'NO DAILY BALANCE' : 'BUFFER SET ASIDE';
    badge.classList.toggle('reset', remaining <= 0);
    byId('runway-breakdown').textContent = `${money(budget.cash)} available${budget.other_income ? ` plus ${money(budget.other_income)} expected income` : ''}, less ${money(budget.essentials)} essentials and ${money(budget.buffer)} buffer, across ${budget.days} days.`;
    const shortfall = Math.max(0, -remaining);
    byId('plan-insight').textContent = shortfall
      ? `Your listed commitments and buffer exceed available money by ${money(shortfall)}. Review the expenses or buffer before relying on this plan. The daily guide is set to KES 0 until the shortfall is addressed.`
      : remaining === 0
        ? 'Your listed commitments use the full available amount. There is no daily spending balance in this estimate.'
        : `After your listed commitments and buffer, ${money(remaining)} remains. Dividing by ${budget.days} days gives a guide of ${money(daily)} per day. Review and adjust it if your situation changes.`;
    const values = { cash: money(budget.cash), income: money(budget.other_income), essentials: money(budget.essentials), buffer: money(budget.buffer), remaining: shortfall ? `Shortfall ${money(shortfall)}` : money(remaining), days: `${budget.days} days` };
    Object.entries(values).forEach(([key, value]) => { const el = document.querySelector(`[data-review-${key}]`); if (el) el.textContent = value; });
    result.setAttribute('aria-busy', 'false'); updatePurchase(budget, daily); return daily;
  }
  function updateRunway() { const budget = readBudget(); if (budget) showBudget(budget); }
  function updatePurchase(budget = readBudget(), daily = null) {
    const input = byId('purchase-price'), feedback = byId('purchase-feedback');
    if (!budget) return;
    if (input.value === '') { feedback.textContent = 'Enter a purchase amount to see the impact.'; feedback.className = 'purchase-feedback'; return; }
    const price = Number(input.value);
    if (!Number.isSafeInteger(price) || price < 0 || price > 1_000_000_000) { feedback.textContent = 'Enter a whole KES amount from 0 to 1,000,000,000.'; feedback.className = 'purchase-feedback is-warning'; return; }
    const available = budget.cash + budget.other_income - budget.essentials - budget.buffer;
    const remainder = available - price;
    const nextDaily = Math.floor(Math.max(0, remainder) / budget.days);
    if (remainder < 0) { feedback.textContent = `This purchase would leave a shortfall of ${money(Math.abs(remainder))} after your listed essentials and buffer. Review the plan before deciding.`; feedback.className = 'purchase-feedback is-warning'; }
    else if (nextDaily < (daily ?? Math.floor(Math.max(0, available) / budget.days))) { feedback.textContent = `After this ${money(price)} purchase, your daily guide would become ${money(nextDaily)} for ${budget.days} days.`; feedback.className = 'purchase-feedback is-caution'; }
    else { feedback.textContent = `Your daily guide would be ${money(nextDaily)} after this planned purchase.`; feedback.className = 'purchase-feedback is-positive'; }
  }
  async function request(path, options = {}) { if (!dataApi) throw new Error(window.BILAFORM_SUPABASE_ERROR || 'Supabase is not configured.'); return dataApi.request(path, options); }
  async function saveBudget(budget = readBudget()) {
    if (!budget) return;
    loginLink.hidden = true;
    if (!await hasSession()) { sessionStorage.setItem(PENDING_KEY, JSON.stringify(budget)); location.assign('../auth.html?auth=login&return=pangasiku'); return; }
    saveButton.disabled = true; status.textContent = 'Saving your plan…';
    try {
      const path = savedBudgetId ? `/budgets/${savedBudgetId}` : '/budgets';
      await request(path, { method: savedBudgetId ? 'PATCH' : 'POST', body: JSON.stringify(budget) });
      status.textContent = 'Your PangaSiku plan is saved to your account.'; sessionStorage.removeItem(PENDING_KEY);
      const latest = await request('/budgets/latest'); savedBudgetId = latest.budget?.id || null;
      await loadSpending();
    } catch (cause) {
      if (cause.status === 401) { localStorage.removeItem(USER_KEY); status.textContent = 'Your session expired. Log in to save this plan.'; loginLink.hidden = false; }
      else status.textContent = cause.message;
    } finally { saveButton.disabled = false; }
  }
  async function loadLatestBudget() {
    if (!await hasSession()) { loginLink.hidden = false; return; }
    try {
      const { budget } = await request('/budgets/latest'); if (!budget) { loginLink.hidden = false; return; }
      savedBudgetId = budget.id || null;
      ['cash', 'essentials', 'buffer', 'days', 'other_income'].forEach((id) => { if (budget[id] != null) byId(id).value = budget[id]; });
      if (budget.cash_location) byId('cash_location').value = budget.cash_location;
      if (budget.payday_date) byId('payday_date').value = budget.payday_date;
      setExpenses(budget.expense_items || (Number(budget.essentials) ? [{ category: 'Other essential', amount: budget.essentials }] : []));
      updateRunway(); status.textContent = 'Your latest saved plan is loaded. Adjust the figures and save to update it.'; await loadSpending();
    } catch (cause) { status.textContent = cause.message; }
  }
  async function loadSpending() {
    const list = document.querySelector('[data-spending-list]');
    try {
      if (!await hasSession() || !savedBudgetId) return;
      const { entries } = await request('/daily-spending'); list.replaceChildren();
      const total = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
      document.querySelector('[data-spending-total]').textContent = entries.length ? `${money(total)} logged today across ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.` : 'No spending logged today.';
      entries.forEach((entry) => {
        const item = document.createElement('li'); const label = document.createElement('span'); label.textContent = `${entry.description} · ${money(entry.amount)}`;
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${entry.description} spending entry`);
        remove.addEventListener('click', async () => { remove.disabled = true; try { await request(`/daily-spending/${entry.id}`, { method: 'DELETE' }); await loadSpending(); } catch (cause) { document.querySelector('[data-spending-status]').textContent = cause.message; remove.disabled = false; } });
        item.append(label, remove); list.append(item);
      });
    } catch (cause) { document.querySelector('[data-spending-status]').textContent = cause.message; }
  }
  document.querySelector('[data-add-expense]').addEventListener('click', () => { addExpense(); updateRunway(); });
  document.querySelectorAll('.pangasiku-steps input, .pangasiku-steps select').forEach((input) => input.addEventListener('input', updateRunway));
  byId('payday_date').min = isoToday();
  byId('payday_date').addEventListener('change', () => { expenseContainer.querySelectorAll('input[type="date"]').forEach((input) => { input.max = byId('payday_date').value; }); updateRunway(); });
  byId('purchase-price').addEventListener('input', () => updatePurchase());
  saveButton.addEventListener('click', () => saveBudget());
  document.querySelector('[data-spending-form]').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; const feedback = document.querySelector('[data-spending-status]');
    if (!await hasSession()) { feedback.textContent = 'Log in to track daily spending.'; loginLink.hidden = false; loginLink.focus(); return; }
    if (!savedBudgetId) { feedback.textContent = 'Save your PangaSiku plan first, then log spending against it.'; return; }
    const amount = Number(form.elements.amount.value), description = form.elements.description.value.trim();
    if (!description || !Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000) { feedback.textContent = 'Enter a description and a whole KES amount above zero.'; return; }
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; feedback.textContent = 'Adding entry…';
    try { await request('/daily-spending', { method: 'POST', body: JSON.stringify({ description, amount, budget_id: savedBudgetId }) }); form.reset(); feedback.textContent = 'Spending entry added.'; await loadSpending(); }
    catch (cause) { feedback.textContent = cause.message; }
    finally { submit.disabled = false; }
  });
  setExpenses([]); updateRunway();
  if (new URLSearchParams(location.search).get('resume') === '1') {
    const saved = sessionStorage.getItem(PENDING_KEY);
    if (saved) try { const pending = JSON.parse(saved); hasSession().then((authenticated) => { if (!authenticated) { location.assign('../auth.html?auth=login&return=pangasiku'); return; } Object.entries(pending).forEach(([key, value]) => { if (['cash', 'buffer', 'days', 'other_income', 'cash_location', 'payday_date'].includes(key) && byId(key)) byId(key).value = value ?? ''; }); setExpenses(pending.expense_items || [{ category: 'Other essential', amount: pending.essentials || 0 }]); updateRunway(); saveBudget(pending); }); } catch { sessionStorage.removeItem(PENDING_KEY); }
  } else loadLatestBudget();
})();
