// BilaForm landing page interactions. Navigation links remain visible without a menu toggle.
(function attachLanding(global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global && global.document) api.initialize(global.document);
}(typeof globalThis !== 'undefined' ? globalThis : this, function createLanding() {
  function routeToolQuery(query) {
    const text = String(query || '').trim().toLowerCase();
    if (!text) return null;
    if (/\b(month|monthly|rent|utilities|salary|income|essentials)\b/.test(text)) return 'services/vukamonth.html';
    if (/\b(afford|affordability|purchase|buy|cost)\b/.test(text)) return 'services/affordability.html';
    if (/\b(recurring|subscription|subscriptions|repeat|micro|leak|leaks)\b/.test(text)) return 'services/micro-leaks.html';
    if (/\b(payday|daily|budget|runway|pangasiku|spend)\b/.test(text)) return 'services/pangasiku.html#calculator';
    return null;
  }
  function initialize(documentRef) {
    const windowRef = documentRef.defaultView;
    if (!windowRef) return;
    initToolFinder(documentRef, windowRef);
    initInstallPrompt(documentRef, windowRef);
    if (!windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches) documentRef.documentElement.classList.add('has-portal-motion');
    if ('serviceWorker' in windowRef.navigator && (windowRef.location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(windowRef.location.hostname))) {
      windowRef.addEventListener('load', () => windowRef.navigator.serviceWorker.register('service-worker.js').catch(() => {}));
    }
  }
  function initToolFinder(documentRef, windowRef) {
    const form = documentRef.querySelector('[data-tool-finder]');
    if (!form) return;
    const input = form.querySelector('[name="query"]');
    const status = documentRef.querySelector('[data-tool-finder-status]');
    const directory = documentRef.querySelector('[data-tool-finder-directory]');
    if (directory) directory.hidden = true;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const destination = routeToolQuery(input.value);
      if (!destination) {
        if (status) status.textContent = input.value.trim() ? 'Try “daily budget”, “check a purchase”, “subscriptions”, or “monthly essentials”.' : 'Type a money-planning topic to find the right tool.';
        if (directory) directory.hidden = false;
        input.focus();
        return;
      }
      if (status) status.textContent = `Opening ${input.value.trim()}.`;
      windowRef.location.href = destination;
    });
  }
  function initInstallPrompt(documentRef, windowRef) {
    const button = documentRef.querySelector('.install-button');
    if (!button) return;
    let promptEvent;
    windowRef.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); promptEvent = event; button.hidden = false; });
    button.addEventListener('click', async () => {
      if (!promptEvent) return;
      await promptEvent.prompt(); await promptEvent.userChoice; promptEvent = null; button.hidden = true;
    });
  }
  return { routeToolQuery, initialize };
}));
