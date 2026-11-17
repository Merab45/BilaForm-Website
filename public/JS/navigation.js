// Shared responsive navigation and accessible dropdown behavior.
(() => {
  const menu = document.querySelector('.menu');
  const nav = document.querySelector('#primary-navigation');
  if (!menu || !nav) return;
  const closeMenu = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    nav.querySelectorAll('details[open]').forEach((item) => { item.open = false; });
    closeMenu(); menu.focus();
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav-dropdown')) nav.querySelectorAll('details[open]').forEach((item) => { item.open = false; });
  });
})();
