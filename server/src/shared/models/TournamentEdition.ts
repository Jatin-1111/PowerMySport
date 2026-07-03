import mongoose, { Document, Schema } from "mongoose";

/**
 * A dated instance ("edition") of a real tournament — e.g. the August 2026
 * running of the AITA Talent Series — extracted by the Lane-A calendar
 * pipeline (tournamentCalendarService) from official federation calendar
 * pages listed in the tournament source registry.
 *
 * Distinct from the evergreen Tournament collection (one row per series,
 * fuzzy typicalDates) so multiple dated editions of the same event can
 * coexist and be queried by real date columns ("what's next?").
 */
export interface TournamentEditionDocument extends Document {
  sportSlug: string;
  /** Canonical tournament/event name as published on the official calendar */
  name: string;
  /** Year of this edition, e.g. 2026 */
  editionYear: number;
  startDate: Date;
  endDate?: Date;
  registrationDeadlineDate?: Date;
  venue?: string;
  city?: string;
  /** e.g. "District" | "State" | "National" | "International" — free-form, calendar wording varies */
  level?: string;
  /** e.g. ["Under-12", "Under-14"] */
  ageGroups?: string[];
  /** The registry URL this edition was extracted from — shown to parents as provenance */
  sourceUrl: string;
  status: "announced" | "ongoing" | "completed" | "cancelled";
  /** When the Lane-A pipeline last confirmed this edition against the source */
  lastCheckedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tournamentEditionSchema = new Schema<TournamentEditionDocument>(
  {
    sportSlug: { type: String, required: true, lowercase: true, index: true },
    name: { type: String, required: true, trim: true },
    editionYear: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    registrationDeadlineDate: { type: Date },
    venue: { type: String },
    city: { type: String },
    level: { type: String },
    ageGroups: { type: [String], default: [] },
    sourceUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ["announced", "ongoing", "completed", "cancelled"],
      default: "announced",
    },
    lastCheckedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One row per dated edition; re-extraction of the same edition updates in place.
tournamentEditionSchema.index(
  { sportSlug: 1, name: 1, startDate: 1 },
  { unique: true },
);
// The "what's coming up for this sport?" query.
tournamentEditionSchema.index({ sportSlug: 1, startDate: 1 });

export const TournamentEdition =
  mongoose.models.TournamentEdition ||
  mongoose.model<TournamentEditionDocument>(
    "TournamentEdition",
    tournamentEditionSchema,
  );
