/**
 * Faro School - Lightweight Service Worker (PWA)
 * Compatible with Next.js 15 and Cloudflare Workers (OpenNext)
 */

const CACHE_NAME = "faro-pwa-v2-dashboard";

const PRECACHE_ASSETS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/brand/logo-on-light.png",
  "/brand/logo-on-dark.png",
];

// URLs/Patterns that must NEVER be intercepted or cached (Zero private data, payments, API or video caching)
const NEVER_CACHE_PATTERNS = [
  /^\/api\//,
  /connexion/,
  /inscription/,
  /mot-de-passe-oublie/,
  /checkout/,
  /confirmation/,
  /paiement/,
  /\/pay\//,
  /admin/,
  /\/dashboard\/messages/,
  /\/dashboard\/communaute/,
  /supabase\.co/,
  /realtime/,
  /b-cdn\.net/,
  /bunnycdn\.com/,
  /mediacage/,
  /video/,
  /stream/,
  /moncash/,
  /natcash/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch((err) => {
        console.warn("[SW] Pre-cache warning:", err);
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("faro-pwa-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Exclude non-http(s) protocols
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Never intercept or cache sensitive, dynamic, or streaming endpoints
  for (const pattern of NEVER_CACHE_PATTERNS) {
    if (pattern.test(url.pathname) || pattern.test(url.hostname)) {
      return;
    }
  }

  // 1. Navigation requests (HTML pages): Network First, fallback to cached /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match("/offline");
        return (
          cachedOffline ||
          new Response("Mode hors-ligne disponible sous peu.", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        );
      })
    );
    return;
  }

  // 2. Static Assets (/_next/static, /icons, /brand, fonts, images): Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2");

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // For other requests, pass through to network
});
