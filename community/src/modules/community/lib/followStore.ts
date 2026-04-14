export type CommunityFollowKind = "group" | "topic";

export interface CommunityFollowItem {
  id: string;
  label: string;
  href: string;
  kind: CommunityFollowKind;
  createdAt: string;
}

const STORAGE_KEY = "pms:community:follows:v1";

const parse = (value: string | null): CommunityFollowItem[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as CommunityFollowItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.href === "string" &&
        (item.kind === "group" || item.kind === "topic"),
    );
  } catch {
    return [];
  }
};

const readAll = () => {
  if (typeof window === "undefined") {
    return [] as CommunityFollowItem[];
  }

  return parse(window.localStorage.getItem(STORAGE_KEY));
};

const writeAll = (items: CommunityFollowItem[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const communityFollowStore = {
  getAll(): CommunityFollowItem[] {
    return readAll().sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  getByKind(kind: CommunityFollowKind): CommunityFollowItem[] {
    return this.getAll().filter((item) => item.kind === kind);
  },

  isFollowing(kind: CommunityFollowKind, id: string): boolean {
    return readAll().some((item) => item.kind === kind && item.id === id);
  },

  toggle(item: Omit<CommunityFollowItem, "createdAt">): { following: boolean } {
    const current = readAll();
    const exists = current.some(
      (existing) => existing.kind === item.kind && existing.id === item.id,
    );

    if (exists) {
      writeAll(
        current.filter(
          (existing) =>
            !(existing.kind === item.kind && existing.id === item.id),
        ),
      );
      return { following: false };
    }

    writeAll([
      ...current,
      {
        ...item,
        createdAt: new Date().toISOString(),
      },
    ]);
    return { following: true };
  },
};
