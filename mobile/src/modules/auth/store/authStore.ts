import { create } from 'zustand';
import { storage, STORAGE_KEYS } from '@/utils/storage';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrated: false,

  setUser: (user) => {
    set({ user });
    if (user) {
      storage.set(STORAGE_KEYS.USER, user);
    } else {
      storage.remove(STORAGE_KEYS.USER);
    }
  },

  setToken: (token) => {
    set({ token });
    if (token) {
      storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
    } else {
      storage.remove(STORAGE_KEYS.AUTH_TOKEN);
    }
  },

  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    await storage.remove(STORAGE_KEYS.AUTH_TOKEN);
    await storage.remove(STORAGE_KEYS.USER);
    set({ user: null, token: null });
  },

  hydrate: async () => {
    const token = await storage.get<string>(STORAGE_KEYS.AUTH_TOKEN);
    const user = await storage.get<User>(STORAGE_KEYS.USER);
    set({ token, user, isHydrated: true });
  },
}));
