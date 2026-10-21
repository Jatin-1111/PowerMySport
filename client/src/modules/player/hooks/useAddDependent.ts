"use client";

import { useSaveChild } from "@/modules/player/hooks/useSaveChild";
import type { Dependent } from "@/types";
import { useMutation } from "@tanstack/react-query";

/**
 * Add a child from the dashboard. The save itself, and making every reader of the profile
 * agree afterwards (the dashboard reads the cached profile while the profile page re-reads
 * it), is `useSaveChild`, which every flow shares.
 */
export const useAddDependent = () => {
  const { addChild } = useSaveChild();

  return useMutation({
    mutationFn: async (data: Dependent) => (await addChild(data)).child,
  });
};
