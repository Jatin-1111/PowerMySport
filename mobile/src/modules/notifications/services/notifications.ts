import apiClient from "@lib/api/axios";

export interface AppNotification {
  _id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  success: boolean;
  data: AppNotification[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const notificationsApi = {
  list: async (page = 1): Promise<NotificationsResponse> => {
    const res = await apiClient.get("/notifications", { params: { page, limit: 30 } });
    return res.data;
  },

  unreadCount: async (): Promise<number> => {
    const res = await apiClient.get("/notifications/unread-count");
    return res.data.count ?? 0;
  },

  markRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.patch("/notifications/read-all");
  },
};
