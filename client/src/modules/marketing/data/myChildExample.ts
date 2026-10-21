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
  summary: "13 years old, tennis, Pune",
} as const;

export interface MyChildRow {
  key: "profile" | "goal" | "progress" | "calendar" | "open";
  label: string;
  summary: string;
}

export const MY_CHILD_ROWS: MyChildRow[] = [
  { key: "profile", label: "Profile", summary: "Intermediate player, 2 years playing." },
  { key: "goal", label: "Goal", summary: "Become a professional player." },
  {
    key: "progress",
    label: "Progress",
    summary: "AITA rank: 150. Played 2 tournaments this year.",
  },
  { key: "calendar", label: "Tournament calendar", summary: "Not created." },
  {
    key: "open",
    label: "Open actions",
    summary: "Check-in due for upcoming SS tournament.",
  },
];

/** One line on who controls the data. True today: deleting a child removes what is kept about them. */
export const MY_CHILD_CONTROL_LINE =
  "Your child's details are yours. You can delete them any time.";
