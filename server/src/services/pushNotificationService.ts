import webpush from "web-push";
import dotenv from "dotenv";

dotenv.config();

// Configure web-push with VAPID details
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || "",
};

const vapidEmail = process.env.VAPID_EMAIL || "mailto:admin@powermysport.com";

// Set VAPID details for web-push
webpush.setVapidDetails(vapidEmail, vapidKeys.publicKey, vapidKeys.privateKey);

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    [key: string]: any;
  };
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Send a push notification to a single subscription
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushNotificationPayload,
): Promise<boolean> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };

    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));

    return true;
  } catch (error: any) {
    console.error("Error sending push notification:", error);

    // Handle specific errors
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription has expired or is no longer valid
      console.log("Subscription expired or invalid:", subscription.endpoint);
      return false;
    }

    throw error;
  }
}

/**
 * Send a push notification to multiple subscriptions
 */
export async function sendPushNotificationToMultiple(
  subscriptions: PushSubscription[],
  payload: PushNotificationPayload,
): Promise<{
  successful: number;
  failed: number;
  expiredEndpoints: string[];
}> {
  const results = {
    successful: 0,
    failed: 0,
    expiredEndpoints: [] as string[],
  };

  const promises = subscriptions.map(async (subscription) => {
    try {
      const success = await sendPushNotification(subscription, payload);
      if (success) {
        results.successful++;
      } else {
        // Subscription expired
        results.failed++;
        results.expiredEndpoints.push(subscription.endpoint);
      }
    } catch (error) {
      results.failed++;
      console.error(
        `Failed to send notification to ${subscription.endpoint}:`,
        error,
      );
    }
  });

  await Promise.allSettled(promises);

  return results;
}

/**
 * Validate VAPID configuration
 */
export function isVapidConfigured(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_EMAIL
  );
}

/**
 * Get VAPID public key
 */
export function getVapidPublicKey(): string {
  return vapidKeys.publicKey;
}

export default {
  sendPushNotification,
  sendPushNotificationToMultiple,
  isVapidConfigured,
  getVapidPublicKey,
};
