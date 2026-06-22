import apiClient from '@lib/api/axios';
import type { AuthResponse, LoginPayload, RegisterPayload, ApiResponse, User } from '@/types';

export const authApi = {
  login: async (data: LoginPayload): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/login', data);
    return res.data;
  },

  register: async (data: RegisterPayload): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
  },

  getProfile: async (): Promise<ApiResponse<User>> => {
    const res = await apiClient.get('/auth/profile');
    return res.data;
  },

  forgotPassword: async (email: string): Promise<ApiResponse> => {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data;
  },

  resetPassword: async (token: string, password: string): Promise<ApiResponse> => {
    const res = await apiClient.post('/auth/reset-password', { token, password });
    return res.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore errors on logout
    }
  },

  googleLogin: async (idToken: string): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/google', { idToken });
    return res.data;
  },
};
