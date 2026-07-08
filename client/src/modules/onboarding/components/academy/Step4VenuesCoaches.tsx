"use client";

import { toast } from "@/lib/toast";
import type { AcademyStep4Payload } from "@/modules/onboarding/types/academy";
import { Button } from "@/modules/shared/ui/Button";
import { useState } from "react";

interface Step4VenuesCoachesProps {
  academyId: string;
  onSubmit: (data: AcademyStep4Payload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  previousData?: AcademyStep4Payload;
}

export default function Step4VenuesCoaches({
  academyId,
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step4VenuesCoachesProps) {
  const [formData, setFormData] = useState({
    allowsExternalCoaches: previousData?.allowsExternalCoaches ?? true,
    venueIds: previousData?.venueIds || ([] as string[]),
    coachIds: previousData?.coachIds || ([] as string[]),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        ...formData,
        academyId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Step 4: Venues & Coaches
        </h2>
        <p className="text-slate-600">
          Link your venues and coaches (optional for now)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
          <p className="text-sm text-blue-900">
            You can skip this step for now and add venues and coaches later from
            your dashboard.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.allowsExternalCoaches}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  allowsExternalCoaches: e.target.checked,
                }))
              }
              className="w-4 h-4 rounded"
              disabled={isSubmitting}
            />
            <span className="text-sm font-medium text-slate-900">
              Allow external coaches to book your venues
            </span>
          </label>
          <p className="text-xs text-slate-600 mt-2 ml-7">
            If enabled, coaches can rent your venues for their sessions
          </p>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-2">
            Venues ({formData.venueIds.length})
          </h3>
          <p className="text-sm text-slate-600">
            You haven&apos;t linked any venues yet. Add them from your dashboard
            later.
          </p>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-2">
            Coaches ({formData.coachIds.length})
          </h3>
          <p className="text-sm text-slate-600">
            You haven&apos;t linked any coaches yet. Add them from your
            dashboard later.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          {onBack && (
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || loading}
            className="flex-1"
          >
            {isSubmitting ? "Saving..." : "Continue to Step 5"}
          </Button>
        </div>
      </form>
    </div>
  );
}
