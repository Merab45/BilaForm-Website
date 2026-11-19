// Account dashboard: fetch the signed-in profile, budgets and saved monthly plans.
(() => {
  const dataApi = window.BilaFormData;
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
    const requestedView = new URLSearchParams(window.location.search).get('view');
    const returnTarget = requestedView === 'goals' ? '&return=goals' : ['plans', 'activity'].includes(requestedView) ? '&return=plans' : '';
    window.location.replace(`auth.html?auth=login${returnTarget}`);
  }
  async function api(path, options = {}) {
    if (!dataApi) throw new Error(window.BILAFORM_SUPABASE_ERROR || 'Supabase is not configured.');
    try { return await dataApi.request(path, options); }
    catch (error) { if (error.status === 401) returnToLogin(); throw error; }
  }
  const dashboardViews = new Set(['overview', 'plans', 'goals', 'settings', 'security']);
  const requestedView = new URLSearchParams(window.location.search).get('view');
  // Keep old activity URLs working after combining duplicate plan and activity lists.
  const resolvedView = requestedView === 'activity' ? 'plans' : requestedView;
  const activeView = dashboardViews.has(resolvedView) ? resolvedView : 'overview';
  document.querySelectorAll('[data-account-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.accountPanel !== activeView;
  });
  document.querySelectorAll('[data-account-view]').forEach((link) => {
    if (link.dataset.accountView === activeView) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const viewTitles = { overview: 'Overview', plans: 'My Plans & History', goals: 'Savings Goals', settings: 'Profile & Settings', security: 'Security' };
  document.title = `${viewTitles[activeView]} | My BilaForm Dashboard`;

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
    const renderRecentActivity = (entries) => {
      const container = document.querySelector('[data-recent-activity]');
      container.replaceChildren();
      entries.slice(0, 4).forEach((entry) => {
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
    renderRecentActivity(activity);
    document.querySelector('[data-recent-activity-empty]').hidden = activity.length > 0;
  }
  function renderSpending(entries) {
    const total = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const latest = budgets[0];
    const guide = Number(latest?.daily_safe || 0);
    const percent = guide > 0 ? Math.min(100, Math.round(total / guide * 100)) : 0;
    document.querySelector('[data-dashboard-spending]').textContent = entries.length ? `${money(total)} logged today across ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.` : 'No spending entries logged today.';
    const progress = document.querySelector('[data-dashboard-spending-progress]');
    progress.setAttribute('aria-valuenow', String(percent)); progress.querySelector('span').style.width = `${percent}%`;
    document.querySelector('[data-dashboard-spending-note]').textContent = guide > 0
      ? total > guide ? `Today’s entries are ${money(total - guide)} above the saved daily guide. Review your plan if useful.` : `${money(Math.max(0, guide - total))} of the saved daily guide remains before other costs.`
      : 'Save a PangaSiku plan to compare today’s spending with a daily guide.';
  }

  async function loadData() {
    const [profile, latest, history, savedPlans, spending] = await Promise.all([
      api('/auth/me'), api('/budgets/latest'), api('/budgets'), api('/plans'), api('/daily-spending'),
    ]);
    setProfile(profile.user);
    budgets = history.budgets || [];
    if (!budgets.length && latest.budget) budgets = [latest.budget];
    plans = savedPlans.plans || [];
    renderBudgets();
    renderSpending(spending.entries || []);
  }

  document.querySelectorAll('[data-account-logout]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await dataApi.request('/auth/logout', { method: 'POST' });
    } catch { /* Local sign-out must work even when the API is offline. */ }
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
      const result = await api('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name: data.name }) });
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
