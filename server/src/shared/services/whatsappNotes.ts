import {
  MAX_NOTE_CHILDREN,
  MAX_NOTE_SPORTS,
  WhatsAppNote,
  type NoteChild,
} from "../../client/models/WhatsAppNote";
import { isCanonicalState, normalizeStateName } from "../../constants/indianStates";

/**
 * Notes about a parent's children, from what they told the WhatsApp assistant.
 *
 * Everything the model passes is untrusted text that will later be shown back to the parent
 * and, on the site's review page, rendered in a browser. So each field is cut down to a
 * plain, short value here, once, and nothing else in the system has to trust it.
 */

export interface NoteInput {
  childName: string;
  age?: unknown;
  sports?: unknown;
  level?: unknown;
  goal?: unknown;
  state?: unknown;
}

export type SaveNoteResult =
  | { saved: true; created: boolean; child: NoteChild }
  | { saved: false; reason: "no_name" | "limit_reached" };

/** Plain words only: no links, markup, line breaks or runs of spaces. */
function plain(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[<>{}[\]\\`]/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
  return text || undefined;
}

/** The first name only: a surname the parent mentioned is cut off and never kept. */
export function cleanFirstName(value: unknown): string | undefined {
  const first = plain(value, 80)
    ?.split(" ")[0]
    ?.replace(/[^\p{L}'-]/gu, "");
  return first ? first.slice(0, 40) : undefined;
}

const cleanAge = (value: unknown): number | undefined => {
  const age = typeof value === "number" ? value : Number(value);
  return Number.isFinite(age) && Number.isInteger(age) && age >= 3 && age <= 21 ? age : undefined;
};

const cleanSports = (value: unknown): string[] | undefined => {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : undefined;
  if (!list) return undefined;
  const sports = list
    .map((sport) => plain(sport, 40))
    .filter((sport): sport is string => Boolean(sport));
  return [...new Set(sports)].slice(0, MAX_NOTE_SPORTS);
};

/** A state is kept only when it is one the site accepts; a city or a guess is dropped. */
const cleanState = (value: unknown): string | undefined => {
  const text = plain(value, 60);
  if (!text) return undefined;
  const state = normalizeStateName(text);
  return isCanonicalState(state) ? state : undefined;
};

export async function saveChildNote(phoneHash: string, input: NoteInput): Promise<SaveNoteResult> {
  const firstName = cleanFirstName(input.childName);
  if (!firstName) return { saved: false, reason: "no_name" };
  const key = firstName.toLowerCase();

  const age = cleanAge(input.age);
  const sports = cleanSports(input.sports);
  const level = plain(input.level, 60);
  const goal = plain(input.goal, 160);
  const state = cleanState(input.state);
  const now = new Date();

  // Only what was given is written, so a later message about the sport does not erase the age.
  const changes: Record<string, unknown> = { "children.$.notedAt": now };
  if (age !== undefined) {
    changes["children.$.age"] = age;
    changes["children.$.ageNotedAt"] = now;
  }
  if (sports !== undefined) changes["children.$.sports"] = sports;
  if (level) changes["children.$.level"] = level;
  if (goal) changes["children.$.goal"] = goal;
  if (state) changes["children.$.state"] = state;

  const updateExisting = async (): Promise<NoteChild | null> => {
    const note = await WhatsAppNote.findOneAndUpdate(
      { phoneHash, "children.key": key },
      { $set: changes },
      { new: true }
    ).lean();
    return note?.children.find((child) => child.key === key) ?? null;
  };

  const existing = await updateExisting();
  if (existing) return { saved: true, created: false, child: existing };

  const child: NoteChild = {
    key,
    firstName,
    sports: sports ?? [],
    notedAt: now,
    ...(age !== undefined ? { age, ageNotedAt: now } : {}),
    ...(level ? { level } : {}),
    ...(goal ? { goal } : {}),
    ...(state ? { state } : {}),
  };

  try {
    // One atomic step: add only while there is room and this child is not already there.
    // If the note exists but the condition fails, the upsert collides on the unique number
    // index, which is how a full note and a message that raced us are told apart below.
    await WhatsAppNote.updateOne(
      {
        phoneHash,
        "children.key": { $ne: key },
        // "Room for one more" as "no element at the last slot yet": an upsert filter may not
        // use $expr, and this says the same thing without reading the array first.
        [`children.${MAX_NOTE_CHILDREN - 1}`]: { $exists: false },
      },
      { $push: { children: child } },
      { upsert: true }
    );
    return { saved: true, created: true, child };
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    // A message for the same child got in first, or the note is full.
    const raced = await updateExisting();
    return raced
      ? { saved: true, created: false, child: raced }
      : { saved: false, reason: "limit_reached" };
  }
}

export async function getNotes(phoneHash: string): Promise<NoteChild[]> {
  const note = await WhatsAppNote.findOne({ phoneHash }).lean();
  return note?.children ?? [];
}

/** Removes one child by first name. Returns how many were removed (0 or 1). */
export async function forgetChild(phoneHash: string, childName: string): Promise<number> {
  const key = cleanFirstName(childName)?.toLowerCase();
  if (!key) return 0;
  const result = await WhatsAppNote.updateOne(
    { phoneHash, "children.key": key },
    { $pull: { children: { key } } }
  );
  return result.modifiedCount;
}

/** Removes every note for this number. Used by "forget everything" and by STOP. */
export async function forgetAllNotes(phoneHash: string): Promise<number> {
  const result = await WhatsAppNote.deleteOne({ phoneHash });
  return result.deletedCount;
}

/** "14" said a year ago is "about 15" now; the age is never read back as if it were new. */
export function describeAge(child: NoteChild, now: Date = new Date()): string | undefined {
  if (child.age === undefined) return undefined;
  const said = child.ageNotedAt ? new Date(child.ageNotedAt) : undefined;
  const years = said
    ? Math.floor((now.getTime() - said.getTime()) / (365.25 * 24 * 3600 * 1000))
    : 0;
  return years >= 1 ? `about ${Math.min(child.age + years, 21)}` : String(child.age);
}

/** What the tools hand back: first names and the facts, in the shape the model reads. */
export function presentChild(child: NoteChild, now: Date = new Date()) {
  const age = describeAge(child, now);
  return {
    child: child.firstName,
    ...(age ? { age } : {}),
    ...(child.sports.length ? { sports: child.sports } : {}),
    ...(child.level ? { level: child.level } : {}),
    ...(child.goal ? { goal: child.goal } : {}),
    ...(child.state ? { state: child.state } : {}),
  };
}

/** The prompt block for a returning parent, so they are never asked for the same thing twice. */
export function formatNotesForPrompt(children: NoteChild[], now: Date = new Date()): string {
  if (children.length === 0) return "";
  const lines = children.map((child) => {
    const facts = presentChild(child, now);
    const parts = [
      facts.age ? `${facts.age} years old` : null,
      facts.sports ? `plays or is considering ${facts.sports.join(", ")}` : null,
      facts.level ? `level: ${facts.level}` : null,
      facts.goal ? `goal: ${facts.goal}` : null,
      facts.state ? `from ${facts.state}` : null,
    ].filter(Boolean);
    return `- ${child.firstName}: ${parts.length ? parts.join("; ") : "no details yet"}.`;
  });
  return `

## What this parent has already told you
They told you this in an earlier chat. Use it and do not ask for it again; if something sounds out of date, check it in one short question.
${lines.join("\n")}`;
}
