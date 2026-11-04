"use client";

import { toast } from "@/lib/toast";
import type { AcademyCoachInput, AcademyCoachesPayload } from "@/modules/onboarding/types/academy";
import {
  MAX_ACADEMY_COACHES,
  coachesForSave,
  coachesFromSaved,
  createEmptyCoach,
  isBlankCoach,
  validateCoaches,
} from "@/modules/onboarding/utils/academyCoachRules";
import { Button } from "@/modules/shared/ui/Button";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { SUPPORTED_SPORT_NAMES } from "@/modules/sports/config/supportedSports";
import { useState } from "react";

interface Step5CoachesProps {
  onSubmit: (data: AcademyCoachesPayload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  /** Coaches already saved, so Back and resume do not lose them. */
  previousData?: AcademyCoachesPayload;
}

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:bg-slate-100";
const label = "mb-1 block text-xs font-semibold text-slate-700";

/**
 * Step 5 of academy sign-up: the coaches who work at the academy. Optional.
 * Only a name, an email and the sports are asked for. These are people who have
 * not agreed to be listed, so nothing more about them is collected.
 */
export default function Step5Coaches({
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step5CoachesProps) {
  const [rows, setRows] = useState<{ key: number; coach: AcademyCoachInput }[]>(() =>
    coachesFromSaved(previousData?.academyCoaches).map((coach, i) => ({ key: i, coach }))
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const busy = isSubmitting || loading;

  // Rows left completely empty are ignored: the step is optional.
  const filled = rows.filter((row) => !isBlankCoach(row.coach));
  const errorsByKey = new Map<number, ReturnType<typeof validateCoaches>[number]>();
  const validation = validateCoaches(filled.map((row) => row.coach));
  filled.forEach((row, i) => {
    if (validation[i]) errorsByKey.set(row.key, validation[i]!);
  });

  const update = (key: number, patch: Partial<AcademyCoachInput>) =>
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, coach: { ...row.coach, ...patch } } : row))
    );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (errorsByKey.size > 0) {
      setShowErrors(true);
      toast.error("Please fix the coach details before continuing");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ academyCoaches: coachesForSave(rows.map((row) => row.coach)) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save coaches");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 md:p-8">
      <div className="mb-2 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">Step 5: Coaches</h2>
        <p className="text-slate-600">
          Optional. Add the coaches who work at your academy, or skip and add them later.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            We keep only a name, an email and the sports. These coaches are not shown on your
            academy page and are not contacted.
          </p>
        </div>

        {rows.map((row, index) => {
          const errors = showErrors ? errorsByKey.get(row.key) : undefined;
          const id = (name: string) => `coach-${row.key}-${name}`;
          return (
            <fieldset key={row.key} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold text-slate-900">Coach {index + 1}</legend>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  className="text-sm text-red-600 underline underline-offset-2 disabled:opacity-50"
                >
                  Remove coach
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={id("first")} className={label}>
                    First name
                  </label>
                  <input
                    id={id("first")}
                    className={field}
                    value={row.coach.firstName}
                    disabled={busy}
                    onChange={(e) => update(row.key, { firstName: e.target.value })}
                  />
                  {errors?.firstName && (
                    <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor={id("last")} className={label}>
                    Last name
                  </label>
                  <input
                    id={id("last")}
                    className={field}
                    value={row.coach.lastName}
                    disabled={busy}
                    onChange={(e) => update(row.key, { lastName: e.target.value })}
                  />
                  {errors?.lastName && (
                    <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor={id("email")} className={label}>
                  Email
                </label>
                <input
                  id={id("email")}
                  type="email"
                  className={field}
                  value={row.coach.email}
                  disabled={busy}
                  onChange={(e) => update(row.key, { email: e.target.value })}
                />
                {errors?.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              <div>
                <span className={label}>Sports</span>
                <SportsMultiSelect
                  value={row.coach.sports}
                  allowedSports={[...SUPPORTED_SPORT_NAMES]}
                  disabled={busy}
                  onChange={(sports) => update(row.key, { sports })}
                />
                {errors?.sports && <p className="mt-1 text-xs text-red-600">{errors.sports}</p>}
              </div>
            </fieldset>
          );
        })}

        <Button
          type="button"
          variant="outline"
          disabled={busy || rows.length >= MAX_ACADEMY_COACHES}
          onClick={() => {
            setRows((prev) => [...prev, { key: nextKey, coach: createEmptyCoach() }]);
            setNextKey((k) => k + 1);
          }}
        >
          {rows.length === 0 ? "Add a coach" : "Add another coach"}
        </Button>
        {rows.length >= MAX_ACADEMY_COACHES && (
          <p className="text-xs text-slate-500">You can add up to {MAX_ACADEMY_COACHES} coaches.</p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" loading={isSubmitting} disabled={busy}>
            {filled.length === 0 ? "Skip for now" : "Save and continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
