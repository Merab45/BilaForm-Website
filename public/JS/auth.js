(() => {
  const API_ROOT = window.BILAFORM_API_ROOT || '/api';
  const feedback = document.querySelector('.auth-feedback');
  const title = document.querySelector('#auth-title');
  const intro = document.querySelector('[data-auth-intro]');
  const tabList = document.querySelector('.auth-tabs');
  const forms = [...document.querySelectorAll('[data-auth-form]')];
  const tabs = [...document.querySelectorAll('[data-auth-tab]')];
  const setFeedback = (message, isError = false) => {
    feedback.textContent = message;
    feedback.hidden = !message;
    feedback.classList.toggle('is-error', isError);
  };
  const authenticatedDestination = () => {
    const target = new URLSearchParams(location.search).get('return');
    return target === 'pangasiku' ? 'services/pangasiku.html?resume=1'
      : target === 'goals' ? 'account.html?view=goals'
        : target === 'plans' ? 'account.html?view=plans' : 'account.html';
  };
  const resetToken = () => location.hash.slice(1);
  const setMode = (mode, focus = true) => {
    const registering = mode === 'register';
    const resetRequest = mode === 'reset-request';
    const resetComplete = mode === 'reset-complete';
    const resetting = resetRequest || resetComplete;
    title.textContent = registering ? 'Start with a clear plan.' : resetting ? 'Reset your password.' : 'Welcome back.';
    intro.textContent = registering ? 'Create an account to keep your plans together.'
      : resetRequest ? 'We’ll email you a secure, one-time reset link.'
        : resetComplete ? 'Choose a new password for your BilaForm account.'
          : 'Sign in to see your saved plans.';
    tabList.hidden = resetting;
    tabs.forEach((tab) => {
      const active = tab.dataset.authTab === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    forms.forEach((form) => { form.hidden = form.dataset.authForm !== mode; });
    document.title = `${registering ? 'Create account' : resetting ? 'Reset password' : 'Sign in'} | BilaForm`;
    setFeedback('');
    if (focus) document.querySelector(`[data-auth-form="${mode}"] input`)?.focus();
  };

  async function requestApi(path, body) {
    if (window.BILAFORM_API_CONFIG_ERROR) throw new Error(window.BILAFORM_API_CONFIG_ERROR);
    const response = await fetch(`${API_ROOT}${path}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
    return payload;
  }

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
  document.querySelector('[data-forgot-password]').addEventListener('click', (event) => {
    event.preventDefault();
    setMode('reset-request');
  });
  document.querySelectorAll('[data-back-login]').forEach((button) => button.addEventListener('click', () => {
    history.replaceState(null, '', `${location.pathname}?auth=login`);
    setMode('login');
  }));
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
    if (!form.reportValidity()) return;
    const mode = form.dataset.authForm;
    const submit = form.querySelector('[type="submit"]');
    const originalLabel = submit.textContent;
    submit.disabled = true;
    submit.textContent = mode === 'register' ? 'Creating account…' : mode === 'login' ? 'Signing in…' : 'Please wait…';
    setFeedback(mode === 'register' ? 'Creating your account…' : mode === 'login' ? 'Signing you in…' : 'Processing your request…');
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      if (mode === 'reset-request') {
        const result = await requestApi('/auth/password-reset/request', { email: data.email });
        form.reset();
        setFeedback(result.message || 'If an account exists for that address, a password reset link will be sent.');
        return;
      }
      if (mode === 'reset-complete') {
        if (data.password !== data.confirm_password) throw new Error('The passwords do not match.');
        const result = await requestApi('/auth/password-reset/complete', { token: resetToken(), password: data.password });
        history.replaceState(null, '', `${location.pathname}?auth=login`);
        form.reset();
        setMode('login', false);
        setFeedback(result.message || 'Password updated. Sign in with your new password.');
        return;
      }

      const result = await requestApi(`/auth/${mode === 'register' ? 'register' : 'login'}`, data);
      localStorage.removeItem('bilaform.auth.token');
      localStorage.removeItem('bilaform.auth.user');
      location.assign(authenticatedDestination());
    } catch (error) {
      const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);
      const isLocalApi = API_ROOT.startsWith('http://127.0.0.1:8000') || (isLocalHost && API_ROOT === '/api');
      const connectionMessage = isLocalApi
        ? 'The local BilaForm account API is not responding. In VS Code, run Terminal → Run Task → BilaForm: Start API and keep that task running.'
        : /^https?:\/\//i.test(API_ROOT)
          ? 'Could not reach the configured BilaForm API. Check that the host is online over HTTPS and allows this site in its CORS_ORIGIN setting.'
          : 'Could not connect to BilaForm’s account server. Check your connection and try again.';
      setFeedback(error.message === 'Failed to fetch' ? connectionMessage : error.message || 'BilaForm could not reach its API. Please try again.', true);
    } finally {
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  }));

  const params = new URLSearchParams(location.search);
  const token = resetToken();
  if (params.get('auth') === 'reset') setMode(token ? 'reset-complete' : 'reset-request', false);
  else setMode(params.get('auth') === 'register' ? 'register' : 'login', false);

  localStorage.removeItem('bilaform.auth.token');
  localStorage.removeItem('bilaform.auth.user');
  if (params.get('auth') !== 'reset') {
    fetch(`${API_ROOT}/auth/me`, { credentials: 'include' })
      .then((response) => {
        if (response.ok) location.replace(authenticatedDestination());
      }).catch(() => {});
  }
})();
