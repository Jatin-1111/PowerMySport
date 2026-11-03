"use client";

import { pushNotificationService } from "@/lib/api/push";
import { toast } from "@/lib/toast";
import { Button } from "../ui/Button";
import { StatusTag } from "../ui/StatusTag";
import { TEXT_LINK } from "../ui/textLink";
import { ProfileSection } from "./settings/ProfileSection";
import { useEffect, useState } from "react";

const SUBSCRIPTION_CHECK_MS = 1500;

/**
 * Whether this browser gets push notifications, as a ruled section: where it
 * stands in a tag, one sentence on what that means, then only the actions that
 * apply. A blocked browser gets the three steps to unblock it as plain text.
 */
export function PushNotificationPermission() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    try {
      const supported = pushNotificationService.isSupported();
      setIsSupported(supported);

      if (!supported) {
        setLoading(false);
        return;
      }

      const currentPermission = await pushNotificationService.getPermissionStatus();
      setPermission(currentPermission);

      // `serviceWorker.ready` never settles when no service worker has been
      // registered, which is the state of anyone who has not turned push on. Treat
      // "no answer yet" as "not subscribed" so the Turn on button can appear.
      const subscription = await Promise.race([
        pushNotificationService.getSubscription(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SUBSCRIPTION_CHECK_MS)),
      ]);
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Error checking push status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnablePush = async () => {
    setActionLoading(true);
    try {
      await pushNotificationService.subscribe();
      setPermission("granted");
      setIsSubscribed(true);
      toast.success("Push notifications enabled");

      // Send a test notification
      setTimeout(() => {
        pushNotificationService.sendTestNotification(
          "Push Notifications Enabled",
          "You will now receive real-time notifications from PowerMySport"
        );
      }, 1000);
    } catch (error) {
      console.error("Failed to enable push notifications:", error);
      if (error instanceof Error && error.message.includes("permission denied")) {
        toast.error("Notification permission denied");
      } else {
        toast.error("Failed to enable push notifications");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setActionLoading(true);
    try {
      await pushNotificationService.unsubscribe();
      setIsSubscribed(false);
      toast.success("Push notifications disabled");
    } catch (error) {
      console.error("Failed to disable push notifications:", error);
      toast.error("Failed to disable push notifications");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await pushNotificationService.sendTestNotification(
        "Test Notification",
        "This is a test notification from PowerMySport"
      );
      toast.success("Test notification sent");
    } catch (error) {
      console.error("Failed to send test notification:", error);
      toast.error("Failed to send test notification");
    }
  };

  const status = loading
    ? null
    : !isSupported
      ? { tone: "neutral" as const, tag: "Not supported" }
      : isSubscribed
        ? { tone: "live" as const, tag: "On" }
        : permission === "denied"
          ? { tone: "alert" as const, tag: "Blocked" }
          : { tone: "neutral" as const, tag: "Off" };

  return (
    <ProfileSection
      id="push"
      title="Push on this browser"
      description="Instant updates, even when PowerMySport is closed."
    >
      {loading ? (
        <p className="text-ink-body" role="status">
          Checking this browser.
        </p>
      ) : (
        <div className="max-w-xl">
          {status && <StatusTag tone={status.tone}>{status.tag}</StatusTag>}

          <p className="text-ink-body mt-3 text-pretty">
            {!isSupported
              ? "This browser does not support push notifications. Chrome, Firefox, Edge and Safari do."
              : isSubscribed
                ? "You are receiving push notifications on this device. Choose which ones in the table below."
                : permission === "denied"
                  ? "Push notifications are blocked for this site, so we cannot turn them on from here."
                  : "Turn them on to get an alert as soon as something needs you."}
          </p>

          {isSupported && permission === "denied" && !isSubscribed && (
            <ol className="text-ink-body mt-3 list-decimal space-y-1 pl-5 text-sm">
              <li>Click the lock icon in your browser&apos;s address bar.</li>
              <li>Find Notifications and set it to Allow.</li>
              <li>Refresh this page and try again.</li>
            </ol>
          )}

          {isSupported && (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
              {!isSubscribed && permission !== "denied" && (
                <Button onClick={handleEnablePush} disabled={actionLoading} className="min-h-11">
                  {actionLoading ? "Turning on" : "Turn on push"}
                </Button>
              )}
              {isSubscribed && (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleDisablePush}
                    disabled={actionLoading}
                    className="min-h-11"
                  >
                    {actionLoading ? "Turning off" : "Turn off push"}
                  </Button>
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm`}
                  >
                    Send a test
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </ProfileSection>
  );
}
