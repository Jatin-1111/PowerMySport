import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * A verified claim that one player profile on this platform is the same person
 * as one row in a federation ranking list.
 *
 * ── Why this is its own collection ───────────────────────────────────────────
 * It could have been three fields on `Player`. It is not, for two reasons that
 * are both about the claim rather than the child:
 *
 *   1. A claim is a *relationship between two datasets*, and the second dataset
 *      is public children's data we mirror rather than own. Keeping it separate
 *      means "who has claimed which ranked player" is one query against one
 *      collection, which is what a DPDP access or erasure request actually asks.
 *   2. It needs a uniqueness rule that spans users (see below), and a field on
 *      `Player` cannot express "no other family may also claim this".
 *
 * ── The two uniqueness rules ─────────────────────────────────────────────────
 * `(sportSlug, regNo)` unique is the important one: a ranked player is a real
 * child, and exactly one account may speak for them. Without it two accounts
 * could both claim the same registration number and both receive that child's
 * movement alerts, which is precisely the harm the verification step exists to
 * prevent.
 *
 * `(dependentId, sportSlug)` unique is the mundane one: a profile has one
 * standing per sport, so a second link would make "this child's rank" ambiguous.
 *
 * ── What is deliberately NOT stored ──────────────────────────────────────────
 * No rank, no points, no category. Those live on `RankingEntry`, change weekly,
 * and a copy here would be a second version of the truth with its own staleness.
 * Reads join live on `regNo` + `isLatest`.
 *
 * No date of birth either, in any form. The DOB the parent types is used once,
 * compared in memory and discarded — see `RankingClaimService`. The whole point
 * of `RankingEntry.dob` being `select: false` is undone if this collection
 * writes a copy of it somewhere with no such guard.
 */
export type RankingClaimVerificationMethod = "DOB_CHALLENGE";

export interface PlayerRankingLinkDocument extends Document {
  /** The account that made and owns the claim. */
  userId: Types.ObjectId;
  /** The claimed profile — a dependent child, or the account holder's own SELF row. */
  dependentId: Types.ObjectId;

  sportSlug: string;
  federationCode: string;
  /** The federation's registration number, as it appears in the ranking list. */
  regNo: string;

  /**
   * How possession was proved. An enum with one member on purpose: a second
   * method (a federation login, a coach vouching) would carry different trust,
   * and code that acts on a link should be able to ask which it was rather than
   * assuming they are equivalent.
   */
  verificationMethod: RankingClaimVerificationMethod;
  verifiedAt: Date;

  /**
   * The as-on date of the newest list this account has already been told about.
   *
   * This, rather than a "last sent at" timestamp, is what makes the weekly
   * digest idempotent. The federation publishes irregularly — 39 of the last 40
   * lists were dated a Monday but the upload lands whenever someone gets to it,
   * sometimes a fortnight later — so "have we sent this week's?" is not a
   * question a clock can answer. Comparing against the list's own date is exact:
   * a digest goes out once per published list, however late it arrives, and a
   * scheduler that runs twice sends nothing the second time.
   *
   * Absent on a link that has never been notified, which is why the first sweep
   * after a claim sends the current standing rather than silence.
   */
  lastNotifiedAsOnDate?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const playerRankingLinkSchema = new Schema<PlayerRankingLinkDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dependentId: { type: Schema.Types.ObjectId, ref: "Player", required: true },

    sportSlug: { type: String, required: true, lowercase: true, trim: true, default: "tennis" },
    federationCode: { type: String, required: true, uppercase: true, trim: true, default: "AITA" },
    regNo: { type: String, required: true, trim: true },

    verificationMethod: {
      type: String,
      enum: ["DOB_CHALLENGE"],
      required: true,
      default: "DOB_CHALLENGE",
    },
    verifiedAt: { type: Date, required: true, default: Date.now },
    lastNotifiedAsOnDate: { type: Date },
  },
  { timestamps: true }
);

// One account may speak for a given ranked player. See the note above.
playerRankingLinkSchema.index({ sportSlug: 1, regNo: 1 }, { unique: true });
// One standing per profile per sport.
playerRankingLinkSchema.index({ dependentId: 1, sportSlug: 1 }, { unique: true });
// The list read: every link this account owns, newest first.
playerRankingLinkSchema.index({ userId: 1, createdAt: -1 });

// Production runs with autoIndex off, so all three also ship as migration 44.

export const PlayerRankingLink = mongoose.model<PlayerRankingLinkDocument>(
  "PlayerRankingLink",
  playerRankingLinkSchema
);
