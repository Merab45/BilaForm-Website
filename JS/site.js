// Shortcuts shared by the calculator and its display formatting.
const byId = (id) => document.getElementById(id);
const money = (value) =>
  `KES ${Math.floor(Math.max(0, value)).toLocaleString('en-KE')}`;

// Recalculate the daily allowance whenever one of the plan inputs changes.
function updateRunway() {
  const cash = Math.max(0, Number(byId('cash').value) || 0);
  const essentials = Math.max(0, Number(byId('essentials').value) || 0);
  const buffer = Math.max(0, Number(byId('buffer').value) || 0);
  const days = Math.max(1, Number(byId('days').value) || 1);
  const daily = Math.floor(Math.max(0, cash - essentials - buffer) / days);

  byId('daily').textContent = money(daily);

  // Tell the user whether the essentials and buffer still fit the plan.
  const badge = byId('badge');
  const needsReset = cash - essentials - buffer <= 0;
  badge.textContent = needsReset ? 'PLAN NEEDS A RESET' : 'BUFFER KEPT ✓';
  badge.classList.toggle('reset', needsReset);
}

['cash', 'essentials', 'buffer', 'days'].forEach((id) => {
  byId(id).addEventListener('input', updateRunway);
});

// Keep the small-screen navigation button in sync with the menu state.
const menuButton = document.querySelector('.menu');
const nav = document.querySelector('.header nav');

menuButton.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

// Close the mobile menu after a visitor follows a navigation link.
nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  });
});

// Populate the calculator's initial result from the example values in the page.
updateRunway();

// Reveal supporting content as it enters view; leave the hero visible immediately.
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
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}
