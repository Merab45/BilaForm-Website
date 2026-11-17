(() => {
  const API_ROOT = ['5500', '5501'].includes(location.port)
    && ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://127.0.0.1:8000/api' : '/api';
  const feedback = document.querySelector('.auth-feedback');
  const title = document.querySelector('#auth-title');
  const intro = document.querySelector('[data-auth-intro]');
  const forms = [...document.querySelectorAll('[data-auth-form]')];
  const tabs = [...document.querySelectorAll('[data-auth-tab]')];
  const setFeedback = (message, isError = false) => {
    feedback.textContent = message;
    feedback.hidden = !message;
    feedback.classList.toggle('is-error', isError);
  };
  const setMode = (mode, focus = true) => {
    const registering = mode === 'register';
    title.textContent = registering ? 'Start with a clear plan.' : 'Welcome back.';
    intro.textContent = registering ? 'Create an account to keep your plans together.' : 'Sign in to see your saved plans.';
    tabs.forEach((tab) => {
      const active = tab.dataset.authTab === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    forms.forEach((form) => { form.hidden = form.dataset.authForm !== mode; });
    document.title = `${registering ? 'Create account' : 'Sign in'} | BilaForm`;
    setFeedback('');
    if (focus) document.querySelector(`[data-auth-form="${mode}"] input`)?.focus();
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.authTab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = tabs.indexOf(tab);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      setMode(tabs[index].dataset.authTab);
      tabs[index].focus();
    });
  });
  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = button.closest('.auth-password-wrap').querySelector('input');
      const showing = input.type === 'password';
      input.type = showing ? 'text' : 'password';
      button.textContent = showing ? 'Hide' : 'Show';
      button.setAttribute('aria-label', `${showing ? 'Hide' : 'Show'} password`);
      button.setAttribute('aria-pressed', String(showing));
    });
  });
  forms.forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const mode = form.dataset.authForm;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    setFeedback(mode === 'register' ? 'Creating your account…' : 'Signing you in…');
    try {
      const response = await fetch(`${API_ROOT}/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
      localStorage.setItem('bilaform.auth.token', payload.token);
      localStorage.setItem('bilaform.auth.user', JSON.stringify(payload.user));
      location.assign('account.html');
    } catch (error) {
      setFeedback(error.message || 'BilaForm could not reach its API. Please try again.', true);
    } finally {
      submit.disabled = false;
    }
  }));
  const mode = new URLSearchParams(location.search).get('auth');
  setMode(mode === 'register' ? 'register' : 'login', false);
})();
