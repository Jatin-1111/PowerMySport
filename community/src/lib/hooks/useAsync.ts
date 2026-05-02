"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AsyncState<T> = {
  status: "idle" | "pending" | "success" | "error";
  data: T | null;
  error: Error | null;
};

export interface UseAsyncOptions {
  manual?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Standardized hook for async operations with proper loading, error, and race condition handling.
 * Replaces scattered useState + useEffect patterns with a single reliable interface.
 */
export function useAsync<T>(
  asyncFn: (signal: AbortSignal) => Promise<T>,
  deps: any[] = [],
  options: UseAsyncOptions = {},
) {
  const { manual = false, onSuccess, onError } = options;

  const [state, setState] = useState<AsyncState<T>>({
    status: "idle",
    data: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    // Abort previous request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState({ status: "pending", data: null, error: null });

    try {
      const result = await asyncFn(signal);
      if (!signal.aborted) {
        setState({ status: "success", data: result, error: null });
        onSuccess?.(result);
      }
    } catch (err) {
      if (!signal.aborted) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ status: "error", data: null, error });
        onError?.(error);
      }
    }
  }, [asyncFn, onSuccess, onError]);

  useEffect(() => {
    if (!manual) {
      void execute();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, deps);

  return {
    ...state,
    isLoading: state.status === "pending",
    isError: state.status === "error",
    isSuccess: state.status === "success",
    execute, // For manual execution
  };
}

/**
 * Specialized hook for mutations (post/put/delete operations).
 */
export function useAsyncMutation<T>(
  asyncFn: (payload: any, signal: AbortSignal) => Promise<T>,
  options: UseAsyncOptions = {},
) {
  const { onSuccess, onError } = options;

  const [state, setState] = useState<AsyncState<T>>({
    status: "idle",
    data: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const mutate = useCallback(
    async (payload: any) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setState({ status: "pending", data: null, error: null });

      try {
        const result = await asyncFn(payload, signal);
        if (!signal.aborted) {
          setState({ status: "success", data: result, error: null });
          onSuccess?.(result);
        }
      } catch (err) {
        if (!signal.aborted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setState({ status: "error", data: null, error });
          onError?.(error);
        }
      }
    },
    [asyncFn, onSuccess, onError],
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    ...state,
    isLoading: state.status === "pending",
    isError: state.status === "error",
    isSuccess: state.status === "success",
    mutate,
  };
}

/**
 * Hook to safely track multiple async operations without race conditions.
 * Useful when you have multiple independent async operations (e.g., voting, searching, etc.)
 */
export function useAsyncMap<T extends string | number>(
  asyncFn: (id: T, signal: AbortSignal) => Promise<any>,
  onSuccess?: (id: T, data: any) => void,
) {
  const [loading, setLoading] = useState<Set<T>>(new Set());
  const [errors, setErrors] = useState<Map<T, Error>>(new Map());
  const abortControllersRef = useRef<Map<T, AbortController>>(new Map());

  const execute = useCallback(
    async (id: T) => {
      // Abort previous request for this ID
      abortControllersRef.current.get(id)?.abort();

      const controller = new AbortController();
      abortControllersRef.current.set(id, controller);

      setLoading((prev) => new Set(prev).add(id));
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      try {
        const result = await asyncFn(id, controller.signal);
        if (!controller.signal.aborted) {
          onSuccess?.(id, result);
          setLoading((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setErrors((prev) => new Map(prev).set(id, error));
          setLoading((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }
    },
    [asyncFn, onSuccess],
  );

  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
    };
  }, []);

  return {
    isLoading: (id: T) => loading.has(id),
    getError: (id: T) => errors.get(id) || null,
    execute,
    reset: () => {
      setLoading(new Set());
      setErrors(new Map());
    },
  };
}
