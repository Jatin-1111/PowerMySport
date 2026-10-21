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
import { RankingLinkCard } from "@/modules/player/components/RankingLinkCard";
import { PlannerSection } from "@/modules/planner/components/PlannerSection";
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
  PRESSURE_LABELS,
  REPETITION_LABELS,
  TEAM_INDIVIDUAL_LABELS,
  VISUAL_TRACKING_LABELS,
  WATER_COMFORT_LABELS,
  WEEKLY_HOURS_LABELS,
  wizardChip,
} from "@/modules/player/data/wizardLabels";
import { deriveBodyCategories } from "@/modules/find-sport/utils/dependentMapping";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { calculateDependentCompletion } from "@/modules/player/utils/dependentCompletion";
import { denormalizeDependent } from "@/modules/player/utils/dependentNormalize";
import { roadmapHref } from "@/modules/pathway/data/sports";
import { Breadcrumbs } from "@/modules/shared/ui/Breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/modules/shared/ui/Input";
import { Modal } from "@/modules/shared/ui/Modal";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { User } from "@/types";
import { ArrowRight, Compass, Edit2, GraduationCap, Info, Mail, Phone, Trash2 } from "lucide-react";
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

function ChipRow({ label, chips }: { label: string; chips: string[] }) {
  if (chips.length === 0) return null;
  return (
    <div>
      <dt className="text-ink-muted mb-2 text-sm">{label}</dt>
      <dd>
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={chip}
              className="border-hairline text-ink rounded-md border bg-white px-3 py-1 text-sm"
            >
              {chip}
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function DependentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-14 w-72 max-w-full" />
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
            { label: "My profile", href: "/dashboard/my-profile" },
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
            { label: "My profile", href: "/dashboard/my-profile" },
            { label: "Not found" },
          ]}
        />
        <div className="py-16">
          <p className="font-editorial text-ink text-3xl font-light">Dependent not found</p>
          <p className="text-ink-body mt-2 max-w-md text-pretty">
            This profile doesn&apos;t exist, or isn&apos;t linked to your account.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => router.push("/dashboard/my-profile")}
          >
            Back to my profile
          </Button>
        </div>
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
  const body = deriveBodyCategories(physical.heightCm, physical.weightKg, age);
  const personality = dependent.personality ?? {};
  const comfort = dependent.comfort ?? {};
  const practical = dependent.practical ?? {};
  const physicalChips = [
    physical.heightCm && physical.weightKg
      ? `${physical.heightCm} cm · ${physical.weightKg} kg`
      : null,
    wizardChip(body.build, BUILD_LABELS),
    wizardChip(body.heightCategory, HEIGHT_LABELS),
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

  const assessedOn = dependent.sport?.wizardCompletedAt
    ? new Date(dependent.sport.wizardCompletedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const discoverHref = `/assessment/discover?dependentId=${encodeURIComponent(dependent._id ?? "")}`;
  const overviewMeta = [
    dependent.relation ? formatDependentRelation(dependent.relation) : null,
    genderLabel,
    age !== null ? `${age} yrs` : null,
    dependent.dob
      ? `Born ${new Date(dependent.dob).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-10">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My profile", href: "/dashboard/my-profile" },
          { label: dependent.name },
        ]}
      />

      <PlayerPageHeader
        title={dependent.name}
        action={
          <Button
            onClick={() => setShowEditModal(true)}
            variant="outline"
            icon={<Edit2 size={16} />}
          >
            Edit profile
          </Button>
        }
      />

      {/* ── Overview ── */}
      <section aria-label="Overview" className="border-hairline border-t pt-10">
        <div className="flex items-center gap-5">
          <ProfileCompletionRing
            percent={completion.percent}
            size={72}
            strokeWidth={3}
            title={`${dependent.name}'s profile is ${completion.percent}% complete`}
          >
            <div className="bg-paper-deep text-ink flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold">
              {getInitials(dependent.name)}
            </div>
          </ProfileCompletionRing>
          <div className="min-w-0">
            {overviewMeta.length > 0 && (
              <p className="text-ink-body text-pretty">{overviewMeta.join(" · ")}</p>
            )}
            {completion.percent < 100 && (
              <p className="text-ink-muted mt-1 text-sm tabular-nums">
                Profile {completion.percent}% complete
              </p>
            )}
          </div>
        </div>

        {effectiveSport ? (
          <div className="border-hairline mt-8 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-ink-muted text-sm">Playing</p>
              <p className="font-editorial text-ink mt-1 text-3xl font-light">{effectiveSport}</p>
            </div>
            <Link href={roadmapHref(effectiveSport)}>
              <Button variant="outline" icon={<ArrowRight size={16} />}>
                View roadmap
              </Button>
            </Link>
          </div>
        ) : (
          <div className="border-hairline mt-8 flex flex-col items-start gap-4 rounded-xl border border-dashed px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-ink font-medium">No sport chosen yet</p>
              <p className="text-ink-muted mt-1 text-pretty text-sm">
                Take the assessment to find {dependent.name}&apos;s best-fit sport.
              </p>
            </div>
            <Link href={discoverHref}>
              <Button size="sm" icon={<Compass size={16} />}>
                Find a sport
              </Button>
            </Link>
          </div>
        )}
      </section>

      {/* ── Assessment results ── */}
      {(dependent.sport?.sportMatches?.length ?? 0) > 0 && (
        <section aria-labelledby="assessment-results" className="border-hairline border-t pt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                id="assessment-results"
                className="font-editorial text-ink text-2xl font-light tracking-tight sm:text-3xl"
              >
                Assessment results
              </h2>
              <p className="text-ink-muted mt-1 text-sm">
                {assessedOn
                  ? `Assessed on ${assessedOn}`
                  : "Sport fit results from the assessment."}
              </p>
            </div>
            <Link href={discoverHref}>
              <Button variant="outline" size="sm">
                Retake assessment
              </Button>
            </Link>
          </div>
          <ol className="divide-hairline border-hairline mt-8 divide-y border-y">
            {dependent.sport!.sportMatches!.map((m, i) => (
              <li key={m.sport} className="flex items-center gap-4 py-4">
                <span className="text-ink-muted w-5 text-sm tabular-nums">{i + 1}</span>
                <span className="text-ink flex-1 font-medium">{m.sport}</span>
                <span className="text-ink-body text-sm">{m.fitLabel}</span>
                <span className="text-ink-muted w-8 text-right text-sm tabular-nums">
                  {m.score}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Profile details ── */}
      <section aria-labelledby="profile-details" className="border-hairline border-t pt-10">
        <ProfileSectionHeader
          headingId="profile-details"
          variant="flat"
          icon={Info}
          title="Profile details"
          description="Physical, personality and practical traits from the assessment."
          completionPercent={completion.percent}
          onEdit={() => setShowEditModal(true)}
        />
        <div className="mt-8">
          {hasTraitChips ? (
            <dl className="space-y-6">
              <ChipRow label="Physical profile" chips={physicalChips} />
              <ChipRow label="Personality and play style" chips={personalityChips} />
              <ChipRow label="Comfort and environment" chips={comfortChips} />
              <ChipRow label="Practical" chips={practicalChips} />
            </dl>
          ) : (
            <div className="border-hairline max-w-lg rounded-xl border border-dashed px-5 py-6">
              <p className="text-ink font-medium">No profile details yet</p>
              <p className="text-ink-muted mt-1 text-pretty text-sm">
                Fill in physical, personality and practical details to get a fuller picture.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowEditModal(true)}
              >
                Edit profile
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── Federation ranking ── Renders nothing unless this child plays a sport
          whose ranking list we mirror, or already has a link. */}
      {dependent._id && (
        <RankingLinkCard
          dependentId={dependent._id}
          dependentName={dependent.name}
          sports={[dependent.sport?.chosenSport, ...(dependent.sport?.sportsFocus ?? [])]}
        />
      )}

      {/* Renders itself only once a ranking is linked — see the component. */}
      {dependent._id && <PlannerSection dependentId={dependent._id} />}

      {/* ── Account actions ── */}
      {isParent && (
        <section aria-labelledby="account-actions" className="border-hairline border-t pt-10">
          <h2
            id="account-actions"
            className="font-editorial text-ink text-2xl font-light tracking-tight sm:text-3xl"
          >
            Account
          </h2>
          <ul className="divide-hairline border-hairline mt-8 divide-y border-y">
            <li className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-ink font-medium">Graduate to independent account</h3>
                <p className="text-ink-muted mt-1 max-w-xl text-pretty text-sm">
                  {isEligibleToGraduate
                    ? `${dependent.name} can sign in and book independently.`
                    : `Eligible once ${dependent.name} turns 18 (currently ${age ?? "?"} yrs).`}
                </p>
              </div>
              <Button
                onClick={() => setShowGraduationModal(true)}
                disabled={!isEligibleToGraduate}
                variant={isEligibleToGraduate ? "primary" : "outline"}
                icon={<GraduationCap size={16} />}
                className="w-full sm:w-auto"
              >
                Graduate
              </Button>
            </li>
            <li className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-ink font-medium">Delete this profile</h3>
                <p className="text-ink-muted mt-1 max-w-xl text-pretty text-sm">
                  Permanently removes {dependent.name}&apos;s profile, assessment results, and
                  booking history. This cannot be undone.
                </p>
              </div>
              <Button
                onClick={() => setShowDeleteModal(true)}
                variant="ghost"
                size="sm"
                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                icon={<Trash2 size={14} />}
              >
                Delete
              </Button>
            </li>
          </ul>
        </section>
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
        <p className="text-ink-body text-sm">
          Are you sure you want to delete
          <span className="text-ink font-semibold"> {dependent.name}</span>? This action cannot be
          undone.
        </p>
      </Modal>

      <Modal
        isOpen={showGraduationModal}
        onClose={closeGraduationModal}
        title="Graduate to independent account"
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
