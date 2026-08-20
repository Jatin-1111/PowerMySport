import { communityService } from "@/modules/community/services/community";
import { hasAuthToken } from "@/lib/auth/token";
import type {
  CommunityFollowKind,
  CommunityFollowRecord,
} from "@/modules/community/types";

export type { CommunityFollowKind, CommunityFollowRecord };

/**
 * Follows used to live only in this localStorage key, which meant they did not
 * survive a device change and nothing server-side could act on them. They are
 * persisted per-user now; the key is read once to migrate whatever a returning
 * user still has locally, then removed.
 */
const LEGACY_STORAGE_KEY = "pms:community:follows:v1";

interface LegacyFollowItem {
  id?: unknown;
  kind?: unknown;
}

/** The legacy store used lowercase kinds; the API uses uppercase. */
const toApiKind = (kind: unknown): CommunityFollowKind | null => {
  if (kind === "group") return "GROUP";
  if (kind === "topic") return "TOPIC";
  return null;
};

const readLegacyItems = (): { kind: CommunityFollowKind; targetId: string }[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as LegacyFollowItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      const kind = toApiKind(item?.kind);
      const targetId = typeof item?.id === "string" ? item.id.trim() : "";
      return kind && targetId ? [{ kind, targetId }] : [];
    });
  } catch {
    return [];
  }
};

let cache: CommunityFollowRecord[] | null = null;
let inFlight: Promise<CommunityFollowRecord[]> | null = null;
let migrationDone = false;

const subscribers = new Set<(items: CommunityFollowRecord[]) => void>();

const publish = (items: CommunityFollowRecord[]) => {
  cache = items;
  for (const subscriber of subscribers) {
    subscriber(items);
  }
};

/**
 * Runs at most once per page load, and only for a signed-in user — a guest has
 * nowhere to migrate to, and clearing their key would lose follows they would
 * otherwise keep after logging in.
 */
const migrateLegacyFollows = async (): Promise<void> => {
  if (migrationDone || typeof window === "undefined") {
    return;
  }
  migrationDone = true;

  const legacy = readLegacyItems();
  if (legacy.length === 0) {
    // Nothing to move, but drop an empty/corrupt key so this never re-runs.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return;
  }

  try {
    await communityService.importFollows(legacy);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Leave the key in place so the next load can retry. Losing a follow list
    // silently is worse than importing it a page-load later.
    migrationDone = false;
  }
};

const fetchAll = async (): Promise<CommunityFollowRecord[]> => {
  if (!hasAuthToken()) {
    return [];
  }

  await migrateLegacyFollows();
  const items = await communityService.listFollows();
  publish(items);
  return items;
};

export const communityFollowStore = {
  /** Cached read. Returns `[]` for guests rather than throwing — the Q&A feed
   *  and landing page are publicly readable and call this on mount. */
  async getAll(): Promise<CommunityFollowRecord[]> {
    if (cache) {
      return cache;
    }
    if (inFlight) {
      return inFlight;
    }

    inFlight = fetchAll()
      .catch(() => [] as CommunityFollowRecord[])
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  },

  async getByKind(kind: CommunityFollowKind): Promise<CommunityFollowRecord[]> {
    const items = await this.getAll();
    return items.filter((item) => item.kind === kind);
  },

  async getIdsByKind(kind: CommunityFollowKind): Promise<string[]> {
    const items = await this.getByKind(kind);
    return items.map((item) => item.targetId);
  },

  async isFollowing(
    kind: CommunityFollowKind,
    targetId: string,
  ): Promise<boolean> {
    const items = await this.getByKind(kind);
    return items.some((item) => item.targetId === targetId);
  },

  async toggle(payload: {
    kind: CommunityFollowKind;
    targetId: string;
  }): Promise<{ following: boolean }> {
    const result = await communityService.toggleFollow(payload);
    // Re-read rather than patch the cache locally: the server resolves the
    // label and prunes follows whose group has gone, so its list is the one
    // that renders correctly.
    cache = null;
    publish(await communityService.listFollows());
    return result;
  },

  /** Notifies on every change so two panels showing follow state stay in step.
   *  Returns its own unsubscribe. */
  subscribe(listener: (items: CommunityFollowRecord[]) => void): () => void {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  },
};
