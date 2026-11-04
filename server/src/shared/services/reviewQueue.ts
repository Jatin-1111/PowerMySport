import { Coach } from "../../client/models/Coach";
import { Expert } from "../../client/models/ExpertProfile";
import { Venue } from "../../client/models/Venue";
import { User } from "../../client/models/User";
import Academy from "../../admin/models/Academy";
import type { LifecycleKind } from "./providerLifecycle";

/**
 * Everyone waiting on an admin, across coaches, experts, venues and academies,
 * read from the shared `lifecycle` status. One list, oldest first.
 */

/** The academy email promises 3 to 5 business days; past 5 days is overdue. */
export const OVERDUE_AFTER_DAYS = 5;

const WAITING = ["SUBMITTED", "NEEDS_INFO"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIMIT_PER_TYPE = 200;

export interface ReviewQueueRow {
  kind: LifecycleKind;
  id: string;
  name: string;
  lifecycle: (typeof WAITING)[number];
  /** The best available "waiting since": the submission time, else the last change. */
  waitingSince?: Date;
  ageDays: number;
  overdue: boolean;
  /** What the record is waiting on, when it is not simply a first review. */
  waitingOn?: string;
}

const row = (
  kind: LifecycleKind,
  doc: any,
  name: string,
  waitingSince: Date | undefined,
  now: Date
): ReviewQueueRow => {
  const ageDays = waitingSince
    ? Math.max(0, Math.floor((now.getTime() - new Date(waitingSince).getTime()) / DAY_MS))
    : 0;
  const needsInfo = doc.lifecycle === "NEEDS_INFO";
  return {
    kind,
    id: String(doc._id),
    name,
    lifecycle: doc.lifecycle,
    ...(waitingSince ? { waitingSince: new Date(waitingSince) } : {}),
    ageDays,
    overdue: ageDays > OVERDUE_AFTER_DAYS,
    ...(needsInfo
      ? { waitingOn: kind === "academy" ? "The KYC check" : "More information from the provider" }
      : {}),
  };
};

export const listReviewQueue = async (now: Date = new Date()): Promise<ReviewQueueRow[]> => {
  const waiting = { lifecycle: { $in: [...WAITING] } };

  const [coaches, experts, venues, academies] = await Promise.all([
    Coach.find(waiting)
      .select("userId lifecycle verificationSubmittedAt updatedAt")
      .limit(LIMIT_PER_TYPE)
      .lean(),
    Expert.find(waiting).select("userId lifecycle updatedAt").limit(LIMIT_PER_TYPE).lean(),
    Venue.find(waiting).select("name ownerName lifecycle updatedAt").limit(LIMIT_PER_TYPE).lean(),
    Academy.find(waiting).select("name lifecycle updatedAt").limit(LIMIT_PER_TYPE).lean(),
  ]);

  const userIds = [...coaches, ...experts].map((d: any) => d.userId).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } })
    .select("name")
    .lean();
  const nameOf = new Map(users.map((u: any) => [String(u._id), String(u.name || "")]));
  const personName = (d: any) => nameOf.get(String(d.userId)) || "Unnamed";

  const rows: ReviewQueueRow[] = [
    ...coaches.map((d: any) =>
      row("coach", d, personName(d), d.verificationSubmittedAt ?? d.updatedAt, now)
    ),
    ...experts.map((d: any) => row("expert", d, personName(d), d.updatedAt, now)),
    ...venues.map((d: any) =>
      row(
        "venue",
        d,
        d.name && d.name !== "Pending Name" ? d.name : d.ownerName || "Unnamed venue",
        d.updatedAt,
        now
      )
    ),
    ...academies.map((d: any) => row("academy", d, d.name || "Unnamed academy", d.updatedAt, now)),
  ];

  // Oldest first; a record with no date sorts last.
  return rows.sort(
    (a, b) => (a.waitingSince?.getTime() ?? Infinity) - (b.waitingSince?.getTime() ?? Infinity)
  );
};

export const countReviewQueue = async (): Promise<number> => {
  const waiting = { lifecycle: { $in: [...WAITING] } };
  const counts = await Promise.all([
    Coach.countDocuments(waiting),
    Expert.countDocuments(waiting),
    Venue.countDocuments(waiting),
    Academy.countDocuments(waiting),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
};
