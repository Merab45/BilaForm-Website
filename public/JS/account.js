// Load the signed-in profile and latest saved budget for the account page.
(() => {
  const TOKEN_KEY = 'bilaform.auth.token';
  const USER_KEY = 'bilaform.auth.user';
  const token = localStorage.getItem(TOKEN_KEY);
  const message = document.querySelector('[data-account-message]');
  const money = (amount) => `KES ${Number(amount).toLocaleString('en-KE')}`;

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle('is-error', isError);
  }

  function returnToLogin() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.replace('index.html?auth=login');
  }

  if (!token) {
    returnToLogin();
    return;
  }

  async function get(path) {
    let response;
    try {
      response = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new Error('The BilaForm account server could not be reached. Start the app with “npm start” and reload this page.');
    }
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    if (!isJson && !response.ok) throw new Error('The BilaForm account API is not running. Start the app with “npm start” and reload this page.');
    const result = isJson ? await response.json() : {};
    if (!response.ok) {
      if (response.status === 401) returnToLogin();
      throw new Error(result.error || 'Could not load your account. Please try again.');
    }
    return result;
  }

  async function loadAccount() {
    try {
      const [{ user }, { budget }] = await Promise.all([get('/auth/me'), get('/budgets/latest')]);
      document.querySelector('[data-name-ending]').textContent = `, ${user.name}.`;
      document.querySelector('[data-profile-name]').textContent = user.name;
      document.querySelector('[data-profile-email]').textContent = user.email;
      const joined = new Date(`${user.created_at.replace(' ', 'T')}Z`);
      document.querySelector('[data-profile-date]').textContent = Number.isNaN(joined.getTime())
        ? user.created_at : joined.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
      localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email }));

      if (!budget) {
        document.querySelector('[data-budget-empty]').hidden = false;
        document.querySelector('.account-budget-grid').hidden = true;
        document.querySelector('[data-budget-daily]').textContent = 'No saved plan yet';
        return;
      }
      document.querySelector('[data-budget-daily]').textContent = money(budget.daily_safe);
      document.querySelector('[data-budget-cash]').textContent = money(budget.cash);
      document.querySelector('[data-budget-essentials]').textContent = money(budget.essentials);
      document.querySelector('[data-budget-buffer]').textContent = money(budget.buffer);
      document.querySelector('[data-budget-days]').textContent = `${budget.days} days`;
      const updated = new Date(`${budget.updated_at.replace(' ', 'T')}Z`);
      document.querySelector('[data-budget-updated]').textContent = Number.isNaN(updated.getTime())
        ? '' : `Saved ${updated.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}`;
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  document.querySelector('[data-account-logout]').addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.assign('index.html');
  });

  loadAccount();
})();
