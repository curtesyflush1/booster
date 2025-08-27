// BoosterBeacon Service Worker for Push Notifications
const CACHE_NAME = 'booster-beacon-v1';
const STATIC_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated successfully');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('Service Worker activation failed:', error);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'BoosterBeacon Alert',
    body: 'New product alert available',
    icon: '/icons/notification-icon-192.png',
    badge: '/icons/badge-72.png',
    data: {
      alertId: 'unknown',
      productId: 'unknown',
      retailerId: 'unknown',
      productUrl: 'https://boosterbeacon.com',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: '👀 View Product',
        icon: '/icons/view-icon.png'
      }
    ],
    requireInteraction: false,
    tag: 'booster-beacon-alert',
    renotify: true
  };

  // Parse notification data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
      console.log('Parsed notification payload:', payload);
    } catch (error) {
      console.error('Failed to parse push notification data:', error);
    }
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      image: notificationData.image,
      data: notificationData.data,
      actions: notificationData.actions,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
      tag: notificationData.tag,
      renotify: notificationData.renotify,
      timestamp: notificationData.data.timestamp,
      vibrate: [200, 100, 200] // Vibration pattern for mobile
    })
    .then(() => {
      console.log('Notification displayed successfully');
      
      // Track notification display (optional analytics)
      if (notificationData.data.alertId !== 'unknown') {
        trackNotificationEvent('displayed', notificationData.data.alertId);
      }
    })
    .catch((error) => {
      console.error('Failed to show notification:', error);
    })
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Close the notification
  notification.close();

  // Track click event
  if (data.alertId && data.alertId !== 'unknown') {
    trackNotificationEvent('clicked', data.alertId, action);
  }

  // Handle different actions
  let targetUrl = data.productUrl || 'https://boosterbeacon.com';

  if (action === 'cart' && data.cartUrl) {
    targetUrl = data.cartUrl;
  } else if (action === 'view') {
    targetUrl = data.productUrl || 'https://boosterbeacon.com';
  } else if (!action) {
    // Default click behavior - open product page or cart if available
    targetUrl = data.cartUrl || data.productUrl || 'https://boosterbeacon.com';
  }

  // Open or focus the target URL
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if the target URL is already open
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            console.log('Focusing existing window:', targetUrl);
            return client.focus();
          }
        }

        // Open new window if not already open
        if (clients.openWindow) {
          console.log('Opening new window:', targetUrl);
          return clients.openWindow(targetUrl);
        }
      })
      .catch((error) => {
        console.error('Failed to handle notification click:', error);
      })
  );
});

// Notification close event - track dismissals
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);

  const notification = event.notification;
  const data = notification.data || {};

  // Track dismissal event
  if (data.alertId && data.alertId !== 'unknown') {
    trackNotificationEvent('dismissed', data.alertId);
  }
});

// Background sync event - handle offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'notification-interaction') {
    event.waitUntil(syncNotificationInteractions());
  }
});

// Helper function to track notification events
function trackNotificationEvent(eventType, alertId, action = null) {
  try {
    const eventData = {
      type: 'notification_event',
      eventType,
      alertId,
      action,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    // Store event for later sync if offline
    if ('indexedDB' in self) {
      storeEventForSync(eventData);
    }

    // Try to send immediately if online
    if (navigator.onLine) {
      sendEventToServer(eventData);
    }
  } catch (error) {
    console.error('Failed to track notification event:', error);
  }
}

// Store event in IndexedDB for offline sync
function storeEventForSync(eventData) {
  // This would implement IndexedDB storage for offline events
  // For now, we'll just log it
  console.log('Storing event for sync:', eventData);
}

// Send event to server
function sendEventToServer(eventData) {
  fetch('/api/analytics/notification-events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventData)
  })
  .then(response => {
    if (response.ok) {
      console.log('Event sent to server successfully');
    } else {
      console.warn('Failed to send event to server:', response.status);
    }
  })
  .catch(error => {
    console.error('Network error sending event:', error);
  });
}

// Sync notification interactions when back online
function syncNotificationInteractions() {
  // This would sync stored events from IndexedDB
  // For now, we'll just resolve
  return Promise.resolve();
}

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);

  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;
    
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;
    
    default:
      console.log('Unknown message type:', type);
  }
});

// Error event - handle service worker errors
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

// Unhandled rejection event
self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('BoosterBeacon Service Worker loaded successfully');