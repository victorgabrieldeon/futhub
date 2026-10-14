// Theme: three states (system → light → dark), persisted in localStorage.
(() => {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const labels = { system: 'Tema: auto', light: 'Tema: claro', dark: 'Tema: escuro' };
  const order = ['system', 'light', 'dark'];
  let mode = localStorage.getItem('futhub-showcase-theme') || 'system';

  function apply() {
    const dark = mode === 'dark' || (mode === 'system' && media.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    for (const button of document.querySelectorAll('.theme-toggle')) {
      button.textContent = labels[mode];
    }
  }
  apply();
  media.addEventListener('change', apply);

  document.addEventListener('DOMContentLoaded', () => {
    apply();
    for (const button of document.querySelectorAll('.theme-toggle')) {
      button.addEventListener('click', () => {
        mode = order[(order.indexOf(mode) + 1) % order.length];
        localStorage.setItem('futhub-showcase-theme', mode);
        apply();
      });
    }

    const menu = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.site-nav');
    menu?.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menu.setAttribute('aria-expanded', String(open));
      menu.textContent = open ? 'Fechar' : 'Menu';
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (const element of document.querySelectorAll('.reveal')) observer.observe(element);
  });
})();
