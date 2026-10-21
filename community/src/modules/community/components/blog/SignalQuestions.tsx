"use client";

import {
  SIGNAL_KEYS_BY_SUBJECT_KIND,
  SIGNAL_VALUES,
  getSignalLabel,
  type ExperienceSubjectKind,
  type SignalKey,
  type SignalValue,
} from "@/modules/community/constants/experienceSubjects";

interface SignalQuestionsProps {
  subjectKind: ExperienceSubjectKind;
  values: Partial<Record<SignalKey, SignalValue>>;
  onChange: (key: SignalKey, value: SignalValue) => void;
  attendedAt: string;
  onAttendedAtChange: (value: string) => void;
}

/**
 * Three-point questions, only shown once a subject is picked. Deliberately
 * not a 5-star rating: this reads as reporting on what happened, not
 * scoring a business, and it is what keeps this off the same footing as the
 * star rating that already lives on the entity page (client/models/Review.ts).
 */
export default function SignalQuestions({
  subjectKind,
  values,
  onChange,
  attendedAt,
  onAttendedAtChange,
}: SignalQuestionsProps) {
  const keys = SIGNAL_KEYS_BY_SUBJECT_KIND[subjectKind] || [];
  if (!keys.length) return null;

  return (
    <section aria-labelledby="signal-title" className="bg-paper-deep rounded-2xl p-5 sm:p-6">
      <h2 id="signal-title" className="font-editorial text-ink text-2xl font-normal">
        A few quick questions
      </h2>
      <div className="divide-ink/10 mt-3 divide-y">
        {keys.map((key) => (
          <div
            key={key}
            role="group"
            aria-label={getSignalLabel(key)}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-ink text-base">{getSignalLabel(key)}</span>
            <div className="flex shrink-0 gap-2">
              {SIGNAL_VALUES.map((option) => {
                const isActive = values[key] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onChange(key, option.value)}
                    className={`btn-motion min-h-11 rounded-md border px-4 text-base font-medium ${
                      isActive
                        ? "border-ink bg-ink text-white"
                        : "text-ink-body hover:border-ink/45 border-[#d9d3c8] bg-white"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-ink/10 border-t pt-4">
        <label htmlFor="signal-attended" className="text-ink mb-2 block text-base font-semibold">
          When was this?
        </label>
        <input
          id="signal-attended"
          type="date"
          value={attendedAt}
          onChange={(event) => onAttendedAtChange(event.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="text-ink hover:border-ink/45 focus:border-ink h-12 rounded-md border border-[#d9d3c8] bg-white px-4 text-base transition-colors duration-200 focus:outline-none"
        />
      </div>
    </section>
  );
}
