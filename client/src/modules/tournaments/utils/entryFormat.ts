import { formatFullDate } from "@/modules/pathway/services/tournamentEditionPage";

/** `HH:MM` as the federation prints it (IST) to "11:59 pm IST". */
export function clock(time: string | null | undefined): string | null {
  const match = time?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "pm" : "am";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${match[2]} ${suffix} IST`;
}

/** A printed day, with its IST time when one is printed. */
export function withTime(day: string, time: string | null | undefined): string {
  const at = clock(time);
  return at ? `${formatFullDate(day)}, ${at}` : formatFullDate(day);
}

export const rupees = (amount: number): string => `₹${amount.toLocaleString("en-IN")}`;

const SIDE: Record<string, string> = { B: "Boys'", G: "Girls'", M: "Men's", W: "Women's" };
const FORMAT: Record<string, string> = { S: "singles", D: "doubles" };

/**
 * "BS18" read out in words: "Boys' singles, under 18". A code that does not fit the
 * pattern is returned as printed, because a wrong expansion is worse than none.
 */
export function describeDrawCode(code: string): string {
  const match = /^([BGMW])([SD])(\d{1,2})?$/.exec(code.trim().toUpperCase());
  if (!match) return code;
  const age = match[3] ? `, under ${match[3]}` : "";
  return `${SIDE[match[1]!]} ${FORMAT[match[2]!]}${age}`;
}

/** A phone number as a tappable link, keeping only the digits and a leading plus. */
export function telHref(phone: string): string | null {
  const first = phone.split(/[;,/]/)[0] ?? "";
  const digits = first.replace(/[^\d+]/g, "");
  return digits.length >= 6 ? `tel:${digits}` : null;
}

/** A website as printed ("www.example.com") to an absolute address, or null if it does not look like one. */
export function websiteHref(site: string): string | null {
  const trimmed = site.trim();
  if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(trimmed)) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
