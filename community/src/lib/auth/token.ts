/** Synchronous check for a logged-in session — used to gate interactive
 * actions (like, comment) on pages that are otherwise publicly readable. */
export const hasAuthToken = (): boolean =>
  typeof window !== "undefined" && Boolean(localStorage.getItem("token"));
