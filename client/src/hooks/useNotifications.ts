"use client";

import { useEffect, useState, useCallback } from "react";
import { friendService } from "@/modules/shared/services/friend";
import { bookingApi } from "@/modules/booking/services/booking";

interface NotificationCounts {
  friendRequests: number;
  bookingInvitations: number;
}

export function useNotifications(pollingInterval: number = 0) {
  const [counts, setCounts] = useState<NotificationCounts>({
    friendRequests: 0,
    bookingInvitations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      setError(null);

      // Fetch both counts in parallel
      const [friendRequestsData, invitationsData] = await Promise.all([
        friendService.getPendingRequestsCount().catch(() => ({ count: 0 })),
        bookingApi.getPendingInvitationsCount().catch(() => ({ count: 0 })),
      ]);

      setCounts({
        friendRequests: friendRequestsData.count || 0,
        bookingInvitations: invitationsData.count || 0,
      });
    } catch (err) {
      console.error("Failed to fetch notification counts:", err);
      setError("Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Polling
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const intervalId = setInterval(fetchCounts, pollingInterval);
    return () => clearInterval(intervalId);
  }, [fetchCounts, pollingInterval]);

  return {
    counts,
    loading,
    error,
    refresh: fetchCounts,
  };
}
