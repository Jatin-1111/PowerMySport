import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { GOOGLE_WEB_CLIENT_ID } from "@lib/constants";

// Google sign-in on the phone. The native Google dialog returns an ID token; the app sends it to the
// server (authApi.googleAuth), which verifies it with Google and ignores every other claim. The token
// is issued for the WEB client ID, because that is the one ID the server accepts. The phone itself is
// identified to Google by an Android client in the same Google Cloud project (package name plus the
// app's signing fingerprint), which is set up in the Google Cloud console, not in code.

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

/**
 * Whether this build can offer Google sign-in. The sign-in library is native code: it is not in
 * Expo Go or a browser, so there the button is hidden instead of failing. iOS is not set up, and
 * without the web client ID there is nothing the server would accept.
 */
export function googleAvailable(): boolean {
  return (
    Platform.OS === "android" &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
    GOOGLE_WEB_CLIENT_ID.length > 0
  );
}

let configured = false;

/** Loaded on demand: importing the native module where it does not exist throws. */
function google(): GoogleModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@react-native-google-signin/google-signin") as GoogleModule;
  if (!configured) {
    mod.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  return mod;
}

export type GoogleResult =
  | { ok: true; idToken: string }
  | {
      ok: false;
      reason: "cancelled" | "unavailable" | "play-services" | "failed";
      message: string;
    };

/** Shows Google's account chooser and returns the signed ID token. */
export async function signInWithGoogle(): Promise<GoogleResult> {
  if (!googleAvailable()) {
    return {
      ok: false,
      reason: "unavailable",
      message: "Google sign-in is not available in this version of the app.",
    };
  }
  try {
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = google();
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          ok: false,
          reason: "play-services",
          message: "Google Play services are missing or out of date on this phone.",
        };
      }
      throw error;
    }

    // Forget the last account first, so every attempt offers the account chooser.
    await GoogleSignin.signOut().catch(() => undefined);

    try {
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return { ok: false, reason: "cancelled", message: "Sign-in was cancelled." };
      }
      const idToken = response.data.idToken;
      if (!idToken) {
        return {
          ok: false,
          reason: "failed",
          message: "Google did not return a sign-in token. Please try again.",
        };
      }
      return { ok: true, idToken };
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { ok: false, reason: "cancelled", message: "Sign-in was cancelled." };
      }
      throw error;
    }
  } catch {
    return {
      ok: false,
      reason: "failed",
      message: "Could not sign in with Google just now. Please try again.",
    };
  }
}

/** Signs out of Google on this phone. Safe to call anywhere: it does nothing where Google sign-in is unavailable. */
export async function signOutOfGoogle(): Promise<void> {
  if (!googleAvailable()) return;
  try {
    await google().GoogleSignin.signOut();
  } catch {
    // Not signed in with Google, or the module is unavailable: nothing to sign out of.
  }
}
