"use client";

import { stateSelectOptions } from "@/lib/indianStates";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileEditPanel } from "@/modules/player/components/ProfileEditPanel";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import { Badge } from "@/modules/shared/ui/Badge";
import { Input } from "@/modules/shared/ui/Input";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { Trophy } from "lucide-react";

const PERSONALITY_TAG_OPTIONS = [
  "Shy",
  "Energetic",
  "Competitive",
  "Social",
  "Focused",
  "Curious",
  "Patient",
  "Team-oriented",
];

export interface PlayerProfileForm {
  yearsPlaying: number | undefined;
  personalityTags: string[];
  primaryObjective: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment: number;
  budgetTier: "Budget" | "Moderate" | "Premium";
  location: string;
  bio: string;
  involvementYears: number | undefined;
  sportInterests: string[];
}

/** The edit-mode half of PlayerProfileCard — the sports/parent-background
 *  form plus the shared AI guidance preferences panel. Split out purely to
 *  stay under the size ratchet; still only ever rendered from that card. */
export function PlayerProfileEditForm({
  isParent,
  selectedSports,
  setSelectedSports,
  playerProfileForm,
  setPlayerProfileForm,
}: {
  isParent: boolean;
  selectedSports: string[];
  setSelectedSports: (sports: string[]) => void;
  playerProfileForm: PlayerProfileForm;
  setPlayerProfileForm: (updater: (f: PlayerProfileForm) => PlayerProfileForm) => void;
}) {
  return (
    <div className="space-y-6">
      {isParent ? (
        <ProfileEditPanel
          title="About You"
          description="Your sports background as a parent — helps the AI understand your perspective."
        >
          <ProfileEditField
            label="About You"
            htmlFor="parent-bio"
            hint={`${playerProfileForm.bio.length}/300 — your background as a sports parent`}
          >
            <textarea
              id="parent-bio"
              rows={3}
              maxLength={300}
              value={playerProfileForm.bio}
              onChange={(e) => setPlayerProfileForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="e.g., Former club cricketer, now focused on my daughter's tennis journey."
              className="focus:border-power-orange focus:ring-power-orange/20 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2"
            />
          </ProfileEditField>

          <ProfileEditField
            label="Sports You Follow or Have Played"
            hint="Helps the AI understand your perspective when asking about your child's sport"
          >
            <SportsMultiSelect
              value={playerProfileForm.sportInterests}
              onChange={(s) => setPlayerProfileForm((f) => ({ ...f, sportInterests: s }))}
            />
          </ProfileEditField>

          <ProfileEditField
            label="Years Involved in Sport"
            htmlFor="parent-involvement-years"
            hint="How long you've been involved or interested in sport"
          >
            <div className="flex items-center gap-3">
              <Input
                id="parent-involvement-years"
                type="number"
                min="0"
                max="40"
                placeholder="e.g., 5"
                value={playerProfileForm.involvementYears ?? ""}
                onChange={(e) =>
                  setPlayerProfileForm((f) => ({
                    ...f,
                    involvementYears:
                      e.target.value === ""
                        ? undefined
                        : Math.min(40, parseInt(e.target.value, 10) || 0),
                  }))
                }
                className="w-28"
              />
              <span className="text-sm text-slate-500">years</span>
            </div>
          </ProfileEditField>
        </ProfileEditPanel>
      ) : (
        <ProfileEditPanel description="Choose the sports you play or are interested in. You can select multiple.">
          <ProfileEditField
            label="Your sports"
            hint={`${selectedSports.length} sport${selectedSports.length === 1 ? "" : "s"} selected`}
          >
            <SportsMultiSelect value={selectedSports} onChange={setSelectedSports} />
          </ProfileEditField>

          <ProfileEditField
            label="Experience (Years)"
            htmlFor="self-years-playing"
            hint="Leave blank if you haven't started playing yet"
          >
            <Input
              id="self-years-playing"
              type="number"
              min="0"
              max="20"
              placeholder="e.g., 2"
              value={playerProfileForm.yearsPlaying ?? ""}
              onChange={(e) =>
                setPlayerProfileForm((f) => ({
                  ...f,
                  yearsPlaying: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                }))
              }
            />
          </ProfileEditField>

          {selectedSports.length > 0 ? (
            <div className="mt-4 rounded-lg border border-orange-100 bg-white/80 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Selected
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedSports.map((sport) => (
                  <Badge
                    key={sport}
                    className="border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-50"
                  >
                    {sport}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-center">
              <Trophy className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              <p className="text-sm text-slate-500">
                No sports selected yet. Search above to add some.
              </p>
            </div>
          )}
        </ProfileEditPanel>
      )}

      <ProfileEditPanel
        title="AI Guidance Preferences"
        description="Used to pre-fill AI recommendations for you."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileEditField label="Primary Objective" htmlFor="primary-objective">
              <ProfileFormSelect
                id="primary-objective"
                value={playerProfileForm.primaryObjective}
                onChange={(value: any) =>
                  setPlayerProfileForm((f) => ({
                    ...f,
                    primaryObjective: value,
                  }))
                }
                options={[
                  { value: "Recreational", label: "Recreational" },
                  { value: "Fitness", label: "Fitness" },
                  { value: "Compete", label: "Compete" },
                ]}
              />
            </ProfileEditField>

            <ProfileEditField label="Budget Tier" htmlFor="budget-tier">
              <ProfileFormSelect
                id="budget-tier"
                value={playerProfileForm.budgetTier}
                onChange={(value: any) =>
                  setPlayerProfileForm((f) => ({
                    ...f,
                    budgetTier: value,
                  }))
                }
                options={[
                  { value: "Budget", label: "Budget" },
                  { value: "Moderate", label: "Moderate" },
                  { value: "Premium", label: "Premium" },
                ]}
              />
            </ProfileEditField>
          </div>

          <ProfileEditField
            label="State / Union Territory"
            htmlFor="self-location"
            hint="Used for local scheme & resource recommendations"
          >
            <ProfileFormSelect
              id="self-location"
              value={playerProfileForm.location}
              onChange={(value: string) => setPlayerProfileForm((f) => ({ ...f, location: value }))}
              options={[
                { value: "", label: "— Select state —" },
                ...stateSelectOptions(playerProfileForm.location),
              ]}
            />
          </ProfileEditField>

          <ProfileEditField label="Weekly Time Commitment (Hours)" htmlFor="weekly-time">
            <Input
              id="weekly-time"
              type="number"
              min="1"
              max="40"
              value={playerProfileForm.weeklyTimeCommitment}
              onChange={(e) =>
                setPlayerProfileForm((f) => ({
                  ...f,
                  weeklyTimeCommitment: parseInt(e.target.value) || 3,
                }))
              }
            />
          </ProfileEditField>

          <ProfileEditField label="Personality Tags">
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_TAG_OPTIONS.map((tag) => {
                const isSelected = playerProfileForm.personalityTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setPlayerProfileForm((f) => {
                        const next = isSelected
                          ? f.personalityTags.filter((t) => t !== tag)
                          : [...f.personalityTags, tag];
                        return { ...f, personalityTags: next };
                      });
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "border-blue-600 bg-indigo-50 font-medium text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </ProfileEditField>
        </div>
      </ProfileEditPanel>
    </div>
  );
}
