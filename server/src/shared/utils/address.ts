import { normalizeStateName } from "../../constants/indianStates";

/**
 * Canonicalizes address fields on write so stored data stays consistent no
 * matter where it came from (web dropdown, mobile, imports, raw API calls).
 * This is Tier 0 "normalize on write" — the guarantee that survives even if a
 * client bypasses the UI constraints.
 *
 * Only normalizes the fields that are present, so it is safe for both full
 * inserts and partial updates.
 */
export interface NormalizableAddress {
  fullName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

const collapse = (value: string): string => value.trim().replace(/\s+/g, " ");

const toTitleCase = (value: string): string =>
  value.replace(/\b\w/g, (c) => c.toUpperCase());

export const normalizeAddressInput = <T extends NormalizableAddress>(
  data: T,
): T => {
  const out: NormalizableAddress = { ...data };

  if (typeof out.fullName === "string") out.fullName = collapse(out.fullName);
  if (typeof out.email === "string") out.email = out.email.trim().toLowerCase();
  if (typeof out.phone === "string") out.phone = out.phone.trim();
  if (typeof out.addressLine1 === "string")
    out.addressLine1 = collapse(out.addressLine1);
  if (typeof out.addressLine2 === "string")
    out.addressLine2 = collapse(out.addressLine2);
  if (typeof out.city === "string") {
    const city = collapse(out.city);
    out.city = city ? toTitleCase(city) : city;
  }
  if (out.state !== undefined && out.state)
    out.state = normalizeStateName(out.state);
  if (out.postalCode !== undefined && typeof out.postalCode === "string")
    out.postalCode = out.postalCode.replace(/\D/g, "");
  if (out.country !== undefined && typeof out.country === "string" && out.country)
    out.country = out.country.trim().toUpperCase();

  return out as T;
};
