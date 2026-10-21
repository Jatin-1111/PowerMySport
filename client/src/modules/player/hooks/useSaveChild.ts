"use client";

import { queryKeys } from "@/lib/query/keys";
import { useRefreshProfile } from "@/modules/auth/hooks/useProfile";
import { authApi } from "@/modules/auth/services/auth";
import type { Dependent, User } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** What can be sent for a child: any of the profile, and a name when adding. */
export type ChildFields = Partial<Omit<Dependent, "_id">>;

export interface SavedChild {
  /** The child as the server stored it. */
  child: Dependent;
  /**
   * The signed-in profile re-read after the save, so the store, the profile query and the
   * dashboard agree. It starts at once and never rejects (null if the re-read failed), so
   * a caller that does not need it can ignore it, and one that does can await it.
   */
  refreshed: Promise<User | null>;
}

/**
 * The one way a child is added or changed from the client.
 *
 * The profile page, the quick add, the sport quiz, "I know my sport" and the guidance card
 * each wrote the child with their own call and then made the rest of the app notice in
 * their own way: one re-read the profile, one invalidated queries, one patched the store
 * by hand. A screen that missed a step left another screen showing the old child. Doing it
 * here means every save, from every flow, ends the same way.
 *
 * Consent is not handled here: `authApi` asks the parent first when it is missing.
 */
export function useSaveChild() {
  const queryClient = useQueryClient();
  const refreshProfile = useRefreshProfile();

  const afterSave = useCallback((): Promise<User | null> => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    return refreshProfile().catch(() => null);
  }, [queryClient, refreshProfile]);

  const addChild = useCallback(
    async (fields: ChildFields & { name: string }): Promise<SavedChild> => {
      const response = await authApi.addDependent(fields);
      if (response.success === false) {
        throw new Error(response.message || "Failed to add child");
      }
      return { child: response.data, refreshed: afterSave() };
    },
    [afterSave]
  );

  const updateChild = useCallback(
    async (childId: string, fields: ChildFields): Promise<SavedChild> => {
      const response = await authApi.updateDependent(childId, fields);
      if (response.success === false) {
        throw new Error(response.message || "Failed to update child");
      }
      return { child: response.data, refreshed: afterSave() };
    },
    [afterSave]
  );

  return { addChild, updateChild };
}
