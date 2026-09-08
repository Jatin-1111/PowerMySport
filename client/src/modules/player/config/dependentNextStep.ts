/**
 * Where a parent goes to close a specific gap in a child's profile.
 *
 * `calculateDependentCompletion` reports *what* is missing; this maps each of
 * those gaps onto the screen that can actually fill it, so a dashboard card can
 * offer one concrete action ("Physical traits — add now") instead of a generic
 * "complete your profile" that lands the parent on a page and leaves them to
 * hunt for the field.
 *
 * The targets are the steps of `DependentManagementModal`, reached through the
 * `?editDependent=<id>&step=<stepId>` deep link that `useProfilePage` already
 * handles. The one exception is `assessment`, which no modal step owns — that
 * gap is closed by the pathway/discovery flow, so it points at the child's
 * detail page where those entry points live.
 */
import type { DependentModalStepId } from "@/modules/player/components/DependentManagementModal";

/** Completion field id (from `DEPENDENT_COMPLETION_FIELDS`) → modal step. */
const FIELD_TO_STEP: Record<string, DependentModalStepId> = {
  // "Sport & setup" carries both what they play and where they're based.
  sportsFocus: "sport",
  location: "sport",
  physical: "physical",
  personality: "personality",
  // "Environment & senses" holds contactComfort / environment / waterComfort.
  comfort: "environment",
  // "Goals & commitment" holds budgetRange / ambition / weeklyHoursCategory.
  practical: "goals",
};

/**
 * The href that closes `field` for `dependentId`.
 *
 * Returns the child's detail page for gaps no modal step owns, so the caller
 * never has to special-case a missing mapping.
 */
export function nextStepHref(dependentId: string, field: string): string {
  const step = FIELD_TO_STEP[field];
  if (!step) {
    return `/dashboard/dependents/${dependentId}`;
  }
  return `/dashboard/my-profile?editDependent=${encodeURIComponent(dependentId)}&step=${step}`;
}
