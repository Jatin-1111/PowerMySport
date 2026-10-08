import fs = require("fs");
import path = require("path");

/**
 * Hand labels: for a child and an event, would a person who knows the circuit call it a
 * realistic suggestion for that child? This is the one number the harness cannot compute
 * (see `score.ts`), and the one that decides whether the suggestions are GOOD rather than
 * merely valid.
 *
 * The file is `fixtures/labels.csv`, with the columns `child_id,event_slug,realistic`
 * where `realistic` is `Y` or `N`. `run.ts --review-sheet` writes every (child, event)
 * pair the engine has suggested, with the facts a labeller needs and an empty `realistic`
 * column, so labelling is filling a column, not building a file.
 *
 * It is allowed not to exist. Until it does the report shows `reachCount` instead and says
 * that realism has not been measured.
 */

export type Labels = Map<string, boolean>;

export const labelKey = (childId: string, slug: string): string => `${childId}|${slug}`;

export function loadLabels(
  file = path.resolve(__dirname, "../../../src/evals/plannerRecommendations/fixtures/labels.csv")
): Labels {
  const labels: Labels = new Map();
  if (!fs.existsSync(file)) return labels;
  const [, ...rows] = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const row of rows) {
    const [childId, slug, realistic] = row.split(",").map((cell) => cell.trim());
    if (!childId || !slug) continue;
    if (realistic === "Y" || realistic === "N")
      labels.set(labelKey(childId, slug), realistic === "Y");
  }
  return labels;
}
