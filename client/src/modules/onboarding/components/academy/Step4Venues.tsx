"use client";

import { toast } from "@/lib/toast";
import { AcademyVenueForm } from "@/modules/onboarding/components/academy/AcademyVenueForm";
import type { AcademyVenueInput, AcademyVenuesPayload } from "@/modules/onboarding/types/academy";
import {
  createEmptyVenue,
  validateVenue,
  venuesForSave,
} from "@/modules/onboarding/utils/academyVenueRules";
import { Button } from "@/modules/shared/ui/Button";
import { useState } from "react";

interface Step4VenuesProps {
  academyId: string;
  onSubmit: (data: AcademyVenuesPayload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  /** Venues already saved, so Back and resume do not lose them. */
  previousData?: AcademyVenuesPayload;
}

/**
 * Step 4 of academy sign-up: the facilities the academy teaches at. At least one
 * is required, with its photos. Everything is checked here first, with the same
 * rules the server applies, so the owner sees what to fix before saving.
 */
export default function Step4Venues({
  academyId,
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step4VenuesProps) {
  // A stable key per venue, so removing one does not shuffle the others' form state.
  const [rows, setRows] = useState<{ key: number; venue: AcademyVenueInput }[]>(() =>
    (previousData?.academyVenues?.length ? previousData.academyVenues : [createEmptyVenue()]).map(
      (venue, i) => ({ key: i, venue })
    )
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const busy = isSubmitting || loading;

  const updateVenue = (key: number, updater: (venue: AcademyVenueInput) => AcademyVenueInput) =>
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, venue: updater(row.venue) } : row))
    );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const invalid = rows.findIndex((row) => Object.keys(validateVenue(row.venue)).length > 0);
    if (invalid >= 0) {
      setShowErrors(true);
      toast.error(
        rows.length > 1
          ? `Please fix the details for venue ${invalid + 1}`
          : "Please fix the venue details"
      );
      document.getElementById(`venue-${invalid}-name`)?.scrollIntoView?.({ block: "center" });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ academyVenues: venuesForSave(rows.map((row) => row.venue)) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save venues");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 md:p-8">
      <div className="mb-2 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">Step 4: Venues</h2>
        <p className="text-slate-600">
          Add the places your academy teaches at. You need at least one, with photos.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {rows.map((row, index) => (
          <AcademyVenueForm
            key={row.key}
            academyId={academyId}
            index={index}
            venue={row.venue}
            errors={validateVenue(row.venue)}
            showErrors={showErrors}
            disabled={busy}
            onChange={(updater) => updateVenue(row.key, updater)}
            {...(rows.length > 1
              ? { onRemove: () => setRows((prev) => prev.filter((r) => r.key !== row.key)) }
              : {})}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setRows((prev) => [...prev, { key: nextKey, venue: createEmptyVenue() }]);
            setNextKey((k) => k + 1);
          }}
        >
          Add another venue
        </Button>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" loading={isSubmitting} disabled={busy}>
            Save and continue
          </Button>
        </div>
      </form>
    </div>
  );
}
