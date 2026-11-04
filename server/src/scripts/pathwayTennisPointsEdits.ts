// The AITA points answer, corrected against AITA's own table (see applyPathwayContentEdits.ts).
//
// Source: "AITA Tournament Structure for Juniors and the Rules Covering the AITA
// Junior Circuit", effective 1 January 2025, "Points system for AITA circuit".
// The live answer carried a Winner / Runner-up / Semifinalist / Participation
// table whose numbers do not appear in that document. The other answer on this
// subject ("What is the difference between AITA tournament categories?") already
// states the winner points correctly and is left alone.

import type { ContentEdit } from "./pathwayChessFormatEdits";

export const TENNIS_POINTS_EDITS: ContentEdit[] = [
  {
    sportSlug: "tennis",
    stageKey: "compete-and-assess",
    kind: "answer",
    label: "questions[11].answer",
    heading: "What is the point system under various AITA tournaments?",
    old: "Points awarded for each result:\n\n| Series | Winner | Runner-up | Semifinalist | Quarterfinalist | Participation |\n| --- | --- | --- | --- | --- | --- |\n| Talent Series (TS) | 10 | 7 | 5 | 3 | 1 |\n| Championship Series (CS) | 30 | 20 | 15 | 10 | 5 |\n| Super Series (SS) | 50 | 35 | 25 | 15 | 8 |\n| National Series (NS) | 100 | 70 | 50 | 30 | 10 |",
    next: [
      "Points depend on the round a player reaches:",
      "",
      "| Series | Round of 64 | Round of 32 | Round of 16 | Quarterfinal | Semifinal | Final | Winner |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| Talent Series (7 days) | - | 2 | 6 | 8 | 10 | 12 | 15 |",
      "| Championship Series (3 days) | - | 1 | 3 | 4 | 6 | 8 | 10 |",
      "| Championship Series (7 days) | - | 4 | 8 | 10 | 15 | 20 | 25 |",
      "| Super Series | - | 5 | 10 | 20 | 30 | 40 | 50 |",
      "| National Series | 5 | 10 | 20 | 30 | 40 | 50 | 75 |",
      "| Nationals | 20 | 40 | 60 | 80 | 100 | 150 | 200 |",
      "",
      "- **Qualifying points:** National Series and Nationals give 6, 4 and 2. Talent Series, Championship Series (7 days) and Super Series give 1 point to players who qualify.",
      "- **Minimum draw:** no points are awarded if the singles main draw has fewer than 16 players or the doubles main draw has fewer than 8 pairs. In 3-day tournaments the minimum is 8 players.",
      "- **North East Sector:** Talent Series tournaments there award points with a minimum of 8 players in the main draw.",
      "",
      "Source: AITA Tournament Structure for Juniors and the Rules Covering the AITA Junior Circuit, effective 1 January 2025.",
    ].join("\n"),
  },
];
