"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseDebouncedSearchOptions {
  delayMs?: number;
  minChars?: number;
}

/**
 * Hook for debounced search with race condition prevention.
 * Prevents hallucinatory UI by:
 * 1. Debouncing rapid input changes
 * 2. Aborting stale requests
 * 3. Only showing results for the most recent query
 */
export function useDebouncedSearch<T>(
  searchFn: (query: string, signal: AbortSignal) => Promise<T[]>,
  options: UseDebouncedSearchOptions = {},
) {
  const { delayMs = 300, minChars = 2 } = options;

  const [query, setQuery] = useState("");
  const [displayQuery, setDisplayQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef("");

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery === lastQueryRef.current) {
        return; // Already searching for this query
      }

      if (searchQuery.length < minChars) {
        setResults([]);
        setError(null);
        return;
      }

      lastQueryRef.current = searchQuery;

      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsSearching(true);
      setError(null);

      try {
        const data = await searchFn(searchQuery, signal);
        if (!signal.aborted && searchQuery === lastQueryRef.current) {
          setResults(data);
        }
      } catch (err) {
        if (!signal.aborted && searchQuery === lastQueryRef.current) {
          const error = err instanceof Error ? err : new Error(String(err));
          if (error.name !== "AbortError") {
            setError(error);
          }
        }
      } finally {
        if (!signal.aborted && searchQuery === lastQueryRef.current) {
          setIsSearching(false);
        }
      }
    },
    [searchFn, minChars],
  );

  // Debounce input changes
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    setDisplayQuery(query);

    if (query.length < minChars) {
      setResults([]);
      setError(null);
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      void performSearch(query);
    }, delayMs);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query, delayMs, minChars, performSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    displayQuery,
    results,
    isSearching,
    error,
    clear: () => {
      setQuery("");
      setDisplayQuery("");
      setResults([]);
      setError(null);
      lastQueryRef.current = "";
    },
  };
}
