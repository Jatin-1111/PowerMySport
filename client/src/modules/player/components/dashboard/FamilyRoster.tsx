"use client";

import { DashboardSection } from "@/modules/player/components/dashboard/DashboardSection";
import { DependentSummaryCard } from "@/modules/player/components/dashboard/DependentSummaryCard";
import QuickAddDependentModal from "@/modules/player/components/QuickAddDependentModal";
import { useAddDependent } from "@/modules/player/hooks/useAddDependent";
import { useDependents } from "@/modules/player/hooks/useDependents";
import { Button } from "@/modules/shared/ui/Button";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { toast } from "@/lib/toast";
import type { Dependent } from "@/types";
import { Plus, Users } from "lucide-react";
import { useState } from "react";

/**
 * The children a parent is here to look after.
 *
 * This is the section the redesign exists for, so it takes the slot the booking
 * calendar used to hold. The zero-children case is the one branch inside here
 * rather than a page-level condition: a parent who hasn't added a child yet is
 * still a parent, and the useful thing to show them is how to start, not a
 * different dashboard.
 */
export function FamilyRoster() {
  const { dependents, incompleteCount, isLoading, isError } = useDependents();
  const [isAddOpen, setAddOpen] = useState(false);
  const addDependent = useAddDependent();

  const handleAdd = async (data: Dependent) => {
    await addDependent.mutateAsync(data);
    toast.success("Child added");
    setAddOpen(false);
  };

  const description =
    dependents.length === 0
      ? "Add a child to get sport recommendations tailored to them."
      : incompleteCount > 0
        ? `${incompleteCount} of ${dependents.length} ${incompleteCount === 1 ? "profile needs" : "profiles need"} finishing.`
        : "Every profile is complete.";

  return (
    <>
      <DashboardSection
        icon={Users}
        title="My family"
        description={description}
        isLoading={isLoading && dependents.length === 0}
        isError={isError}
        skeletonHeight="h-40"
        action={
          dependents.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(true)}
              icon={<Plus size={14} />}
            >
              Add child
            </Button>
          ) : undefined
        }
      >
        {dependents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No children added yet"
            description="Add your child to track their sport journey, get matched to the right sport, and see what to do next."
            actionLabel="Add your first child"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {dependents.map((summary) => (
              <DependentSummaryCard key={summary.id} summary={summary} />
            ))}
          </div>
        )}
      </DashboardSection>

      <QuickAddDependentModal
        isOpen={isAddOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
        isLoading={addDependent.isPending}
      />
    </>
  );
}
