import { encryptValue, decryptValue, isEncryptedValue } from "./encryption";

/**
 * App-layer encryption for the sensitive fields on Coach / Venue / Expert
 * payout methods.
 *
 * On the Mongo side these are handled transparently by the models: a
 * `pre("save")` hook encrypts on write and schema-level field getters decrypt
 * on read. Prisma has no equivalent hooks/getters, so the identical behaviour
 * is applied explicitly at the payout-method read/write call sites (the payout
 * controllers). Only `accountNumber`, `ifscCode` and `upiId` are encrypted at
 * rest — matching the Mongoose models exactly; `accountHolderName` and
 * `bankName` stay in the clear.
 */
const SENSITIVE_FIELDS = ["accountNumber", "ifscCode", "upiId"] as const;

/**
 * Encrypt the sensitive fields of a payout-method write payload before it is
 * persisted. Mirrors the models' `pre("save")` hook, including the
 * `!isEncryptedValue` guard that prevents double-encrypting a value that is
 * already ciphertext. Returns a shallow copy; the input object is not mutated.
 */
export const encryptPayoutFields = <T extends object>(fields: T): T => {
  const out = { ...fields } as Record<string, unknown>;
  for (const field of SENSITIVE_FIELDS) {
    const value = out[field];
    if (typeof value === "string" && value && !isEncryptedValue(value)) {
      out[field] = encryptValue(value);
    }
  }
  return out as unknown as T;
};

/**
 * Decrypt the sensitive fields of a single stored payout-method row before it
 * is returned to its owner (or an admin processing the payout). `decryptValue`
 * is a no-op on plaintext, so rows written before encryption existed pass
 * through unchanged. Returns a shallow copy; the input is not mutated.
 */
export const decryptPayoutMethod = <T extends object>(method: T): T => {
  const out = { ...method } as Record<string, unknown>;
  for (const field of SENSITIVE_FIELDS) {
    const value = out[field];
    if (typeof value === "string" && value) {
      out[field] = decryptValue(value);
    }
  }
  return out as unknown as T;
};

/** Decrypt every row in a list (null/undefined is treated as an empty list). */
export const decryptPayoutMethods = <T extends object>(
  methods: T[] | null | undefined,
): T[] => (methods ?? []).map((method) => decryptPayoutMethod(method));
