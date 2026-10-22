import mongoose, { Document, Schema } from "mongoose";

/**
 * What a parent told the WhatsApp assistant about their children, kept apart from the chat.
 *
 * The chat is raw text and expires in 90 days. This is the few facts worth keeping so a
 * parent who later signs up on the website does not have to say them again. It is a draft,
 * not a profile: nothing here becomes a child on an account until the parent confirms it.
 *
 * Like the chat, the number itself is never stored. `phoneHash` is the same keyed hash the
 * conversation uses (`hashPhone`), so the two can be deleted together on STOP.
 *
 * Deliberately not stored: a surname, a date of birth, a school, anything medical, or the
 * parent's own words. A child's age is kept with the day it was noted, because a year later
 * a bare "14" is wrong.
 */

/** A number can tell us about this many children; more is a different kind of account. */
export const MAX_NOTE_CHILDREN = 4;
export const MAX_NOTE_SPORTS = 3;
/** Unclaimed notes go 12 months after the last message. Claimed ones become profile data. */
export const NOTE_RETENTION_SECONDS = 60 * 60 * 24 * 365;

export interface NoteChild {
  /** Lower-cased first name, the identity of the child within this number. */
  key: string;
  firstName: string;
  age?: number;
  /** When `age` was said, so it can be read back as "about 15" later. */
  ageNotedAt?: Date;
  sports: string[];
  level?: string;
  goal?: string;
  /** One of the 36 state names the site accepts. */
  state?: string;
  notedAt: Date;
}

export interface WhatsAppNoteDocument extends Document {
  phoneHash: string;
  children: NoteChild[];
  createdAt: Date;
  updatedAt: Date;
}

const noteChildSchema = new Schema<NoteChild>(
  {
    key: { type: String, required: true },
    firstName: { type: String, required: true, maxlength: 40 },
    age: { type: Number, min: 3, max: 21 },
    ageNotedAt: { type: Date },
    sports: { type: [{ type: String, maxlength: 40 }], default: [] },
    level: { type: String, maxlength: 60 },
    goal: { type: String, maxlength: 160 },
    state: { type: String, maxlength: 60 },
    notedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const whatsAppNoteSchema = new Schema<WhatsAppNoteDocument>(
  {
    phoneHash: { type: String, required: true, unique: true },
    children: { type: [noteChildSchema], default: [] },
  },
  { timestamps: true }
);

// A child's age, sport and goals are in here, so unclaimed notes are not kept indefinitely.
whatsAppNoteSchema.index({ updatedAt: 1 }, { expireAfterSeconds: NOTE_RETENTION_SECONDS });

export const WhatsAppNote = mongoose.model<WhatsAppNoteDocument>(
  "WhatsAppNote",
  whatsAppNoteSchema
);
