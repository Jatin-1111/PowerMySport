import type { ChildSharePublicView } from "@powermysport/shared-types";

/**
 * Reading a shared profile, for someone who has the link and no account.
 *
 * These calls use plain `fetch`, not the browser axios instance, on purpose. That instance
 * attaches a signed-in user's token and reacts to a 401 by sending the person to the login page;
 * neither belongs on a page that works for a stranger. And nothing here is ever cached: a link
 * that has been stopped must stop working at once, and a playback link is good for minutes.
 */

const apiBase = (): string => process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export type SharedProfileResult =
  /** The profile. */
  | { kind: "ok"; view: ChildSharePublicView }
  /** The link existed and is over: expired, stopped, or the child was removed. */
  | { kind: "gone" }
  /** The link is not one we issued. */
  | { kind: "missing" }
  /** Something else went wrong, or the link is being opened too fast. Worth trying again. */
  | { kind: "unavailable" };

/** Asked for on the server when the page is built, so the content is in the HTML. */
export async function fetchSharedProfile(token: string): Promise<SharedProfileResult> {
  try {
    const res = await fetch(`${apiBase()}/share/${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return { kind: "missing" };
    if (res.status === 410) return { kind: "gone" };
    if (!res.ok) return { kind: "unavailable" };
    const body = await res.json();
    return body?.success && body?.data
      ? { kind: "ok", view: body.data as ChildSharePublicView }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Asked for in the browser when a reader presses Play. The link it returns works for minutes. */
export async function fetchSharedPlayback(
  token: string,
  videoId: string
): Promise<{ url: string }> {
  const res = await fetch(
    `${apiBase()}/share/${encodeURIComponent(token)}/videos/${encodeURIComponent(videoId)}/playback`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`playback ${res.status}`);
  const body = await res.json();
  if (!body?.data?.url) throw new Error("playback without a link");
  return { url: body.data.url as string };
}

/** Where the CV for a link is downloaded from. A plain address, so it works as a link. */
export const sharedCvUrl = (token: string): string =>
  `${apiBase()}/share/${encodeURIComponent(token)}/cv.pdf`;

export interface ContactRequestInput {
  name: string;
  email: string;
  message?: string;
}

export type ContactResult = { ok: true } | { ok: false; message: string };

const FALLBACK = "Your request could not be sent. Please try again.";

/**
 * Asks the family behind a link to get in touch. The family's own address is never part of the
 * answer; all that comes back is whether it was sent, and if not, a message fit to show.
 */
export async function sendContactRequest(
  token: string,
  input: ContactRequestInput
): Promise<ContactResult> {
  try {
    const res = await fetch(`${apiBase()}/share/${encodeURIComponent(token)}/contact`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    // A validation failure lists its problems; the first reads best on its own.
    const message =
      typeof body?.errors?.[0]?.message === "string"
        ? body.errors[0].message
        : typeof body?.message === "string"
          ? body.message
          : FALLBACK;
    return { ok: false, message };
  } catch {
    return { ok: false, message: FALLBACK };
  }
}
