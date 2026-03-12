import axios from "./axios";

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt?: string;
}

export interface PushSubscriptionResponse {
  success: boolean;
  data: PushSubscription | PushSubscription[];
  message?: string;
}

let cachedVapidPublicKey: string | null =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushNotificationService = {
  /**
   * Resolve VAPID public key from backend/runtime config
   */
  getVapidPublicKey: async (): Promise<string> => {
    if (cachedVapidPublicKey) {
      return cachedVapidPublicKey;
    }

    const response = await axios.get<{
      success: boolean;
      data?: {
        configured?: boolean;
        publicKey?: string | null;
      };
    }>("/notifications/push/vapid-status");

    const publicKey = response.data?.data?.publicKey;
    if (!publicKey) {
      throw new Error("Push is not configured on the server");
    }

    cachedVapidPublicKey = publicKey;
    return publicKey;
  },

  /**
   * Check if push notifications are supported
   */
  isSupported: (): boolean => {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  },

  /**
   * Get current notification permission status
   */
  getPermissionStatus: async (): Promise<NotificationPermission> => {
    if (!pushNotificationService.isSupported()) {
      return "denied";
    }
    return Notification.permission;
  },

  /**
   * Request notification permission from user
   */
  requestPermission: async (): Promise<NotificationPermission> => {
    if (!pushNotificationService.isSupported()) {
      throw new Error("Push notifications are not supported in this browser");
    }

    const permission = await Notification.requestPermission();
    return permission;
  },

  /**
   * Register service worker
   */
  registerServiceWorker: async (): Promise<ServiceWorkerRegistration> => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported in this browser");
    }

    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    return registration;
  },

  /**
   * Subscribe to push notifications
   */
  subscribe: async (): Promise<PushSubscription> => {
    try {
      // Check support
      if (!pushNotificationService.isSupported()) {
        throw new Error("Push notifications are not supported");
      }

      // Request permission
      const permission = await pushNotificationService.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission denied");
      }

      // Register service worker
      const registration =
        await pushNotificationService.registerServiceWorker();

      const vapidPublicKey = await pushNotificationService.getVapidPublicKey();

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as BufferSource,
      });

      // Convert to plain object
      const subscriptionObject = subscription.toJSON();
      const pushSubscription: PushSubscription = {
        endpoint: subscriptionObject.endpoint!,
        keys: {
          p256dh: subscriptionObject.keys!.p256dh!,
          auth: subscriptionObject.keys!.auth!,
        },
        userAgent: navigator.userAgent,
      };

      // Send subscription to backend
      const response = await axios.post<PushSubscriptionResponse>(
        "/notifications/push/subscribe",
        pushSubscription,
      );

      return response.data.data as PushSubscription;
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      throw error;
    }
  },

  /**
   * Unsubscribe from push notifications
   */
  unsubscribe: async (): Promise<void> => {
    try {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove subscription from backend
        await axios.delete("/notifications/push/unsubscribe", {
          data: {
            endpoint: subscription.endpoint,
          },
        });
      }
    } catch (error) {
      console.error("Failed to unsubscribe from push notifications:", error);
      throw error;
    }
  },

  /**
   * Get current subscription
   */
  getSubscription: async (): Promise<PushSubscription | null> => {
    try {
      if (!("serviceWorker" in navigator)) {
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        return null;
      }

      const subscriptionObject = subscription.toJSON();
      return {
        endpoint: subscriptionObject.endpoint!,
        keys: {
          p256dh: subscriptionObject.keys!.p256dh!,
          auth: subscriptionObject.keys!.auth!,
        },
      };
    } catch (error) {
      console.error("Failed to get push subscription:", error);
      return null;
    }
  },

  /**
   * Get all subscriptions from backend
   */
  getSubscriptions: async (): Promise<PushSubscription[]> => {
    try {
      const response = await axios.get<PushSubscriptionResponse>(
        "/notifications/push/subscriptions",
      );
      return response.data.data as PushSubscription[];
    } catch (error) {
      console.error("Failed to get push subscriptions:", error);
      return [];
    }
  },

  /**
   * Test sending a notification (for development)
   */
  sendTestNotification: async (title: string, body: string): Promise<void> => {
    if (!pushNotificationService.isSupported()) {
      console.error("Notifications are not supported");
      return;
    }

    if (Notification.permission !== "granted") {
      console.error("Notification permission not granted");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      tag: "test-notification",
    });
  },
};
