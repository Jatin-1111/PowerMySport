"use client";

import { ProfileInfoField } from "@/modules/player/components/ProfileInfoField";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { calculateProfileCompletion } from "@/modules/player/utils/profileCompletion";
import { Button } from "@/modules/shared/ui/Button";
import { User } from "@/types";
import { Trophy } from "lucide-react";
import { SportChips } from "./SportChips";
import { PlayerProfileEditForm, type PlayerProfileForm } from "./PlayerProfileEditForm";

const years = (n: number) => `${n} year${n === 1 ? "" : "s"}`;

const NOT_PROVIDED = <span className="text-ink-muted text-sm">Not provided</span>;

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
  const parentInterests = user.parentProfile?.sportInterests ?? [];
  const playerSports = user.playerProfile?.sportsFocus ?? [];

  return (
    <section aria-labelledby="player-profile" className="border-hairline border-t pt-10">
      <ProfileSectionHeader
        headingId="player-profile"
        variant="flat"
        icon={Trophy}
        title={isParent ? "Parent profile" : "Player profile"}
        description={isParent ? "Your background as a sports parent." : "The sports you play."}
        isEditing={isEditingSports}
        onEdit={onEdit}
        onCancel={onCancel}
        onSave={onSave}
        saving={isSavingSports}
        saveLabel="Save profile"
        completionPercent={calculateProfileCompletion(user).percent}
      />

      <div className="mt-8">
        {isEditingSports ? (
          <PlayerProfileEditForm
            isParent={isParent}
            selectedSports={selectedSports}
            setSelectedSports={setSelectedSports}
            playerProfileForm={playerProfileForm}
            setPlayerProfileForm={setPlayerProfileForm}
          />
        ) : isParent ? (
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <ProfileInfoField label="Background" className="sm:col-span-2">
              {user.parentProfile?.bio ? (
                <p className="text-ink-body max-w-prose text-pretty text-base leading-relaxed">
                  {user.parentProfile.bio}
                </p>
              ) : (
                NOT_PROVIDED
              )}
            </ProfileInfoField>
            <ProfileInfoField label="Years involved in sport">
              {user.parentProfile?.involvementYears !== undefined ? (
                <span className="tabular-nums">{years(user.parentProfile.involvementYears)}</span>
              ) : (
                NOT_PROVIDED
              )}
            </ProfileInfoField>
            <ProfileInfoField label="Sports followed">
              {parentInterests.length > 0 ? <SportChips sports={parentInterests} /> : NOT_PROVIDED}
            </ProfileInfoField>
          </dl>
        ) : (
          <div className="space-y-6">
            {playerSports.length > 0 ? (
              <div>
                <h3 className="text-ink mb-3 font-medium">My sports</h3>
                <SportChips sports={playerSports} />
              </div>
            ) : (
              <div className="border-hairline max-w-lg rounded-xl border border-dashed px-5 py-6">
                <p className="text-ink font-medium">No sports added yet</p>
                <p className="text-ink-muted mt-1 text-pretty text-sm">
                  Add the sports you play to get better recommendations.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={onEdit}>
                  Add sports
                </Button>
              </div>
            )}
            <dl className="max-w-xs">
              <ProfileInfoField label="Experience">
                {user.playerProfile?.yearsPlaying !== undefined ? (
                  <span className="tabular-nums">{years(user.playerProfile.yearsPlaying)}</span>
                ) : (
                  "Not started yet"
                )}
              </ProfileInfoField>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
