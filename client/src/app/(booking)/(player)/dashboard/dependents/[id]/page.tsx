"use client";

import { toast } from "@/lib/toast";
import { useRefreshProfile } from "@/modules/auth/hooks/useProfile";
import { authApi } from "@/modules/auth/services/auth";
import DependentManagementModal from "@/modules/player/components/DependentManagementModal";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileCompletionRing } from "@/modules/player/components/ProfileCompletionRing";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileEditPanel } from "@/modules/player/components/ProfileEditPanel";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { formatDependentRelation } from "@/modules/player/data/dependentRelations";
import {
  AGILITY_LABELS,
  AMBITION_LABELS,
  BUDGET_RANGE_LABELS,
  BUILD_LABELS,
  COMPETITIVE_RESPONSE_LABELS,
  CONTACT_LABELS,
  DECISION_LABELS,
  ENERGY_LABELS,
  ENV_LABELS,
  EYESIGHT_LABELS,
  FOCUS_LABELS,
  GENDER_LABELS,
  HEIGHT_LABELS,
  MATCH_RANK_META,
  PRESSURE_LABELS,
  REPETITION_LABELS,
  TEAM_INDIVIDUAL_LABELS,
  VISUAL_TRACKING_LABELS,
  WATER_COMFORT_LABELS,
  WEEKLY_HOURS_LABELS,
  wizardChip,
} from "@/modules/player/data/wizardLabels";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { calculateDependentCompletion } from "@/modules/player/utils/dependentCompletion";
import { denormalizeDependent } from "@/modules/player/utils/dependentNormalize";
import { roadmapHref } from "@/modules/pathway/data/sports";
import { Avatar, AvatarFallback } from "@/modules/shared/ui/Avatar";
import { Badge } from "@/modules/shared/ui/Badge";
import { Breadcrumbs } from "@/modules/shared/ui/Breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Input } from "@/modules/shared/ui/Input";
import { Modal } from "@/modules/shared/ui/Modal";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { User } from "@/types";
import {
  ArrowRight,
  Compass,
  Edit2,
  GraduationCap,
  Info,
  Mail,
  Phone,
  ShieldAlert,
  Trash2,
  Trophy,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Dependent = NonNullable<User["dependents"]>[number];

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    return axiosError.response?.data?.message || "An error occurred";
  }
  if (error instanceof Error) return error.message;
  return "An error occurred";
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const formatGender = (gender?: string) => wizardChip(gender, GENDER_LABELS);

const CHIP_GROUPS = [
  { border: "border-blue-100", bg: "bg-blue-50", text: "text-blue-700" },
  { border: "border-indigo-100", bg: "bg-indigo-50", text: "text-indigo-700" },
  { border: "border-teal-100", bg: "bg-teal-50", text: "text-teal-700" },
  { border: "border-amber-100", bg: "bg-amber-50", text: "text-amber-700" },
];

function ChipRow({ label, chips, group }: { label: string; chips: string[]; group: number }) {
  if (chips.length === 0) return null;
  const c = CHIP_GROUPS[group];
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className={`rounded-full border ${c.border} ${c.bg} px-2.5 py-1 text-[11px] font-medium ${c.text}`}
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function DependentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function DependentDetailPage() {
  const params = useParams();
  const dependentId = String(params.id || "");
  const router = useRouter();
  const loadProfile = useRefreshProfile();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showGraduationModal, setShowGraduationModal] = useState(false);
  const [isGraduating, setIsGraduating] = useState(false);
  const [graduationForm, setGraduationForm] = useState({
    email: "",
    password: "",
    phone: "",
  });

  const fetchProfile = async () => {
    try {
      setUser(await loadProfile());
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "My Profile", href: "/dashboard/my-profile" },
            { label: "…" },
          ]}
        />
        <DependentDetailSkeleton />
      </div>
    );
  }

  const dependent = user?.dependents?.find((d) => d._id?.toString() === dependentId);

  if (!user || !dependent) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "My Profile", href: "/dashboard/my-profile" },
            { label: "Not found" },
          ]}
        />
        <EmptyState
          icon={UserRound}
          title="Dependent not found"
          description="This profile doesn't exist, or isn't linked to your account."
          actionLabel="Back to My Profile"
          onAction={() => router.push("/dashboard/my-profile")}
        />
      </div>
    );
  }

  const isParent = user.role === "Parent";
  const age = getDependentAge(dependent.dob) ?? dependent.age ?? null;
  const isEligibleToGraduate = age !== null && age >= 18;
  const genderLabel = formatGender(dependent.gender);
  const completion = calculateDependentCompletion(denormalizeDependent(dependent));
  const effectiveSport = dependent.sport?.chosenSport || dependent.sport?.sportsFocus?.[0];

  const physical = dependent.physical ?? {};
  const personality = dependent.personality ?? {};
  const comfort = dependent.comfort ?? {};
  const practical = dependent.practical ?? {};

  const physicalChips = [
    physical.heightCm && physical.weightKg
      ? `${physical.heightCm} cm · ${physical.weightKg} kg`
      : null,
    wizardChip(physical.build, BUILD_LABELS),
    wizardChip(physical.heightCategory, HEIGHT_LABELS),
    wizardChip(physical.energyType, ENERGY_LABELS),
    wizardChip(physical.visualTracking, VISUAL_TRACKING_LABELS),
    wizardChip(physical.eyesight, EYESIGHT_LABELS),
    wizardChip(physical.agility, AGILITY_LABELS),
  ].filter(Boolean) as string[];

  const personalityChips = [
    personality.teamIndividual !== undefined
      ? TEAM_INDIVIDUAL_LABELS[personality.teamIndividual as number]
      : null,
    wizardChip(personality.competitiveResponse, COMPETITIVE_RESPONSE_LABELS),
    wizardChip(personality.focusStyle, FOCUS_LABELS),
    wizardChip(personality.decisionStyle, DECISION_LABELS),
    wizardChip(personality.pressureResponse, PRESSURE_LABELS),
    wizardChip(personality.repetitionTolerance, REPETITION_LABELS),
  ].filter(Boolean) as string[];

  const comfortChips = [
    wizardChip(comfort.contactComfort, CONTACT_LABELS),
    wizardChip(comfort.environment, ENV_LABELS),
    wizardChip(comfort.waterComfort, WATER_COMFORT_LABELS),
  ].filter(Boolean) as string[];

  const practicalChips = [
    wizardChip(practical.budgetRange, BUDGET_RANGE_LABELS),
    wizardChip(practical.ambition, AMBITION_LABELS),
    wizardChip(practical.weeklyHoursCategory, WEEKLY_HOURS_LABELS),
  ].filter(Boolean) as string[];

  const hasTraitChips =
    physicalChips.length > 0 ||
    personalityChips.length > 0 ||
    comfortChips.length > 0 ||
    practicalChips.length > 0;

  const handleSaveDependent = async (data: Dependent) => {
    if (!dependent._id) return;
    setIsSaving(true);
    try {
      await authApi.updateDependent(dependent._id, data);
      toast.success("Profile updated successfully");
      await fetchProfile();
    } catch (error: unknown) {
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDependent = async () => {
    if (!dependent._id) return;
    setIsDeleting(true);
    try {
      await authApi.deleteDependent(dependent._id);
      toast.success("Dependent deleted");
      router.push("/dashboard/my-profile");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to delete dependent");
    } finally {
      setIsDeleting(false);
    }
  };

  const closeGraduationModal = () => {
    setShowGraduationModal(false);
    setGraduationForm({ email: "", password: "", phone: "" });
  };

  const handleSubmitGraduation = async () => {
    if (!dependent._id) return;
    if (!graduationForm.email || !graduationForm.password || !graduationForm.phone) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsGraduating(true);
    try {
      const response = await authApi.graduateDependent({
        dependentId: dependent._id,
        email: graduationForm.email,
        password: graduationForm.password,
        phone: graduationForm.phone,
      });
      if (response.success) {
        toast.success("Dependent graduated to an independent account.");
        closeGraduationModal();
        await fetchProfile();
      } else {
        toast.error(response.message || "Failed to graduate dependent");
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to graduate dependent");
    } finally {
      setIsGraduating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Profile", href: "/dashboard/my-profile" },
          { label: dependent.name },
        ]}
      />

      <PlayerPageHeader
        title={dependent.name}
        subtitle={[
          dependent.relation ? formatDependentRelation(dependent.relation) : null,
          age !== null ? `${age} yrs` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <Button
            onClick={() => setShowEditModal(true)}
            variant="outline"
            icon={<Edit2 size={16} />}
          >
            Edit Profile
          </Button>
        }
      />

      {/* ── Overview ── */}
      <Card className="shop-surface premium-shadow p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ProfileCompletionRing
            percent={completion.percent}
            size={64}
            strokeWidth={3}
            title={`${dependent.name}'s profile is ${completion.percent}% complete`}
          >
            <Avatar className="h-16 w-16 border border-white shadow-sm">
              <AvatarFallback className="bg-power-orange/10 text-power-orange text-lg font-bold">
                {getInitials(dependent.name)}
              </AvatarFallback>
            </Avatar>
          </ProfileCompletionRing>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
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
              {completion.percent < 100 && (
                <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                  {completion.percent}% complete
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
          </div>
        </div>

        {/* Sport / roadmap CTA */}
        {effectiveSport ? (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-orange-100 bg-orange-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                Playing
              </p>
              <p className="text-lg font-bold text-slate-900">{effectiveSport}</p>
            </div>
            <Link href={roadmapHref(effectiveSport)}>
              <Button variant="outline" icon={<ArrowRight size={16} />}>
                View Roadmap
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">No sport chosen yet</p>
              <p className="text-sm text-slate-500">
                Take the assessment to find {dependent.name}&apos;s best-fit sport.
              </p>
            </div>
            <Link href="/assessment/discover">
              <Button size="sm" icon={<Compass size={16} />}>
                Find a Sport
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* ── Assessment results ── */}
      {(dependent.sport?.sportMatches?.length ?? 0) > 0 && (
        <Card className="shop-surface premium-shadow overflow-hidden p-0">
          <ProfileSectionHeader
            icon={Trophy}
            title="Assessment Results"
            description={
              dependent.sport?.wizardCompletedAt
                ? `Assessed on ${new Date(dependent.sport.wizardCompletedAt).toLocaleDateString(
                    undefined,
                    { day: "numeric", month: "short", year: "numeric" }
                  )}`
                : "Sport fit results from the assessment."
            }
            action={
              <Link href="/assessment/discover">
                <Button variant="outline" size="sm">
                  Retake Assessment
                </Button>
              </Link>
            }
          />
          <CardContent className="space-y-1.5 p-6">
            {dependent.sport!.sportMatches!.map((m, i) => {
              const meta = MATCH_RANK_META[i] ?? MATCH_RANK_META[2];
              const RankIcon = meta.icon;
              return (
                <div
                  key={m.sport}
                  className={`flex items-center justify-between rounded-lg border ${meta.ring} bg-white px-3 py-2`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${meta.badge}`}
                    >
                      <RankIcon className="h-3 w-3" />
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{m.sport}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">{m.fitLabel}</span>
                    <span className="text-[11px] tabular-nums text-slate-300">{m.score}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Profile details ── */}
      <Card className="shop-surface premium-shadow overflow-hidden p-0">
        <ProfileSectionHeader
          icon={Info}
          title="Profile Details"
          description="Physical, personality, and practical traits from the assessment."
          completionPercent={completion.percent}
          onEdit={() => setShowEditModal(true)}
        />
        <CardContent className="p-6">
          {hasTraitChips || (dependent.medicalConditions?.length ?? 0) > 0 ? (
            <div className="space-y-4">
              <ChipRow label="Physical profile" chips={physicalChips} group={0} />
              <ChipRow label="Personality & play style" chips={personalityChips} group={1} />
              <ChipRow label="Comfort & environment" chips={comfortChips} group={2} />
              <ChipRow label="Practical" chips={practicalChips} group={3} />
              {(dependent.medicalConditions?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Medical conditions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dependent.medicalConditions!.map((cond) => (
                      <Badge
                        key={cond}
                        className="border-amber-200 bg-amber-50 text-[11px] text-amber-700 hover:bg-amber-50"
                      >
                        {cond}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Info}
              title="No profile details yet"
              description="Fill in physical, personality, and practical details to get a fuller picture."
              actionLabel="Edit Profile"
              onAction={() => setShowEditModal(true)}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Account actions ── */}
      {isParent && (
        <Card className="shop-surface premium-shadow p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="bg-power-orange/10 text-power-orange flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Graduate to independent account
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {isEligibleToGraduate
                    ? `${dependent.name} can sign in and book independently.`
                    : `Eligible once ${dependent.name} turns 18 (currently ${age ?? "?"} yrs).`}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowGraduationModal(true)}
              disabled={!isEligibleToGraduate}
              variant={isEligibleToGraduate ? "primary" : "secondary"}
              icon={<GraduationCap size={16} />}
              className="w-full sm:w-auto"
            >
              Graduate
            </Button>
          </div>

          <div className="mt-5 flex items-start gap-3 border-t border-slate-200/70 pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Delete this profile</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Permanently removes {dependent.name}&apos;s profile, assessment results, and booking
                history. This cannot be undone.
              </p>
            </div>
            <Button
              onClick={() => setShowDeleteModal(true)}
              variant="ghost"
              size="sm"
              className="border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              icon={<Trash2 size={14} />}
            >
              Delete
            </Button>
          </div>
        </Card>
      )}

      <DependentManagementModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleSaveDependent}
        initialDependent={dependent}
        isLoading={isSaving}
      />

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete dependent"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteDependent}
              disabled={isDeleting}
              loading={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete
          <span className="font-semibold text-slate-900"> {dependent.name}</span>? This action
          cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={showGraduationModal}
        onClose={closeGraduationModal}
        title="Graduate to Independent Account"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeGraduationModal}
              disabled={isGraduating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitGraduation}
              loading={isGraduating}
              disabled={!graduationForm.email || !graduationForm.password || !graduationForm.phone}
            >
              Graduate
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <ProfileEditPanel
            title={`Account for ${dependent.name}`}
            description="They will use these credentials to sign in and book independently."
          >
            <div className="space-y-4">
              <ProfileEditField
                label="Email"
                htmlFor="graduation-email"
                required
                icon={Mail}
                hint="This becomes their login email."
              >
                <Input
                  id="graduation-email"
                  type="email"
                  value={graduationForm.email}
                  onChange={(event) =>
                    setGraduationForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="newaccount@example.com"
                />
              </ProfileEditField>

              <ProfileEditField
                label="Password"
                htmlFor="graduation-password"
                required
                hint="Minimum 8 characters recommended."
              >
                <Input
                  id="graduation-password"
                  type="password"
                  value={graduationForm.password}
                  onChange={(event) =>
                    setGraduationForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="Create a password"
                />
              </ProfileEditField>

              <ProfileEditField
                label="Phone"
                htmlFor="graduation-phone"
                required
                icon={Phone}
                hint="Used for booking confirmations."
              >
                <Input
                  id="graduation-phone"
                  type="tel"
                  value={graduationForm.phone}
                  onChange={(event) =>
                    setGraduationForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="Phone number"
                />
              </ProfileEditField>
            </div>
          </ProfileEditPanel>
        </div>
      </Modal>
    </div>
  );
}
