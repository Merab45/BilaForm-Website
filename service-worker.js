// Bump this when changing cached app code so installed clients receive the fix.
const CACHE_NAME = 'bilaform-site-v25';
const APP_FILES = [
  './',
  './index.html',
  './CSS/styles.css',
  './JS/site.js',
  './manifest.webmanifest',
  './privacy.html',
  './terms.html',
  './contact.html',
  './BilaForm-Android-Prototype/index.html',
  './BilaForm-Android-Prototype/demo.css',
  './BilaForm-Android-Prototype/demo.js',
  './Assets/Assets/favicon.svg',
  './Assets/Assets/bilaform-mark.png',
  './Assets/Assets/hero-portrait.png',
  './Assets/Assets/hero-blue-waves.png',
  './Assets/Assets/benefits/financial-control.svg',
  './Assets/Assets/benefits/smart-planning.svg',
  './Assets/Assets/benefits/better-decisions.svg',
  './Assets/Assets/benefits/peace-of-mind.svg',
  './Assets/Assets/runway.svg',
  './Assets/Assets/simulator.svg',
  './Assets/Assets/micro-leaks.svg',
  './Assets/Assets/budget-rival.svg',
  './Assets/Assets/vukamonth/essentials.svg',
  './Assets/Illustrations/financial-planning.svg',
  './Assets/Illustrations/budgeting-calculator.svg',
  './Assets/Illustrations/financial-dashboard.svg',
  './Assets/Illustrations/customer-support.svg',
  './Assets/Illustrations/african-shopping.svg',
  './Assets/Illustrations/final-cta.svg',
  './Assets/Illustrations/income-step.svg',
  './Assets/Illustrations/decision-step.svg',
  './Assets/icons/bilaform-icon-192.png',
  './Assets/icons/bilaform-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('bilaform-site-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.ok) return response;
          const copy = response.clone();
          return caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .then(() => response);
        })
        .catch(async () => (await caches.match(request)) || caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
