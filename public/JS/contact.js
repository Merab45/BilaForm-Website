// Submit contact messages directly to the BilaForm Supabase Data API.
(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const status = form.querySelector('[data-contact-status]');
  if (new URLSearchParams(location.search).get('topic') === 'password-reset') {
    form.elements.message.value = 'I need help regaining access to my BilaForm account.';
    form.elements.message.focus();
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    status.textContent = 'Sending your message…';
    try {
      if (!window.BilaFormData) throw new Error(window.BILAFORM_SUPABASE_ERROR || 'Supabase is not configured.');
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await window.BilaFormData.request('/contact', { method: 'POST', body: JSON.stringify(payload) });
      status.textContent = result.message;
      form.reset();
    } catch (error) {
      status.textContent = error.message || 'Could not send your message. Please try again.';
    } finally {
      submit.disabled = false;
    }
  });
})();
