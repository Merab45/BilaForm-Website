// Navigation stays visible at every viewport width. Close open dropdowns on Escape.
(() => {
  const nav = document.querySelector('#primary-navigation');
  if (!nav) return;
  document.documentElement.classList.add('has-nav-js');
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') nav.querySelectorAll('details[open]').forEach((item) => { item.open = false; });
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav-dropdown')) nav.querySelectorAll('details[open]').forEach((item) => { item.open = false; });
  });
})();
