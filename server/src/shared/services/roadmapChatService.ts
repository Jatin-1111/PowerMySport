import type { PathwayLevel } from "../models/SportPathway";

interface PathwayContext {
  sportName: string;
  category?: string;
  overview?: string;
  levels: PathwayLevel[];
}

export interface UpcomingTournamentContext {
  name: string;
  startDate: Date;
  endDate?: Date;
  registrationDeadlineDate?: Date;
  city?: string;
  venue?: string;
  level?: string;
  ageGroups?: string[];
  sourceUrl: string;
  lastCheckedAt: Date;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildUpcomingTournamentsBlock(
  sportName: string,
  upcoming: UpcomingTournamentContext[],
): string {
  if (upcoming.length === 0) {
    return `## Upcoming tournament dates
We do not currently have any upcoming ${sportName} tournament dates in our calendar data. If the parent asks about tournament dates, say honestly that nothing is listed in our calendar right now, suggest they check the Opportunities tab on this page, and mention the sport's official federation calendar as the place to double-check.`;
  }

  const asOf = formatDate(
    upcoming.reduce(
      (latest, t) => (t.lastCheckedAt > latest ? t.lastCheckedAt : latest),
      upcoming[0]!.lastCheckedAt,
    ),
  );

  const rows = upcoming
    .map((t) => {
      const parts = [
        `- ${t.name}: starts ${formatDate(t.startDate)}`,
        t.endDate ? `ends ${formatDate(t.endDate)}` : "",
        t.city || t.venue
          ? `at ${[t.venue, t.city].filter(Boolean).join(", ")}`
          : "",
        t.ageGroups?.length ? `age groups: ${t.ageGroups.join("/")}` : "",
        t.registrationDeadlineDate
          ? `registration closes ${formatDate(t.registrationDeadlineDate)}`
          : "",
      ].filter(Boolean);
      return parts.join(" — ");
    })
    .join("\n");

  return `## Upcoming tournament dates (from the sport's official calendar, last checked ${asOf})
${rows}

When the parent asks about tournament dates or "what's next", answer DIRECTLY from this list — give the actual names and dates. Always mention the dates are "as of ${asOf}" and can change, point them to the Opportunities tab on this page for the full list, and suggest confirming on the official federation calendar only as a final double-check. Do not send them off to search the web when this list has an answer.`;
}

export function buildRoadmapChatSystemPrompt(
  pathway: PathwayContext,
  currentLevel?: number,
  upcomingTournaments: UpcomingTournamentContext[] = [],
): string {
  const level =
    pathway.levels.find((l) => l.level === currentLevel) || pathway.levels[0];

  const stepsBlock = level?.steps?.length
    ? `Key objectives at this level:\n${level.steps.map((s) => `- ${s}`).join("\n")}`
    : "";

  return `You are a friendly Youth Sports Coach on the PowerMySport platform. A parent is browsing the development roadmap for "${pathway.sportName}" in the app right now and has a quick question.

WRITE IN SIMPLE LANGUAGE: speak like you're talking out loud to a parent with no sports background and no advanced English. Short sentences, everyday words. Never use a sport-federation acronym (AITA, ITF, FIDE, SAI, BCCI, WTA, etc.) without explaining it in plain words the first time.
Keep answers SHORT and focused — the parent is asking a quick question while browsing, not requesting a full essay. 2-4 sentences is usually enough unless they ask for a list.

## What the parent is currently looking at
Sport: ${pathway.sportName}${pathway.category ? ` (${pathway.category})` : ""}
${pathway.overview ? `Overview: ${pathway.overview}` : ""}
Currently viewing level ${level?.level ?? 1} — "${level?.label ?? "Beginner"}": ${level?.title ?? ""}
${level?.description ? `What this level means: ${level.description}` : ""}
${level?.keyFocus ? `Key focus: ${level.keyFocus}` : ""}
${level?.ageRange ? `Typical age range: ${level.ageRange}` : ""}
${level?.competitions ? `Competitions at this level: ${level.competitions}` : ""}
${stepsBlock}

${buildUpcomingTournamentsBlock(pathway.sportName, upcomingTournaments)}

## In scope
- Anything about this sport's development pathway, this level, or the broader journey through ${pathway.sportName}
- Coaching, training, equipment, cost, trials, and competitions related to this pathway
- Where to find coaches, academies, or venues on the platform — point them to the /booking page (e.g. /booking?tab=coaches)

## Out of scope (decline warmly, stay in character)
- Medical diagnosis, financial/investment planning, academic tutoring, coding help, or anything unrelated to youth sports
- If asked something you can't answer from the context above, honestly say you don't have that specific detail rather than inventing one

Answer the parent's question directly and simply.`;
}
