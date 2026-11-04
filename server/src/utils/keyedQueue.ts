/**
 * In-process FIFO queue per key.
 *
 * Booking creation serializes on one database lock document per resource per
 * day. When many requests for the same resource arrive together they all open a
 * transaction and collide on that document; Mongo reports a write conflict, the
 * driver retries each transaction, and N contenders redo their work about N
 * times. Queueing them here lets each take its turn, so the database only ever
 * sees one transaction per resource per instance. The database lock remains the
 * source of truth across instances; this only removes the pile-up inside one.
 */
const tails = new Map<string, Promise<void>>();

export type Release = () => void;

export const acquireKey = async (key: string): Promise<Release> => {
  const previous = tails.get(key) ?? Promise.resolve();
  let release!: Release;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => mine);
  tails.set(key, tail);

  await previous;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
    // Last one out removes the entry so the map does not grow with every key.
    if (tails.get(key) === tail) tails.delete(key);
  };
};

/**
 * Acquires several keys in a stable (sorted) order so two callers that need the
 * same pair cannot each hold one and wait for the other.
 */
export const acquireKeys = async (keys: string[]): Promise<Release> => {
  const ordered = [...new Set(keys)].sort();
  const releases: Release[] = [];
  try {
    for (const key of ordered) releases.push(await acquireKey(key));
  } catch (error) {
    releases.forEach((r) => r());
    throw error;
  }
  return () => releases.reverse().forEach((r) => r());
};

/** Number of keys with someone queued or running. Exposed for tests. */
export const activeKeyCount = (): number => tails.size;
