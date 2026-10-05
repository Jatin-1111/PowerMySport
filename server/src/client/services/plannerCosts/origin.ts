import { AppError } from "../../../utils/AppError";
import { User } from "../../models/User";
import type { Origin } from "./types";

/**
 * Where a family travels from.
 *
 * The parent's profile city comes first, because it is the one they chose to tell
 * us. Failing that, a saved address, then the state the child is registered in on
 * the ranking list, which every linked child has. A state is far coarser than a
 * city, so the page says which one it used and offers to take a city instead.
 *
 * ── Why the city is stored on the profile ───────────────────────────────────
 * On 2026-10-05 no parent had a city saved anywhere, so there was nothing to read.
 * The planner asks once and writes the answer to the existing `User.city` field,
 * which means it is the profile's city and not a private copy the planner keeps.
 * Account deletion already clears that field.
 */

/** Letters, spaces and the punctuation real place names use. No digits, no markup. */
const CITY_PATTERN = /^[\p{L}][\p{L}\s.'-]{1,59}$/u;

export function parseCity(value: unknown): string {
  const city = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!CITY_PATTERN.test(city)) {
    throw new AppError("Enter your city, using letters only.", 400);
  }
  return city;
}

const cityOf = (value: string | null | undefined): string | null => {
  const city = value?.trim();
  return city ? city : null;
};

export async function resolveOrigin(
  userId: string,
  registeredState: string | null
): Promise<Origin> {
  const user = await User.findById(userId)
    .select("city addresses defaultAddressId shippingAddress")
    .lean();

  const addresses = user?.addresses ?? [];
  const defaultAddress =
    addresses.find((address) => String(address._id) === String(user?.defaultAddressId)) ??
    addresses[0];

  const city =
    cityOf(user?.city) ?? cityOf(defaultAddress?.city) ?? cityOf(user?.shippingAddress?.city);
  if (city) return { kind: "city", city, label: city };

  const state = cityOf(registeredState);
  if (state) return { kind: "state", state, label: state };

  return { kind: "none", label: null };
}

/** Save the city on the parent's profile. Returns what was stored. */
export async function setHomeCity(userId: string, value: unknown): Promise<string> {
  const city = parseCity(value);
  const result = await User.updateOne({ _id: userId }, { $set: { city } });
  if (result.matchedCount === 0) throw new AppError("Account not found.", 404);
  return city;
}
