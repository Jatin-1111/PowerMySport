import apiClient from '@lib/api/axios';
import type { ApiResponse, Coach, Venue, Academy, DiscoveryFilters, PaginationMetadata } from '@/types';

interface ListResponse<T> extends ApiResponse<T[]> {
  pagination?: PaginationMetadata;
}

export const discoveryApi = {
  getCoaches: async (filters: DiscoveryFilters = {}): Promise<ListResponse<Coach>> => {
    const res = await apiClient.get('/discovery/coaches', { params: filters });
    return res.data;
  },

  getCoachById: async (id: string): Promise<ApiResponse<Coach>> => {
    const res = await apiClient.get(`/discovery/coaches/${id}`);
    return res.data;
  },

  getVenues: async (filters: DiscoveryFilters = {}): Promise<ListResponse<Venue>> => {
    const res = await apiClient.get('/discovery/venues', { params: filters });
    return res.data;
  },

  getVenueById: async (id: string): Promise<ApiResponse<Venue>> => {
    const res = await apiClient.get(`/discovery/venues/${id}`);
    return res.data;
  },

  getAcademies: async (filters: DiscoveryFilters = {}): Promise<ListResponse<Academy>> => {
    const res = await apiClient.get('/discovery/academies', { params: filters });
    return res.data;
  },

  getAcademyById: async (id: string): Promise<ApiResponse<Academy>> => {
    const res = await apiClient.get(`/discovery/academies/${id}`);
    return res.data;
  },

  searchAll: async (query: string): Promise<ApiResponse<{ coaches: Coach[]; venues: Venue[]; academies: Academy[] }>> => {
    const res = await apiClient.get('/discovery/search', { params: { q: query } });
    return res.data;
  },
};
