import mongoose, { Document, Schema } from "mongoose";

/**
 * A dated instance ("edition") of a real tournament — e.g. the August 2026
 * running of the AITA Talent Series. Populated via the admin-managed data
 * source review flow (see DataSourceExtractionService.ts /
 * dataSourceAdminController.ts) — an admin submits a link or PDF, AI extracts
 * candidate editions, and an admin approves before they land here.
 *
 * Distinct from the evergreen Tournament collection (one row per series,
 * fuzzy typicalDates) so multiple dated editions of the same event can
 * coexist and be queried by real date columns ("what's next?").
 */
/** A file or page published alongside an edition — fact sheet, acceptance list, draw. */
export interface EditionDocumentEntry {
  label: string;
  url: string;
  kind: "factSheet" | "acceptanceList" | "entryForm" | "draw" | "results" | "other";
}

export interface TournamentEditionDocument extends Document {
  sportSlug: string;
  /**
   * The federation whose calendar this edition was read from — i.e. who
   * sanctions entry to it, not merely who else might list it.
   *
   * Load-bearing, because a sport has several federations and only some of
   * them have had a calendar sourced. Without it every federation page showed
   * the same sport-wide list, so UTR's page — which says in its own key facts
   * that UTR results do not count toward an AITA ranking — listed AITA ranking
   * events as though they were UTR's.
   *
   * An ITF- or ATF-sanctioned event that AITA prints on its own calendar is
   * attributed to AITA: that is the source we actually read, and claiming it
   * for ITF would assert a calendar we have never sourced.
   */
  federationSlug?: string;
  /** Canonical tournament/event name as published on the official calendar */
  name: string;
  /** URL-safe id for the public detail page — `${kebab(name)}-${startDate}`, deduped with a numeric suffix */
  slug: string;
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

  // ── From the event's own page on the federation site (see the detail
  // enrichment pass in DataSourceExtractionService.ts). The calendar cell only
  // ever carries a name and a week; everything below exists solely there.
  /** The event's page on the federation site — the durable link when a signed document URL expires */
  detailUrl?: string;
  /** Full official title, e.g. "AITA CHAMPIONSHIP SERIES TOURNAMENT (DELHI)" — `name` stays the short calendar form */
  officialName?: string;
  /** Host club/academy running the event */
  organiser?: string;
  state?: string;
  /** Category exactly as the source prints it, e.g. "Under 12 Under 16" */
  category?: string;
  /** Fact sheets, acceptance lists and similar. URLs may be signed and expiring — see detailUrl */
  documents?: EditionDocumentEntry[];

  // ── Derived from the name by `services/aita/editionSeries.ts` ─────────────
  // Tennis only, because the vocabulary being parsed is AITA's. Stored rather
  // than computed per read so a planner can filter on it, and because the same
  // answer should not be re-derived in the client, the server and a migration.
  //
  // `level` is NOT this. It holds "State"/"National"/"International" on the
  // minority of rows that have it at all, and cannot be joined to the ladder
  // the entry rules are written against.
  /** The AITA junior ladder rung, when the event is on it. */
  ladder?: string;
  /** The number printed in "CS7"/"TS7". What it signifies is unverified. */
  grade?: number;
  /** AITA | ITF | ATF | WTA. */
  circuit?: string;
  /**
   * Which sort of event this is. The load-bearing value is anything that is not
   * `junior-ladder`: 14% of the tennis calendar is the senior prize-money
   * circuit carrying age groups of Men and Women, and it must never be offered
   * to a junior as a step on their pathway.
   */
  kind?: string;

  /** The registry URL this edition was extracted from — shown to parents as provenance */
  sourceUrl: string;
  /**
   * Slug of the surviving edition when this row was found to describe the same
   * real event as another (see migration 41). The row is kept rather than
   * deleted so /tournaments/[slug] can answer its old URL with a permanent
   * redirect — those URLs are indexed and carry real search traffic, and a 404
   * would throw that away instead of passing it to the survivor.
   */
  mergedInto?: string;
  status: "announced" | "ongoing" | "completed" | "cancelled";
  /** When the Lane-A pipeline last confirmed this edition against the source */
  lastCheckedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tournamentEditionSchema = new Schema<TournamentEditionDocument>(
  {
    sportSlug: { type: String, required: true, lowercase: true, index: true },
    federationSlug: { type: String, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, lowercase: true, trim: true },
    editionYear: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    registrationDeadlineDate: { type: Date },
    venue: { type: String },
    city: { type: String },
    level: { type: String },
    ageGroups: { type: [String], default: [] },
    detailUrl: { type: String },
    officialName: { type: String, trim: true },
    organiser: { type: String, trim: true },
    state: { type: String, trim: true },
    category: { type: String, trim: true },
    documents: {
      type: [
        {
          _id: false,
          label: { type: String, required: true },
          url: { type: String, required: true },
          kind: {
            type: String,
            enum: ["factSheet", "acceptanceList", "entryForm", "draw", "results", "other"],
            default: "other",
          },
        },
      ],
      default: undefined,
    },
    ladder: { type: String, trim: true },
    grade: { type: Number },
    circuit: { type: String, trim: true },
    kind: { type: String, trim: true },

    sourceUrl: { type: String, required: true },
    mergedInto: { type: String, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ["announced", "ongoing", "completed", "cancelled"],
      default: "announced",
    },
    lastCheckedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One row per dated edition; re-extraction of the same edition updates in place.
tournamentEditionSchema.index({ sportSlug: 1, name: 1, startDate: 1 }, { unique: true });
// The "what's coming up for this sport?" query. It also backs the federation
// page, which adds an equality on `federationSlug`: that narrows a few hundred
// already-fetched rows in memory and buys nothing worth an index, for the same
// reason spelled out for `ladder`/`kind` below.
tournamentEditionSchema.index({ sportSlug: 1, startDate: 1 });
// Backs the public /tournaments/[slug] page. Sparse on purpose: editions
// approved before that page existed carry no slug, and a plain unique index
// would treat every one of those nulls as a duplicate of the last.
tournamentEditionSchema.index({ slug: 1 }, { unique: true, sparse: true });
// Deliberately NO index on `ladder`/`kind`. The planner's working set is the
// upcoming editions for one sport — 46 rows for tennis — which the existing
// `{sportSlug, startDate}` index already delivers, and filtering 46 documents
// in memory costs nothing. An index here would buy no query and spend quota on
// a cluster that has already hit its ceiling once.
// Backs admin getCalendarFreshness — per-sport findOne sorted {lastCheckedAt:-1}.
tournamentEditionSchema.index({ sportSlug: 1, lastCheckedAt: -1 });

export const TournamentEdition =
  mongoose.models.TournamentEdition ||
  mongoose.model<TournamentEditionDocument>("TournamentEdition", tournamentEditionSchema);
