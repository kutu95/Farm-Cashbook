const CACHE_NAME = 'farm-cashbook-v2'; // Updated to force cache refresh
const urlsToCache = [
  '/',
  '/dashboard',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

// Check if we're in development mode
const isDevelopment = self.location.hostname === 'localhost' || 
                     self.location.hostname === '127.0.0.1' || 
                     self.location.hostname.includes('localhost');

// If in development mode, don't cache anything and just pass through requests
if (isDevelopment) {
  console.log('Service worker running in development mode - caching disabled');
  
  // Install event - do nothing in development
  self.addEventListener('install', (event) => {
    console.log('SW install event in development mode - skipping');
    event.waitUntil(self.skipWaiting());
  });

  // Fetch event - just pass through in development
  self.addEventListener('fetch', (event) => {
    // Don't intercept requests in development - just let them pass through
    // No return statement needed - event listener just doesn't call respondWith
  });

  // Activate event - clean up and claim clients
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('Deleting cache in development:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        return self.clients.claim();
      })
    );
  });
  
  // Exit early in development mode - no need to register production handlers
  // The event listeners above will handle everything in dev mode
}

// Install event - cache resources with error handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Cache resources individually to handle failures gracefully
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn(`Failed to cache ${url}:`, err);
              return null; // Continue with other resources
            })
          )
        );
      })
      .then(() => {
        console.log('Cache installation completed');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Fetch event - network-first for HTML, cache-first for static assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  const isHTML = event.request.destination === 'document' || 
                 event.request.headers.get('accept')?.includes('text/html');
  const isStaticAsset = url.pathname.startsWith('/_next/static/') ||
                       url.pathname.startsWith('/icon-') ||
                       url.pathname.endsWith('.png') ||
                       url.pathname.endsWith('.jpg') ||
                       url.pathname.endsWith('.css') ||
                       url.pathname.endsWith('.js') ||
                       url.pathname === '/manifest.json';

  // For HTML pages: Network-first strategy (always try network first)
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If network succeeds, update cache and return response
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => {
                console.warn('Failed to cache response:', err);
              });
          }
          return response;
        })
        .catch((error) => {
          // Network failed, try cache as fallback
          console.warn('Network request failed, trying cache:', error);
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // No cache available, return offline page
              if (event.request.destination === 'document') {
                return caches.match('/') || new Response('Offline - Please check your connection', { 
                  status: 503,
                  headers: { 'Content-Type': 'text/html' }
                });
              }
              throw error;
            });
        })
    );
    return;
  }

  // For static assets: Cache-first strategy (faster loading)
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version immediately
            // Also fetch in background to update cache
            fetch(event.request)
              .then((response) => {
                if (response && response.status === 200) {
                  const responseToCache = response.clone();
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(event.request, responseToCache);
                    });
                }
              })
              .catch(() => {
                // Ignore background fetch errors
              });
            return cachedResponse;
          }

          // Not in cache, fetch from network
          return fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  })
                  .catch(err => {
                    console.warn('Failed to cache response:', err);
                  });
              }
              return response;
            });
        })
    );
    return;
  }

  // For other requests: Network-first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch((error) => {
        return caches.match(event.request)
          .then((cachedResponse) => {
            return cachedResponse || Promise.reject(error);
          });
      })
  );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

