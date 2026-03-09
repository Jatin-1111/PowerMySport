import axiosInstance from "@/lib/api/axios";
import { ApiResponse } from "@/types";

// ============================================
// NOTIFICATION MONITORING TYPES
// ============================================

export interface NotificationStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
  failureRate: number;
  lastProcessedAt: string | null;
}

export interface SchedulerHealth {
  isHealthy: boolean;
  lastRun: string | null;
  minutesSinceLastRun: number;
  pendingCount: number;
  overdueCount: number;
  failureRate: number;
  issues: string[];
}

export interface FailedReminder {
  _id: string;
  userId: string;
  bookingId?: string;
  interval: "24h" | "1h" | "15min";
  scheduledFor: string;
  status: string;
  failureReason?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  lastAttempt?: string;
}

export interface MonitoringStats {
  period: string;
  totalProcessed: number;
  totalSent: number;
  totalFailed: number;
  totalCancelled: number;
  failureRate: number;
  lastProcessedAt: string | null;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  message: string;
  stats: MonitoringStats;
  health: SchedulerHealth;
  alertSent: boolean;
}

// ============================================
// NOTIFICATION MONITORING API
// ============================================

export const notificationApi = {
  /**
   * Get notification statistics for the last 24 hours
   */
  getStats: async (): Promise<ApiResponse<MonitoringStats>> => {
    const response = await axiosInstance.get("/reminders/monitoring/stats");
    return response.data;
  },

  /**
   * Get scheduler health status
   */
  getHealth: async (): Promise<ApiResponse<SchedulerHealth>> => {
    const response = await axiosInstance.get("/reminders/monitoring/health");
    return response.data;
  },

  /**
   * Get list of failed reminders
   * @param limit - Maximum number of failed reminders to retrieve (default: 50, max: 100)
   */
  getFailedReminders: async (
    limit: number = 50,
  ): Promise<ApiResponse<FailedReminder[]>> => {
    const response = await axiosInstance.get(
      `/reminders/monitoring/failed?limit=${limit}`,
    );
    return response.data;
  },

  /**
   * Manually trigger a health check (admin only)
   */
  triggerHealthCheck: async (): Promise<ApiResponse<HealthCheckResult>> => {
    const response = await axiosInstance.post(
      "/reminders/monitoring/health-check",
    );
    return response.data;
  },

  /**
   * Manually trigger sending the daily summary email (admin only)
   */
  sendDailySummary: async (): Promise<
    ApiResponse<{ message: string; emailsSent: number }>
  > => {
    const response = await axiosInstance.post(
      "/reminders/monitoring/send-summary",
    );
    return response.data;
  },

  /**
   * Retry a single failed reminder
   */
  retryReminder: async (
    reminderId: string,
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await axiosInstance.post(
      `/reminders/monitoring/retry/${reminderId}`,
    );
    return response.data;
  },

  /**
   * Retry multiple failed reminders
   */
  retryMultiple: async (
    reminderIds: string[],
  ): Promise<
    ApiResponse<{
      message: string;
      results: { reminderId: string; success: boolean; message: string }[];
    }>
  > => {
    const response = await axiosInstance.post(
      "/reminders/monitoring/retry-batch",
      { reminderIds },
    );
    return response.data;
  },
};
