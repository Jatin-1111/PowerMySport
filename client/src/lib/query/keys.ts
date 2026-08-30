/**
 * Query keys, declared in one place.
 *
 * Keys are what tie a mutation's invalidation to the queries it affects, so
 * scattering them is how caches go stale in ways nobody can trace. Declaring
 * them here means an invalidation can be checked against its readers by reading
 * one file.
 *
 * Deliberately NO user id in any key: `QueryProvider` scopes the whole cache to
 * the signed-in session and empties it on any identity change, so per-key
 * scoping would be redundant — and a convention every future contributor has to
 * remember is exactly the thing that failed before (the old `requestCache` was
 * keyed by URL alone and leaked between users on a shared device).
 */
export const queryKeys = {
  auth: {
    profile: ["auth", "profile"] as const,
  },

  notifications: {
    /** Unread in-app notification count. */
    unreadCount: ["notifications", "unread-count"] as const,
  },

  friends: {
    all: ["friends"] as const,
    list: (page: number, limit: number, search?: string) =>
      ["friends", "list", { page, limit, search: search ?? "" }] as const,
    pendingRequests: ["friends", "pending-requests"] as const,
    pendingRequestsCount: ["friends", "pending-requests-count"] as const,
    searchUsers: (query: string, page: number) =>
      ["friends", "search-users", { query, page }] as const,
    forBooking: (query: string) => ["friends", "for-booking", query] as const,
    status: (targetId: string) => ["friends", "status", targetId] as const,
  },

  coachPrograms: {
    all: ["coach-programmes"] as const,
    browse: (sport: string, online: boolean) =>
      ["coach-programmes", "browse", { sport, online }] as const,
    mine: ["coach-programmes", "mine"] as const,
    mySessions: ["coach-programmes", "sessions", "mine"] as const,
    makeupsOwed: ["coach-programmes", "sessions", "makeups-owed"] as const,
    earnings: ["coach-programmes", "sessions", "earnings"] as const,
    myEnrollments: ["coach-programmes", "my", "enrollments"] as const,
    myUpcoming: ["coach-programmes", "my", "sessions"] as const,
    myPackages: ["coach-programmes", "packages", "mine"] as const,
  },

  bookings: {
    all: ["bookings"] as const,
    quote: (subtotal: number, discount: number) =>
      ["bookings", "quote", { subtotal, discount }] as const,
    subscriptionQuote: (basePaise: number) =>
      ["bookings", "subscription-quote", basePaise] as const,
    invitations: (status?: string) =>
      ["bookings", "invitations", status ?? "ALL"] as const,
    pendingInvitationsCount: ["bookings", "pending-invitations-count"] as const,
  },

  discovery: {
    all: ["discovery"] as const,
    nearbyVenues: (params: unknown) =>
      ["discovery", "nearby-venues", params] as const,
    nearbyCoaches: (params: unknown) =>
      ["discovery", "nearby-coaches", params] as const,
    venue: (id: string) => ["discovery", "venue", id] as const,
    coach: (id: string) => ["discovery", "coach", id] as const,
  },
} as const;
