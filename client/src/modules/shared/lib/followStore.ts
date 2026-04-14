export type FollowKind = "coach" | "venue";

export interface FollowItem {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  kind: FollowKind;
  createdAt: string;
}

const STORAGE_KEY = "pms:client:follows:v1";

const safeParse = (value: string | null): FollowItem[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as FollowItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.href === "string" &&
        (item.kind === "coach" || item.kind === "venue"),
    );
  } catch {
    return [];
  }
};

const readAll = (): FollowItem[] => {
  if (typeof window === "undefined") {
    return [];
  }

  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

const writeAll = (items: FollowItem[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const clientFollowStore = {
  getAll(): FollowItem[] {
    return readAll().sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  getByKind(kind: FollowKind): FollowItem[] {
    return this.getAll().filter((item) => item.kind === kind);
  },

  isFollowing(kind: FollowKind, id: string): boolean {
    return readAll().some((item) => item.kind === kind && item.id === id);
  },

  toggle(item: Omit<FollowItem, "createdAt">): { following: boolean } {
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
