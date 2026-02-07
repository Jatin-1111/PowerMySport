import axiosInstance from "./axios";

export interface GeoSuggestion {
  label: string;
  lat: number;
  lon: number;
}

interface GeoResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export const geoApi = {
  autocomplete: async (query: string): Promise<GeoSuggestion[]> => {
    const response = await axiosInstance.get<GeoResponse<GeoSuggestion[]>>(
      `/geo/autocomplete?q=${encodeURIComponent(query)}`,
    );
    return response.data.data || [];
  },

  geocode: async (address: string): Promise<GeoSuggestion | null> => {
    const response = await axiosInstance.get<GeoResponse<GeoSuggestion | null>>(
      `/geo/geocode?address=${encodeURIComponent(address)}`,
    );
    return response.data.data || null;
  },

  reverse: async (lat: number, lon: number): Promise<GeoSuggestion | null> => {
    const response = await axiosInstance.get<GeoResponse<GeoSuggestion | null>>(
      `/geo/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(
        String(lon),
      )}`,
    );
    return response.data.data || null;
  },
};
