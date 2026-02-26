const CACHE_NAME = 'atlas-helpdesk-v1';
const STATIC_ASSETS = [
  '/',
  '/login',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls - let them go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/trpc/')) {
    return;
  }

  // Cache strategy: Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // If it's a page navigation, show offline page
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }

          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});

// Push notification support
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  if (!event.data) {
    console.log('[SW] No push data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);
    
    const options = {
      body: data.body || 'New notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'default',
      requireInteraction: true,
      actions: data.actions || [],
      data: data.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Atlas Helpdesk',
        options
      ).then(() => {
        console.log('[SW] Notification shown');
      }).catch((err) => {
        console.error('[SW] Failed to show notification:', err);
      })
    );
  } catch (err) {
    console.error('[SW] Error handling push:', err);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { notification } = event;
  const notificationData = notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === notificationData.url && 'focus' in client) {
          return client.focus();
        }
      }

      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(notificationData.url || '/');
      }
    })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tickets') {
    event.waitUntil(syncTicketSubmissions());
  }
});

async function syncTicketSubmissions() {
  // Get pending submissions from IndexedDB and sync them
  // This would be implemented with a more complete offline sync solution
  console.log('Syncing pending ticket submissions...');
}
