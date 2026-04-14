type CoachCommunitySource = "coaches_list" | "coach_detail";

type CoachCommunityIntentInput = {
  source: CoachCommunitySource;
  selectedSport?: string;
  coachSports?: string[];
  coachId?: string;
};

type CoachCommunityIntent = {
  q?: string;
  sport?: string;
  analyticsMetadata: Record<string, unknown>;
};

const normalizeTerm = (value?: string | null): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
};

const dedupeTerms = (terms: Array<string | undefined | null>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const term of terms) {
    const normalized = normalizeTerm(term);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
};

export const buildCoachCommunityIntent = (
  input: CoachCommunityIntentInput,
): CoachCommunityIntent => {
  const selectedSport = normalizeTerm(input.selectedSport);
  const primaryCoachSport = normalizeTerm(input.coachSports?.[0]);
  const sport = selectedSport || primaryCoachSport || "";

  const queryTerms =
    input.source === "coach_detail"
      ? dedupeTerms([selectedSport, primaryCoachSport, "coach"])
      : dedupeTerms([selectedSport]);

  const q = queryTerms.length > 0 ? queryTerms.join(" ") : undefined;

  return {
    q,
    sport: sport || undefined,
    analyticsMetadata: {
      source: input.source,
      selectedSport: selectedSport || undefined,
      primaryCoachSport: primaryCoachSport || undefined,
      coachId: input.coachId || undefined,
      hasQuery: Boolean(q),
    },
  };
};
