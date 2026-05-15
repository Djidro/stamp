const CACHE_NAME = 'loyaltysip-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/login.html',
    '/register.html',
    '/dashboard.html',
    '/scanner.html',
    '/customer.html',
    '/css/styles.css',
    '/js/supabase-config.js',
    '/js/dashboard.js',
    '/js/scanner.js',
    '/js/customer.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;
                return fetch(event.request);
            })
    );
});
