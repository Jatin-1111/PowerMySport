import { CHILD_ACADEMIC_BOARDS } from "@powermysport/shared-types";
import type { ChildAcademicBoard } from "@powermysport/shared-types";
import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * What a university coach needs to place a student, one document per child: the school board, the
 * year the child finishes school, and optionally the school and the field they want to study.
 *
 * Dated results and test scores are `ChildEvent` rows (kinds academic_result and test_score), not
 * fields here, because there can be many and each has a date. Everything is the family's own
 * statement; the product never claims it checked a grade or an eligibility rule.
 */
export interface ChildAcademicProfileDocument extends Document {
  childId: Types.ObjectId;
  userId: Types.ObjectId;
  board?: ChildAcademicBoard;
  /** The calendar year the child finishes school, which is what a recruiter calls their class. */
  graduationYear?: number;
  /** Shown only if the parent fills it in. A school name points at a real child, so it is optional. */
  school?: string;
  intendedField?: string;
  createdAt: Date;
  updatedAt: Date;
}

const childAcademicProfileSchema = new Schema<ChildAcademicProfileDocument>(
  {
    childId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    board: { type: String, enum: [...CHILD_ACADEMIC_BOARDS] },
    graduationYear: { type: Number, min: 2020, max: 2060 },
    school: { type: String, trim: true, maxlength: 120 },
    intendedField: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true }
);

// One profile per child.
childAcademicProfileSchema.index({ childId: 1 }, { name: "childId_1", unique: true });
// Deleting an account removes the profile.
childAcademicProfileSchema.index({ userId: 1 }, { name: "userId_1" });

export const ChildAcademicProfile = mongoose.model<ChildAcademicProfileDocument>(
  "ChildAcademicProfile",
  childAcademicProfileSchema
);
