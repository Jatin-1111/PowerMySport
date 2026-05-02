"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface PlayerSearchResult {
  id: string;
  displayName: string;
  name: string;
  isIdentityPublic: boolean;
  role?: string;
}

interface UsePlayerSearchOptions {
  debounceMs?: number;
  minChars?: number;
}

/**
 * Custom hook for player search with debouncing and race condition prevention.
 * Prevents hallucination by only showing results for the most recent search query.
 */
export function usePlayerSearch(
  searchFn: (
    query: string,
    signal: AbortSignal,
  ) => Promise<PlayerSearchResult[]>,
  options: UsePlayerSearchOptions = {},
) {
  const { debounceMs = 300, minChars = 2 } = options;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef("");

  const performSearch = useCallback(
    async (searchQuery: string) => {
      // Skip if we're already searching for this exact query
      if (searchQuery === lastQueryRef.current) {
        return;
      }

      if (searchQuery.length < minChars) {
        setResults([]);
        setError(null);
        setIsSearching(false);
        return;
      }

      lastQueryRef.current = searchQuery;

      // Abort any previous search request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsSearching(true);
      setError(null);

      try {
        const data = await searchFn(searchQuery, signal);
        // Only update if not aborted and this is still the latest query
        if (!signal.aborted && searchQuery === lastQueryRef.current) {
          setResults(data);
        }
      } catch (err) {
        // Don't set error if request was aborted (normal when search input changes rapidly)
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

    if (query.length < minChars) {
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceTimeoutRef.current = setTimeout(() => {
      void performSearch(query);
    }, debounceMs);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query, debounceMs, minChars, performSearch]);

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
    results,
    isSearching,
    error,
    // For displaying to user
    shouldShowResults: query.length >= minChars && !isSearching,
    clear: () => {
      setQuery("");
      setResults([]);
      setError(null);
      lastQueryRef.current = "";
    },
  };
}
