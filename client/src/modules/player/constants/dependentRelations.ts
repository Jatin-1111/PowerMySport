export const DEPENDENT_RELATIONS = [
  { value: "SON", label: "Son" },
  { value: "DAUGHTER", label: "Daughter" },
  { value: "CHILD", label: "Child" },
  { value: "NEPHEW", label: "Nephew" },
  { value: "NIECE", label: "Niece" },
  { value: "WARD", label: "Ward" },
  { value: "OTHER", label: "Other" },
] as const;

export type DependentRelation = (typeof DEPENDENT_RELATIONS)[number]["value"];

export const DEFAULT_DEPENDENT_RELATION: DependentRelation = "CHILD";

export function formatDependentRelation(relation?: string): string {
  if (!relation) return "";

  const match = DEPENDENT_RELATIONS.find(
    (option) => option.value === relation.toUpperCase(),
  );
  if (match) return match.label;

  return relation
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeDependentRelation(
  relation?: string,
): DependentRelation {
  if (!relation) return DEFAULT_DEPENDENT_RELATION;

  const match = DEPENDENT_RELATIONS.find(
    (option) => option.value === relation.toUpperCase(),
  );
  return match?.value ?? DEFAULT_DEPENDENT_RELATION;
}
