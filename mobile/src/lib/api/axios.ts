import axios from 'axios';
import { API_URL } from '../constants';
import { storage, STORAGE_KEYS } from '../../utils/storage';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.get<string>(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      await storage.remove(STORAGE_KEYS.USER);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
