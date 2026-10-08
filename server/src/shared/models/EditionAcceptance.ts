import mongoose, { Document, Schema } from "mongoose";

/**
 * Who got into a finished AITA junior event, as numbers.
 *
 * One document per event and singles category ("BS16" at tournament 31). It holds the
 * draw sizes and the RANKS of the players accepted, sorted, and nothing that identifies
 * anyone: no name, no state, no date of birth, no registration number. That is the
 * point. A rank with no name is enough to say where a draw closed, and this product has
 * no reason to keep a list of children's names (see `acceptanceParser.ts`).
 *
 * What reads it: the planner, to say whether a child of a given rank would have got into
 * an event of the same level, age group and gender (`judgeReach` in shared-types).
 *
 * Small on purpose: about 60 numbers a document, a few hundred documents a year. Written
 * once per category after the event has finished, never updated by a user.
 */
export interface EditionAcceptanceDocument extends Document {
  /** AITA's own tournament id. */
  externalId: string;
  tournamentName: string;
  /** "Super Series", "National Series" and so on. */
  ladder: string;
  /** `YYYY-MM-DD`. */
  startDate: string;
  /** "BS16": boys' singles, under 16. */
  category: string;
  ageGroup: string;
  gender: "Boys" | "Girls";
  mainDrawSize: number;
  mainDirectSlots: number;
  mainRanks: number[];
  mainUnranked: number;
  qualifyingSize: number;
  qualifyingDirectSlots: number;
  qualifyingRanks: number[];
  qualifyingUnranked: number;
  entered?: number | null;
  /** The day the list was last frozen. */
  asOn?: string | null;
  capturedAt: Date;
}

const schema = new Schema<EditionAcceptanceDocument>(
  {
    externalId: { type: String, required: true, trim: true },
    tournamentName: { type: String, required: true, trim: true },
    ladder: { type: String, required: true, trim: true },
    startDate: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    ageGroup: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["Boys", "Girls"], required: true },
    mainDrawSize: { type: Number, required: true, min: 0 },
    mainDirectSlots: { type: Number, required: true, min: 0 },
    mainRanks: { type: [Number], default: [] },
    mainUnranked: { type: Number, default: 0, min: 0 },
    qualifyingSize: { type: Number, default: 0, min: 0 },
    qualifyingDirectSlots: { type: Number, default: 0, min: 0 },
    qualifyingRanks: { type: [Number], default: [] },
    qualifyingUnranked: { type: Number, default: 0, min: 0 },
    entered: { type: Number, default: null },
    asOn: { type: String, default: null },
    capturedAt: { type: Date, required: true },
  },
  { collection: "editionacceptances" }
);

// One document per event and category: re-capturing replaces it, never duplicates it.
schema.index({ externalId: 1, category: 1 }, { unique: true });
// The planner's one query: every past event of a level, age group and gender, newest first.
schema.index({ ladder: 1, ageGroup: 1, gender: 1, startDate: -1 });

export const EditionAcceptance = mongoose.model<EditionAcceptanceDocument>(
  "EditionAcceptance",
  schema
);
