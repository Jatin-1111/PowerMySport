/**
 * The words and limits for a child's sporting history and the profile a parent shares.
 *
 * Declared once, like `child.ts`: the stored models, the request validation and the screens all
 * import from here, so a kind added here is a compile error wherever a label is missing.
 *
 * A stored event has no "source" field. How much weight a reader should give it follows from the
 * entry itself (a result link was attached or it was not), so `sourceOf` works it out and the two
 * can never disagree. Rows the platform derives (a ranking, a tournament marked played) carry
 * their own source when they are put on the timeline and are never stored here.
 */

export const CHILD_EVENT_KINDS = [
  "tournament_result",
  "coaching_period",
  "award",
  "fitness_test",
  "academic_result",
  "test_score",
] as const;
export type ChildEventKind = (typeof CHILD_EVENT_KINDS)[number];

/** A parent rarely remembers the day, so an entry says how exact its date is. */
export const CHILD_EVENT_DATE_PRECISIONS = ["day", "month", "year"] as const;
export type ChildEventDatePrecision = (typeof CHILD_EVENT_DATE_PRECISIONS)[number];

/** Where the way a row reached the timeline comes from, as shown to a reader. */
export const CHILD_HISTORY_SOURCES = ["parent", "parent_with_link", "federation"] as const;
export type ChildHistorySource = (typeof CHILD_HISTORY_SOURCES)[number];

/** The label a reader sees next to a row. Plain words, naming the real source. */
export const CHILD_HISTORY_SOURCE_LABELS: Record<ChildHistorySource, string> = {
  parent: "Parent record",
  parent_with_link: "Parent record, link provided",
  federation: "From the AITA ranking list",
};

export const sourceOf = (event: { resultUrl?: string | null | undefined }): ChildHistorySource =>
  event.resultUrl ? "parent_with_link" : "parent";

/** Which kinds belong to which section of the page and the shared profile. */
export const CHILD_SHARE_SECTIONS = [
  "results",
  "ranking",
  "coaching",
  "fitness",
  "awards",
  "academics",
  "videos",
] as const;
export type ChildShareSection = (typeof CHILD_SHARE_SECTIONS)[number];

export const CHILD_EVENT_SECTION: Record<ChildEventKind, ChildShareSection> = {
  tournament_result: "results",
  coaching_period: "coaching",
  award: "awards",
  fitness_test: "fitness",
  academic_result: "academics",
  test_score: "academics",
};

export const CHILD_VIDEO_STATUSES = ["uploading", "ready", "failed"] as const;
export type ChildVideoStatus = (typeof CHILD_VIDEO_STATUSES)[number];
/** Only these are accepted, because the clip is played as uploaded, with no conversion. */
export const CHILD_VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type ChildVideoContentType = (typeof CHILD_VIDEO_CONTENT_TYPES)[number];

export const CHILD_ACADEMIC_BOARDS = ["CBSE", "ICSE", "ISC", "IB", "STATE", "OTHER"] as const;
export type ChildAcademicBoard = (typeof CHILD_ACADEMIC_BOARDS)[number];

/**
 * Limits. A cap on what one child can hold keeps a typo or an abuse from becoming a bill, and
 * keeps the timeline a record rather than a feed.
 */
export const CHILD_HISTORY_LIMITS = {
  eventsPerChild: 300,
  titleChars: 120,
  detailChars: 500,
  resultLabelChars: 80,
  videosPerChild: 5,
  /** Provisional until storage cost is priced in the video slice. */
  videoMaxSeconds: 120,
  videoMaxBytes: 300 * 1024 * 1024,
  /** Each part of an upload but the last. Storage needs at least 5 MB per part. */
  videoPartBytes: 8 * 1024 * 1024,
  /** One account may start this much video in a day, so a script cannot fill storage. */
  videoBytesPerDay: 5 * 300 * 1024 * 1024,
  shareLabelChars: 60,
  contactMessageChars: 500,
  contactNameChars: 80,
  /** Links one child can have live at once. */
  activeSharesPerChild: 20,
  /** Contact requests one link can take in its lifetime, however many people open it. */
  contactRequestsPerShare: 10,
} as const;

/**
 * One row of the timeline a parent sees. A row is either an entry the parent stored or one the
 * platform derives when the timeline is built (a tournament marked played, the sport the family
 * chose, a ranking). Derived rows are read live and never copied, so they cannot go stale.
 */
export type ChildTimelineOrigin = "stored" | "planner" | "chosen_sport" | "ranking";

export interface ChildTimelineRow {
  /** The entry's id for a stored row; `planner:<slug>`, `sport` or `ranking:<n>` for a derived one. */
  id: string;
  origin: ChildTimelineOrigin;
  kind: ChildEventKind | "milestone" | "ranking";
  section: ChildShareSection;
  title: string;
  detail?: string;
  resultLabel?: string;
  /** ISO date. How exact it is follows `datePrecision`. */
  occurredOn: string;
  datePrecision: ChildEventDatePrecision;
  endedOn?: string;
  resultUrl?: string;
  editionSlug?: string;
  source: ChildHistorySource;
  /** Only stored rows can be edited or deleted here. */
  editable: boolean;
  /** A tournament marked played that has no stored result yet: the screen offers "Add result". */
  canAddResult: boolean;
}

/** A clip as the parent's page lists it. The file itself is only reached through a short link. */
export interface ChildVideoView {
  id: string;
  title?: string;
  status: ChildVideoStatus;
  sizeBytes?: number;
  durationSeconds?: number;
  createdAt: string;
}

export interface ChildHistoryView {
  child: {
    id: string;
    name: string;
    sport: string | null;
    level: string | null;
    /** The year they started, worked out from years playing. */
    sinceYear: number | null;
  };
  /** Worked out from the rows, never typed. A count with nothing behind it is 0, not hidden here. */
  stats: { yearsInSport: number | null; tournaments: number; awards: number };
  academics: {
    board?: ChildAcademicBoard;
    graduationYear?: number;
    school?: string;
    intendedField?: string;
  } | null;
  timeline: ChildTimelineRow[];
  videos: ChildVideoView[];
  /** True once the parent has agreed to the current video notice; the upload screen asks if not. */
  videoConsent: boolean;
  usage: { events: number; limit: number };
}

/** The line every shared profile carries, so a reader knows how far to trust an entry. */
export const CHILD_SHARE_NOTICE =
  "Entries are provided by the family unless marked as from a federation source. PowerMySport does not verify them.";

/**
 * What a person with a share link may see. This is the whole list: the server builds the
 * response from these fields and nothing else, and a test fails if anything outside them appears.
 * There is no date of birth, no age, no contact detail, no quiz answer, no registration number
 * and no storage key in it, by design.
 */
export interface ChildSharePublicRow {
  kind: ChildTimelineRow["kind"];
  section: ChildShareSection;
  title: string;
  detail?: string;
  resultLabel?: string;
  occurredOn: string;
  datePrecision: ChildEventDatePrecision;
  endedOn?: string;
  resultUrl?: string;
  source: ChildHistorySource;
}

export interface ChildSharePublicView {
  child: {
    name: string;
    sport: string | null;
    level: string | null;
    sinceYear: number | null;
    /** An Indian state, never a city. */
    state: string | null;
    /** The year they finish school. Only present when the academics section is shared. */
    classYear: number | null;
  };
  /** Only the figures behind a shared section: tournaments with Results, awards with Awards. */
  stats: { yearsInSport: number | null; tournaments?: number; awards?: number };
  academics: { board?: ChildAcademicBoard; school?: string; intendedField?: string } | null;
  timeline: ChildSharePublicRow[];
  videos: Array<{ id: string; title?: string; durationSeconds?: number; sizeBytes?: number }>;
  sections: ChildShareSection[];
  sharedAt: string;
  expiresAt: string;
  notice: string;
}

/** A link as the parent's list shows it. The link itself is not here: it is shown once, at creation. */
export interface ChildShareListItem {
  id: string;
  recipientLabel: string;
  sections: ChildShareSection[];
  videoCount: number;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  status: "active" | "expired" | "revoked";
  openCount: number;
  lastOpenedAt?: string;
}

export const CHILD_SHARE_LIFETIME_DAYS = 30;
/** A share and a contact request are kept this long after they stop mattering, then removed. */
export const CHILD_SHARE_PURGE_AFTER_EXPIRY_DAYS = 90;
export const CONTACT_REQUEST_RETENTION_DAYS = 90;
