"use client";

import { notificationApi } from "@/lib/api/notification";
import { queryKeys } from "@/lib/query/keys";
import { bookingApi } from "@/modules/booking/services/booking";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { friendService } from "@/modules/shared/services/friend";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

interface NotificationCounts {
  friendRequests: number;
  bookingInvitations: number;
  inAppUnread: number;
}

const ZERO: NotificationCounts = {
  friendRequests: 0,
  bookingInvitations: 0,
  inAppUnread: 0,
};

/**
 * The three badge counts in the dashboard nav.
 *
 * This used to hand-roll everything a query layer already does: an in-flight ref
 * to dedupe concurrent calls, a manual polling interval, its own loading/error
 * state, and a bespoke equality check to avoid re-render churn. All of that is
 * now `useQueries` — three independently cached queries that dedupe across every
 * consumer and share one cache with the rest of the app.
 *
 * `enabled` matters here beyond efficiency: these endpoints 401 for a signed-out
 * visitor, and the axios interceptor answers a 401 with a full-page redirect to
 * /login. Firing them without a session used to hijack the dashboard guard's own
 * redirect and lose the return path.
 */
export function useNotifications(pollingInterval: number = 0) {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const enabled = hydrated && Boolean(token);

  const refetchInterval = pollingInterval > 0 ? pollingInterval : undefined;

  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.friends.pendingRequestsCount,
        queryFn: () => friendService.getPendingRequestsCount(),
        enabled,
        refetchInterval,
      },
      {
        queryKey: queryKeys.bookings.pendingInvitationsCount,
        queryFn: () => bookingApi.getPendingInvitationsCount(),
        enabled,
        refetchInterval,
      },
      {
        queryKey: queryKeys.notifications.unreadCount,
        queryFn: () => notificationApi.getUnreadCount(),
        enabled,
        refetchInterval,
      },
    ],
  });

  const [friendRequests, bookingInvitations, inAppUnread] = results;

  const counts: NotificationCounts = enabled
    ? {
        friendRequests: friendRequests.data?.count ?? 0,
        bookingInvitations: bookingInvitations.data?.count ?? 0,
        inAppUnread: inAppUnread.data?.count ?? 0,
      }
    : ZERO;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.friends.pendingRequestsCount,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.bookings.pendingInvitationsCount,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.unreadCount,
    });
  }, [queryClient]);

  return {
    counts,
    loading: enabled && results.some((r) => r.isPending),
    error: results.find((r) => r.error) ? "Failed to fetch notifications" : null,
    refresh,
  };
}
