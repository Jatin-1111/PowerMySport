import { User } from "@/types";
import { create } from "zustand";

interface AuthStore {
  user: User | null;
  token: string | null;
  /**
   * False until `HydrationBoundary` has finished reading localStorage.
   *
   * Without this, `user === null` is ambiguous — it means BOTH "still reading
   * the session" and "definitely signed out". Route guards cannot be written
   * correctly against an ambiguous value: treating null as signed-out bounces
   * real users mid-hydration, and treating it as unknown lets signed-out
   * visitors sit on protected pages (which is what used to happen). Guards must
   * wait for this flag before acting on `user`.
   */
  hydrated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setHydrated: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  hydrated: false,
  isLoading: false,
  error: null,
  setUser: (user) => {
    set({ user });
    if (typeof window !== "undefined") {
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      } else {
        localStorage.removeItem("user");
      }
    }
  },
  setToken: (token) => {
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("token", token);
      } else {
        localStorage.removeItem("token");
      }
    }
    set({ token });
  },
  setHydrated: () => set({ hydrated: true }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  logout: () => {
    // `hydrated` deliberately stays true — the session is now known to be
    // empty, which is a resolved state, not an unresolved one.
    set({ user: null, token: null });
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  },
}));

// Note: Hydration is now handled by HydrationBoundary component
// This ensures proper client-side initialization without SSR hydration mismatches
