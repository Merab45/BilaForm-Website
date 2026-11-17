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
    documentRef.documentElement.classList.add('has-bubble-menu');
    initMenu(documentRef, windowRef);
    initToolFinder(documentRef, windowRef);
    initInstallPrompt(documentRef, windowRef);
    if (!windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      documentRef.documentElement.classList.add('has-portal-motion');
    }
    if ('serviceWorker' in windowRef.navigator && (windowRef.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(windowRef.location.hostname))) {
      windowRef.addEventListener('load', () => windowRef.navigator.serviceWorker.register('service-worker.js').catch(() => {}));
    }
  }

  function initMenu(documentRef, windowRef) {
    const button = documentRef.querySelector('.menu');
    const nav = documentRef.querySelector('#primary-navigation');
    if (!button || !nav) return;
    const close = (restoreFocus = false) => {
      nav.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
      if (restoreFocus) button.focus();
    };
    button.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
      if (open) nav.querySelector('a')?.focus();
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => close()));
    documentRef.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('open')) close(true);
    });
    documentRef.addEventListener('pointerdown', (event) => {
      if (nav.classList.contains('open') && !nav.contains(event.target) && !button.contains(event.target)) close();
    });
    windowRef.addEventListener('resize', () => {
      if (windowRef.matchMedia('(min-width: 741px)').matches && nav.classList.contains('open')) close();
    }, { passive: true });
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
        if (status) status.textContent = input.value.trim()
          ? 'Try “daily budget”, “check a purchase”, “subscriptions”, or “monthly essentials”.'
          : 'Type a money-planning topic to find the right tool.';
        if (directory) directory.hidden = false;
        input.focus();
        return;
      }
      if (status) status.textContent = `Opening ${input.value.trim()}.`;
      if (destination.endsWith('#calculator')) windowRef.location.href = destination;
      else windowRef.location.href = destination;
    });
  }

  function initInstallPrompt(documentRef, windowRef) {
    const button = documentRef.querySelector('.install-button');
    if (!button) return;
    let promptEvent;
    windowRef.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      promptEvent = event;
      button.hidden = false;
    });
    button.addEventListener('click', async () => {
      if (!promptEvent) return;
      await promptEvent.prompt();
      await promptEvent.userChoice;
      promptEvent = null;
      button.hidden = true;
    });
  }

  return { routeToolQuery, initialize };
}));
