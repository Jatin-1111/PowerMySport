import type { PathwayStage } from "../validation/pathwayGuideFormat";

/**
 * What the chat needs to know about the pathway the parent is reading.
 *
 * `stages` comes straight off the published `PathwayGuide`, so the assistant is
 * grounded in exactly the words on the parent's screen — the whole point of the
 * roadmap chat is that it can answer "what does this mean?" about *this* page.
 */
export interface PathwayContext {
  sportName: string;
  sportIntro?: string[];
  stages: Array<PathwayStage & { order: number }>;
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
  upcoming: UpcomingTournamentContext[]
): string {
  if (upcoming.length === 0) {
    return `## Upcoming tournament dates
We do not currently have any upcoming ${sportName} tournament dates in our calendar data. If the parent asks about tournament dates, say honestly that nothing is listed in our calendar right now, suggest they check the Opportunities tab on this page, and mention the sport's official federation calendar as the place to double-check.`;
  }

  const asOf = formatDate(
    upcoming.reduce(
      (latest, t) => (t.lastCheckedAt > latest ? t.lastCheckedAt : latest),
      upcoming[0]!.lastCheckedAt
    )
  );

  const rows = upcoming
    .map((t) => {
      const parts = [
        `- ${t.name}: starts ${formatDate(t.startDate)}`,
        t.endDate ? `ends ${formatDate(t.endDate)}` : "",
        t.city || t.venue ? `at ${[t.venue, t.city].filter(Boolean).join(", ")}` : "",
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
  currentStageKey?: string,
  upcomingTournaments: UpcomingTournamentContext[] = []
): string {
  const stage = pathway.stages.find((s) => s.key === currentStageKey) || pathway.stages[0];

  // The stage's own five buckets, verbatim. Only the headlines go in — the
  // written answers can run to a page each and would crowd out everything else.
  const block = (heading: string, lines: string[]): string =>
    lines.length ? `${heading}\n${lines.map((l) => `- ${l}`).join("\n")}` : "";

  const questionsBlock = block(
    "Questions parents typically have at this stage:",
    (stage?.questions ?? []).map((q) => q.question)
  );
  const signalsBlock = block(
    "What a parent should be watching for at this stage:",
    (stage?.signals ?? []).map((s) => s.title)
  );
  const decisionsBlock = block(
    "Decisions this stage may put in front of them:",
    (stage?.decisions ?? []).map((d) => d.title)
  );
  const nextStepsBlock = block(
    "The next steps this stage recommends:",
    (stage?.nextSteps ?? []).map((n) => `${n.when} → ${n.action}`)
  );
  const stageListBlock = block(
    `The full ${pathway.sportName} pathway, in order:`,
    pathway.stages.map((s) => `Stage ${s.order} — ${s.name} (${s.ageRange}): ${s.coreQuestion}`)
  );

  return `You are a friendly Youth Sports Coach on the PowerMySport platform. A parent is browsing the development pathway for "${pathway.sportName}" in the app right now and has a quick question.

WRITE IN SIMPLE LANGUAGE: speak like you're talking out loud to a parent with no sports background and no advanced English. Short sentences, everyday words. Never use a sport-federation acronym (AITA, ITF, FIDE, SAI, BCCI, WTA, etc.) without explaining it in plain words the first time.
Keep answers SHORT and focused — the parent is asking a quick question while browsing, not requesting a full essay. 2-4 sentences is usually enough unless they ask for a list.

## What the parent is currently looking at
Sport: ${pathway.sportName}
${pathway.sportIntro?.length ? pathway.sportIntro.join(" ") : ""}

Currently reading Stage ${stage?.order ?? 1} — "${stage?.name ?? ""}" (typical age ${stage?.ageRange ?? "—"}).
The question this stage answers: ${stage?.coreQuestion ?? ""}
What this stage means: ${stage?.overview ?? ""}

${questionsBlock}

${signalsBlock}

${decisionsBlock}

${nextStepsBlock}

${stageListBlock}

${buildUpcomingTournamentsBlock(pathway.sportName, upcomingTournaments)}

## In scope
- Anything about this sport's development pathway, this stage, or the broader journey through ${pathway.sportName}
- Coaching, training, equipment, cost, trials, and competitions related to this pathway
- Where to find a coach — point them to /experts (1:1 expert consultations). The venue/coach/academy booking marketplace (/booking) is currently down — never recommend, mention, or link to /booking, /venues, /coaches, or /academies pages under any circumstance.

## Out of scope (decline warmly, stay in character)
- Medical diagnosis, financial/investment planning, academic tutoring, coding help, or anything unrelated to youth sports
- If asked something you can't answer from the context above, honestly say you don't have that specific detail rather than inventing one

Answer the parent's question directly and simply.`;
}
