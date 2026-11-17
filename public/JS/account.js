// Account dashboard: fetch the signed-in profile, budgets and saved monthly plans.
(() => {
  const TOKEN_KEY = 'bilaform.auth.token';
  const USER_KEY = 'bilaform.auth.user';
  const token = localStorage.getItem(TOKEN_KEY);
  const apiRoot = ['5500', '5501'].includes(location.port) && ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://127.0.0.1:8000/api' : '/api';
  const message = document.querySelector('[data-account-message]');
  const money = (value) => `KES ${Number(value || 0).toLocaleString('en-KE')}`;
  const dateLabel = (value) => {
    const date = new Date(`${String(value || '').replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? 'Saved recently' : date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  let budgets = [];
  let plans = [];
  let currentUser = null;

  function showMessage(text, error = false) {
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle('is-error', error);
  }

  function returnToLogin() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.replace('auth.html?auth=login');
  }

  if (!token) { returnToLogin(); return; }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(`${apiRoot}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
    } catch {
      throw new Error('BilaForm could not reach its API. Open the app at http://127.0.0.1:8000 or run “BilaForm: Start API” in VS Code.');
    }
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    const result = isJson ? await response.json() : {};
    if (response.status === 401) { returnToLogin(); throw new Error(result.error || 'Please sign in again.'); }
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  }

  const dashboardViews = new Set(['overview', 'activity', 'plans', 'settings', 'security']);
  const requestedView = new URLSearchParams(window.location.search).get('view');
  const activeView = dashboardViews.has(requestedView) ? requestedView : 'overview';
  document.querySelectorAll('[data-account-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.accountPanel !== activeView;
  });
  document.querySelectorAll('[data-account-view]').forEach((link) => {
    if (link.dataset.accountView === activeView) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const viewTitles = { overview: 'Overview', activity: 'My Activities', plans: 'Saved Budgets', settings: 'Profile & Settings', security: 'Security' };
  document.title = `${viewTitles[activeView]} | My BilaForm Dashboard`;

  const sidebar = document.querySelector('.dashboard-sidebar');
  const sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  const closeSidebar = (restoreFocus = false) => {
    sidebar.classList.remove('is-open');
    sidebarToggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) sidebarToggle.focus();
  };
  sidebarToggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    sidebarToggle.setAttribute('aria-expanded', String(open));
    if (open) sidebar.querySelector('[data-account-view]')?.focus();
  });
  sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeSidebar()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) closeSidebar(true);
  });

  function setProfile(user) {
    currentUser = user;
    document.querySelector('.account-announcement').hidden = false;
    const initials = user.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
    document.querySelector('[data-avatar]').textContent = initials || 'BF';
    document.querySelector('[data-sidebar-name]').textContent = user.name;
    document.querySelector('[data-sidebar-email]').textContent = user.email;
    document.querySelector('[data-name-ending]').textContent = `, ${user.name}.`;
    document.querySelector('[data-profile-name]').textContent = user.name;
    document.querySelector('[data-profile-email]').textContent = user.email;
    document.querySelector('[data-security-email]').textContent = user.email;
    const joined = dateLabel(user.created_at);
    document.querySelector('[data-profile-date]').textContent = joined;
    const form = document.querySelector('[data-profile-form]');
    form.elements.name.value = user.name;
    form.elements.email.value = user.email;
    localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email }));
  }

  function makePlanRow({ id, type, title, detail, amount, date, deletePath }) {
    const row = document.createElement('article');
    row.className = 'plan-row';
    row.dataset.date = String(date || '');
    const description = document.createElement('div');
    const heading = document.createElement('h4'); heading.textContent = `${type} · ${title}`;
    const copy = document.createElement('p'); copy.textContent = `${detail} · ${dateLabel(date)}`;
    description.append(heading, copy);
    const total = document.createElement('span'); total.className = 'plan-amount'; total.textContent = amount;
    const remove = document.createElement('button'); remove.className = 'plan-delete'; remove.type = 'button'; remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${type} plan ${title}`);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try { await api(deletePath, { method: 'DELETE' }); await loadData(); showMessage('Saved plan removed.'); }
      catch (error) { remove.disabled = false; showMessage(error.message, true); }
    });
    row.append(description, total, remove);
    return row;
  }

  function renderBudgets() {
    const latest = budgets[0];
    const planContainer = document.querySelector('[data-plan-list]');
    planContainer.replaceChildren();
    document.querySelector('[data-summary-count]').textContent = String(budgets.length + plans.length);
    if (latest) {
      document.querySelector('[data-summary-daily]').textContent = money(latest.daily_safe);
      document.querySelector('[data-summary-days]').textContent = `${latest.days} day${latest.days === 1 ? '' : 's'} to your next income`;
      const unreserved = latest.cash - latest.essentials - latest.buffer;
      const bufferIsSafe = latest.buffer > 0 && unreserved >= 0;
      document.querySelector('[data-summary-buffer]').textContent = bufferIsSafe ? `${money(latest.buffer)} kept` : latest.buffer > 0 ? 'Review plan' : 'Not set';
      document.querySelector('[data-summary-buffer-note]').textContent = bufferIsSafe
        ? 'Reserved in your latest plan'
        : unreserved < 0 ? `${money(Math.abs(unreserved))} over available money` : 'Add a buffer to your PangaSiku plan';
      document.querySelector('[data-budget-cash]').textContent = money(latest.cash);
      document.querySelector('[data-budget-essentials]').textContent = money(latest.essentials);
      document.querySelector('[data-budget-buffer]').textContent = money(latest.buffer);
      document.querySelector('[data-budget-days]').textContent = `${latest.days} days`;
      document.querySelector('[data-overview-updated]').textContent = `Updated ${dateLabel(latest.updated_at)}`;
      document.querySelector('[data-budget-empty]').hidden = true;
    } else {
      document.querySelector('[data-summary-daily]').textContent = '—';
      document.querySelector('[data-summary-days]').textContent = 'Save a PangaSiku plan to see your runway';
      document.querySelector('[data-summary-buffer]').textContent = 'Not set';
      document.querySelector('[data-budget-empty]').hidden = false;
    }
    const rows = [
      ...budgets.map((budget) => makePlanRow({
        id: budget.id, type: 'PangaSiku', title: `${budget.days} day runway`,
        detail: `${money(budget.daily_safe)} daily · ${money(budget.cash)} available`, amount: money(budget.cash),
        date: budget.updated_at, deletePath: `/budgets/${budget.id}`,
      })),
      ...plans.map((plan) => {
        const allocated = Object.entries(plan.data).filter(([key]) => key !== 'income').reduce((sum, [, amount]) => sum + Number(amount), 0);
        return makePlanRow({
          id: plan.id, type: 'VukaMonth', title: plan.name,
          detail: `${money(allocated)} allocated from ${money(plan.data.income)}`,
          amount: money(Math.max(0, plan.data.income - allocated)), date: plan.created_at,
          deletePath: `/plans/${plan.id}`,
        });
      }),
    ].sort((a, b) => b.dataset.date.localeCompare(a.dataset.date));
    rows.forEach((row) => planContainer.append(row));
    document.querySelector('[data-plans-empty]').hidden = rows.length > 0;

    const activity = [
      ...budgets.map((budget) => ({ date: budget.updated_at, title: `PangaSiku · ${budget.days} day runway`, detail: `${money(budget.daily_safe)} daily guide` })),
      ...plans.map((plan) => ({ date: plan.created_at, title: `VukaMonth · ${plan.name}`, detail: `${money(plan.data.income)} monthly income` })),
    ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const renderActivity = (container, entries) => {
      container.replaceChildren();
      entries.forEach((entry) => {
        const item = document.createElement('li');
        const title = document.createElement('strong');
        const detail = document.createElement('span');
        const date = document.createElement('time');
        title.textContent = entry.title;
        detail.textContent = entry.detail;
        date.textContent = dateLabel(entry.date);
        item.append(title, detail, date);
        container.append(item);
      });
    };
    renderActivity(document.querySelector('[data-recent-activity]'), activity.slice(0, 4));
    renderActivity(document.querySelector('[data-activity-full]'), activity);
    document.querySelector('[data-recent-activity-empty]').hidden = activity.length > 0;
    document.querySelector('[data-activity-empty]').hidden = activity.length > 0;
  }

  async function loadData() {
    const [profile, latest, history, savedPlans] = await Promise.all([
      api('/auth/me'), api('/budgets/latest'), api('/budgets'), api('/plans'),
    ]);
    setProfile(profile.user);
    budgets = history.budgets || [];
    if (!budgets.length && latest.budget) budgets = [latest.budget];
    plans = savedPlans.plans || [];
    renderBudgets();
  }

  document.querySelectorAll('[data-account-logout]').forEach((button) => button.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.assign('index.html');
  }));

  const preferenceKeys = { dark: 'bilaform.preference.dark', contrast: 'bilaform.preference.contrast' };
  const darkToggle = document.querySelector('[data-dark-toggle]');
  const contrastToggle = document.querySelector('[data-contrast-toggle]');
  function applyPreferences() {
    document.body.classList.toggle('theme-dark', darkToggle.checked);
    document.body.classList.toggle('theme-contrast', contrastToggle.checked);
    localStorage.setItem(preferenceKeys.dark, String(darkToggle.checked));
    localStorage.setItem(preferenceKeys.contrast, String(contrastToggle.checked));
  }
  darkToggle.checked = localStorage.getItem(preferenceKeys.dark) !== 'false';
  contrastToggle.checked = localStorage.getItem(preferenceKeys.contrast) === 'true';
  applyPreferences();
  darkToggle.addEventListener('change', applyPreferences);
  contrastToggle.addEventListener('change', applyPreferences);

  document.querySelector('[data-profile-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('[data-profile-status]');
    const submit = event.currentTarget.querySelector('[type=submit]');
    submit.disabled = true; status.textContent = 'Saving…';
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const result = await api('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) });
      setProfile(result.user); status.textContent = 'Profile updated.';
    } catch (error) { status.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  const vukaForm = document.querySelector('[data-vuka-form]');
  const vukaFields = ['income', 'food', 'transport', 'rent', 'electricity', 'water', 'savings', 'other'];
  function updateVukaTotal() {
    const data = Object.fromEntries(vukaFields.map((key) => [key, Number(vukaForm.elements[key].value || 0)]));
    const total = vukaFields.slice(1).reduce((sum, key) => sum + data[key], 0);
    const remainder = data.income - total;
    const output = document.querySelector('[data-vuka-total]');
    output.classList.toggle('is-over', remainder < 0);
    output.textContent = data.income > 0
      ? remainder < 0 ? `Allocations exceed income by ${money(Math.abs(remainder))}. Adjust your amounts before saving.` : `${money(total)} allocated · ${money(remainder)} remains.`
      : 'Enter your monthly income and allocations.';
    return { data, total, remainder };
  }
  vukaForm.addEventListener('input', updateVukaTotal);
  vukaForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('[data-vuka-status]');
    const { data, remainder } = updateVukaTotal();
    if (remainder < 0) { status.textContent = 'Reduce allocations before saving this plan.'; return; }
    const submit = vukaForm.querySelector('[type=submit]'); submit.disabled = true; status.textContent = 'Saving…';
    try {
      await api('/plans', { method: 'POST', body: JSON.stringify({ type: 'vukamonth', name: vukaForm.elements.name.value, data }) });
      vukaForm.reset(); updateVukaTotal(); status.textContent = 'VukaMonth plan saved.'; await loadData();
    } catch (error) { status.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  loadData().catch((error) => {
    if (!message.textContent) showMessage(error.message, true);
  });
})();
