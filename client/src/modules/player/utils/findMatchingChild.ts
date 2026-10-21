/**
 * Which of a parent's children a typed name (and date of birth, when given) refers to, so a
 * flow that asks for a name updates that child instead of adding a second one.
 *
 * A name and date of birth that both match win over a name alone; a name alone is the
 * fallback because many parents do not give a date of birth. Names compare without regard
 * to case or surrounding spaces. Returns null when nothing matches.
 */
export interface MatchableChild {
  name?: string | null;
  dob?: string | Date | null;
}

const day = (value: string | Date | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

export function findMatchingChild<T extends MatchableChild>(
  children: readonly T[],
  typed: { name: string; dateOfBirth?: string | null }
): T | null {
  const wanted = typed.name.trim().toLowerCase();
  if (!wanted) return null;

  const sameName = children.filter((child) => child.name?.trim().toLowerCase() === wanted);
  if (typed.dateOfBirth) {
    const exact = sameName.find((child) => day(child.dob) === typed.dateOfBirth);
    if (exact) return exact;
  }
  return sameName[0] ?? null;
}
