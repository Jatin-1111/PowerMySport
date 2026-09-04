"use client";

import { normalizeStoredState } from "@/lib/indianStates";
import { ProfileInfoField } from "@/modules/player/components/ProfileInfoField";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { calculateProfileCompletion } from "@/modules/player/utils/profileCompletion";
import { Badge } from "@/modules/shared/ui/Badge";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { User } from "@/types";
import { cn } from "@/utils/cn";
import { Trophy } from "lucide-react";
import { PlayerProfileEditForm, type PlayerProfileForm } from "./PlayerProfileEditForm";

export function PlayerProfileCard({
  user,
  isParent,
  isEditingSports,
  isSavingSports,
  selectedSports,
  setSelectedSports,
  playerProfileForm,
  setPlayerProfileForm,
  onEdit,
  onCancel,
  onSave,
}: {
  user: User;
  isParent: boolean;
  isEditingSports: boolean;
  isSavingSports: boolean;
  selectedSports: string[];
  setSelectedSports: (sports: string[]) => void;
  playerProfileForm: PlayerProfileForm;
  setPlayerProfileForm: (updater: (f: PlayerProfileForm) => PlayerProfileForm) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Card
      className={cn(
        "shop-surface premium-shadow overflow-hidden p-0 transition-shadow",
        isEditingSports && "ring-power-orange/20 ring-2"
      )}
    >
      <ProfileSectionHeader
        icon={Trophy}
        title={isParent ? "Parent Profile" : "Player Profile"}
        description={
          isParent
            ? "Your background and preferences — used to personalise AI guidance."
            : "Your sports and AI guidance preferences."
        }
        isEditing={isEditingSports}
        onEdit={onEdit}
        onCancel={onCancel}
        onSave={onSave}
        saving={isSavingSports}
        saveLabel="Save Profile"
        completionPercent={calculateProfileCompletion(user.playerProfile).percent}
      />

      <CardContent className="px-6 py-6">
        {isEditingSports ? (
          <PlayerProfileEditForm
            isParent={isParent}
            selectedSports={selectedSports}
            setSelectedSports={setSelectedSports}
            playerProfileForm={playerProfileForm}
            setPlayerProfileForm={setPlayerProfileForm}
          />
        ) : (
          <div className="space-y-8">
            {isParent ? (
              <div>
                <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  About You
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileInfoField label="Background">
                    {user.parentProfile?.bio ? (
                      <p className="text-sm leading-relaxed text-slate-700">
                        {user.parentProfile.bio}
                      </p>
                    ) : (
                      <span className="text-sm italic text-slate-400">Not provided</span>
                    )}
                  </ProfileInfoField>
                  <ProfileInfoField label="Years Involved in Sport">
                    {user.parentProfile?.involvementYears !== undefined ? (
                      `${user.parentProfile.involvementYears} year${user.parentProfile.involvementYears === 1 ? "" : "s"}`
                    ) : (
                      <span className="text-sm italic text-slate-400">Not provided</span>
                    )}
                  </ProfileInfoField>
                  <ProfileInfoField label="Sports Followed">
                    {user.parentProfile?.sportInterests &&
                    user.parentProfile.sportInterests.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {user.parentProfile.sportInterests.map((sport) => (
                          <Badge
                            key={sport}
                            className="border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-50"
                          >
                            {sport}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm italic text-slate-400">Not provided</span>
                    )}
                  </ProfileInfoField>
                </div>
              </div>
            ) : (
              <div>
                <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  My Sports
                </h4>
                {user.playerProfile?.sportsFocus && user.playerProfile.sportsFocus.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.playerProfile.sportsFocus.map((sport: string) => (
                      <Badge
                        key={sport}
                        className="border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-50"
                      >
                        {sport}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="max-w-lg rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center">
                    <Trophy className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">No sports added yet</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Add the sports you play to get better recommendations.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={onEdit}>
                      Add Sports
                    </Button>
                  </div>
                )}
                <div className="mt-4">
                  <ProfileInfoField label="Experience">
                    {user.playerProfile?.yearsPlaying !== undefined
                      ? `${user.playerProfile.yearsPlaying} year${user.playerProfile.yearsPlaying === 1 ? "" : "s"}`
                      : "Not started yet"}
                  </ProfileInfoField>
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-6">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                AI Guidance Preferences
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileInfoField label="Primary Objective">
                  {user.playerProfile?.primaryObjective || "Not specified"}
                </ProfileInfoField>
                <ProfileInfoField label="Budget">
                  {user.playerProfile?.budgetTier || "Not specified"}
                </ProfileInfoField>
                <ProfileInfoField label="State">
                  {normalizeStoredState(user.playerProfile?.location) || "Not specified"}
                </ProfileInfoField>
                <ProfileInfoField label="Weekly Time">
                  {user.playerProfile?.weeklyTimeCommitment
                    ? `${user.playerProfile.weeklyTimeCommitment} hours`
                    : "Not specified"}
                </ProfileInfoField>
                <ProfileInfoField label="Personality">
                  {user.playerProfile?.personalityTags &&
                  user.playerProfile.personalityTags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {user.playerProfile.personalityTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    "Not specified"
                  )}
                </ProfileInfoField>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
