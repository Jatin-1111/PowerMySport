import axios, { AxiosError, AxiosInstance } from "axios";
import { redirectToMainLogin } from "@/lib/auth/redirect";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const requestUrl = error.config?.url || "";
    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/google");

    const errorMessage =
      ((error.response?.data as { message?: string })?.message as
        | string
        | undefined) || "";

    const isStaleProfileSession =
      error.response?.status === 404 &&
      requestUrl.includes("/auth/profile") &&
      /user not found|session expired/i.test(errorMessage);

    if (
      (error.response?.status === 401 || isStaleProfileSession) &&
      !isAuthEndpoint
    ) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }

      redirectToMainLogin();
    }

    const errorWithData = new Error(
      (error.response?.data as { message?: string })?.message ||
        error.message ||
        "Request failed",
    ) as Error & {
      response?: unknown;
    };
    errorWithData.response = error.response;
    return Promise.reject(errorWithData);
  },
);

export default axiosInstance;
