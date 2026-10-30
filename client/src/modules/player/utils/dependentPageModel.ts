import { formatDependentRelation } from "@/modules/player/data/dependentRelations";
import {
  AGILITY_LABELS,
  AMBITION_LABELS,
  BUDGET_RANGE_LABELS,
  BUILD_LABELS,
  COMPETITIVE_RESPONSE_LABELS,
  CONTACT_LABELS,
  DECISION_LABELS,
  ENERGY_LABELS,
  ENV_LABELS,
  EYESIGHT_LABELS,
  FOCUS_LABELS,
  GENDER_LABELS,
  HEIGHT_LABELS,
  PRESSURE_LABELS,
  REPETITION_LABELS,
  TEAM_INDIVIDUAL_LABELS,
  VISUAL_TRACKING_LABELS,
  WATER_COMFORT_LABELS,
  WEEKLY_HOURS_LABELS,
  wizardChip,
} from "@/modules/player/data/wizardLabels";
import { deriveBodyCategories } from "@/modules/find-sport/utils/dependentMapping";
import type { Dependent } from "@/types";

/**
 * What a parent reads on a child's page, worked out from the profile.
 *
 * The page used to print every stored answer as an unlabelled pill and leave the parent to guess
 * what mattered. These functions decide the three things the page now says in plain words: what to
 * do next, the handful of facts worth knowing at a glance, and how the child plays and moves.
 * They are pure so the wording and the ordering can be tested without rendering the page.
 */

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export interface NextStep {
  kind: "choose-sport" | "finish-profile";
  title: string;
  detail: string;
}

/**
 * The one thing to do next, or null when there is nothing outstanding.
 *
 * Choosing a sport comes first because the roadmap, the planner and the tournaments all hang off
 * it. After that, the parts of the profile the rest of the product reads.
 */
export function nextStepFor(
  dependent: Pick<Dependent, "name">,
  hasSport: boolean,
  missing: Array<{ field: string; label: string }>
): NextStep | null {
  if (!hasSport) {
    return {
      kind: "choose-sport",
      title: `Choose a sport for ${dependent.name}`,
      detail:
        "Take the assessment and we will suggest sports that suit how they move and play, and what your family can commit to.",
    };
  }

  const outstanding = missing.filter((item) => item.field !== "sportsFocus");
  if (outstanding.length === 0) return null;

  return {
    kind: "finish-profile",
    title: `Finish ${dependent.name}'s profile`,
    detail: `Still to add: ${outstanding.map((item) => item.label.toLowerCase()).join(", ")}. The planner and tournament suggestions read these.`,
  };
}

export interface Fact {
  label: string;
  /** Null when the family has not told us yet; the page says so instead of hiding the row. */
  value: string | null;
}

export function glanceFacts(dependent: Dependent, age: number | null): Fact[] {
  const born = dependent.dob ? formatDate(dependent.dob) : null;
  const years = dependent.yearsPlaying;

  return [
    {
      label: "Age",
      value: age !== null ? `${age} years${born ? `, born ${born}` : ""}` : born,
    },
    {
      label: "Relation",
      value: dependent.relation ? formatDependentRelation(dependent.relation) : null,
    },
    { label: "Gender", value: wizardChip(dependent.gender, GENDER_LABELS) },
    { label: "Lives in", value: dependent.location || null },
    {
      label: "Level",
      value: dependent.experienceLevel ? capitalise(dependent.experienceLevel) : null,
    },
    {
      label: "Time in the sport",
      value:
        years === undefined || years === null
          ? null
          : years === 0
            ? "Less than a year"
            : `${years} ${years === 1 ? "year" : "years"}`,
    },
    { label: "Goal", value: wizardChip(dependent.ambition, AMBITION_LABELS) },
    { label: "Monthly budget", value: wizardChip(dependent.budgetRange, BUDGET_RANGE_LABELS) },
    {
      label: "Training time",
      value: wizardChip(dependent.weeklyHoursCategory, WEEKLY_HOURS_LABELS),
    },
  ];
}

export interface TraitGroup {
  title: string;
  items: string[];
}

const present = (items: Array<string | null>) => items.filter((item): item is string => !!item);

/** The quiz answers, grouped by what they describe. Budget, goal and time live in the facts. */
export function traitGroups(dependent: Dependent, age: number | null): TraitGroup[] {
  const quiz = dependent.quiz ?? {};
  const body = deriveBodyCategories(quiz.heightCm, quiz.weightKg, age);

  const groups: TraitGroup[] = [
    {
      title: "Body and senses",
      items: present([
        quiz.heightCm && quiz.weightKg ? `${quiz.heightCm} cm, ${quiz.weightKg} kg` : null,
        wizardChip(body.build, BUILD_LABELS),
        wizardChip(body.heightCategory, HEIGHT_LABELS),
        wizardChip(quiz.energyType, ENERGY_LABELS),
        wizardChip(quiz.visualTracking, VISUAL_TRACKING_LABELS),
        wizardChip(quiz.eyesight, EYESIGHT_LABELS),
        wizardChip(quiz.agility, AGILITY_LABELS),
      ]),
    },
    {
      title: "Personality and play style",
      items: present([
        quiz.teamIndividual !== undefined ? TEAM_INDIVIDUAL_LABELS[quiz.teamIndividual] : null,
        wizardChip(quiz.competitiveResponse, COMPETITIVE_RESPONSE_LABELS),
        wizardChip(quiz.focusStyle, FOCUS_LABELS),
        wizardChip(quiz.decisionStyle, DECISION_LABELS),
        wizardChip(quiz.pressureResponse, PRESSURE_LABELS),
        wizardChip(quiz.repetitionTolerance, REPETITION_LABELS),
      ]),
    },
    {
      title: "What suits them",
      items: present([
        wizardChip(quiz.contactComfort, CONTACT_LABELS),
        wizardChip(quiz.environment, ENV_LABELS),
        wizardChip(quiz.waterComfort, WATER_COMFORT_LABELS),
      ]),
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}
