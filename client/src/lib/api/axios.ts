import axios, { AxiosError, AxiosInstance } from "axios";

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
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/google");

    if (error.response?.status === 401 && !isAuthEndpoint) {
      // Clear auth data and redirect to login only for non-auth endpoints
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
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
