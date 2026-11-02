import type { Schema } from "mongoose";

/**
 * One status vocabulary for coaches, experts, venues and academies.
 *
 *   DRAFT        started, not submitted for review
 *   SUBMITTED    waiting for an admin
 *   NEEDS_INFO   an admin asked for more, or approval is waiting on one more check
 *   APPROVED     reviewed and live
 *   REJECTED     reviewed and declined
 *   SUSPENDED    was approved, is switched off
 *
 * `lifecycle` is never set by hand. It is calculated from the fields each model
 * already had (`verificationStatus`, `approvalStatus`, `isApproved`, ...) by
 * `deriveLifecycle`, and the hooks below recalculate it on every write that goes
 * through Mongoose. Those older fields stay in charge of what the public sees;
 * `lifecycle` drives the admin review queue and the status words.
 *
 * This file imports no model, so a script can use it with the raw driver.
 */
export const LIFECYCLES = [
  "DRAFT",
  "SUBMITTED",
  "NEEDS_INFO",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;

export type Lifecycle = (typeof LIFECYCLES)[number];
export type LifecycleKind = "coach" | "expert" | "venue" | "academy";

/** The fields `deriveLifecycle` reads, per kind. Used to select just enough to resync. */
export const LIFECYCLE_SOURCE_FIELDS: Record<LifecycleKind, string> = {
  coach: "verificationStatus",
  expert: "verificationStatus isActive",
  venue: "approvalStatus documents",
  academy: "onboardingCompleted isApproved isActive kycVerified rejectionReason",
};

type Source = Record<string, unknown>;

export const deriveLifecycle = (kind: LifecycleKind, doc: Source): Lifecycle => {
  switch (kind) {
    case "coach":
      switch (doc.verificationStatus) {
        case "VERIFIED":
          return "APPROVED";
        case "PENDING":
          return "SUBMITTED";
        case "REVIEW":
          return "NEEDS_INFO";
        case "REJECTED":
          return "REJECTED";
        default:
          return "DRAFT";
      }

    case "expert":
      switch (doc.verificationStatus) {
        case "APPROVED":
          return doc.isActive === false ? "SUSPENDED" : "APPROVED";
        case "PENDING":
          return "SUBMITTED";
        case "REJECTED":
          return "REJECTED";
        default:
          return "DRAFT";
      }

    case "venue":
      switch (doc.approvalStatus) {
        case "APPROVED":
          return "APPROVED";
        case "REVIEW":
          return "NEEDS_INFO";
        case "REJECTED":
          return "REJECTED";
        default: {
          // A venue row exists from onboarding step 1, so "pending" with no
          // documents is a draft, not a submission.
          const documents = doc.documents;
          return Array.isArray(documents) && documents.length > 0 ? "SUBMITTED" : "DRAFT";
        }
      }

    case "academy": {
      if (doc.isApproved === true) {
        if (doc.isActive === true) return "APPROVED";
        // Approved but not live: waiting on the KYC check, or switched off.
        return doc.kycVerified === true ? "SUSPENDED" : "NEEDS_INFO";
      }
      if (doc.onboardingCompleted !== true) return "DRAFT";
      const reason = typeof doc.rejectionReason === "string" ? doc.rejectionReason.trim() : "";
      return reason ? "REJECTED" : "SUBMITTED";
    }
  }
};

// ── Keeping the stored value in step ─────────────────────────────────────────

/**
 * Wires `lifecycle` recalculation into a schema. Call it once, before the model
 * is compiled.
 *
 * Covered: `save`/`create`, and `findOneAndUpdate`/`findByIdAndUpdate`/
 * `updateOne` when the filter names an `_id`. Not covered: `updateMany`,
 * `insertMany` and raw collection writes. The drift report
 * (`npm run report:lifecycle-drift`) shows any record those leave behind.
 */
export const attachLifecycleSync = (schema: Schema, kind: LifecycleKind): void => {
  schema.pre("save", function () {
    (this as unknown as { lifecycle?: Lifecycle }).lifecycle = deriveLifecycle(
      kind,
      this as unknown as Source
    );
  });

  const resync = async (model: any, id: unknown): Promise<void> => {
    if (!id) return;
    const fresh = await model
      .findById(id)
      .select(`lifecycle ${LIFECYCLE_SOURCE_FIELDS[kind]}`)
      .lean();
    if (!fresh) return;
    const next = deriveLifecycle(kind, fresh as Source);
    if ((fresh as { lifecycle?: string }).lifecycle === next) return;
    // The native collection call skips Mongoose hooks, so this cannot loop, and
    // it leaves `updatedAt` alone.
    await model.collection.updateOne(
      { _id: (fresh as { _id: unknown })._id },
      { $set: { lifecycle: next } }
    );
  };

  schema.post("findOneAndUpdate", async function (doc: { _id?: unknown } | null) {
    if (doc?._id) await resync((this as any).model, doc._id);
  });

  schema.post("updateOne", async function () {
    const id = ((this as any).getFilter?.() as { _id?: unknown } | undefined)?._id;
    // A plain id only; an operator such as { $in: [...] } is left to the drift report.
    const isOperator =
      typeof id === "object" && id !== null && Object.keys(id).some((k) => k.startsWith("$"));
    if (id && !isOperator) await resync((this as any).model, id);
  });
};
