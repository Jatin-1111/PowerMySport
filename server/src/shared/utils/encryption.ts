import crypto from "crypto";

/**
 * Shared AES-256-GCM helpers for financial/tax fields at rest (bank account
 * numbers, IFSC, UPI IDs, PAN). Originally private to Academy.ts; extracted
 * here so Expert/Coach/Venue payout data can use the identical, already-
 * proven implementation instead of each carrying their own copy.
 */

const rawEncryptionKey = process.env.BANK_ENCRYPTION_KEY || "";
const ENCRYPTION_KEY = Buffer.from(rawEncryptionKey, "hex");
if (!rawEncryptionKey || ENCRYPTION_KEY.length !== 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: BANK_ENCRYPTION_KEY must be a 32-byte hex string.");
  }
  console.warn(
    "WARNING: BANK_ENCRYPTION_KEY is missing or invalid. Financial fields will not be encrypted correctly.",
  );
}

export const isEncryptedValue = (value: string): boolean =>
  value.split(":").length === 3;

export const encryptValue = (plaintext: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

export const decryptValue = (ciphertext: string): string => {
  if (!ciphertext || !isEncryptedValue(ciphertext)) {
    return ciphertext;
  }

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      return ciphertext;
    }

    const [ivHex, tagHex, encHex] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return ciphertext;
  }
};
