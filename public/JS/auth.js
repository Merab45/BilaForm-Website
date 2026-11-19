(() => {
  const client = window.BilaFormSupabase;
  const feedback = document.querySelector('.auth-feedback');
  const title = document.querySelector('#auth-title');
  const intro = document.querySelector('[data-auth-intro]');
  const tabList = document.querySelector('.auth-tabs');
  const forms = [...document.querySelectorAll('[data-auth-form]')];
  const tabs = [...document.querySelectorAll('[data-auth-tab]')];
  const setFeedback = (message, isError = false) => { feedback.textContent = message; feedback.hidden = !message; feedback.classList.toggle('is-error', isError); };
  const authenticatedDestination = () => {
    const target = new URLSearchParams(location.search).get('return');
    return target === 'pangasiku' ? 'services/pangasiku.html?resume=1' : target === 'goals' ? 'account.html?view=goals' : target === 'plans' ? 'account.html?view=plans' : 'account.html';
  };
  const setMode = (mode, focus = true) => {
    const registering = mode === 'register'; const resetRequest = mode === 'reset-request'; const resetComplete = mode === 'reset-complete'; const resetting = resetRequest || resetComplete;
    title.textContent = registering ? 'Start with a clear plan.' : resetting ? 'Reset your password.' : 'Welcome back.';
    intro.textContent = registering ? 'Create an account to keep your plans together.' : resetRequest ? 'We’ll email you a secure, one-time reset link.' : resetComplete ? 'Choose a new password for your BilaForm account.' : 'Sign in to see your saved plans.';
    tabList.hidden = resetting;
    tabs.forEach((tab) => { const active = tab.dataset.authTab === mode; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    forms.forEach((form) => { form.hidden = form.dataset.authForm !== mode; });
    document.title = `${registering ? 'Create account' : resetting ? 'Reset password' : 'Sign in'} | BilaForm`; setFeedback('');
    if (focus) document.querySelector(`[data-auth-form="${mode}"] input`)?.focus();
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.authTab));
    tab.addEventListener('keydown', (event) => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const i = tabs.indexOf(tab); const n = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; setMode(tabs[n].dataset.authTab); tabs[n].focus(); });
  });
  document.querySelector('[data-forgot-password]').addEventListener('click', (event) => { event.preventDefault(); history.replaceState(null, '', `${location.pathname}?auth=reset-request`); setMode('reset-request'); });
  document.querySelectorAll('[data-back-login]').forEach((button) => button.addEventListener('click', () => { history.replaceState(null, '', `${location.pathname}?auth=login`); setMode('login'); }));
  document.querySelectorAll('[data-password-toggle]').forEach((button) => button.addEventListener('click', () => { const input = button.closest('.auth-password-wrap').querySelector('input'); const showing = input.type === 'password'; input.type = showing ? 'text' : 'password'; button.textContent = showing ? 'Hide' : 'Show'; button.setAttribute('aria-label', `${showing ? 'Hide' : 'Show'} password`); button.setAttribute('aria-pressed', String(showing)); }));
  forms.forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const mode = form.dataset.authForm; const submit = form.querySelector('[type="submit"]'); const label = submit.textContent; submit.disabled = true; submit.textContent = mode === 'register' ? 'Creating account…' : mode === 'login' ? 'Signing in…' : 'Please wait…'; setFeedback('Connecting securely to BilaForm…');
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      if (!client) throw new Error(window.BILAFORM_SUPABASE_ERROR || 'Supabase is not configured.');
      if (mode === 'reset-request') {
        const { error } = await client.auth.resetPasswordForEmail(data.email, { redirectTo: `${location.origin}${location.pathname}?auth=reset` }); if (error) throw error;
        form.reset(); setFeedback('If an account exists for that address, a password reset link will be sent.'); return;
      }
      if (mode === 'reset-complete') {
        if (data.password !== data.confirm_password) throw new Error('The passwords do not match.');
        const { error } = await client.auth.updateUser({ password: data.password }); if (error) throw error;
        history.replaceState(null, '', `${location.pathname}?auth=login`); form.reset(); setMode('login', false); setFeedback('Password updated. Sign in with your new password.'); return;
      }
      if (mode === 'register') {
        const { data: result, error } = await client.auth.signUp({ email: data.email.trim(), password: data.password, options: { data: { full_name: data.name.trim() }, emailRedirectTo: `${location.origin}${location.pathname}?auth=login` } }); if (error) throw error;
        if (!result.session) { form.reset(); setFeedback('Check your email to confirm your account, then sign in.'); return; }
      } else {
        const { error } = await client.auth.signInWithPassword({ email: data.email.trim(), password: data.password }); if (error) throw error;
      }
      location.assign(authenticatedDestination());
    } catch (error) {
      let message = error.message || 'BilaForm could not complete that request.';
      if (/Invalid login credentials/i.test(message)) message = 'Email or password is incorrect. Check your details and try again.';
      if (/Failed to fetch|NetworkError/i.test(message)) message = 'Could not reach Supabase. Check your connection and project settings.';
      setFeedback(message, true);
    } finally { submit.disabled = false; submit.textContent = label; }
  }));
  const params = new URLSearchParams(location.search); const hashParams = new URLSearchParams(location.hash.slice(1));
  const mode = params.get('auth');
  if (mode === 'reset-request') setMode('reset-request', false);
  else if (mode === 'reset' || hashParams.get('type') === 'recovery') setMode('reset-complete', false);
  else setMode(mode === 'register' ? 'register' : 'login', false);
  if (mode !== 'reset-request' && mode !== 'reset' && hashParams.get('type') !== 'recovery' && client) client.auth.getSession().then(({ data }) => { if (data.session) location.replace(authenticatedDestination()); });
})();
