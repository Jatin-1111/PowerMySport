"use client";

import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  childHistoryApi,
  type NewShare,
  type ShareChoice,
} from "@/modules/my-child/services/childHistory";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const serverMessage = (error: unknown): string | undefined =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

/**
 * One child's share links: the list, making one, stopping one, and the preview of what a link
 * would show.
 *
 * The preview is a query keyed by the exact choice, so going back and changing a tick fetches a
 * fresh one, and it is never kept: what a coach would see depends on the child's data at the
 * moment the link is made.
 */
export function useChildShares(childId: string) {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const key = queryKeys.childHistory.shares(childId);

  const list = useQuery({
    queryKey: key,
    queryFn: () => childHistoryApi.listShares(childId),
    enabled: hydrated && Boolean(token) && Boolean(childId),
  });

  const create = useMutation({
    mutationFn: (share: NewShare) => childHistoryApi.createShare(childId, share),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => toast.error(serverMessage(error) ?? "Could not create the link."),
  });

  const revoke = useMutation({
    mutationFn: (shareId: string) => childHistoryApi.revokeShare(childId, shareId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Link stopped.");
    },
    onError: (error) => toast.error(serverMessage(error) ?? "Could not stop that link."),
  });

  return {
    shares: list.data ?? [],
    isLoading: list.isPending,
    isError: list.isError,
    create,
    revoke,
  };
}

/** What a coach would see for this choice. Fetched when the preview step opens, never kept. */
export function useSharePreview(childId: string, choice: ShareChoice, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.childHistory.shares(childId), "preview", choice],
    queryFn: () => childHistoryApi.previewShare(childId, choice),
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
}
