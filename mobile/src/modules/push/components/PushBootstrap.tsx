import { useEffect } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { pushSupport, refreshPushRegistration } from "../services/push";
import { routeForNotification } from "../utils/route";

// A notification can be seen twice: once by the live listener and once as "the notification that
// launched the app". Remember what was handled so a tap never navigates twice.
const handled = new Set<string>();

/**
 * Mounted once at the root. Shows a notification that arrives while the app is open, opens the right
 * screen when one is tapped (including the tap that launched the app), and keeps a phone that already
 * turned push on registered. It asks for no permission itself: that happens on the settings screen,
 * when the parent chooses to turn notifications on.
 */
export function PushBootstrap() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (pushSupport() !== "supported") return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const open = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      router.push(
        routeForNotification(response.notification.request.content.data as Record<string, unknown>)
      );
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) open(response);
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (userId) void refreshPushRegistration(userId);
  }, [userId]);

  return null;
}
