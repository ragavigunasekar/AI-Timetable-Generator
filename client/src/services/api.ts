import axios from "axios";
import { useAuthStore } from "../store/authStore";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token ?? localStorage.getItem("ragavi_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().logout();
      if (window.location.pathname !== "/" && window.location.pathname !== "/register") {
        window.location.assign("/");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
