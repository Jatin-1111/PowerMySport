import type { ExpertSessionPlayer } from "@/modules/expert/services/expert";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Boy",
  FEMALE: "Girl",
  OTHER: "Other",
};

/** "12 years, Girl. Best fit: Tennis (Strong fit)": the headline facts of the child. */
export const playerBriefLine = (player: ExpertSessionPlayer): string => {
  const basics = [
    player.age ? `${player.age} years` : "",
    player.gender ? GENDER_LABEL[player.gender] || player.gender : "",
  ]
    .filter(Boolean)
    .join(", ");
  const fit = player.topSportMatch
    ? `Best fit: ${player.topSportMatch.sport} (${player.topSportMatch.fitLabel})`
    : "";
  return [basics, fit].filter(Boolean).join(". ");
};

/** A few of the most useful assessment signals for a quick pre-session read, not the full profile. */
export const playerTraits = (player: ExpertSessionPlayer): string[] =>
  [
    player.ambition &&
      {
        fun: "Health and fun",
        competitive: "Competitive",
        national: "National level",
        professional: "Pro career",
      }[player.ambition],
    player.competitiveResponse &&
      {
        "fired-up": "Fires up after a loss",
        calm: "Calm after a loss",
        discouraged: "Needs time after a loss",
      }[player.competitiveResponse],
    player.pressureResponse &&
      {
        thrives: "Thrives under pressure",
        manages: "Manages pressure",
        avoids: "Avoids the spotlight",
      }[player.pressureResponse],
    player.energyType &&
      { explosive: "Explosive energy", endurance: "Endurance-built" }[player.energyType],
  ].filter((v): v is string => Boolean(v));
