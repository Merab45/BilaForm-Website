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
      const response = await fetch(`${apiRoot}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send your message.');
      status.textContent = result.message; form.reset();
    } catch (error) { status.textContent = error.message || 'BilaForm could not reach its server. Please try again.'; }
    finally { submit.disabled = false; }
  });
})();
