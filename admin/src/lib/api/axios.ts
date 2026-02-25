import axios, { AxiosError, AxiosInstance } from "axios";

interface ApiErrorPayload {
  message?: string;
}

interface AxiosErrorWithPayload {
  response?: {
    data?: ApiErrorPayload;
  };
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

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
      requestUrl.includes("/admin/login") ||
      requestUrl.includes("/admin/logout");

    if (error.response?.status === 401 && !isAuthEndpoint) {
      // Clear admin auth data and redirect only for non-auth endpoints
      if (typeof window !== "undefined") {
        localStorage.removeItem("admin");
        localStorage.removeItem("token");
        window.location.href = "/admin/login";
      }
    }

    // Preserve the response data for error handling
    const typedError = error as AxiosErrorWithPayload;
    const errorWithData = new Error(
      typedError.response?.data?.message || error.message || "Request failed",
    ) as Error & { response?: AxiosError["response"] };
    errorWithData.response = error.response;

    return Promise.reject(errorWithData);
  },
);

export default axiosInstance;
