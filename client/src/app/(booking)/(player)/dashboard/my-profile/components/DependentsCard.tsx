"use client";

import { Button } from "@/modules/shared/ui/Button";
import { ProfileCompletionRing } from "@/modules/player/components/ProfileCompletionRing";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { formatDependentRelation } from "@/modules/player/data/dependentRelations";
import { GENDER_LABELS, wizardChip } from "@/modules/player/data/wizardLabels";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { calculateDependentCompletion } from "@/modules/player/utils/dependentCompletion";
import { denormalizeDependent } from "@/modules/player/utils/dependentNormalize";
import { User } from "@/types";
import { ArrowRight, Plus, Trash2, Users } from "lucide-react";
import type { useRouter } from "next/navigation";
import type { Dependent } from "../hooks/useProfilePage";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const formatGender = (gender?: string) => wizardChip(gender, GENDER_LABELS);

export function DependentsCard({
  user,
  isParent,
  router,
  onAddDependent,
  onDeleteDependent,
  isDeletingDependentId,
}: {
  user: User;
  isParent: boolean;
  router: ReturnType<typeof useRouter>;
  onAddDependent: () => void;
  onDeleteDependent: (dependent: Dependent) => void;
  isDeletingDependentId: string | null;
}) {
  const dependents = user.dependents ?? [];

  return (
    <section aria-labelledby="dependents" className="border-hairline border-t pt-10">
      <ProfileSectionHeader
        headingId="dependents"
        icon={Users}
        title="My dependents"
        description="Children or wards whose bookings you manage."
        action={
          isParent ? (
            <Button
              onClick={onAddDependent}
              size="sm"
              icon={<Plus size={14} />}
              className="w-full sm:w-auto"
            >
              Add dependent
            </Button>
          ) : undefined
        }
      />

      {dependents.length > 0 ? (
        <ul className="divide-hairline border-hairline mt-8 divide-y border-y">
          {dependents.map((dependent) => {
            const age = getDependentAge(dependent.dob) ?? dependent.age ?? null;
            const sport = dependent.sport?.chosenSport || dependent.sport?.sportsFocus?.[0];
            const completion = calculateDependentCompletion(denormalizeDependent(dependent));
            const meta = [
              dependent.relation ? formatDependentRelation(dependent.relation) : null,
              formatGender(dependent.gender),
              age !== null ? `${age} yrs` : null,
              sport,
            ].filter(Boolean);
            const isDeleting = isDeletingDependentId === dependent._id;

            return (
              <li
                key={dependent._id}
                className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <ProfileCompletionRing
                    percent={completion.percent}
                    size={52}
                    strokeWidth={3}
                    title={`${dependent.name}'s profile is ${completion.percent}% complete`}
                  >
                    <div className="bg-paper-deep text-ink flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold">
                      {getInitials(dependent.name)}
                    </div>
                  </ProfileCompletionRing>

                  <div className="min-w-0">
                    <h3 className="text-ink truncate text-lg font-medium">{dependent.name}</h3>
                    {meta.length > 0 && (
                      <p className="text-ink-muted mt-0.5 text-sm">{meta.join(" · ")}</p>
                    )}
                    {completion.percent < 100 && (
                      <p className="text-ink-muted mt-0.5 text-sm tabular-nums">
                        Profile {completion.percent}% complete
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    onClick={() => router.push(`/dashboard/dependents/${dependent._id}`)}
                    variant="outline"
                    size="sm"
                    disabled={!dependent._id}
                    icon={<ArrowRight size={14} />}
                  >
                    View profile
                  </Button>
                  <Button
                    onClick={() => onDeleteDependent(dependent)}
                    variant="ghost"
                    size="sm"
                    disabled={isDeleting}
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    icon={<Trash2 size={14} />}
                  >
                    {isDeleting ? "Deleting" : "Delete"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border-hairline mt-8 max-w-lg rounded-xl border border-dashed px-5 py-6">
          <p className="text-ink font-medium">No dependents yet</p>
          <p className="text-ink-muted mt-1 text-pretty text-sm">
            Add a child or ward to manage their bookings, sports, and player profile from your
            account.
          </p>
          {isParent && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onAddDependent}>
              Add dependent
            </Button>
          )}
        </div>
      )}

      <p className="text-ink-muted mt-6 max-w-2xl text-pretty text-sm leading-relaxed">
        A dependent is someone whose bookings you manage. You can book venues and coaches for them,
        track their sports, and move them to an independent account once they turn 18.
      </p>
    </section>
  );
}
