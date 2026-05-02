"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface MutationState {
  status: "idle" | "pending" | "success" | "error";
  error: Error | null;
}

interface UseMutationStateOptions {
  onSuccess?: (id: string, result: any, payload?: any) => void;
  onError?: (id: string, error: Error, payload?: any) => void;
}

/**
 * Hook to manage multiple concurrent mutations (voting, editing, deleting, etc.)
 * with per-item loading/error state. Replaces scattered isMutatingPostId, isVotingKey patterns.
 *
 * Example: voting on 5 posts simultaneously - each has its own loading state.
 */
export function useMutationState(
  mutationFn: (id: string, payload?: any, signal?: AbortSignal) => Promise<any>,
  options: UseMutationStateOptions = {},
) {
  const { onSuccess, onError } = options;

  const [mutations, setMutations] = useState<Map<string, MutationState>>(
    new Map(),
  );
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const getMutation = useCallback(
    (id: string) =>
      mutations.get(id) || { status: "idle" as const, error: null },
    [mutations],
  );

  const mutate = useCallback(
    async (id: string, payload?: any) => {
      // Cancel previous mutation for this ID if it exists
      abortControllersRef.current.get(id)?.abort();

      const controller = new AbortController();
      abortControllersRef.current.set(id, controller);

      setMutations((prev) => {
        const next = new Map(prev);
        next.set(id, { status: "pending", error: null });
        return next;
      });

      try {
        const result = await mutationFn(id, payload, controller.signal);
        if (!controller.signal.aborted) {
          setMutations((prev) => {
            const next = new Map(prev);
            next.set(id, { status: "success", error: null });
            return next;
          });
          onSuccess?.(id, result, payload);
          // Auto-reset success state after a brief delay
          setTimeout(() => {
            setMutations((prev) => {
              const next = new Map(prev);
              const mutation = next.get(id);
              if (mutation?.status === "success") {
                next.delete(id);
              }
              return next;
            });
          }, 300);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setMutations((prev) => {
            const next = new Map(prev);
            next.set(id, { status: "error", error });
            return next;
          });
          onError?.(id, error, payload);
        }
      }
    },
    [mutationFn, onSuccess, onError],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => {
        controller.abort();
      });
    };
  }, []);

  return {
    mutations,
    getMutation,
    isLoading: (id: string) => getMutation(id).status === "pending",
    isError: (id: string) => getMutation(id).status === "error",
    isSuccess: (id: string) => getMutation(id).status === "success",
    getError: (id: string) => getMutation(id).error,
    mutate,
    reset: (id?: string) => {
      if (id) {
        setMutations((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      } else {
        setMutations(new Map());
      }
    },
  };
}
