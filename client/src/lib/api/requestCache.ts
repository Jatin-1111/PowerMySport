type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export const getCachedValue = <T>(key: string): T | null => {
  const entry = responseCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.value as T;
};

export const setCachedValue = <T>(
  key: string,
  value: T,
  ttlMs: number,
): void => {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(0, ttlMs),
  });
};

export const withRequestCache = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> => {
  const cached = getCachedValue<T>(key);
  if (cached !== null) {
    return cached;
  }

  const activeRequest = inFlightRequests.get(key) as Promise<T> | undefined;
  if (activeRequest) {
    return activeRequest;
  }

  const requestPromise = (async () => {
    const value = await fetcher();
    setCachedValue(key, value, ttlMs);
    return value;
  })();

  inFlightRequests.set(key, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(key);
  }
};

export const clearRequestCache = (prefixes?: string[]): void => {
  if (!prefixes || prefixes.length === 0) {
    responseCache.clear();
    inFlightRequests.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      responseCache.delete(key);
    }
  }

  for (const key of inFlightRequests.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      inFlightRequests.delete(key);
    }
  }
};
