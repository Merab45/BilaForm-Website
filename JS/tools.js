// Client-side BilaForm planning tools. Values are calculated in this page only.
const currency = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 });
const money = (value) => `KES ${currency.format(value)}`;
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function wholeNumber(value) {
  return value !== '' && Number.isFinite(Number(value)) && Number.isInteger(Number(value)) && Number(value) >= 0;
}

function showError(form, message) {
  const error = document.getElementById(`${form.id.replace('-form', '')}-error`);
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}

function clearError(form) {
  const error = document.getElementById(`${form.id.replace('-form', '')}-error`);
  if (error) {
    error.textContent = '';
    error.hidden = true;
  }
  form.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute('aria-invalid'));
}

function setResult(id, html) {
  const result = document.getElementById(id);
  result.innerHTML = html;
  result.hidden = false;
}

function readValidFields(form, names) {
  const values = {};
  let invalid = null;
  for (const name of names) {
    const field = form.elements.namedItem(name);
    const value = field.value.trim();
    if (!wholeNumber(value) || (field.min && Number(value) < Number(field.min))) {
      invalid ||= field;
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
      values[name] = Number(value);
    }
  }
  return { values, invalid };
}

// PangaSiku: distribute available everyday money over the days remaining.
const pangasikuForm = document.getElementById('pangasiku-form');
pangasikuForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearError(pangasikuForm);
  const { values, invalid } = readValidFields(pangasikuForm, ['balance', 'days']);
  if (invalid || values.days < 1) {
    showError(pangasikuForm, values.days === 0 ? 'Days until next income must be at least 1.' : 'Enter a whole KES amount of 0 or more and at least 1 day.');
    invalid?.focus();
    return;
  }
  const daily = Math.floor(values.balance / values.days);
  setResult('pangasiku-result', `<h3>Daily guide: ${money(daily)}</h3><p><strong>Available money:</strong> ${money(values.balance)} ÷ <strong>${values.days} days</strong> = <strong>${money(daily)} per day</strong>.</p><p>${money(values.balance - (daily * values.days))} remains after dividing into whole-KES daily amounts.</p>`);
});

// Purchase check uses the amount left after essentials as the flexible budget.
const affordabilityForm = document.getElementById('affordability-form');
affordabilityForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearError(affordabilityForm);
  const { values, invalid } = readValidFields(affordabilityForm, ['balance', 'price', 'essentials']);
  if (invalid || values.price < 1) {
    showError(affordabilityForm, 'Enter whole KES amounts. Purchase price must be at least KES 1.');
    invalid?.focus();
    return;
  }
  const flexible = Math.max(0, values.balance - values.essentials);
  const afterPurchase = values.balance - values.price;
  const remainingAfterEssentials = afterPurchase - values.essentials;
  const status = remainingAfterEssentials < 0
    ? ['Not Affordable', 'negative']
    : (flexible > 0 && values.price >= flexible / 2 ? ['Risky', 'risky'] : ['Affordable', '']);
  const explanation = remainingAfterEssentials < 0
    ? `The purchase would leave ${money(Math.abs(remainingAfterEssentials))} short of the essentials you entered.`
    : (status[0] === 'Risky'
      ? `It fits after essentials, but uses at least half of your ${money(flexible)} flexible amount.`
      : `After the purchase and essentials, ${money(remainingAfterEssentials)} would remain.`);
  setResult('affordability-result', `<span class="result-status ${status[1]}">${status[0]}</span><h3>${money(values.price)} purchase</h3><p>${explanation}</p><div class="result-grid"><div class="result-metric"><span>Balance</span><strong>${money(values.balance)}</strong></div><div class="result-metric"><span>Essentials due</span><strong>${money(values.essentials)}</strong></div><div class="result-metric"><span>After purchase</span><strong>${money(afterPurchase)}</strong></div></div>`);
});

// Reusable editable expense rows for the micro-leak tool.
const leakRows = document.getElementById('leak-rows');
const suggestedLeakNames = ['Subscriptions', 'Snacks', 'Transport', 'Other daily buys'];
let leakRowCount = 0;

function addLeakRow(name = '') {
  leakRowCount += 1;
  const row = document.createElement('div');
  row.className = 'leak-row';
  row.innerHTML = `<label>Expense name<input name="leak-name-${leakRowCount}" maxlength="50" type="text" placeholder="${escapeHTML(name || 'e.g. Coffee')}"></label><label>Amount (KES)<input name="leak-amount-${leakRowCount}" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 100"></label><label>How often?<select name="leak-frequency-${leakRowCount}"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><button class="remove-leak" type="button" aria-label="Remove ${escapeHTML(name || 'expense')} row">Remove</button>`;
  row.querySelector('.remove-leak').addEventListener('click', () => {
    if (leakRows.children.length > 1) row.remove();
    else row.querySelectorAll('input').forEach((input) => { input.value = ''; });
  });
  leakRows.append(row);
}

suggestedLeakNames.forEach(addLeakRow);
document.getElementById('add-leak').addEventListener('click', () => addLeakRow());

const leaksForm = document.getElementById('leaks-form');
leaksForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearError(leaksForm);
  const rows = [...leakRows.querySelectorAll('.leak-row')];
  const expenses = [];
  let invalid = null;
  rows.forEach((row) => {
    const name = row.querySelector('input[type="text"]');
    const amount = row.querySelector('input[type="number"]');
    name.removeAttribute('aria-invalid');
    amount.removeAttribute('aria-invalid');
    if (!amount.value.trim() && !name.value.trim()) return;
    if (!name.value.trim() || !wholeNumber(amount.value) || Number(amount.value) < 1) {
      invalid ||= !name.value.trim() ? name : amount;
      if (!name.value.trim()) name.setAttribute('aria-invalid', 'true');
      if (!wholeNumber(amount.value) || Number(amount.value) < 1) amount.setAttribute('aria-invalid', 'true');
      return;
    }
    const frequency = row.querySelector('select').value;
    const amountValue = Number(amount.value);
    const daily = frequency === 'daily' ? amountValue : (frequency === 'weekly' ? amountValue / 7 : amountValue / 30);
    expenses.push({ name: name.value.trim(), daily, weekly: daily * 7, monthly: daily * 30 });
  });
  if (invalid || expenses.length === 0) {
    showError(leaksForm, expenses.length === 0 && !invalid ? 'Add at least one recurring expense to see its impact.' : 'Complete each started expense row with a name and a whole KES amount of at least 1.');
    invalid?.focus();
    return;
  }
  const daily = expenses.reduce((sum, item) => sum + item.daily, 0);
  const weekly = expenses.reduce((sum, item) => sum + item.weekly, 0);
  const monthly = expenses.reduce((sum, item) => sum + item.monthly, 0);
  const largest = [...expenses].sort((a, b) => b.monthly - a.monthly).slice(0, 2);
  const suggestions = largest.map((item) => `<li><strong>${escapeHTML(item.name)}</strong> is about ${money(item.monthly)} per 30-day month. Cutting it by 25% would free about ${money(item.monthly * .25)} per month, if that change works for you.</li>`).join('');
  setResult('leaks-result', `<h3>Recurring spending estimate</h3><div class="result-grid"><div class="result-metric"><span>Per day</span><strong>${money(daily)}</strong></div><div class="result-metric"><span>Per week</span><strong>${money(weekly)}</strong></div><div class="result-metric"><span>Per 30-day month</span><strong>${money(monthly)}</strong></div></div><p><strong>Largest entries to review:</strong></p><ul class="suggestion-list">${suggestions}</ul>`);
});

// BudgetRival: compare only figures the user chooses to enter locally.
const rivalForm = document.getElementById('rival-form');
const rivalState = { type: 'save', target: 0, self: 0, friend: null, friendName: '' };
const rivalType = rivalForm.elements.namedItem('type');
const rivalSelfLabel = rivalForm.elements.namedItem('self').parentElement;
const rivalFriendLabel = rivalForm.elements.namedItem('friend').parentElement;

function syncRivalLabels() {
  const saving = rivalType.value === 'save';
  rivalSelfLabel.firstChild.textContent = saving ? 'Your progress (saved so far, KES)' : 'Your progress (spent so far, KES)';
  rivalFriendLabel.firstChild.textContent = saving ? "Friend's progress (saved, optional, KES)" : "Friend's progress (spent, optional, KES)";
}
rivalType.addEventListener('change', syncRivalLabels);
syncRivalLabels();

function renderRival() {
  const saving = rivalState.type === 'save';
  const selfPercent = saving
    ? Math.min(100, rivalState.self / rivalState.target * 100)
    : Math.max(0, 100 - rivalState.self / rivalState.target * 100);
  const selfLabel = saving ? `${money(rivalState.self)} saved · ${Math.floor(selfPercent)}% of goal` : `${money(rivalState.self)} spent · ${Math.floor(rivalState.self / rivalState.target * 100)}% of limit used`;
  const friendPercent = rivalState.friend === null ? null : (saving
    ? Math.min(100, rivalState.friend / rivalState.target * 100)
    : Math.max(0, 100 - rivalState.friend / rivalState.target * 100));
  let comparison = 'Add a friend’s manually shared progress above to compare.';
  if (friendPercent !== null) {
    const ahead = saving ? rivalState.self >= rivalState.friend : rivalState.self <= rivalState.friend;
    comparison = `${escapeHTML(rivalState.friendName || 'Your friend')}: ${money(rivalState.friend)} ${saving ? 'saved' : 'spent'}. ${ahead ? 'You are currently closer to the challenge target.' : 'Your friend is currently closer to the challenge target.'}`;
    if (rivalState.self === rivalState.friend) comparison = 'You are currently level on the amount entered.';
  }
  const metricLabel = saving ? 'Savings goal' : 'Spending limit';
  const progressLabel = saving ? 'Goal reached' : 'Limit remaining';
  const progressBar = (label, percent) => `<p><strong>${label}:</strong></p><div class="progress-bar ${percent < 0 ? 'over' : ''}" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.max(0, Math.round(percent)))}"><span style="width:${Math.min(100, Math.max(0, percent))}%"></span></div>`;
  const updateLabel = saving ? 'Update saved amount (KES)' : 'Update amount spent (KES)';
  const friendBar = friendPercent === null ? '' : `${progressBar(`${escapeHTML(rivalState.friendName || 'Friend')} ${progressLabel}`, friendPercent)}<p>${escapeHTML(rivalState.friendName || 'Friend')}: ${money(rivalState.friend)} ${saving ? 'saved' : 'spent'}.</p>`;
  setResult('rival-result', `<h3>${saving ? 'Savings challenge' : 'Spending-limit challenge'}</h3><p><strong>${metricLabel}:</strong> ${money(rivalState.target)}</p>${progressBar(progressLabel, selfPercent)}<p>${selfLabel}</p>${friendBar}<p>${comparison}</p><form class="progress-update" id="progress-update"><label>${updateLabel}<input name="progress" type="number" min="0" step="1" inputmode="numeric" value="${rivalState.self}" required></label><button class="tool-button" type="submit">Update my progress</button></form>`);
  document.getElementById('progress-update').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.progress;
    if (!wholeNumber(input.value)) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    rivalState.self = Number(input.value);
    renderRival();
  });
}

rivalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearError(rivalForm);
  const { values, invalid } = readValidFields(rivalForm, ['target', 'self']);
  const friendInput = rivalForm.elements.namedItem('friend');
  const friendValue = friendInput.value.trim();
  if (friendValue && !wholeNumber(friendValue)) friendInput.setAttribute('aria-invalid', 'true');
  if (invalid || values.target < 1 || (friendValue && !wholeNumber(friendValue))) {
    showError(rivalForm, 'Enter a whole KES target of at least 1 and valid whole-KES progress amounts.');
    invalid?.focus();
    if (friendValue && !wholeNumber(friendValue)) friendInput.focus();
    return;
  }
  rivalState.type = rivalType.value;
  rivalState.target = values.target;
  rivalState.self = values.self;
  rivalState.friend = friendValue ? Number(friendValue) : null;
  rivalState.friendName = rivalForm.elements.namedItem('friendName').value.trim();
  renderRival();
});

// VukaMonth: compare user-entered monthly allocations with entered income.
const vukaForm = document.getElementById('vuka-form');
const vukaCategories = [
  ['food', 'Food'], ['transport', 'Transport'], ['rent', 'Rent'],
  ['electricity', 'Electricity'], ['water', 'Water'], ['savings', 'Savings'], ['other', 'Other essentials'],
];
vukaForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearError(vukaForm);
  const { values, invalid: incomeInvalid } = readValidFields(vukaForm, ['income']);
  let invalid = incomeInvalid;
  vukaCategories.forEach(([name]) => {
    const input = vukaForm.elements.namedItem(name);
    const value = input.value.trim();
    if (!value) {
      values[name] = 0;
      input.removeAttribute('aria-invalid');
    } else if (!wholeNumber(value)) {
      invalid ||= input;
      input.setAttribute('aria-invalid', 'true');
    } else {
      values[name] = Number(value);
      input.removeAttribute('aria-invalid');
    }
  });
  if (invalid) {
    showError(vukaForm, 'Enter whole KES amounts of 0 or more for income and each allocation.');
    invalid.focus();
    return;
  }
  const total = vukaCategories.reduce((sum, [name]) => sum + values[name], 0);
  const remaining = values.income - total;
  const rows = vukaCategories.map(([name, label]) => {
    const amount = values[name];
    const percent = values.income > 0 ? Math.min(100, amount / values.income * 100) : 0;
    return `<div class="allocation-row"><span>${label}</span><div class="allocation-track" role="progressbar" aria-label="${label} allocation" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><span style="width:${percent}%"></span></div><strong>${money(amount)}</strong></div>`;
  }).join('');
  const warning = remaining < 0 ? `<p class="allocation-warning" role="alert">Allocations exceed income by ${money(Math.abs(remaining))}. Adjust the amounts before relying on this plan.</p>` : '';
  const remainingText = remaining < 0 ? `Short by ${money(Math.abs(remaining))}` : `${money(remaining)} left to plan`;
  setResult('vuka-result', `<h3>Monthly allocation summary</h3><div class="result-grid"><div class="result-metric"><span>Income</span><strong>${money(values.income)}</strong></div><div class="result-metric"><span>Allocated</span><strong>${money(total)}</strong></div><div class="result-metric"><span>Remaining</span><strong>${remainingText}</strong></div></div><div class="allocation-list">${rows}</div>${warning}`);
});
