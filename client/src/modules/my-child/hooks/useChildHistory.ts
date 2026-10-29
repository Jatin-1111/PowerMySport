"use client";

import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  childHistoryApi,
  type AcademicsChanges,
  type EntryChanges,
  type NewEntry,
} from "@/modules/my-child/services/childHistory";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * One child's history, and the four things a parent does to it.
 *
 * ── Why every write re-reads the page instead of patching the cache ─────────
 * A write returns the one entry it touched, but the page is more than that entry: adding a
 * result to a tournament marked played replaces a derived row, and the tiles count across all
 * rows. Re-reading is one request and cannot disagree with the server; patching would be a
 * second copy of the rules that decide what counts.
 */
export function useChildHistory(childId: string) {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const key = queryKeys.childHistory.forChild(childId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => childHistoryApi.get(childId),
    enabled: hydrated && Boolean(token) && Boolean(childId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  /** The server's message is the useful one: it says which rule was hit. */
  const failed = (fallback: string) => (error: unknown) => {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message;
    toast.error(message || fallback);
  };

  const addEntry = useMutation({
    mutationFn: (entry: NewEntry) => childHistoryApi.addEntry(childId, entry),
    onSuccess: () => {
      void refresh();
      toast.success("Entry added.");
    },
    onError: failed("Could not add that entry."),
  });

  const updateEntry = useMutation({
    mutationFn: (input: { entryId: string; changes: EntryChanges }) =>
      childHistoryApi.updateEntry(childId, input.entryId, input.changes),
    onSuccess: () => {
      void refresh();
      toast.success("Entry saved.");
    },
    onError: failed("Could not save that entry."),
  });

  const deleteEntry = useMutation({
    mutationFn: (entryId: string) => childHistoryApi.deleteEntry(childId, entryId),
    onSuccess: () => {
      void refresh();
      toast.success("Entry removed.");
    },
    onError: failed("Could not remove that entry."),
  });

  const saveAcademics = useMutation({
    mutationFn: (changes: AcademicsChanges) => childHistoryApi.saveAcademics(childId, changes),
    onSuccess: () => {
      void refresh();
      toast.success("School details saved.");
    },
    onError: failed("Could not save the school details."),
  });

  const recordVideoConsent = useMutation({
    mutationFn: () => childHistoryApi.recordVideoConsent(),
    onSuccess: () => void refresh(),
    onError: failed("Could not record your agreement."),
  });

  const deleteVideo = useMutation({
    mutationFn: (videoId: string) => childHistoryApi.deleteVideo(childId, videoId),
    onSuccess: () => {
      void refresh();
      toast.success("Video removed.");
    },
    onError: failed("Could not remove that video."),
  });

  return {
    history: query.data ?? null,
    isLoading: query.isPending && hydrated && Boolean(token),
    isError: query.isError,
    refetch: query.refetch,
    addEntry,
    updateEntry,
    deleteEntry,
    saveAcademics,
    recordVideoConsent,
    deleteVideo,
  };
}
