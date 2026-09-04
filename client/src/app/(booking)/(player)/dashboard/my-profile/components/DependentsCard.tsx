"use client";

import { Avatar, AvatarFallback } from "@/modules/shared/ui/Avatar";
import { Badge } from "@/modules/shared/ui/Badge";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { ProfileCompletionRing } from "@/modules/player/components/ProfileCompletionRing";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { formatDependentRelation } from "@/modules/player/data/dependentRelations";
import { GENDER_LABELS, wizardChip } from "@/modules/player/data/wizardLabels";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { calculateDependentCompletion } from "@/modules/player/utils/dependentCompletion";
import { denormalizeDependent } from "@/modules/player/utils/dependentNormalize";
import { User } from "@/types";
import { ArrowRight, Info, Plus, Trash2, Users } from "lucide-react";
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
  return (
    <Card className="shop-surface premium-shadow overflow-hidden p-0">
      <ProfileSectionHeader
        icon={Users}
        title="My Dependents"
        description="Manage children or wards whose bookings you handle."
        action={
          isParent ? (
            <Button
              onClick={onAddDependent}
              size="sm"
              icon={<Plus size={14} />}
              className="w-full sm:w-auto"
            >
              Add Dependent
            </Button>
          ) : undefined
        }
      />

      <CardContent className="px-6 py-6">
        {user.dependents && user.dependents.length > 0 ? (
          <div className="grid gap-4">
            {user.dependents.map((dependent) => {
              const age = getDependentAge(dependent.dob) ?? dependent.age ?? null;
              const genderLabel = formatGender(dependent.gender);
              const dependentCompletion = calculateDependentCompletion(
                denormalizeDependent(dependent)
              );

              return (
                <div
                  key={dependent._id}
                  className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <ProfileCompletionRing
                        percent={dependentCompletion.percent}
                        size={52}
                        strokeWidth={3}
                        title={`${dependent.name}'s profile is ${dependentCompletion.percent}% complete`}
                      >
                        <Avatar className="h-12 w-12 border border-white shadow-sm">
                          <AvatarFallback className="bg-power-orange/10 text-power-orange text-sm font-bold">
                            {getInitials(dependent.name)}
                          </AvatarFallback>
                        </Avatar>
                      </ProfileCompletionRing>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                          {dependent.name}
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {dependent.relation && (
                            <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                              {formatDependentRelation(dependent.relation)}
                            </Badge>
                          )}
                          {genderLabel && (
                            <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                              {genderLabel}
                            </Badge>
                          )}
                          {age !== null && (
                            <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                              {age} yrs
                            </Badge>
                          )}
                          {dependentCompletion.percent < 100 && (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                              {dependentCompletion.percent}% complete
                            </Badge>
                          )}
                        </div>

                        {dependent.dob && (
                          <p className="mt-2 text-sm text-slate-500">
                            Born{" "}
                            {new Date(dependent.dob).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        )}

                        {/* Sport, at a glance — full detail lives on the profile page */}
                        {(dependent.sport?.chosenSport || dependent.sport?.sportsFocus?.[0]) && (
                          <div className="mt-3">
                            <Badge className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50">
                              {dependent.sport?.chosenSport || dependent.sport?.sportsFocus?.[0]}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        onClick={() => router.push(`/dashboard/dependents/${dependent._id}`)}
                        variant="outline"
                        size="sm"
                        disabled={!dependent._id}
                        icon={<ArrowRight size={14} />}
                      >
                        View Profile
                      </Button>
                      <Button
                        onClick={() => onDeleteDependent(dependent)}
                        variant="ghost"
                        size="sm"
                        disabled={isDeletingDependentId === dependent._id}
                        className="border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        icon={<Trash2 size={14} />}
                      >
                        {isDeletingDependentId === dependent._id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No dependents yet"
            description="Add a child or ward to manage their bookings, sports, and player profile from your account."
            actionLabel={isParent ? "Add Dependent" : undefined}
            onAction={isParent ? onAddDependent : undefined}
          />
        )}
      </CardContent>

      <div className="border-t border-slate-200/60 bg-indigo-50/50 px-6 py-4">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <Info className="h-4 w-4" />
          </div>
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900">What is a dependent?</p>
            <p className="mt-1">
              A dependent is someone whose bookings you manage. You can book venues and coaches for
              them, track their sports, and graduate them to an independent account once they turn
              18.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
