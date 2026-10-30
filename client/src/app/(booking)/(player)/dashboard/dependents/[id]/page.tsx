"use client";

import { toast } from "@/lib/toast";
import { useRefreshProfile } from "@/modules/auth/hooks/useProfile";
import { useSaveChild } from "@/modules/player/hooks/useSaveChild";
import { ChildRankingAndPlanner } from "@/modules/player/components/ChildRankingAndPlanner";
import DependentManagementModal from "@/modules/player/components/DependentManagementModal";
import { DependentAtAGlance } from "@/modules/player/components/DependentAtAGlance";
import { DependentManageSection } from "@/modules/player/components/DependentManageSection";
import { DependentNextStep } from "@/modules/player/components/DependentNextStep";
import { DependentSportFit } from "@/modules/player/components/DependentSportFit";
import { DependentSummary } from "@/modules/player/components/DependentSummary";
import { DependentTraits } from "@/modules/player/components/DependentTraits";
import { MyChildSection } from "@/modules/my-child/components/MyChildSection";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { calculateDependentCompletion } from "@/modules/player/utils/dependentCompletion";
import { glanceFacts, nextStepFor, traitGroups } from "@/modules/player/utils/dependentPageModel";
import { Breadcrumbs } from "@/modules/shared/ui/Breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { Dependent, User } from "@/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const { updateChild } = useSaveChild();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSaveDependent = async (data: Dependent) => {
    if (!dependent._id) return;
    setIsSaving(true);
    try {
      const { refreshed } = await updateChild(dependent._id, data);
      toast.success("Profile updated successfully");
      const profile = await refreshed;
      if (profile) setUser(profile);
    } finally {
      setIsSaving(false);
    }
  };

  const age = getDependentAge(dependent.dob) ?? dependent.age ?? null;
  const completion = calculateDependentCompletion(dependent);
  const effectiveSport = dependent.chosenSport || dependent.sportsFocus?.[0];
  const openEdit = () => setShowEditModal(true);

  const discoverHref = `/assessment/discover?dependentId=${encodeURIComponent(dependent._id ?? "")}`;
  const assessedOn = dependent.wizardCompletedAt
    ? new Date(dependent.wizardCompletedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const matches = dependent.sportMatches ?? [];
  const nextStep = nextStepFor(dependent, !!effectiveSport, completion.missing);
  const isParent = user.role === "Parent";

  return (
    <div className="space-y-20 lg:space-y-24">
      {/* One column, with wide gaps between sections: each section is a thing to read, not a
          panel to scan past. The top group sits closer together because it is one introduction. */}
      <div className="space-y-10">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "My profile", href: "/dashboard/my-profile" },
            { label: dependent.name },
          ]}
        />

        <DependentSummary
          name={dependent.name}
          relation={dependent.relation}
          age={age}
          sport={effectiveSport}
          completionPercent={completion.percent}
          onEdit={openEdit}
        />

        {nextStep && (
          <DependentNextStep step={nextStep} discoverHref={discoverHref} onEdit={openEdit} />
        )}
      </div>

      <DependentAtAGlance facts={glanceFacts(dependent, age)} onEdit={openEdit} />

      {matches.length > 0 && (
        <DependentSportFit
          name={dependent.name}
          matches={matches}
          currentSport={effectiveSport}
          assessedOn={assessedOn}
          discoverHref={discoverHref}
        />
      )}

      {dependent._id && <MyChildSection childId={dependent._id} />}

      {/* Each renders itself only when it has something. */}
      {dependent._id && (
        <ChildRankingAndPlanner
          dependentId={dependent._id}
          dependentName={dependent.name}
          sports={[dependent.chosenSport, ...(dependent.sportsFocus ?? [])]}
        />
      )}

      <DependentTraits
        name={dependent.name}
        groups={traitGroups(dependent, age)}
        discoverHref={discoverHref}
      />

      {isParent && dependent._id && (
        <DependentManageSection
          dependentId={dependent._id}
          name={dependent.name}
          age={age}
          onGraduated={fetchProfile}
        />
      )}

      <DependentManagementModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleSaveDependent}
        initialDependent={dependent}
        isLoading={isSaving}
      />
    </div>
  );
}
