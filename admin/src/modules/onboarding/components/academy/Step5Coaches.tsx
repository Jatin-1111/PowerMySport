"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import type {
  AcademyOwnedCoachInput,
  AcademyStep5Payload,
} from "@/modules/onboarding/types/academy";

interface Step5CoachesProps {
  academyId: string;
  onSubmit: (data: AcademyStep5Payload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  previousData?: AcademyStep5Payload;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyCoach = (): AcademyOwnedCoachInput => ({
  firstName: "",
  lastName: "",
  email: "",
  sports: [],
});

const isBlank = (coach: AcademyOwnedCoachInput) =>
  !coach.firstName.trim() &&
  !coach.lastName.trim() &&
  !coach.email.trim() &&
  coach.sports.length === 0;

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none";

/**
 * The coaches an academy says work there. Optional. Only a name, an email and
 * the sports are collected: these are people who have not agreed to be listed,
 * so no phone number, bio, rate or location is asked for or stored.
 */
export default function Step5Coaches({
  academyId,
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step5CoachesProps) {
  const [coaches, setCoaches] = useState<AcademyOwnedCoachInput[]>(
    previousData?.academyCoaches?.length
      ? previousData.academyCoaches.map(({ firstName, lastName, email, sports }) => ({
          firstName,
          lastName,
          email,
          sports,
        }))
      : []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (index: number, patch: Partial<AcademyOwnedCoachInput>) =>
    setCoaches((prev) => prev.map((coach, i) => (i === index ? { ...coach, ...patch } : coach)));

  const validate = (rows: AcademyOwnedCoachInput[]): boolean => {
    const next: Record<string, string> = {};
    rows.forEach((coach, i) => {
      if (coach.firstName.trim().length < 2) next[`${i}_first`] = "Enter a first name";
      if (coach.lastName.trim().length < 2) next[`${i}_last`] = "Enter a last name";
      if (!EMAIL.test(coach.email.trim())) next[`${i}_email`] = "Enter a valid email";
      if (coach.sports.length === 0) next[`${i}_sports`] = "Select at least one sport";
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Rows left completely empty are dropped; the step is optional.
    const rows = coaches.filter((coach) => !isBlank(coach));
    if (!validate(rows)) {
      toast.error("Please fix the coach details before continuing");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ academyId, academyCoaches: rows });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save coaches");
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || loading;

  return (
    <div className="shadow-xs space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 md:p-8">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-semibold text-slate-900">Step 5: Coaches</h2>
        <p className="text-slate-600">
          Optional. Add the coaches who work at this academy, or skip and add them later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm text-blue-900">
            We keep only a name, an email and the sports. These coaches are not shown on the academy
            page and are not contacted.
          </p>
        </div>

        {coaches.map((coach, index) => (
          <fieldset
            key={`academy-coach-${index}`}
            className="space-y-3 rounded-lg border border-slate-200 p-4"
          >
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold text-slate-900">Coach {index + 1}</legend>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setCoaches((prev) => prev.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`coach-first-${index}`}
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  First name
                </label>
                <input
                  id={`coach-first-${index}`}
                  className={inputClass}
                  value={coach.firstName}
                  onChange={(e) => update(index, { firstName: e.target.value })}
                />
                {errors[`${index}_first`] && (
                  <p className="mt-1 text-xs text-red-600">{errors[`${index}_first`]}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor={`coach-last-${index}`}
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Last name
                </label>
                <input
                  id={`coach-last-${index}`}
                  className={inputClass}
                  value={coach.lastName}
                  onChange={(e) => update(index, { lastName: e.target.value })}
                />
                {errors[`${index}_last`] && (
                  <p className="mt-1 text-xs text-red-600">{errors[`${index}_last`]}</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor={`coach-email-${index}`}
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Email
              </label>
              <input
                id={`coach-email-${index}`}
                type="email"
                className={inputClass}
                value={coach.email}
                onChange={(e) => update(index, { email: e.target.value })}
              />
              {errors[`${index}_email`] && (
                <p className="mt-1 text-xs text-red-600">{errors[`${index}_email`]}</p>
              )}
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Sports</span>
              <SportsMultiSelect
                value={coach.sports}
                onChange={(sports) => update(index, { sports })}
              />
              {errors[`${index}_sports`] && (
                <p className="mt-1 text-xs text-red-600">{errors[`${index}_sports`]}</p>
              )}
            </div>
          </fieldset>
        ))}

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setCoaches((prev) => [...prev, emptyCoach()])}
        >
          {coaches.length === 0 ? "Add a coach" : "Add another coach"}
        </Button>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : coaches.length === 0 ? "Skip for now" : "Save and continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
