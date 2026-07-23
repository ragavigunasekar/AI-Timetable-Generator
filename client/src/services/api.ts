import axios from "axios";
import { useAuthStore } from "../store/authStore";

/**
 * Resolve the backend API base URL from the environment variable.
 */
const BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Response interceptor that unwraps the standard { success, data, message }
 * envelope returned by the backend, while preserving backward compatibility
 * with endpoints that return data directly.
 *
 * After this interceptor:
 *   - On success: response.data resolves to the actual payload (the `data` field).
 *   - On 401: automatically logs out and redirects to login.
 */
api.interceptors.response.use(
  (response) => {
    // If the response follows the { success, data } format, unwrap it
    if (
      response.data &&
      typeof response.data === "object" &&
      "success" in response.data
    ) {
      if (response.data.success === true && "data" in response.data) {
        // Rewrite response.data to the actual payload
        response.data = response.data.data;
      } else if (response.data.success === false) {
        // Convert envelope failures into rejected promises
        return Promise.reject({
          response: {
            status: response.status,
            data: { message: response.data.message },
          },
        });
      }
      // If success=true but no data field, leave as-is
    }
    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().logout();
      const { pathname } = window.location;
      if (pathname !== "/" && pathname !== "/register") {
        window.location.assign("/");
      }
    }
    return Promise.reject(error);
  }
);

export default api;