const CACHE_NAME = 'farm-cashbook-v1';
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

// Fetch event - serve from cache when offline with better error handling
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the response for future use
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => {
                console.warn('Failed to cache response:', err);
              });

            return response;
          })
          .catch((error) => {
            console.warn('Fetch failed:', error);
            // Return a fallback response for navigation requests
            if (event.request.destination === 'document') {
              return caches.match('/') || new Response('Offline', { status: 503 });
            }
            throw error;
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

