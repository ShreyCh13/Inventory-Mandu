// Service Worker for Inventory Mandu PWA
// Enhanced for production with Background Sync and extended offline support
const STATIC_CACHE_NAME = 'inventory-mandu-static-v4';
const API_CACHE_NAME = 'inventory-mandu-api-v2';
const SYNC_TAG = 'inventory-sync';

// Extended cache duration for true offline support (24 hours)
const API_CACHE_DURATION = 24 * 60 * 60 * 1000;

// Static assets to precache
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.error('Service Worker: Cache failed', err);
      })
  );
  // Note: skipWaiting() removed - let users control when to update
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Keep current static and API caches
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Check if URL is a Supabase API request
const isSupabaseRequest = (url) => {
  return url.hostname.includes('supabase.co') && url.pathname.includes('/rest/');
};

// Check if cached response is still valid
const isCacheValid = (response, maxAge = API_CACHE_DURATION) => {
  if (!response) return false;
  
  const cachedTime = response.headers.get('sw-cached-time');
  if (!cachedTime) return false;
  
  const age = Date.now() - parseInt(cachedTime, 10);
  return age < maxAge;
};

// Fetch event - smart caching strategy
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // Handle Supabase API requests with network-first, cache-fallback
  if (isSupabaseRequest(url)) {
    event.respondWith(
      (async () => {
        try {
          // Try network first with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
          
          const networkResponse = await fetch(event.request, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (networkResponse.ok) {
            // Clone response and add cache timestamp
            const responseToCache = networkResponse.clone();
            const cache = await caches.open(API_CACHE_NAME);
            
            // Create new response with timestamp header
            const headers = new Headers(responseToCache.headers);
            headers.set('sw-cached-time', Date.now().toString());
            
            const body = await responseToCache.blob();
            const cachedResponse = new Response(body, {
              status: responseToCache.status,
              statusText: responseToCache.statusText,
              headers: headers
            });
            
            await cache.put(event.request, cachedResponse);
          }
          
          return networkResponse;
        } catch (error) {
          // Network failed, try cache (even if stale for offline support)
          console.log('Service Worker: Network failed, trying cache for', url.pathname);
          const cache = await caches.open(API_CACHE_NAME);
          const cachedResponse = await cache.match(event.request);
          
          if (cachedResponse) {
            console.log('Service Worker: Serving from cache (possibly stale)', url.pathname);
            return cachedResponse;
          }
          
          // Return error response if no cache
          return new Response(JSON.stringify({ error: 'Offline and no cached data' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
    return;
  }

  // Skip external requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first for HTML/navigation to avoid stale UI
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put('/index.html', responseToCache);
          });
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, images), with background refresh
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(STATIC_CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => cached); // Return cached on network failure

      return cached || fetchPromise;
    })
  );
});

// Background Sync - process pending operations when back online
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

// Background sync implementation
async function doBackgroundSync() {
  try {
    // Notify all clients to process pending ops
    const clients = await self.clients.matchAll({ type: 'window' });
    
    for (const client of clients) {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        message: 'Processing pending operations...'
      });
    }
    
    // The actual sync is handled by the main app
    // This just triggers the notification to clients
    console.log('Service Worker: Background sync notification sent to', clients.length, 'clients');
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
    throw error; // Rethrow to retry later
  }
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEANUP_API_CACHE') {
    caches.open(API_CACHE_NAME).then(async (cache) => {
      const requests = await cache.keys();
      const now = Date.now();
      
      // Clean entries older than 48 hours
      const maxAge = 48 * 60 * 60 * 1000;
      
      for (const request of requests) {
        const response = await cache.match(request);
        const cachedTime = response?.headers.get('sw-cached-time');
        
        if (cachedTime && now - parseInt(cachedTime, 10) > maxAge) {
          console.log('Service Worker: Removing stale cache entry', request.url);
          await cache.delete(request);
        }
      }
    });
  }
  
  // Register for background sync when requested
  if (event.data && event.data.type === 'REGISTER_SYNC') {
    self.registration.sync.register(SYNC_TAG)
      .then(() => console.log('Service Worker: Background sync registered'))
      .catch((err) => console.warn('Service Worker: Background sync registration failed', err));
  }
});

// Periodic sync (if supported) - check for pending ops every 12 hours
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'inventory-periodic-sync') {
    event.waitUntil(doBackgroundSync());
  }
});
