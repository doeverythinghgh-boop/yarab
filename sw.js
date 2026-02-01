const CACHE_NAME = "events-app-v8";
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./search.html",
    "./topics.html",
    "./settings.html",
    "./timeline.html",
    "./css/common.css",
    "./css/index.css",
    "./css/search.css",
    "./css/topics.css",
    "./css/settings.css",
    "./css/timeline.css",
    "./js/db.js",
    "./js/index.js",
    "./js/search.js",
    "./js/topics.js",
    "./js/settings.js",
    "./js/timeline.js",
    "./js/pwa-loader.js",
    "https://unpkg.com/codemirror@5.65.13/lib/codemirror.css",
    "https://unpkg.com/codemirror@5.65.13/lib/codemirror.js",
    "https://unpkg.com/codemirror@5.65.13/addon/mode/overlay.js",
    "https://unpkg.com/codemirror@5.65.13/addon/selection/active-line.js"
];

// Install Event
self.addEventListener("install", (event) => {
    self.skipWaiting(); // إجبار التحديث فوراً
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[Service Worker] Caching all assets");
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log("[Service Worker] Removing old cache", key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch Event
self.addEventListener("fetch", (event) => {
    // Only cache http/https requests, skip chrome-extension:// etc
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
