const formatMoney = (amount) =>
  `KES ${Math.floor(Math.max(0, amount)).toLocaleString('en-KE')}`;

const form = document.querySelector('#expense-form');
const nameInput = document.querySelector('#expense-name');
const categoryInput = document.querySelector('#expense-category');
const amountInput = document.querySelector('#expense-amount');
const error = document.querySelector('#expense-error');
const list = document.querySelector('#expense-list');
const emptyState = document.querySelector('#empty-state');

// Demo entries only live in memory; a refresh starts from the example again.
let availableBalance = 18420;
let monthlyExpenses = 9500;
let entryCount = 0;

function updateDailyGuide() {
  const remaining = availableBalance - 7600 - 2000;
  const daily = Math.floor(Math.max(0, remaining) / 21);
  const needsReset = remaining <= 0;
  const status = document.querySelector('#plan-status');

  document.querySelector('#daily-amount').textContent = formatMoney(daily);
  status.textContent = needsReset
    ? 'Plan needs a reset to protect essentials and buffer.'
    : 'Buffer kept in the example plan.';
  status.classList.toggle('needs-reset', needsReset);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const amount = Number(amountInput.value);
  const invalidName = !name;
  const invalidAmount = !Number.isInteger(amount) || amount < 1;

  nameInput.setAttribute('aria-invalid', String(invalidName));
  amountInput.setAttribute('aria-invalid', String(invalidAmount));

  if (invalidName || invalidAmount) {
    error.textContent = 'Enter a name and a whole KES amount of at least 1.';
    error.hidden = false;
    (invalidName ? nameInput : amountInput).focus();
    return;
  }

  if (amount > availableBalance) {
    amountInput.setAttribute('aria-invalid', 'true');
    error.textContent = 'That amount is higher than the sample balance available to plan.';
    error.hidden = false;
    amountInput.focus();
    return;
  }

  error.hidden = true;
  error.textContent = '';
  availableBalance -= amount;
  monthlyExpenses += amount;

  const item = document.createElement('li');
  const description = document.createElement('span');
  const title = document.createElement('strong');
  const category = document.createElement('small');
  const value = document.createElement('b');

  title.textContent = name;
  category.textContent = `${categoryInput.value} · Just added`;
  value.textContent = `− ${formatMoney(amount)}`;
  description.append(title, category);
  item.append(description, value);
  list.prepend(item);
  entryCount += 1;

  document.querySelector('#available-balance').textContent = formatMoney(availableBalance);
  document.querySelector('#monthly-expenses').textContent = formatMoney(monthlyExpenses);
  updateDailyGuide();

  if (entryCount > 0) emptyState.hidden = true;
  form.reset();
  nameInput.focus();
});


