import axios from "axios";
import { API_URL } from "../constants";
import { secureStorage, STORAGE_KEYS } from "../../utils/storage";

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// The auth store registers this so a dead session logs the user out of the UI as well as storage.
// A callback rather than an import keeps the store and this module from importing each other.
let onSessionExpired: (() => void) | null = null;

export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

// A wrong password on these routes is a 401 too, but it is not an expired session.
const AUTH_ENTRY_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/google",
  "/auth/forgot-password",
  "/auth/reset-password",
];

apiClient.interceptors.request.use(
  async (config) => {
    const token = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const hadSession = Boolean(config?.headers?.Authorization);
    const isAuthEntry = AUTH_ENTRY_PATHS.some((path) => config?.url?.startsWith(path));
    if (error.response?.status === 401 && hadSession && !isAuthEntry) {
      onSessionExpired?.();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
