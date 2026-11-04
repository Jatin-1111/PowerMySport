import Constants from "expo-constants";
import { Platform } from "react-native";

// For Android emulator, localhost = 10.0.2.2
// For iOS simulator, localhost works directly
// For physical devices, replace with your machine's local IP
const getApiUrl = () => {
  // EXPO_PUBLIC_API_URL (e.g. in mobile/.env) wins over everything, for pointing a build at another API.
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;

  const envUrl = Constants.expoConfig?.extra?.apiUrl;
  if (envUrl) return envUrl;

  if (__DEV__) {
    // Expo Go on a phone: the dev server's host is the PC's LAN IP, and the API runs on the same PC.
    const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
    if (devHost) return `http://${devHost}:5000/api`;
    return Platform.OS === "android" ? "http://10.0.2.2:5000/api" : "http://localhost:5000/api";
  }

  return "https://api.powermysport.com/api";
};

export const API_URL = getApiUrl();

// The public website, for the legal pages the app links to.
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://powermysport.com";

// Mirrors client/DESIGN.md (warm paper). Keep in step with the colors in tailwind.config.js.
export const COLORS = {
  canvas: "#F8F3EA",
  canvasDeep: "#EFE7DA",
  wash: "#FBE9D9",
  surface: "#FFFFFF",
  ink: "#1C1B1A",
  body: "#4A4741",
  muted: "#7A766E",
  ash: "#A8A5A0",
  hairline: "#E1DCD3",
  action: "#C2410C",
  actionHover: "#9A3412",
  brandOrange: "#E97316",
  success: "#15803D",
  error: "#B91C1C",
  // Older names still used by screens written before the redesign.
  powerOrange: "#E97316",
  deepSlate: "#1C1B1A",
  turfGreen: "#15803D",
  errorRed: "#B91C1C",
  background: "#F8F3EA",
  foreground: "#1C1B1A",
  border: "#E1DCD3",
  card: "#FFFFFF",
} as const;

export const SPORTS = [
  "Cricket",
  "Football",
  "Basketball",
  "Tennis",
  "Badminton",
  "Swimming",
  "Hockey",
  "Volleyball",
  "Athletics",
  "Boxing",
  "Kabaddi",
  "Table Tennis",
] as const;
