(function attachMicroLeakCalculator(global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global && global.document) api.initialize(global.document);
}(typeof globalThis !== 'undefined' ? globalThis : this, function createMicroLeakCalculator() {
  const monthlyFactors = { daily: 365 / 12, weekly: 52 / 12, monthly: 1 };
  const annualFactors = { daily: 365, weekly: 52, monthly: 12 };

  function calculateRecurringCosts(costs) {
    return costs.reduce((totals, cost) => {
      totals.monthly += cost.amount * monthlyFactors[cost.frequency];
      totals.annual += cost.amount * annualFactors[cost.frequency];
      return totals;
    }, { monthly: 0, annual: 0 });
  }

  function initialize(documentRef) {
    const form = documentRef.querySelector('[data-leak-form]');
    if (!form) return;
    const list = documentRef.querySelector('[data-leak-list]');
    const empty = documentRef.querySelector('[data-leak-empty]');
    const status = documentRef.querySelector('[data-leak-status]');
    const monthly = documentRef.querySelector('[data-leak-monthly]');
    const annual = documentRef.querySelector('[data-leak-annual]');
    const costs = [];
    const money = (value) => `KES ${Math.round(value).toLocaleString('en-KE')}`;

    function render() {
      list.replaceChildren(...costs.map((cost, index) => {
        const item = documentRef.createElement('li');
        const detail = documentRef.createElement('span');
        const cadence = { daily: 'per day', weekly: 'per week', monthly: 'per month' }[cost.frequency];
        detail.textContent = `${cost.name} · ${money(cost.amount)} ${cadence}`;
        const remove = documentRef.createElement('button');
        remove.type = 'button'; remove.className = 'micro-leak-remove';
        remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${cost.name}`);
        remove.addEventListener('click', () => { costs.splice(index, 1); render(); status.textContent = `${cost.name} removed from this calculation.`; });
        item.append(detail, remove);
        return item;
      }));
      empty.hidden = costs.length > 0;
      const totals = calculateRecurringCosts(costs);
      monthly.textContent = money(totals.monthly);
      annual.textContent = money(totals.annual);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = form.elements.name.value.trim();
      const amount = Number(form.elements.amount.value);
      if (!name || name.length > 60 || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) {
        status.textContent = 'Enter an expense name and a whole KES amount from 1 to 1,000,000,000.';
        return;
      }
      costs.push({ name, amount, frequency: form.elements.frequency.value });
      form.reset();
      status.textContent = `${name} added to this calculation.`;
      render();
      form.elements.name.focus();
    });
    render();
  }

  return { calculateRecurringCosts, initialize };
}));
