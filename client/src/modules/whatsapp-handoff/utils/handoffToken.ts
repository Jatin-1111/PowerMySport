/**
 * Keeps the link's token for the length of the visit.
 *
 * The token arrives in the address (`/start?t=...`). It is a credential, so it is moved into
 * session storage and taken out of the address bar straight away: it should not sit in browser
 * history, be copied from the URL, or travel in a referrer. Session storage lasts as long as
 * the tab, which is what lets a parent leave to sign up and come back to the same review.
 *
 * Storage can throw (private windows, blocked site data), so every access is guarded and the
 * page still works from the URL alone if it fails.
 */

const KEY = "pms.whatsapp-handoff.token";

export function rememberToken(token: string): void {
  try {
    window.sessionStorage.setItem(KEY, token);
  } catch {
    // The page still has the token in memory for this load.
  }
}

export function recalledToken(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetToken(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing was stored.
  }
}
