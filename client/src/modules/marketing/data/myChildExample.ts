/**
 * The example child shown in the homepage "My Child" section.
 *
 * Everything here is invented and is labelled "Example" where it is shown. It
 * describes only what the product keeps today: a profile, a goal, a ranking link,
 * planner choices and check-ins. Nothing here claims that PMS learns from
 * outcomes, which is not built yet, so the copy says "kept", not "learns".
 */

export const EXAMPLE_CHILD = {
  name: "Anaya",
  initial: "A",
  summary: "9 years old, tennis, Pune",
} as const;

export interface MyChildRow {
  key: "profile" | "goals" | "progress" | "decisions" | "open";
  label: string;
  summary: string;
}

export const MY_CHILD_ROWS: MyChildRow[] = [
  { key: "profile", label: "Profile", summary: "Anaya, 9. Plays tennis twice a week in Pune." },
  { key: "goals", label: "Goals", summary: "Play a first district tournament this season." },
  { key: "progress", label: "Progress", summary: "Ranking linked. Two events played so far." },
  {
    key: "decisions",
    label: "Decisions",
    summary: "Chose tennis. Shortlisted one event. Skipped one.",
  },
  { key: "open", label: "Open actions", summary: "Entries close in 6 days. A check-in is due." },
];

/** One line on who controls the data. True today: deleting a child removes what is kept about them. */
export const MY_CHILD_CONTROL_LINE =
  "Your child's details are yours. You can delete them any time.";
