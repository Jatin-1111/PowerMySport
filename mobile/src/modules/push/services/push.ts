import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants, { ExecutionEnvironment } from "expo-constants";
import apiClient from "@lib/api/axios";
import { storage } from "@/utils/storage";

// Phone push through Expo: the app asks the parent's permission, gets an Expo push token for this
// phone, and tells the server, which sends to it (server/src/client/services/ExpoPushService.ts).

const TOKEN_KEY = "pms_push_token";
const OWNER_KEY = "pms_push_owner";
/** The Android channel every message lands in. The server sends channelId "default". */
const CHANNEL_ID = "default";

export type PushSupport = "supported" | "expo-go" | "not-a-phone" | "web";

/**
 * Whether this build can receive push at all. Expo Go on Android stopped supporting remote push in
 * SDK 53, so the app says so plainly instead of failing; a development build or the store build works.
 */
export function pushSupport(): PushSupport {
  if (Platform.OS === "web") return "web";
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return "expo-go";
  if (!Device.isDevice) return "not-a-phone";
  return "supported";
}

export type PushPermission = "granted" | "denied" | "undetermined";

export async function pushPermission(): Promise<PushPermission> {
  if (pushSupport() !== "supported") return "undetermined";
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

export type EnableResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unsupported" | "permission-denied" | "no-project" | "failed";
      message: string;
    };

function projectId(): string | undefined {
  // Set when the project is linked to EAS (`eas init`). Without it Expo cannot issue a token.
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;
  return fromConfig ?? Constants.easConfig?.projectId;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  // Android 13 and later will not even show the permission prompt until a channel exists.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#C2410C",
  });
}

async function sendToServer(token: string): Promise<void> {
  await apiClient.post("/notifications/push/device", {
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
    deviceName: Device.modelName ?? undefined,
    appVersion: Constants.expoConfig?.version,
  });
}

/** Asks permission if needed, then registers this phone for the signed-in parent. */
export async function enablePush(userId: string): Promise<EnableResult> {
  if (pushSupport() !== "supported") {
    return {
      ok: false,
      reason: "unsupported",
      message:
        "Push notifications need the full PowerMySport app. They do not work in Expo Go or on an emulator.",
    };
  }
  try {
    await ensureChannel();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") {
      return {
        ok: false,
        reason: "permission-denied",
        message: "Notifications are turned off for PowerMySport in your phone's settings.",
      };
    }
    const id = projectId();
    if (!id) {
      return {
        ok: false,
        reason: "no-project",
        message:
          "This build is not linked to an Expo project yet, so it cannot receive push notifications.",
      };
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await sendToServer(token);
    await storage.set(TOKEN_KEY, token);
    await storage.set(OWNER_KEY, userId);
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "failed",
      message: "Could not turn on notifications just now. Please try again.",
    };
  }
}

/** Is this phone set up to receive push for this account? */
export async function isPushOn(userId: string): Promise<boolean> {
  const [token, owner] = await Promise.all([
    storage.get<string>(TOKEN_KEY),
    storage.get<string>(OWNER_KEY),
  ]);
  return Boolean(token) && owner === userId && (await pushPermission()) === "granted";
}

/**
 * Registers again on each launch for a parent who already turned push on. The server uses the time
 * to drop phones that have not opened the app in 120 days, and Expo can issue a new token.
 */
export async function refreshPushRegistration(userId: string): Promise<void> {
  if (pushSupport() !== "supported") return;
  const owner = await storage.get<string>(OWNER_KEY);
  // Only the parent who turned it on: another account on the same phone has to opt in itself.
  if (owner !== userId) return;
  if ((await pushPermission()) !== "granted") return;
  await enablePush(userId);
}

/** Stops notifications to this phone: tells the server, and forgets the token here. */
export async function disablePush(keepOwner = false): Promise<void> {
  const token = await storage.get<string>(TOKEN_KEY);
  if (token) {
    try {
      await apiClient.delete("/notifications/push/device", { data: { token } });
    } catch {
      // Already gone on the server, or offline: the phone ends up unregistered either way, and
      // the server drops a dead token the next time it tries it.
    }
  }
  await storage.remove(TOKEN_KEY);
  if (!keepOwner) await storage.remove(OWNER_KEY);
}

/** Signing out: this phone must stop buzzing for that account, and the next account decides for itself. */
export async function unregisterOnSignOut(): Promise<void> {
  await disablePush(false);
}

/** Forget this phone's token without calling the server, for when the account is already gone. */
export async function forgetPushLocally(): Promise<void> {
  await storage.remove(TOKEN_KEY);
  await storage.remove(OWNER_KEY);
}
