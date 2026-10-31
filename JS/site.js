// Small helpers shared by the calculator and its display formatting.
const byId = (id) => document.getElementById(id);
const money = (value) =>
  `KES ${Math.floor(Math.max(0, value)).toLocaleString('en-KE')}`;

// Recalculate the daily allowance without changing the original formula.
function updateRunway() {
  const inputIds = ['cash', 'essentials', 'buffer', 'days'];
  const inputs = inputIds.map(byId);
  const error = byId('calc-error');
  const invalidInput = inputs.find(
    (input) => !input.value.trim() || !input.validity.valid,
  );

  inputs.forEach((input) => {
    input.setAttribute('aria-invalid', String(!input.value.trim() || !input.validity.valid));
  });

  if (invalidInput) {
    error.textContent = invalidInput.id === 'days'
      ? 'Enter at least 1 day until payday.'
      : 'Enter a valid amount of 0 KES or more for each field.';
    error.hidden = false;
    return;
  }

  error.hidden = true;
  error.textContent = '';

  const cash = Math.max(0, Number(byId('cash').value) || 0);
  const essentials = Math.max(0, Number(byId('essentials').value) || 0);
  const buffer = Math.max(0, Number(byId('buffer').value) || 0);
  const days = Math.max(1, Number(byId('days').value) || 1);
  const daily = Math.floor(Math.max(0, cash - essentials - buffer) / days);

  byId('daily').textContent = money(daily);

  // The badge shows whether the plan still leaves anything after reserves.
  const badge = byId('badge');
  const needsReset = cash - essentials - buffer <= 0;
  badge.textContent = needsReset ? 'PLAN NEEDS A RESET' : 'BUFFER KEPT ✓';
  badge.classList.toggle('reset', needsReset);
}

['cash', 'essentials', 'buffer', 'days'].forEach((id) => {
  byId(id).addEventListener('input', updateRunway);
});

// Keep the mobile menu's visual and accessibility states in sync.
const menuButton = document.querySelector('.menu');
const nav = document.querySelector('#primary-navigation');

function closeMenu() {
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}

menuButton.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => closeMenu());
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    closeMenu();
    menuButton.focus();
  }
});

// Highlight the navigation item for the section currently in view.
const sectionLinks = [...nav.querySelectorAll('a[href^="#"]')];
const observedSections = sectionLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        sectionLinks.forEach((link) => {
          const active = link.hash === `#${entry.target.id}`;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    },
    { rootMargin: '-20% 0px -65% 0px' },
  );
  observedSections.forEach((section) => sectionObserver.observe(section));
}

// Accessible FAQ disclosures: CSS grid animates their height in normal flow,
// so each answer moves the content below it instead of covering it.
const faqItems = [...document.querySelectorAll('.faq-item')];
const canHoverFAQ = window.matchMedia('(hover: hover) and (pointer: fine)');

function setFAQOpen(item, open) {
  faqItems.forEach((other) => {
    const isOpen = other === item && open;
    other.classList.toggle('is-open', isOpen);
    other.querySelector('.faq-question').setAttribute('aria-expanded', String(isOpen));
    other.querySelector('.faq-answer').setAttribute('aria-hidden', String(!isOpen));
  });
}

faqItems.forEach((item) => {
  const question = item.querySelector('.faq-question');

  question.addEventListener('click', (event) => {
    // A mouse click follows its hover state; keyboard and touch activate as a toggle.
    if (canHoverFAQ.matches && event.detail > 0) {
      setFAQOpen(item, true);
      return;
    }
    setFAQOpen(item, question.getAttribute('aria-expanded') !== 'true');
  });

  item.addEventListener('pointerenter', (event) => {
    if (canHoverFAQ.matches && event.pointerType === 'mouse') setFAQOpen(item, true);
  });
  item.addEventListener('pointerleave', (event) => {
    if (canHoverFAQ.matches && event.pointerType === 'mouse') setFAQOpen(item, false);
  });
});

// Keep the floating return-to-top control out of the way until it is useful.
const backToTop = document.querySelector('.back-to-top');
function syncBackToTop() {
  const isVisible = window.scrollY > 500;
  backToTop.classList.toggle('is-visible', isVisible);
  backToTop.setAttribute('aria-hidden', String(!isVisible));
  backToTop.tabIndex = isVisible ? 0 : -1;
}
window.addEventListener('scroll', syncBackToTop, { passive: true });
syncBackToTop();

// Show installation only after the browser confirms it can install the app.
const installButton = document.querySelector('.install-button');
let installPrompt;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  installPrompt = null;
});

// Reveal supporting content as it enters view; the hero stays visible on load.
const revealItems = document.querySelectorAll(
  '.benefit-card, .feature-card, .start-grid li',
);

if (
  'IntersectionObserver' in window &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
) {
  revealItems.forEach((item) => item.classList.add('reveal'));

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12 },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

// Register offline support only on secure origins (HTTPS or localhost).
if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('BilaForm could not register offline support:', error);
    });
  });
}

// Fill the calculator result on first load using the example values in the page.
updateRunway();
