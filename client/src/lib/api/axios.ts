import { loginUrlFor } from "@/flow/policy";
import { currentReturnPath } from "@/lib/returnPath";
import axios, { AxiosError, AxiosInstance } from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * What to do when the API says the session is gone.
 *
 * This is a registration point rather than a direct call because deciding what
 * happens to a dead session is a flow concern, and this module is the transport
 * layer: it has no router, no store, and no idea what route the user is on. It
 * used to decide anyway, and the only verb available to it was
 * `window.location.href = "/login"` — a full document reload that discarded
 * in-memory state and dropped the page the user was on.
 *
 * Worse, it *raced* the route guards. A hard navigation from here overwrote the
 * guard's own `router.replace`, so a signed-out visitor to a console page was
 * bounced to a bare `/login` with no return path even though the guard had
 * already constructed the right URL.
 *
 * So the transport layer now only reports the fact, and the auth module decides
 * (see `useSessionExpiry`). The fallback below still runs if nothing has
 * registered — during SSR, or before the app has mounted — and it preserves the
 * return path, which the original never did.
 */
export type UnauthorizedHandler = (returnTo: string | null) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registers the session-expiry handler. Returns a function that unregisters it. */
export const setUnauthorizedHandler = (
  handler: UnauthorizedHandler,
): (() => void) => {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
};

/**
 * Auth pages must never become a return path: `/login?redirect=/login` sends the
 * user back to where they already are once they sign in.
 */
const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const isAuthPath = (pathname: string): boolean =>
  AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Where to send the user back to after they re-authenticate, or `null` if there
 * is nowhere sensible — which currently means they are already on an auth page.
 *
 * Exported because it is the part that was wrong, and a decision buried inside an
 * interceptor callback cannot be tested.
 */
export const returnPathForUnauthorized = (
  pathname: string,
  search?: string,
): string | null =>
  isAuthPath(pathname) ? null : currentReturnPath(pathname, search);

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor to attach token
axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const requestUrl = error.config?.url || "";
    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/google");

    const errorMessage =
      ((error.response?.data as any)?.message as string | undefined) || "";

    const isStaleProfileSession =
      error.response?.status === 404 &&
      requestUrl.includes("/auth/profile") &&
      /user not found|session expired/i.test(errorMessage);

    if (
      (error.response?.status === 401 || isStaleProfileSession) &&
      !isAuthEndpoint
    ) {
      if (typeof window !== "undefined") {
        const { pathname } = window.location;

        // Already on an auth page: tear the session down, but do not navigate,
        // and do not offer the auth page itself as somewhere to return to.
        const returnTo = returnPathForUnauthorized(
          pathname,
          window.location.search,
        );

        if (unauthorizedHandler) {
          unauthorizedHandler(returnTo);
        } else {
          // No handler registered yet. Do the minimum ourselves, but keep the
          // return path — losing it was the actual defect here.
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          if (!isAuthPath(pathname)) {
            window.location.href = loginUrlFor(returnTo);
          }
        }
      }
    }

    // Preserve the response data for error handling
    const errorWithData = new Error(
      (error.response?.data as any)?.message ||
        error.message ||
        "Request failed",
    ) as Error & { response?: any };
    errorWithData.response = error.response;

    return Promise.reject(errorWithData);
  },
);

export default axiosInstance;
