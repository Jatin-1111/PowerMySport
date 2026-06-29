// ─── Guidance Module Utilities ────────────────────────────────────────────────

import type { JourneyPhase, GuidanceResponse } from "./types";

export function buildFallbackJourney(r: GuidanceResponse): JourneyPhase[] {
  const splitActions = (s?: string) =>
    (s || "")
      .split(/(?<=\.)\s+|;\s*/)
      .map((t) => t.trim())
      .filter(Boolean);

  const phases: JourneyPhase[] = [];
  const actions = splitActions(r.recommendedPlatformActions);
  phases.push({
    title: "Get Set Up",
    timeframe: "Weeks 1–2",
    focus: "Lay the groundwork and start with a clear structure.",
    milestones: actions.length
      ? actions.slice(0, 4)
      : ["Choose a coach or academy", "Set a weekly schedule"],
    outcome: "Training has a clear structure and you're enrolled.",
  });
  phases.push({
    title: "Build the Weekly Rhythm",
    timeframe: "Weeks 3–8",
    focus: "Turn the plan into a sustainable weekly habit.",
    milestones: [
      `Training: ${r.weeklyBlueprint.trainingHours}`,
      `Free play: ${r.weeklyBlueprint.freePlayHours}`,
      `Rest: ${r.weeklyBlueprint.restDays}`,
    ],
    outcome: "A balanced, repeatable weekly routine the child enjoys.",
  });
  if (r.mentalSkillsRoadmap) {
    phases.push({
      title: "Strengthen the Mind",
      timeframe: "Month 2–3",
      focus: r.mentalSkillsRoadmap.currentFocus,
      milestones: r.mentalSkillsRoadmap.skills
        .map((s) => `${s.skill}: ${s.howToDevelop}`)
        .slice(0, 4),
      outcome: "Noticeably more composed and focused under pressure.",
    });
  }
  if (r.talentIdentifiers?.length) {
    phases.push({
      title: "Track Real Progress",
      timeframe: "Ongoing",
      focus: "Watch for genuine signs of aptitude and growth.",
      milestones: r.talentIdentifiers.slice(0, 4),
      outcome: "Clear, observable evidence the child is developing.",
    });
  }
  return phases;
}
