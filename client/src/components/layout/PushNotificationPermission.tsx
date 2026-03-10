"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { pushNotificationService } from "@/lib/api/push";
import {
  Bell,
  BellOff,
  Smartphone,
  AlertCircle,
  CheckCircle,
  Lightbulb,
} from "lucide-react";
import { toast } from "@/lib/toast";

export function PushNotificationPermission() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
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

      const currentPermission =
        await pushNotificationService.getPermissionStatus();
      setPermission(currentPermission);

      const subscription = await pushNotificationService.getSubscription();
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
      toast.success("Push notifications enabled successfully!");

      // Send a test notification
      setTimeout(() => {
        pushNotificationService.sendTestNotification(
          "Push Notifications Enabled",
          "You will now receive real-time notifications from PowerMySport",
        );
      }, 1000);
    } catch (error) {
      console.error("Failed to enable push notifications:", error);
      if (
        error instanceof Error &&
        error.message.includes("permission denied")
      ) {
        toast.error(
          "Notification permission denied. Please enable notifications in your browser settings.",
        );
      } else {
        toast.error("Failed to enable push notifications. Please try again.");
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
      toast.success("Push notifications disabled successfully");
    } catch (error) {
      console.error("Failed to disable push notifications:", error);
      toast.error("Failed to disable push notifications. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await pushNotificationService.sendTestNotification(
        "Test Notification",
        "This is a test notification from PowerMySport",
      );
      toast.success("Test notification sent!");
    } catch (error) {
      console.error("Failed to send test notification:", error);
      toast.error("Failed to send test notification");
    }
  };

  if (loading) {
    return (
      <Card className="bg-white">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <Smartphone className="text-slate-400" size={20} />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Push Notifications
              </h3>
              <p className="text-sm text-slate-600">Loading...</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card className="border-l-4 border-l-slate-400 bg-white">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 text-slate-500" size={20} />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900">
                Push Notifications Not Supported
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Your browser does not support push notifications. Please use a
                modern browser like Chrome, Firefox, Edge, or Safari.
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`border-l-4 bg-white ${
        isSubscribed
          ? "border-l-green-500"
          : permission === "denied"
            ? "border-l-red-500"
            : "border-l-power-orange"
      }`}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={`rounded-full p-2 ${
              isSubscribed
                ? "bg-green-100"
                : permission === "denied"
                  ? "bg-red-100"
                  : "bg-power-orange/10"
            }`}
          >
            {isSubscribed ? (
              <Bell className="text-green-600" size={20} />
            ) : (
              <BellOff
                className={
                  permission === "denied" ? "text-red-600" : "text-power-orange"
                }
                size={20}
              />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Browser Push Notifications
              </h3>
              {isSubscribed && (
                <div className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <CheckCircle size={12} />
                  Active
                </div>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-600">
              {isSubscribed
                ? "You're receiving real-time push notifications on this device."
                : permission === "denied"
                  ? "Push notifications are blocked. Please enable them in your browser settings."
                  : "Get instant notifications even when PowerMySport is closed."}
            </p>

            {permission === "denied" && (
              <div className="mt-3 rounded-lg bg-red-50 p-3">
                <p className="text-xs text-red-800">
                  <strong>To enable push notifications:</strong>
                  <br />
                  1. Click the lock icon in your browser&apos;s address bar
                  <br />
                  2. Find &quot;Notifications&quot; and set to &quot;Allow&quot;
                  <br />
                  3. Refresh this page and try again
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!isSubscribed && permission !== "denied" && (
                <Button
                  onClick={handleEnablePush}
                  disabled={actionLoading}
                  size="sm"
                >
                  <Bell size={16} className="mr-2" />
                  {actionLoading ? "Enabling..." : "Enable Push Notifications"}
                </Button>
              )}

              {isSubscribed && (
                <>
                  <Button
                    onClick={handleDisablePush}
                    disabled={actionLoading}
                    variant="outline"
                    size="sm"
                  >
                    <BellOff size={16} className="mr-2" />
                    {actionLoading ? "Disabling..." : "Disable"}
                  </Button>
                  <Button
                    onClick={handleTestNotification}
                    variant="outline"
                    size="sm"
                  >
                    <Smartphone size={16} className="mr-2" />
                    Send Test
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {isSubscribed && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5" /> <strong>Tip:</strong>
              </span>{" "}
              You can manage which notifications you receive via push in the
              notification preferences table below.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
