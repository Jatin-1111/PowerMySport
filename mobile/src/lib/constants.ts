import Constants from 'expo-constants';
import { Platform } from 'react-native';

// For Android emulator, localhost = 10.0.2.2
// For iOS simulator, localhost works directly
// For physical devices, replace with your machine's local IP
const getApiUrl = () => {
  const envUrl = Constants.expoConfig?.extra?.apiUrl;
  if (envUrl) return envUrl;

  if (__DEV__) {
    return Platform.OS === 'android'
      ? 'http://10.0.2.2:5000/api'
      : 'http://localhost:5000/api';
  }

  return 'https://api.powermysport.com/api';
};

export const API_URL = getApiUrl();

export const COLORS = {
  powerOrange: '#E97316',
  deepSlate: '#0F172A',
  ghostWhite: '#F8FAFC',
  turfGreen: '#22C55E',
  errorRed: '#EF4444',
  background: '#f4f7ff',
  foreground: '#111827',
  border: '#E5E7EB',
  muted: '#6B7280',
  card: '#FFFFFF',
} as const;

export const SPORTS = [
  'Cricket',
  'Football',
  'Basketball',
  'Tennis',
  'Badminton',
  'Swimming',
  'Hockey',
  'Volleyball',
  'Athletics',
  'Boxing',
  'Kabaddi',
  'Table Tennis',
] as const;
