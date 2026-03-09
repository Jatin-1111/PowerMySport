// Service Worker for Push Notifications
// This file handles push notification events

const CACHE_NAME = "powermysport-v1";
const urlsToCache = ["/", "/offline.html"];

// Install event - cache resources
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Opened cache");
            return cache.addAll(urlsToCache);
        }),
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log("Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                }),
            );
        }),
    );
    // Take control immediately
    return self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Cache hit - return response
            if (response) {
                return response;
            }
            return fetch(event.request);
        }),
    );
});

// Push event - handle incoming push notifications
self.addEventListener("push", (event) => {
    console.log("Push event received:", event);

    let notificationData = {
        title: "PowerMySport",
        body: "You have a new notification",
        icon: "/android-chrome-192x192.png",
        badge: "/favicon-32x32.png",
        tag: "default",
        data: {},
    };

    // Parse push data if available
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                title: data.title || notificationData.title,
                body: data.message || data.body || notificationData.body,
                icon: data.icon || notificationData.icon,
                badge: data.badge || notificationData.badge,
                tag: data.tag || data.type || notificationData.tag,
                data: data.data || data,
            };
        } catch (error) {
            console.error("Error parsing push data:", error);
            notificationData.body = event.data.text();
        }
    }

    const options = {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        vibrate: [200, 100, 200],
        tag: notificationData.tag,
        requireInteraction: false,
        data: notificationData.data,
        actions: [
            {
                action: "view",
                title: "View",
                icon: "/android-chrome-192x192.png",
            },
            {
                action: "close",
                title: "Dismiss",
            },
        ],
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options),
    );
});

// Notification click event - handle user interaction
self.addEventListener("notificationclick", (event) => {
    console.log("Notification clicked:", event);

    event.notification.close();

    if (event.action === "close") {
        // User dismissed the notification
        return;
    }

    // Handle notification click
    const urlToOpen = event.notification.data?.url || "/notifications";

    event.waitUntil(
        clients
            .matchAll({
                type: "window",
                includeUncontrolled: true,
            })
            .then((windowClients) => {
                // Check if there's already a window open
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url === urlToOpen && "focus" in client) {
                        return client.focus();
                    }
                }
                // If not, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            }),
    );
});

// Notification close event - track dismissals
self.addEventListener("notificationclose", (event) => {
    console.log("Notification closed:", event);
    // Can track analytics here if needed
});

// Message event - handle messages from the main app
self.addEventListener("message", (event) => {
    console.log("Service worker received message:", event.data);

    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }

    if (event.data && event.data.type === "TEST_NOTIFICATION") {
        const options = {
            body: event.data.body || "This is a test notification",
            icon: "/android-chrome-192x192.png",
            badge: "/favicon-32x32.png",
            vibrate: [200, 100, 200],
            tag: "test",
        };

        self.registration.showNotification(
            event.data.title || "Test Notification",
            options,
        );
    }
});
