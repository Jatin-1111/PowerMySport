import axios from "./axios";

export interface Notification {
  _id: string;
  userId: string;
  type: string;
  category: "SOCIAL" | "BOOKING" | "ADMIN" | "REVIEW" | "PAYMENT" | "COMMUNITY";
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationFilters {
  category?:
    | "SOCIAL"
    | "BOOKING"
    | "ADMIN"
    | "REVIEW"
    | "PAYMENT"
    | "COMMUNITY";
  isRead?: boolean;
}

export interface NotificationResponse {
  success: boolean;
  data: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  count: number;
}

export interface NotificationChannelPreferences {
  friendRequests?: boolean;
  bookingInvitations?: boolean;
  bookingConfirmations?: boolean;
  bookingReminders?: boolean;
  bookingCancellations?: boolean;
  reviews?: boolean;
  payments?: boolean;
  admin?: boolean;
  marketing?: boolean;
}

export interface NotificationPreferences {
  email?: NotificationChannelPreferences;
  push?: NotificationChannelPreferences;
  inApp?: NotificationChannelPreferences;
}

export interface NotificationPreferencesResponse {
  success: boolean;
  data: NotificationPreferences;
}

export const notificationApi = {
  /**
   * Get user notifications with pagination
   */
  getNotifications: async (
    page: number = 1,
    limit: number = 20,
    filters?: NotificationFilters,
  ): Promise<NotificationResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters?.category) {
      params.append("category", filters.category);
    }

    if (filters?.isRead !== undefined) {
      params.append("isRead", filters.isRead.toString());
    }

    const response = await axios.get(`/notifications?${params.toString()}`);
    return response.data;
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (
    category?:
      | "SOCIAL"
      | "BOOKING"
      | "ADMIN"
      | "REVIEW"
      | "PAYMENT"
      | "COMMUNITY",
  ): Promise<UnreadCountResponse> => {
    const params = category ? `?category=${category}` : "";
    const response = await axios.get(`/notifications/unread-count${params}`);
    return response.data;
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (
    notificationId: string,
  ): Promise<{ success: boolean; data: Notification }> => {
    const response = await axios.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<{ success: boolean; count: number }> => {
    const response = await axios.patch("/notifications/read-all");
    return response.data;
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (
    notificationId: string,
  ): Promise<{ success: boolean }> => {
    const response = await axios.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  /**
   * Get notification preferences
   */
  getPreferences: async (): Promise<NotificationPreferencesResponse> => {
    const response = await axios.get("/notifications/preferences");
    return response.data;
  },

  /**
   * Update notification preferences
   */
  updatePreferences: async (
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferencesResponse> => {
    const response = await axios.patch(
      "/notifications/preferences",
      preferences,
    );
    return response.data;
  },
};
