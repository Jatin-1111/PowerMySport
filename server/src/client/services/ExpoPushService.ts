import { Types } from "mongoose";
import { DevicePushToken, type DevicePlatform } from "../models/DevicePushToken";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("expoPush");

/**
 * Push notifications to phones, through Expo's push service.
 *
 * Expo takes a device's token and forwards the message to Google (Android) or Apple (iOS), so the
 * server holds no Firebase or APNs credentials of its own. Those live in the EAS project the app is
 * built with. Web browsers keep using `pushNotificationService` (web-push); this is the phone path.
 *
 * Sending is a two step exchange. The send call returns a "ticket" per message: an error here means
 * Expo rejected it outright. A later receipts call says whether Google or Apple accepted it, and is
 * where `DeviceNotRegistered` (the app was uninstalled) shows up. Both paths drop the dead token so
 * it is not tried again.
 */

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

/** Expo accepts up to 100 messages per request. */
const CHUNK_SIZE = 100;

/** Receipts are ready a few minutes after sending; Expo asks callers to wait at least 15. */
const RECEIPT_DELAY_MS = 15 * 60 * 1000;

/** A person with more phones than this has the oldest ones dropped when a new one registers. */
export const MAX_DEVICES_PER_USER = 8;

/** The one Android notification channel the app creates, so every message lands in it. */
export const ANDROID_CHANNEL_ID = "default";

const TOKEN_PATTERN = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$/;

export const isExpoPushToken = (value: unknown): value is string =>
  typeof value === "string" && TOKEN_PATTERN.test(value);

// Replaceable in tests, so no test ever calls Expo.
type Fetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;
let doFetch: Fetch = (url, init) => fetch(url, init) as unknown as ReturnType<Fetch>;
export const setExpoFetchForTests = (replacement: Fetch | null): void => {
  doFetch = replacement ?? ((url, init) => fetch(url, init) as unknown as ReturnType<Fetch>);
};

/** Switched off with EXPO_PUSH_ENABLED=false, for a machine that must never message real phones. */
const enabled = (): boolean => process.env.EXPO_PUSH_ENABLED !== "false";

const headers = (): Record<string, string> => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  // Optional. Turning on "enhanced push security" for the project in Expo makes it required.
  ...(process.env.EXPO_ACCESS_TOKEN
    ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
    : {}),
});

export interface DevicePushPayload {
  title: string;
  body: string;
  /** Shown to the app when a notification is tapped. Keep it small: Expo caps a message near 4 KB. */
  data?: Record<string, unknown>;
}

interface Ticket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export const ExpoPushService = {
  /**
   * Remember a phone for an account. The token is unique to the device, so a token that already
   * exists is moved to this account and its last-seen time refreshed (a second person signing in on
   * the same phone, or the app registering again on launch).
   */
  async register(
    userId: string,
    input: {
      token: string;
      platform: DevicePlatform;
      deviceName?: string | undefined;
      appVersion?: string | undefined;
    }
  ): Promise<void> {
    const owner = new Types.ObjectId(userId);
    await DevicePushToken.updateOne(
      { token: input.token },
      {
        $set: {
          userId: owner,
          platform: input.platform,
          lastSeenAt: new Date(),
          ...(input.deviceName ? { deviceName: input.deviceName } : {}),
          ...(input.appVersion ? { appVersion: input.appVersion } : {}),
        },
        $setOnInsert: { token: input.token },
      },
      { upsert: true }
    );

    // Keep the newest few. A parent with a new phone every year should not accumulate dead ones.
    const mine = await DevicePushToken.find({ userId: owner })
      .sort({ lastSeenAt: -1 })
      .select("_id")
      .lean();
    if (mine.length > MAX_DEVICES_PER_USER) {
      await DevicePushToken.deleteMany({
        _id: { $in: mine.slice(MAX_DEVICES_PER_USER).map((d) => d._id) },
      });
    }
  },

  /** Stop notifying a phone. Only the account that owns the token can remove it. */
  async unregister(userId: string, token: string): Promise<boolean> {
    const result = await DevicePushToken.deleteOne({ token, userId: new Types.ObjectId(userId) });
    return result.deletedCount > 0;
  },

  /** Forget every phone for an account, for account deletion. */
  async removeAllForUser(userId: string): Promise<number> {
    const result = await DevicePushToken.deleteMany({ userId: new Types.ObjectId(userId) });
    return result.deletedCount ?? 0;
  },

  /** Send to every phone the account has registered. Never throws: a failed push must not fail the caller. */
  async sendToUser(
    userId: string,
    payload: DevicePushPayload
  ): Promise<{ sent: number; removed: number }> {
    if (!enabled()) return { sent: 0, removed: 0 };
    try {
      const devices = await DevicePushToken.find({ userId: new Types.ObjectId(userId) })
        .select("token platform")
        .lean();
      const valid = devices.filter((d) => isExpoPushToken(d.token));
      if (valid.length === 0) return { sent: 0, removed: 0 };

      let sent = 0;
      let removed = 0;
      const pendingReceipts: Array<{ id: string; token: string }> = [];
      const dead: string[] = [];

      for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
        const chunk = valid.slice(i, i + CHUNK_SIZE);
        const messages = chunk.map((d) => ({
          to: d.token,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          sound: "default",
          priority: "high",
          channelId: ANDROID_CHANNEL_ID,
        }));

        const response = await doFetch(EXPO_SEND_URL, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(messages),
        });
        if (!response.ok) {
          log.warn(`Expo push send failed with HTTP ${response.status}`);
          continue;
        }
        const body = (await response.json()) as { data?: Ticket[] };
        (body.data ?? []).forEach((ticket, index) => {
          const token = chunk[index]?.token;
          if (!token) return;
          if (ticket.status === "ok") {
            sent += 1;
            if (ticket.id) pendingReceipts.push({ id: ticket.id, token });
          } else if (ticket.details?.error === "DeviceNotRegistered") {
            dead.push(token);
          } else {
            log.warn(
              `Expo push rejected for a device: ${ticket.details?.error ?? ticket.message ?? "unknown"}`
            );
          }
        });
      }

      // A Mongoose query only runs when awaited, so the dead tokens are deleted here, not fire and forget.
      if (dead.length > 0) {
        await DevicePushToken.deleteMany({ token: { $in: dead } });
        removed += dead.length;
      }

      if (pendingReceipts.length > 0) this.scheduleReceiptCheck(pendingReceipts);
      return { sent, removed };
    } catch (error) {
      log.error("Failed to send push to devices:", error);
      return { sent: 0, removed: 0 };
    }
  },

  /**
   * Ask Expo, after the recommended delay, whether Google or Apple took each message. An uninstalled
   * app only shows up here. Best effort and in memory: a restart in the 15 minutes loses the check,
   * and the token is then removed the next time a ticket reports it, or by the 120 day TTL.
   */
  scheduleReceiptCheck(pending: Array<{ id: string; token: string }>): void {
    const timer = setTimeout(() => void this.checkReceipts(pending), RECEIPT_DELAY_MS);
    timer.unref?.();
  },

  async checkReceipts(pending: Array<{ id: string; token: string }>): Promise<number> {
    let removed = 0;
    try {
      for (let i = 0; i < pending.length; i += 300) {
        const chunk = pending.slice(i, i + 300);
        const response = await doFetch(EXPO_RECEIPTS_URL, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ ids: chunk.map((p) => p.id) }),
        });
        if (!response.ok) continue;
        const body = (await response.json()) as { data?: Record<string, Ticket> };
        for (const { id, token } of chunk) {
          const receipt = body.data?.[id];
          if (receipt?.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
            await DevicePushToken.deleteOne({ token });
            removed += 1;
          }
        }
      }
    } catch (error) {
      log.error("Failed to check Expo push receipts:", error);
    }
    return removed;
  },
};
