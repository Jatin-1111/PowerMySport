import {
  CHILD_EVENT_DATE_PRECISIONS,
  CHILD_EVENT_KINDS,
  CHILD_HISTORY_LIMITS,
} from "@powermysport/shared-types";
import type { ChildEventDatePrecision, ChildEventKind } from "@powermysport/shared-types";
import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * One thing a parent recorded in their child's sporting history: a tournament result, a spell of
 * coaching, an award, a fitness test, an academic result or a test score.
 *
 * Only what the parent typed is stored. A tournament marked played in the planner, the sport the
 * family chose and the child's ranking are read live when the timeline is built, so there is no
 * second copy of them to go stale. `editionSlug` is how a stored result is matched back to the
 * played tournament it belongs to; at most one result is kept per child and tournament.
 *
 * Every text field is cut down and capped by the service before it gets here, and is rendered as
 * plain text. `resultUrl` is an https link a reader can open to check the entry; the server never
 * fetches it.
 */
export interface ChildEventDocument extends Document {
  childId: Types.ObjectId;
  /** The parent's account, so deleting the account removes the history without walking children. */
  userId: Types.ObjectId;
  kind: ChildEventKind;
  title: string;
  detail?: string;
  /** A short outcome: a round reached, a grade, a score. Shown beside the title. */
  resultLabel?: string;
  occurredOn: Date;
  datePrecision: ChildEventDatePrecision;
  /** Coaching spells only: when it ended. Absent means it is still going. */
  endedOn?: Date;
  /** The official draw or results page, so a reader can check the entry themselves. */
  resultUrl?: string;
  /** The planner edition this result belongs to, when it was added from a played tournament. */
  editionSlug?: string;
  sportSlug?: string;
  createdAt: Date;
  updatedAt: Date;
}

const childEventSchema = new Schema<ChildEventDocument>(
  {
    childId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: [...CHILD_EVENT_KINDS], required: true },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: CHILD_HISTORY_LIMITS.titleChars,
    },
    detail: { type: String, trim: true, maxlength: CHILD_HISTORY_LIMITS.detailChars },
    resultLabel: { type: String, trim: true, maxlength: CHILD_HISTORY_LIMITS.resultLabelChars },
    occurredOn: { type: Date, required: true },
    datePrecision: {
      type: String,
      enum: [...CHILD_EVENT_DATE_PRECISIONS],
      required: true,
      default: "month",
    },
    endedOn: { type: Date },
    resultUrl: { type: String, trim: true, maxlength: 500 },
    editionSlug: { type: String, trim: true, maxlength: 120 },
    sportSlug: { type: String, trim: true, maxlength: 60 },
  },
  { timestamps: true }
);

// The timeline: one child's entries, newest first.
childEventSchema.index({ childId: 1, occurredOn: -1 }, { name: "childId_1_occurredOn_-1" });
// One stored result per played tournament, so adding a result twice edits it instead.
childEventSchema.index(
  { childId: 1, editionSlug: 1 },
  {
    name: "childId_1_editionSlug_1",
    unique: true,
    partialFilterExpression: { editionSlug: { $type: "string" } },
  }
);
// Deleting an account removes every entry the parent owns.
childEventSchema.index({ userId: 1 }, { name: "userId_1" });

export const ChildEvent = mongoose.model<ChildEventDocument>("ChildEvent", childEventSchema);
