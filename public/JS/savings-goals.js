(function attachSavingsGoals(global, factory) {
  const api = factory(global);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global && global.document) api.initialize(global.document);
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSavingsGoals(globalRef) {
  const TOKEN_KEY = 'bilaform.auth.token';
  const USER_KEY = 'bilaform.auth.user';
  const money = (value) => `KES ${Number(value || 0).toLocaleString('en-KE')}`;

  function calculateGoalProgress(goal, todayValue = new Date().toISOString().slice(0, 10)) {
    const target = Number(goal.target_amount) || 0;
    const saved = Number(goal.current_amount) || 0;
    const remaining = Math.max(0, target - saved);
    const percent = target > 0 ? Math.min(100, Math.floor((saved / target) * 100)) : 0;
    const today = new Date(`${todayValue}T00:00:00.000Z`);
    const targetDate = new Date(`${goal.target_date}T00:00:00.000Z`);
    const daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);
    const dateIsValid = Number.isFinite(daysRemaining);
    const overdue = dateIsValid && daysRemaining < 0 && remaining > 0;
    const monthlyPeriods = dateIsValid ? Math.max(1, Math.ceil(daysRemaining / 30.436875)) : 0;
    const weeklyPeriods = dateIsValid ? Math.max(1, Math.ceil(daysRemaining / 7)) : 0;
    return {
      remaining,
      percent,
      overdue,
      monthlyContribution: remaining && dateIsValid && !overdue ? Math.ceil(remaining / monthlyPeriods) : 0,
      weeklyContribution: remaining && dateIsValid && !overdue ? Math.ceil(remaining / weeklyPeriods) : 0,
    };
  }

  function initialize(documentRef) {
    const panel = documentRef.querySelector('[data-savings-goals]');
    if (!panel || panel.hidden) return;
    const token = globalRef.localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const form = panel.querySelector('[data-goal-form]');
    const status = panel.querySelector('[data-goal-status]');
    const list = panel.querySelector('[data-goal-list]');
    const empty = panel.querySelector('[data-goal-empty]');
    const target = form.elements.target_amount;
    const alreadySaved = form.elements.current_amount;
    const cancel = panel.querySelector('[data-goal-cancel]');
    let goals = [];

    function showStatus(text, isError = false) {
      status.textContent = text;
      status.classList.toggle('is-error', isError);
    }

    async function api(route, options = {}) {
      let response;
      try {
        response = await globalRef.fetch(`${globalRef.BILAFORM_API_ROOT || '/api'}${route}`, {
          ...options,
          headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
        });
      } catch {
        throw new Error('BilaForm could not reach its API. Your goal changes have not been saved.');
      }
      const payload = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : {};
      if (response.status === 401) {
        globalRef.localStorage.removeItem(TOKEN_KEY);
        globalRef.localStorage.removeItem(USER_KEY);
        globalRef.location.assign('auth.html?auth=login&return=goals');
      }
      if (!response.ok) throw new Error(payload.error || 'Your savings goal could not be saved.');
      return payload;
    }

    function resetForm() {
      form.reset();
      form.dataset.goalId = '';
      alreadySaved.disabled = false;
      target.min = '1';
      alreadySaved.max = '1000000000';
      cancel.hidden = true;
      form.querySelector('[type="submit"]').textContent = 'Create savings goal';
    }

    async function changeStatus(goal, nextStatus) {
      try {
        await api(`/savings-goals/${goal.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: goal.name, target_amount: goal.target_amount, target_date: goal.target_date, status: nextStatus }),
        });
        await loadGoals();
        showStatus(nextStatus === 'active' ? 'Goal resumed.' : `Goal ${nextStatus}.`);
      } catch (error) { showStatus(error.message, true); }
    }

    function makeButton(label, className, action) {
      const button = documentRef.createElement('button');
      button.type = 'button'; button.className = className; button.textContent = label;
      button.addEventListener('click', action);
      return button;
    }

    function goalCard(goal) {
      const progress = calculateGoalProgress(goal);
      const card = documentRef.createElement('article');
      card.className = 'dashboard-card savings-goal-card';
      const top = documentRef.createElement('div'); top.className = 'savings-goal-top';
      const identity = documentRef.createElement('div');
      const title = documentRef.createElement('h3'); title.textContent = goal.name;
      const due = documentRef.createElement('p');
      due.textContent = `${progress.overdue ? 'Target date passed' : 'Target date'} · ${goal.target_date}`;
      identity.append(title, due);
      const badge = documentRef.createElement('span');
      badge.className = `goal-status goal-status--${goal.status}`;
      badge.textContent = goal.status[0].toUpperCase() + goal.status.slice(1);
      top.append(identity, badge);

      const amounts = documentRef.createElement('div'); amounts.className = 'goal-amounts';
      const saved = documentRef.createElement('strong'); saved.textContent = money(goal.current_amount);
      const targetLabel = documentRef.createElement('span'); targetLabel.textContent = `of ${money(goal.target_amount)}`;
      const percent = documentRef.createElement('b'); percent.textContent = `${progress.percent}%`;
      amounts.append(saved, targetLabel, percent);

      const track = documentRef.createElement('div'); track.className = 'goal-progress-track';
      track.setAttribute('role', 'progressbar'); track.setAttribute('aria-label', `${goal.name} savings progress`);
      track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100'); track.setAttribute('aria-valuenow', String(progress.percent));
      const fill = documentRef.createElement('span'); fill.className = 'goal-progress-fill'; fill.style.width = `${progress.percent}%`; track.append(fill);

      const guidance = documentRef.createElement('p'); guidance.className = 'goal-guidance';
      guidance.textContent = progress.remaining === 0
        ? 'You have reached this target.'
        : progress.overdue
          ? `${money(progress.remaining)} remaining · update the date to see a contribution guide.`
          : `${money(progress.remaining)} remaining · about ${money(progress.weeklyContribution)} weekly or ${money(progress.monthlyContribution)} monthly.`;

      const actions = documentRef.createElement('div'); actions.className = 'goal-actions';
      actions.append(makeButton('Edit', 'subtle-button', () => {
        form.elements.name.value = goal.name;
        target.value = goal.target_amount;
        alreadySaved.value = goal.current_amount;
        form.elements.target_date.value = goal.target_date;
        form.dataset.goalId = String(goal.id);
        alreadySaved.disabled = true;
        target.min = String(goal.current_amount || 1);
        cancel.hidden = false;
        form.querySelector('[type="submit"]').textContent = 'Save changes';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.elements.name.focus();
      }));

      if (goal.status !== 'completed') {
        actions.append(makeButton(goal.status === 'paused' ? 'Resume' : 'Pause', 'subtle-button', () => changeStatus(goal, goal.status === 'paused' ? 'active' : 'paused')));
        actions.append(makeButton('Mark complete', 'subtle-button', () => changeStatus(goal, 'completed')));
      } else if (progress.remaining > 0) {
        actions.append(makeButton('Restart goal', 'subtle-button', () => changeStatus(goal, 'active')));
      }
      actions.append(makeButton('Delete', 'goal-delete', async () => {
        if (!globalRef.confirm(`Delete “${goal.name}” and its contribution history?`)) return;
        try { await api(`/savings-goals/${goal.id}`, { method: 'DELETE' }); await loadGoals(); showStatus('Savings goal deleted.'); }
        catch (error) { showStatus(error.message, true); }
      }));

      const contributionHistory = documentRef.createElement('details'); contributionHistory.className = 'goal-contributions';
      const summary = documentRef.createElement('summary'); summary.textContent = `Savings history (${goal.contributions.length})`;
      const entries = documentRef.createElement('ul');
      goal.contributions.forEach((contribution) => {
        const row = documentRef.createElement('li');
        const amount = documentRef.createElement('strong'); amount.textContent = `${contribution.entry_type === 'initial' ? 'Already saved' : 'Contribution'} · ${money(contribution.amount)}`;
        const date = documentRef.createElement('time'); date.textContent = contribution.created_at;
        row.append(amount, date); entries.append(row);
      });
      if (!goal.contributions.length) { const row = documentRef.createElement('li'); row.textContent = 'No contributions recorded yet.'; entries.append(row); }
      contributionHistory.append(summary, entries);

      card.append(top, amounts, track, guidance);
      if (goal.status === 'active' && progress.remaining > 0) {
        const contributionForm = documentRef.createElement('form'); contributionForm.className = 'goal-contribution-form';
        const label = documentRef.createElement('label'); label.textContent = 'Add contribution (KES)';
        const amount = documentRef.createElement('input'); amount.type = 'number'; amount.name = 'amount'; amount.min = '1'; amount.max = String(progress.remaining); amount.step = '1'; amount.inputMode = 'numeric'; amount.required = true;
        amount.setAttribute('aria-label', `Contribution amount for ${goal.name}`); label.append(amount);
        const submit = documentRef.createElement('button'); submit.type = 'submit'; submit.className = 'dashboard-cta'; submit.textContent = 'Add savings';
        contributionForm.append(label, submit);
        contributionForm.addEventListener('submit', async (event) => {
          event.preventDefault(); submit.disabled = true;
          try {
            await api(`/savings-goals/${goal.id}/contributions`, { method: 'POST', body: JSON.stringify({ amount: Number(amount.value) }) });
            await loadGoals(); showStatus('Contribution recorded.');
          } catch (error) { showStatus(error.message, true); }
          finally { submit.disabled = false; }
        });
        card.append(contributionForm);
      }
      card.append(contributionHistory, actions);
      return card;
    }

    function renderGoals() {
      list.replaceChildren(...goals.map(goalCard));
      empty.hidden = goals.length > 0;
      const active = goals.filter((goal) => goal.status === 'active');
      panel.querySelector('[data-goals-active]').textContent = String(active.length);
      panel.querySelector('[data-goals-saved]').textContent = money(goals.reduce((sum, goal) => sum + goal.current_amount, 0));
      panel.querySelector('[data-goals-target]').textContent = money(goals.reduce((sum, goal) => sum + goal.target_amount, 0));
    }

    async function loadGoals() {
      const result = await api('/savings-goals');
      goals = result.goals || [];
      renderGoals();
    }

    target.addEventListener('input', () => {
      if (!alreadySaved.disabled) alreadySaved.max = target.value || '1000000000';
    });
    cancel.addEventListener('click', resetForm);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
      showStatus(form.dataset.goalId ? 'Saving changes…' : 'Creating goal…');
      const body = {
        name: form.elements.name.value.trim(),
        target_amount: Number(target.value),
        target_date: form.elements.target_date.value,
        ...(!alreadySaved.disabled ? { current_amount: Number(alreadySaved.value || 0) } : {}),
      };
      try {
        const editing = Boolean(form.dataset.goalId);
        await api(editing ? `/savings-goals/${form.dataset.goalId}` : '/savings-goals', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
        resetForm(); await loadGoals(); showStatus('Savings goal saved.');
      } catch (error) { showStatus(error.message, true); }
      finally { submit.disabled = false; }
    });

    loadGoals().catch((error) => showStatus(error.message, true));
  }

  return { calculateGoalProgress, initialize };
}));
