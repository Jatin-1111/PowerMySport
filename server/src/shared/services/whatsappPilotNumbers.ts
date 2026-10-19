import crypto from "node:crypto";

import {
  WhatsAppPilotMode,
  WhatsAppPilotNumber,
  WhatsAppPilotSettings,
} from "../models/WhatsAppPilotNumber";
import { log as __rootLog } from "../../utils/logger";
import { isOnEnvList } from "./whatsappPilot";
import { normalizeIndianPhone } from "./WhatsAppNotificationService";

const log = __rootLog.child("whatsappPilot");

/**
 * The pilot allow-list kept in the database, so staff can add and remove numbers
 * from the admin panel without a deploy. Numbers are stored as keyed hashes.
 */

/** Keyed hash of a number in Meta's 12-digit form; domain-separated from chat hashes. */
export function hashPilotPhone(normalized: string): string {
  const key = process.env.WHATSAPP_PHONE_HASH_KEY || process.env.JWT_SECRET;
  if (!key) throw new Error("Missing WHATSAPP_PHONE_HASH_KEY or JWT_SECRET");
  return crypto.createHmac("sha256", key).update(`whatsapp-pilot:${normalized}`).digest("hex");
}

const INDIAN_MOBILE = /^91[6-9]\d{9}$/;
export const MAX_ENTRIES_PER_REQUEST = 500;

export interface ParsedEntry {
  phone: string;
  label: string;
}

export interface ParsedInput {
  entries: ParsedEntry[];
  /** Lines that did not hold an Indian mobile number, shown back to staff. */
  invalid: string[];
}

/**
 * Reads pasted text, one number per line, with an optional name after it:
 * "9876543210, Coach Ravi", "+91 98765 43211 Meera (parent)", or a bare number.
 */
export function parsePilotInput(text: string): ParsedInput {
  const entries: ParsedEntry[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(\+?\d[\d\s-]{8,16}\d)\s*[,;\t:-]?\s*(.*)$/);
    const phone = match ? normalizeIndianPhone(match[1]!) : "";
    if (!match || !INDIAN_MOBILE.test(phone)) {
      invalid.push(trimmed.slice(0, 60));
      continue;
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    entries.push({ phone, label: (match[2] ?? "").trim().slice(0, 80) });
  }
  return { entries, invalid };
}

export async function addPilotNumbers(
  text: string,
  addedBy?: string
): Promise<{ added: number; alreadyListed: number; invalid: string[] }> {
  const { entries, invalid } = parsePilotInput(text);
  if (entries.length > MAX_ENTRIES_PER_REQUEST) {
    throw new Error(`Add at most ${MAX_ENTRIES_PER_REQUEST} numbers at a time.`);
  }
  let added = 0;
  let alreadyListed = 0;
  for (const entry of entries) {
    const phoneHash = hashPilotPhone(entry.phone);
    const result = await WhatsAppPilotNumber.updateOne(
      { phoneHash },
      { $setOnInsert: { phoneHash, label: entry.label, lastFour: entry.phone.slice(-4), addedBy } },
      { upsert: true }
    );
    if (result.upsertedCount > 0) added += 1;
    else alreadyListed += 1;
  }
  return { added, alreadyListed, invalid };
}

export async function listPilotNumbers() {
  const docs = await WhatsAppPilotNumber.find().sort({ createdAt: -1 }).lean();
  return docs.map((d) => ({
    id: String(d._id),
    label: d.label,
    lastFour: d.lastFour,
    createdAt: d.createdAt,
  }));
}

export async function removePilotNumber(id: string): Promise<boolean> {
  const result = await WhatsAppPilotNumber.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

/** A new install is closed: until staff open it, only listed numbers get answers. */
export async function getPilotMode(): Promise<WhatsAppPilotMode> {
  const doc = await WhatsAppPilotSettings.findOne({ key: "singleton" }).lean();
  return doc?.mode ?? "listed";
}

export async function setPilotMode(mode: WhatsAppPilotMode, updatedBy?: string): Promise<void> {
  await WhatsAppPilotSettings.updateOne(
    { key: "singleton" },
    { $set: { mode, updatedBy }, $setOnInsert: { key: "singleton" } },
    { upsert: true }
  );
}

/**
 * Whether `from` (a sender number as Meta gives it) may use the assistant.
 * Open to everyone when staff chose that; otherwise only numbers in the database
 * or on `WHATSAPP_ALLOWED_NUMBERS`. If the database cannot be read the answer is
 * "environment list only": a fault never opens the pilot up.
 */
export async function mayUseAssistant(from: string): Promise<boolean> {
  if (isOnEnvList(from)) return true;
  try {
    if ((await getPilotMode()) === "everyone") return true;
    const phoneHash = hashPilotPhone(normalizeIndianPhone(from));
    return (await WhatsAppPilotNumber.exists({ phoneHash })) !== null;
  } catch (err) {
    log.error("Could not read the pilot list; treating the sender as not listed", err);
    return false;
  }
}
