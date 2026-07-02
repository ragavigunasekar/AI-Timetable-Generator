import { create } from "zustand";

const STORAGE_KEY = "ragavi_token";

function isTokenExpired(token: string | null | undefined) {
  if (!token) return true;

  try {
    const [, payload] = token.split(".");
    if (!payload) return true;

    const decoded = JSON.parse(atob(payload));
    if (!decoded?.exp) return false;

    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
}

function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(STORAGE_KEY);
  return isTokenExpired(token) ? null : token;
}

type AuthState = {
  token: string | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredToken(),
  isAuthenticated: Boolean(getStoredToken()),
  setToken: (token) => {
    const nextToken = token && !isTokenExpired(token) ? token : null;

    if (nextToken) {
      window.localStorage.setItem(STORAGE_KEY, nextToken);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    set({ token: nextToken, isAuthenticated: Boolean(nextToken) });
  },
  logout: () => {
    window.localStorage.removeItem(STORAGE_KEY);
    set({ token: null, isAuthenticated: false });
  },
}));
