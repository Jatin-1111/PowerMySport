// ─── Stages for any sport ───────────────────────────────────────────────────
//
// Tennis has a hand-written handbook (`./tennis.ts`). Every other sport has its
// pathway levels, which are per-sport and per-state and carry considerably more
// than a stage reader needs — benchmarks, trial windows, coach-selection guides,
// government schemes, injury risks. This turns those into the same nine-tab
// shape the authored guide uses, so the reader is one component and no sport is
// stuck with a worse UI merely because nobody has written its handbook yet.
//
// Nothing is invented and nothing is filled in. A tab appears only if the levels
// behind it actually carry content, so a thin sport renders a short stage rather
// than a stage full of empty headings.

import {
  getCombinedFeeRange,
  MacroLevel,
  mergeAgeRanges,
} from "@/modules/sports/config/macroLevels";
import type { PathwayLevel } from "@/modules/sports/services/pathway";

import type { GuideStage, StageBlock, StageGuide, StageTab } from "./types";

/**
 * Filler the pathway generator emits when it has nothing.
 *
 * A sport whose data hasn't been filled in yet returns strings like "Varies" and
 * "Information currently unavailable." — and `mergeAgeRanges` duly turns two of
 * them into "Varies – Varies". Printing those tells a parent nothing and makes
 * the page look broken; an omitted row at least reads as "not stated". Dropping
 * them here means the stage simply renders shorter.
 */
const PLACEHOLDER =
  /^(varies(\s*[–—-]\s*varies)?|n\/?a|tbd|unknown|none|not available|not specified|information currently unavailable\.?|pathway level)$/i;

function meaningful(value: string | undefined): string | undefined {
  const t = value?.trim();
  if (!t || PLACEHOLDER.test(t)) return undefined;
  return t;
}

/** Drop empty strings, filler and duplicates — generated content repeats. */
function uniq(values: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = meaningful(v);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function list(
  title: string,
  items: (string | undefined)[],
  tone?: "check" | "cross" | "bullet",
): StageBlock | null {
  const clean = uniq(items);
  if (clean.length === 0) return null;
  return tone ? { kind: "list", title, items: clean, tone } : { kind: "list", title, items: clean };
}

function pairs(
  title: string,
  rows: { label: string; value: string | undefined }[],
): StageBlock | null {
  const clean = rows
    .map((r) => ({ label: r.label, value: r.value?.trim() ?? "" }))
    .filter((r) => r.value.length > 0);
  if (clean.length === 0) return null;
  return { kind: "pairs", title, rows: clean };
}

/** A tab is only worth a heading if something is behind it. */
function tab(id: StageTab["id"], blocks: (StageBlock | null)[]): StageTab | null {
  const kept = blocks.filter((b): b is StageBlock => b !== null);
  return kept.length > 0 ? { id, blocks: kept } : null;
}

function flat<T>(levels: PathwayLevel[], pick: (l: PathwayLevel) => T[] | undefined): T[] {
  return levels.flatMap((l) => pick(l) ?? []);
}

function stageFrom(macro: MacroLevel, index: number, total: number): GuideStage {
  const levels = macro.rawLevels;
  const ageRange = meaningful(mergeAgeRanges(levels.map((l) => l.ageRange)));
  const fees = meaningful(getCombinedFeeRange(macro.rawLevelNumbers));
  const lead = levels[0];
  const subtitle = meaningful(lead?.title) ?? meaningful(macro.scopeTag) ?? "";

  const schemes = flat(levels, (l) => l.governmentSchemes);
  const metrics = flat(levels, (l) => l.benchmarks?.metrics);

  const tabs = [
    tab("overview", [
      ...uniq(levels.map((l) => l.description)).map(
        (text): StageBlock => ({ kind: "prose", text }),
      ),
      pairs("The numbers here", [
        { label: "Typical age", value: ageRange },
        { label: "How long", value: macro.durationNote },
        { label: "Rough cost", value: fees },
        { label: "Scope", value: macro.scopeTag },
      ]),
      macro.exitValueNote
        ? {
            kind: "callout" as const,
            tone: "goal" as const,
            title: "What reaching this is worth",
            text: macro.exitValueNote,
          }
        : null,
    ]),

    tab("topics", [
      list("What your child actually does here", flat(levels, (l) => l.steps)),
      metrics.length > 0
        ? {
            kind: "pairs" as const,
            title: "Benchmarks to aim at",
            rows: metrics.map((m) => ({ label: m.metric, value: m.target })),
          }
        : null,
      list(
        "Signs of talent at this stage",
        [
          ...flat(levels, (l) => l.talentSignals?.physicalMarkers),
          ...flat(levels, (l) => l.talentSignals?.cognitiveMarkers),
          ...flat(levels, (l) => l.talentSignals?.behavioralMarkers),
        ],
        "check",
      ),
    ]),

    tab("expect", [
      ...uniq(levels.map((l) => l.keyFocus)).map(
        (text): StageBlock => ({ kind: "prose", text }),
      ),
      pairs("Where you compete", [
        { label: "Competitions", value: uniq(levels.map((l) => l.competitions)).join(" · ") },
        { label: "Trials", value: lead?.trialInfo?.typicalMonths },
        { label: "Eligibility", value: lead?.trialInfo?.eligibilityAge },
        { label: "How to register", value: lead?.trialInfo?.registrationProcess },
      ]),
      list("What selectors look for", flat(levels, (l) => l.trialInfo?.selectionCriteria)),
      macro.funnelNote
        ? {
            kind: "callout" as const,
            tone: "warn" as const,
            title: "How far most children get",
            text: macro.funnelNote,
          }
        : null,
    ]),

    tab("tips", [
      list("In a coach, insist on", flat(levels, (l) => l.coachSelectionGuide?.mustHave), "check"),
      list("Walk away if", flat(levels, (l) => l.coachSelectionGuide?.redFlags), "cross"),
      list("Ask them this", flat(levels, (l) => l.coachSelectionGuide?.questionsToAsk)),
      list("Staying uninjured", flat(levels, (l) => l.injuryRisks?.preventionTips), "check"),
      list("Warning signs to watch", flat(levels, (l) => l.injuryRisks?.warningSignsToWatch), "cross"),
      list("Mental skills to build", flat(levels, (l) => l.mentalSkillsFocus)),
      list("Tips for trials", flat(levels, (l) => l.trialInfo?.tips)),
    ]),

    tab("resources", [
      schemes.length > 0
        ? {
            kind: "pairs" as const,
            title: "Funding you can apply for",
            rows: schemes.map((s) => ({
              label: s.name,
              value: [s.benefit, s.eligibility && `Eligibility: ${s.eligibility}`]
                .filter(Boolean)
                .join(" · "),
            })),
          }
        : null,
      list("Documents worth having ready", flat(levels, (l) => l.proactiveDocuments)),
      list("Where to train locally", [
        ...flat(levels, (l) => l.localResources?.academies),
        ...flat(levels, (l) => l.localResources?.facilities),
      ]),
      list("Who governs this level", [
        ...uniq(levels.map((l) => l.governingBody)),
        ...flat(levels, (l) => l.localResources?.governingBodies),
      ]),
      ...uniq(levels.map((l) => l.academicIntegration)).map(
        (text): StageBlock => ({ kind: "prose", text }),
      ),
    ]),
  ].filter((t): t is StageTab => t !== null);

  return {
    id: macro.id,
    title: macro.label,
    ageLabel: ageRange,
    ageRange,
    listNote: macro.scopeTag,
    subtitle,
    goal: macro.exitValueNote || macro.funnelNote || `Stage ${index + 1} of ${total}.`,
    // The ticked list is a contents page for the stage, so it names the tabs
    // that actually have something in them rather than a fixed set.
    atAGlance: uniq([
      ageRange && `Typical age ${ageRange}`,
      macro.durationNote,
      fees && `Around ${fees}`,
      uniq(levels.map((l) => l.competitions))[0],
      metrics[0] && `Benchmark: ${metrics[0].metric}`,
      schemes[0] && `Funding: ${schemes[0].name}`,
    ]).slice(0, 6),
    rawLevel: macro.representativeRawLevel,
    tabs,
  };
}

/**
 * Build a stage guide from a sport's own pathway levels. Returns undefined when
 * there is nothing to show, so the caller can fall back rather than render an
 * empty reader.
 */
export function deriveStageGuide(
  sportName: string,
  macroLevels: MacroLevel[],
): StageGuide | undefined {
  const usable = macroLevels.filter((m) => m.rawLevels.length > 0);
  if (usable.length === 0) return undefined;
  return {
    sport: sportName,
    stages: usable.map((m, i) => stageFrom(m, i, usable.length)),
  };
}
