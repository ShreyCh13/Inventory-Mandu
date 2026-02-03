# PWA + Caching + Offline: One-Prompt Implementation Guide

Use this guide to make another web app **installable**, **cached**, and **offline-capable** like Inventory Mandu.

---

## Part 1: Installable Web App (PWA)

### 1.1 Web App Manifest (`public/manifest.json`)

Create a JSON file that tells the browser “this is an installable app.”

| Field | Purpose |
|-------|--------|
| `name` | Full name (install prompt, splash) |
| `short_name` | Home screen label |
| `description` | Shown in install UI |
| `start_url` | URL when user opens the app from icon (usually `"/"`) |
| `display` | `"standalone"` = no browser chrome (feels like native app) |
| `background_color` | Splash screen / background |
| `theme_color` | Status bar / address bar color |
| `icons` | Array of `{ src, sizes, type, purpose }` — include at least 192×192 and 512×512 (or one SVG with `sizes: "any"`) |
| `categories` | e.g. `["business", "productivity"]` |
| `orientation` | Optional, e.g. `"portrait-primary"` |
| `shortcuts` | Optional app shortcuts from icon long-press |

**Example:**

```json
{
  "name": "My App",
  "short_name": "MyApp",
  "description": "My app description",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1e293b",
  "theme_color": "#4f46e5",
  "icons": [
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" },
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ],
  "categories": ["business", "productivity"]
}
```

### 1.2 HTML: Link manifest + iOS/Apple

In your main **`index.html`** `<head>`:

- **Manifest:**  
  `<link rel="manifest" href="/manifest.json">`
- **Theme (Android/desktop):**  
  `<meta name="theme-color" content="#4f46e5">`
- **iOS “Add to Home Screen”:**  
  - `<meta name="apple-mobile-web-app-capable" content="yes">`  
  - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`  
  - `<meta name="apple-mobile-web-app-title" content="My App">`

Without the Apple meta tags, iOS won’t treat the site as an installable web app.

### 1.3 Service worker registration (required for install)

Browsers generally require a **service worker** before showing “Install app.” Register it from your app entry (e.g. `index.tsx` or `main.tsx`):

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => { /* optional: log in dev */ })
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}
```

- **HTTPS** is required for install (and for service workers) in production.
- The SW file must be at the **root scope** (e.g. `/sw.js`) so its scope covers the whole app.

---

## Part 2: Caching (Service worker)

Use **two caches**: one for **static app shell**, one for **API/data** (if you have a backend). Use **versioned cache names** so you can invalidate when you deploy.

```javascript
const STATIC_CACHE_NAME = 'my-app-static-v1';
const API_CACHE_NAME = 'my-app-api-v1';
```

### 2.1 Install: precache static shell

On `install`, open the static cache and add critical URLs so the app loads offline:

```javascript
const urlsToCache = ['/', '/index.html', '/favicon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch((err) => console.error('Precache failed', err))
  );
});
```

Add any other critical JS/CSS entrypoints if you want them available on first load.

### 2.2 Activate: cleanup old caches + claim clients

On `activate`, delete old cache names and take control of open tabs:

```javascript
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== STATIC_CACHE_NAME && name !== API_CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      ),
      self.clients.claim()
    ])
  );
});
```

When you release a new version, bump `STATIC_CACHE_NAME` / `API_CACHE_NAME`; the next activate will remove the old caches.

### 2.3 Fetch: strategy by type of request

- **Only cache GET.** Ignore POST/PUT/DELETE in the fetch handler.
- **Same-origin only for app assets.** Skip `event.respondWith` for `url.origin !== self.location.origin` unless you explicitly want to cache a specific cross-origin API.

**A) API / backend (e.g. Supabase REST): network-first, cache fallback**

- Try network first (optionally with a short timeout, e.g. 10s).
- On success: store response in `API_CACHE_NAME` with a custom header (e.g. `sw-cached-time: Date.now()`) so you can expire entries later.
- On network failure: serve from cache if present; otherwise return a 503 JSON body like `{ error: 'Offline and no cached data' }`.

This gives fresh data when online and last-known data when offline.

**B) HTML / navigation: network-first, cache fallback**

- Try `fetch(event.request)`.
- On success: optionally update `STATIC_CACHE_NAME` with the response (e.g. for `/` or `/index.html`).
- On failure: `caches.match('/index.html')` (or your shell URL) so the app shell still loads offline.

**C) Static assets (JS, CSS, images): cache-first, background refresh**

- `caches.match(event.request)`.
- If cache hit: return it, and optionally `fetch(event.request)` in the background and `cache.put(...)` to update.
- If cache miss: fetch, then store in `STATIC_CACHE_NAME` and return the response.
- On network failure when cache miss: return the cached response if you have one from a previous visit.

### 2.4 API cache “freshness” (optional)

Store a timestamp when you cache API responses (e.g. header `sw-cached-time`). In the fetch handler you can:

- Treat responses as valid for e.g. 24 hours.
- When serving from cache, you can still return it for offline even if “stale”; the network-first logic already prefers fresh data when online.

You can also add a **message handler** from the main app to the SW (e.g. `postMessage({ type: 'CLEANUP_API_CACHE' })`) and in the SW delete API cache entries older than 24–48 hours to avoid unbounded growth.

---

## Part 3: Offline usage

### 3.1 What “offline” means here

- **App shell:** Served from the **static cache** (precached + cache-first for assets).
- **Data:** Served from the **API cache** when the network fails (network-first with cache fallback).
- **Writes (POST/PUT/DELETE):** Not cached by the SW; the app must **queue** them and **replay** when back online.

### 3.2 Detect online/offline in the app

- **`navigator.onLine`** — quick check.
- **`window` events:**  
  - `window.addEventListener('online', ...)`  
  - `window.addEventListener('offline', ...)`  
  Use these to update UI (e.g. “You’re offline”) and to trigger sync when coming back online.

### 3.3 Queue writes when offline (pending ops)

- When the user does something that triggers a write (e.g. create transaction, update item), check `navigator.onLine` (or your connection state).
- If **offline**, don’t call the API; instead append to a **pending operations** list stored in **localStorage** (or IndexedDB for large payloads). Each entry might have: `id`, `type` (e.g. `'insert'` / `'update'`), `table`, `payload`, `status` (`'pending'` / `'done'` / `'failed'`), `createdAt`.
- Apply the write **locally** to in-memory state (and optionally to a local cache) so the UI reflects the change immediately.
- When **back online**, process the queue: for each pending op, call your API; on success mark `status: 'done'` and remove or leave for history; on conflict (e.g. 409) you can mark as conflict and show a conflict-resolution UI.

### 3.4 Sync when back online

- In the **`online`** handler:
  1. Call your **processPendingOps** (or equivalent) to flush the queue to the server.
  2. Refresh data (e.g. reload from API or refetch critical tables).
  3. Update “last sync” and pending count in the UI.
- Optionally also run **processPendingOps** on a timer (e.g. every 5 minutes) while online, so any stragglers get synced.

### 3.5 Optional: Background Sync (service worker)

- In the SW: listen for `sync` event with a tag (e.g. `'my-app-sync'`).
- In the handler, use `event.waitUntil(doBackgroundSync())`. In `doBackgroundSync` you can `self.clients.matchAll()` and `client.postMessage({ type: 'BACKGROUND_SYNC' })` so the open tab runs its sync logic (e.g. processPendingOps).
- From the **main app**, when you add a pending op while offline, get the SW registration and call `registration.sync.register('my-app-sync')`. When the browser decides to run the sync (e.g. when connection is back), the SW will fire the sync event and notify the client.
- The actual API calls stay in the main app; the SW only triggers “please sync now.”

### 3.6 Optional: Connection quality

- You can ping your backend (e.g. lightweight request or health endpoint) and measure latency to show “Good / Slow / Offline” in the UI.
- Use `navigator.onLine` plus this check to set a connection state; when quality is “offline” or request fails, treat as offline and use cache + pending queue.

---

## Part 4: Checklist for another app

| Step | What to do |
|------|------------|
| 1 | Add `public/manifest.json` (name, short_name, start_url, display, icons, theme_color, background_color). |
| 2 | In `index.html`: `<link rel="manifest" href="/manifest.json">` + Apple meta tags + theme-color. |
| 3 | Add `public/sw.js` with install (precache), activate (cleanup + claim), and fetch (static + API strategies). |
| 4 | Register the SW from app entry: `navigator.serviceWorker.register('/sw.js')` on load. |
| 5 | Deploy over HTTPS. |
| 6 | (Offline) Detect online/offline with `navigator.onLine` and `online`/`offline` events. |
| 7 | (Offline) Queue writes in localStorage/IndexedDB when offline; replay on `online` and optionally on a timer. |
| 8 | (Optional) Background Sync: SW `sync` event + `postMessage` to client; client calls `registration.sync.register(...)` when queueing offline ops. |
| 9 | (Optional) API cache cleanup: message from app to SW to delete old API cache entries. |

---

## Part 5: File summary (this repo)

| File | Role |
|------|------|
| `public/manifest.json` | PWA manifest (install, icons, display). |
| `index.html` | Manifest link, theme-color, Apple meta tags. |
| `public/sw.js` | Precaching, two caches (static + API), fetch strategies, Background Sync, message handlers (SKIP_WAITING, CLEANUP_API_CACHE, REGISTER_SYNC). |
| `index.tsx` | Registers `/sw.js` after load. |
| `lib/db.ts` | Pending ops queue (read/write from localStorage), `processPendingOps()`, `isOnline()`. |
| `lib/supabase.ts` | Connection quality, `navigator.onLine`, subscription for connection state. |
| `App.tsx` | `online`/`offline` listeners, calls `processPendingOps()` on online and on a 5‑minute timer when online, loads data and shows pending/conflict UI. |

Using this, you can implement install, caching, and offline behavior in another app by replicating the manifest, HTML meta/link, service worker behavior, registration, and app-side offline queue + sync logic.
