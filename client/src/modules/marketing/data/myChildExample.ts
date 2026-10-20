/**
 * The example child shown in the "My Child" section.
 *
 * Everything here is invented and is labelled "Example" wherever it is shown.
 * It describes only what the product keeps today: a profile, a goal, a ranking
 * link, planner choices and check-ins. Nothing here claims that PMS learns from
 * outcomes, which is not built yet, so the copy says "remembers".
 */

export const EXAMPLE_CHILD = {
  name: "Anaya",
  initial: "A",
  summary: "9 years old, tennis, Pune",
} as const;

export type MyChildKey = "profile" | "goals" | "progress" | "decisions" | "open";

export interface MyChildRow {
  key: MyChildKey;
  label: string;
  /** One line for the card view. */
  summary: string;
  /** The same row in more detail, for the tabbed view. */
  lines: string[];
}

export const MY_CHILD_ROWS: MyChildRow[] = [
  {
    key: "profile",
    label: "Profile",
    summary: "Anaya, 9. Plays tennis twice a week in Pune.",
    lines: ["Age: 9", "Sport: tennis", "Plays: twice a week", "City: Pune"],
  },
  {
    key: "goals",
    label: "Goals",
    summary: "Play a first district tournament this season.",
    lines: [
      "This season: a first district tournament",
      "Preference: events close to home",
      "Exams: no events in the exam weeks you set",
    ],
  },
  {
    key: "progress",
    label: "Progress",
    summary: "Ranking linked. Two events played so far.",
    lines: ["Ranking: linked", "Events played: 2", "Next stage: first competition"],
  },
  {
    key: "decisions",
    label: "Decisions",
    summary: "Chose tennis. Shortlisted one event. Skipped one.",
    lines: [
      "Chose tennis after the assessment",
      "Shortlisted the District Junior Open",
      "Skipped a state event: too far for exam week",
    ],
  },
  {
    key: "open",
    label: "Open actions",
    summary: "Entries close in 6 days. A check-in is due.",
    lines: [
      "Entries for the District Junior Open close in 6 days",
      "Four-week check-in is due",
      "Link a second event to the plan",
    ],
  },
];

export interface TimelineEntry {
  when: string;
  what: string;
  note?: string;
  open?: boolean;
}

export const MY_CHILD_TIMELINE: TimelineEntry[] = [
  { when: "Week 1", what: "Took the sport assessment", note: "Tennis came out as a good fit." },
  { when: "Week 1", what: "Chose tennis" },
  { when: "Week 2", what: "Linked her ranking" },
  { when: "Week 3", what: "Shortlisted the District Junior Open" },
  { when: "Week 3", what: "Skipped a state event", note: "Too far for exam week." },
  { when: "Week 5", what: "Answered the four-week check-in", note: "Progressing." },
  {
    when: "Now",
    what: "Entries for the District Junior Open close in 6 days",
    open: true,
  },
];

export interface KnownFact {
  fact: string;
  from: string;
}

/** What is known about the child, and which part of PMS it came from. Every source here exists today. */
export const MY_CHILD_FACTS: KnownFact[] = [
  { fact: "Anaya is 9 and lives in Pune", from: "Her profile" },
  { fact: "Tennis suits her", from: "Sport assessment" },
  { fact: "Aiming for a first district tournament", from: "Season planner" },
  { fact: "Her ranking is linked", from: "Ranking link" },
  { fact: "Skipped a state event: too far", from: "Season planner" },
  { fact: "Progressing at four weeks", from: "Check-in" },
];

/** One line on who controls the data. True today: deleting a child removes what is kept about them. */
export const MY_CHILD_CONTROL_LINE =
  "Your child's details are yours. You can delete them any time.";
