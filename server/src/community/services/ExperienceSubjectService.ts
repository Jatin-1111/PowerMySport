import mongoose from "mongoose";
import { Tournament } from "../../shared/models/Tournament";
import { TournamentEdition } from "../../shared/models/TournamentEdition";
import { Venue } from "../../client/models/Venue";
import Academy from "../../admin/models/Academy";
import { Coach } from "../../client/models/Coach";
import { Expert } from "../../client/models/ExpertProfile";
import { User } from "../../client/models/User";
import { Experience } from "../models/Experience";
import {
  EXPERIENCE_SUBJECT_KINDS,
  SIGNAL_KEYS_BY_SUBJECT_KIND,
  type ExperienceSubjectKind,
  type SignalKey,
} from "../constants/experience";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("experience-subjects");

/**
 * Everything an experience can be anchored to, in one place.
 *
 * This is the only genuinely new server-side piece of the Experience work —
 * everything else in phase 3 is the existing blog machinery under a new name.
 * Two things live here: a subject autocomplete for the composer, and the
 * "Parent experiences" summary an entity page renders alongside its existing
 * (booking-gated, star-rated) Review band.
 */

export interface SubjectSearchResult {
  kind: ExperienceSubjectKind;
  refId: string;
  name: string;
  slug: string | null;
  /** A short second line for the autocomplete row — city, sport, etc. */
  meta?: string;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `meta` is optional on SubjectSearchResult, and `exactOptionalPropertyTypes`
 * means an explicit `undefined` does not satisfy "optional" — the key has to
 * be entirely absent, not present-with-undefined. This builds the object with
 * the key omitted rather than set to undefined.
 */
const withMeta = <T extends object>(
  base: T,
  meta: string | null | undefined
): T & { meta?: string } =>
  // prettier-ignore
  meta ? { ...base, meta } : base;

const MAX_RESULTS_PER_KIND = 6;

type LeanUser = { name?: string } | null;

/**
 * Each subject kind knows how to find itself by name and how to shape a
 * result. Isolated into one table so adding a seventh subject kind later is
 * one entry, not a new branch scattered through the search and summary logic.
 */
const SUBJECT_FINDERS: Record<
  ExperienceSubjectKind,
  (rx: RegExp) => Promise<SubjectSearchResult[]>
> = {
  TOURNAMENT: async (rx) => {
    const rows = await Tournament.find({ name: rx })
      .select("_id name slug sportSlug")
      .limit(MAX_RESULTS_PER_KIND)
      .lean();
    return rows.map((row) =>
      withMeta(
        {
          kind: "TOURNAMENT" as const,
          refId: String(row._id),
          name: row.name,
          slug: row.slug || null,
        },
        row.sportSlug
      )
    );
  },
  TOURNAMENT_EDITION: async (rx) => {
    const rows = await TournamentEdition.find({ name: rx })
      .select("_id name slug startDate")
      .sort({ startDate: -1 })
      .limit(MAX_RESULTS_PER_KIND)
      .lean();
    return rows.map((row) =>
      withMeta(
        {
          kind: "TOURNAMENT_EDITION" as const,
          refId: String(row._id),
          name: row.name,
          slug: row.slug || null,
        },
        row.startDate ? new Date(row.startDate).getFullYear().toString() : null
      )
    );
  },
  VENUE: async (rx) => {
    // PENDING/REVIEW venues aren't publicly listed yet — anchoring an
    // experience to one would point at something no other parent can open.
    const rows = await Venue.find({ name: rx, approvalStatus: "APPROVED" })
      .select("_id name city")
      .limit(MAX_RESULTS_PER_KIND)
      .lean();
    return rows.map((row) =>
      withMeta(
        { kind: "VENUE" as const, refId: String(row._id), name: row.name, slug: null },
        (row as { city?: string }).city
      )
    );
  },
  ACADEMY: async (rx) => {
    const rows = await Academy.find({ name: rx, isApproved: true, isActive: true })
      .select("_id name slug city")
      .limit(MAX_RESULTS_PER_KIND)
      .lean();
    return rows.map((row) =>
      withMeta(
        {
          kind: "ACADEMY" as const,
          refId: String(row._id),
          name: row.name,
          slug: row.slug || null,
        },
        (row as { city?: string }).city
      )
    );
  },
  COACH: async (rx) => {
    // Coach carries no name of its own — it is a role profile on a User.
    const matchingUsers = await User.find({ name: rx })
      .select("_id name")
      .limit(MAX_RESULTS_PER_KIND * 2)
      .lean();
    if (!matchingUsers.length) return [];

    const rows = await Coach.find({
      userId: { $in: matchingUsers.map((user) => user._id) },
      isVerified: true,
    })
      .select("_id userId")
      .limit(MAX_RESULTS_PER_KIND)
      .populate("userId", "name")
      .lean();

    return rows
      .map((row) => ({ id: row._id, user: row.userId as unknown as LeanUser }))
      .filter((row): row is { id: typeof row.id; user: { name: string } } =>
        Boolean(row.user?.name)
      )
      .map((row) => ({
        kind: "COACH" as const,
        refId: String(row.id),
        name: row.user.name,
        slug: null,
      }));
  },
  EXPERT: async (rx) => {
    const matchingUsers = await User.find({ name: rx })
      .select("_id name")
      .limit(MAX_RESULTS_PER_KIND * 2)
      .lean();
    if (!matchingUsers.length) return [];

    const rows = await Expert.find({
      userId: { $in: matchingUsers.map((user) => user._id) },
      isActive: true,
    })
      .select("_id userId")
      .limit(MAX_RESULTS_PER_KIND)
      .populate("userId", "name")
      .lean();

    return rows
      .map((row) => ({ id: row._id, user: row.userId as unknown as LeanUser }))
      .filter((row): row is { id: typeof row.id; user: { name: string } } =>
        Boolean(row.user?.name)
      )
      .map((row) => ({
        kind: "EXPERT" as const,
        refId: String(row.id),
        name: row.user.name,
        slug: null,
      }));
  },
};

export const ExperienceSubjectService = {
  /**
   * Autocomplete for the composer's "was this about a tournament, venue,
   * academy or coach?" step. `kind` narrows to one subject type; omitted, it
   * searches all six and returns a handful of each so the caller can group
   * them under headings.
   */
  async searchSubjects(q: string, kind?: string | null): Promise<{ items: SubjectSearchResult[] }> {
    const term = q.trim();
    if (term.length < 2) {
      return { items: [] };
    }

    const rx = new RegExp(escapeRegExp(term), "i");
    const kinds: ExperienceSubjectKind[] = EXPERIENCE_SUBJECT_KINDS.includes(
      kind as ExperienceSubjectKind
    )
      ? [kind as ExperienceSubjectKind]
      : [...EXPERIENCE_SUBJECT_KINDS];

    const results = await Promise.all(
      kinds.map(async (subjectKind) => {
        try {
          return await SUBJECT_FINDERS[subjectKind](rx);
        } catch (error) {
          // One subject type having a bad day (a stale index, a down
          // secondary) should not take autocomplete down for the other five —
          // but it must not vanish silently either. This exact catch is what
          // hid a `mongoose.model("User")` MissingSchemaError during
          // development; every branch here is logged for that reason.
          log.error(`subject search failed for ${subjectKind}:`, error);
          return [];
        }
      })
    );

    return { items: results.flat() };
  },

  /**
   * The "Parent experiences" band on a tournament / venue / academy / coach /
   * expert page: how many parents wrote about this, what they said in the
   * three-point signals, and the most recent few. Deliberately returns counts,
   * never an average — this is reporting, not the star rating that already
   * lives on the page via client/models/Review.ts.
   */
  async getSummary(
    kind: ExperienceSubjectKind,
    refId: string
  ): Promise<{
    count: number;
    signals: Partial<Record<SignalKey, { good: number; okay: number; poor: number }>>;
    recent: Array<{ id: string; excerpt: string; createdAt: Date; authorName: string | null }>;
  }> {
    const objectId = new mongoose.Types.ObjectId(refId);
    const match = {
      "subject.kind": kind,
      "subject.refId": objectId,
      status: "PUBLISHED" as const,
      isDeleted: false,
      moderationStatus: "APPROVED" as const,
    };

    const allowedSignals = SIGNAL_KEYS_BY_SUBJECT_KIND[kind];

    const groupStage: Record<string, unknown> = { _id: null };
    for (const key of allowedSignals) {
      groupStage[key] = { $push: `$signals.${key}` };
    }

    const [count, signalRows, recentRows] = await Promise.all([
      Experience.countDocuments(match),
      allowedSignals.length
        ? Experience.aggregate<{ _id: null } & Record<SignalKey, string[]>>([
            { $match: match },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { $group: groupStage as any },
          ])
        : Promise.resolve([]),
      Experience.find(match)
        .select("excerpt content authorId createdAt")
        .sort({ createdAt: -1 })
        .limit(3)
        .populate("authorId", "name")
        .lean(),
    ]);

    const tallyOf = (values: (string | undefined)[] = []) => ({
      good: values.filter((value) => value === "GOOD").length,
      okay: values.filter((value) => value === "OKAY").length,
      poor: values.filter((value) => value === "POOR").length,
    });

    const signals: Partial<Record<SignalKey, { good: number; okay: number; poor: number }>> = {};
    const row = signalRows[0];
    if (row) {
      for (const key of allowedSignals) {
        const tally = tallyOf((row as Record<SignalKey, (string | undefined)[]>)[key]);
        if (tally.good + tally.okay + tally.poor > 0) {
          signals[key] = tally;
        }
      }
    }

    return {
      count,
      signals,
      recent: recentRows.map((doc) => {
        const author = doc.authorId as unknown as LeanUser;
        return {
          id: String(doc._id),
          excerpt: doc.excerpt || "",
          createdAt: doc.createdAt,
          authorName: author?.name || null,
        };
      }),
    };
  },

  /**
   * Whether `userId` is the specific person a COACH/EXPERT subject names —
   * the right of reply is only ever offered to that one person, verified
   * server-side, never taken on the client's word. Any other subject kind (an
   * event, a venue, an academy with no single owner) has no reply story yet.
   */
  async isSubjectOwner(
    userId: string,
    subject:
      { kind: ExperienceSubjectKind; refId: mongoose.Types.ObjectId | string } | null | undefined
  ): Promise<boolean> {
    if (!subject) return false;
    if (subject.kind === "COACH") {
      const coach = await Coach.findOne({ _id: subject.refId, userId }).select("_id").lean();
      return Boolean(coach);
    }
    if (subject.kind === "EXPERT") {
      const expert = await Expert.findOne({ _id: subject.refId, userId }).select("_id").lean();
      return Boolean(expert);
    }
    return false;
  },

  /**
   * Post the one right-of-reply response. Rejects a second attempt outright —
   * this is a single reply, not a thread, which is what keeps it from turning
   * into the comment section the named person could otherwise be drawn into
   * arguing in.
   */
  async postSubjectReply(
    userId: string,
    experienceId: string,
    content: string
  ): Promise<{ content: string; authorId: string; createdAt: Date }> {
    const experience = await Experience.findOne({ _id: experienceId, isDeleted: false });
    if (!experience) {
      throw new Error("Experience not found");
    }
    if (experience.subjectReply) {
      throw new Error("A reply has already been posted");
    }

    const isOwner = await this.isSubjectOwner(userId, experience.subject);
    if (!isOwner) {
      throw new Error("Access denied");
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Reply cannot be empty");
    }

    experience.subjectReply = {
      content: trimmed.slice(0, 2000),
      authorId: new mongoose.Types.ObjectId(userId),
      createdAt: new Date(),
    };
    await experience.save();

    return {
      content: experience.subjectReply.content,
      authorId: String(experience.subjectReply.authorId),
      createdAt: experience.subjectReply.createdAt,
    };
  },
};
