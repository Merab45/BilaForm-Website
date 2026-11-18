// Submit enquiries through BilaForm's account API.
(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const status = form.querySelector('[data-contact-status]');
  if (new URLSearchParams(location.search).get('topic') === 'password-reset') {
    form.elements.message.value = 'I need help regaining access to my BilaForm account.';
    form.elements.message.focus();
  }
  const apiRoot = window.BILAFORM_API_ROOT || '/api';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true; status.textContent = 'Sending your message…';
    try {
      if (window.BILAFORM_API_CONFIG_ERROR) throw new Error(window.BILAFORM_API_CONFIG_ERROR);
      const response = await fetch(`${apiRoot}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send your message.');
      status.textContent = result.message; form.reset();
    } catch (error) { status.textContent = error.message === 'Failed to fetch' ? 'Could not connect to BilaForm’s server. Check your connection and try again.' : error.message || 'BilaForm could not reach its server. Please try again.'; }
    finally { submit.disabled = false; }
  });
})();
