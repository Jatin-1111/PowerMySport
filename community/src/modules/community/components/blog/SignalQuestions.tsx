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
 * not a 5-star rating — this reads as reporting on what happened, not
 * scoring a business, and it's what keeps this off the same footing as the
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
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        A few quick questions
      </p>
      <div className="mt-2.5 space-y-2.5">
        {keys.map((key) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-700">{getSignalLabel(key)}</span>
            <div className="flex shrink-0 gap-1.5">
              {SIGNAL_VALUES.map((option) => {
                const isActive = values[key] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(key, option.value)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      isActive
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
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

      <div className="mt-3 border-t border-slate-100 pt-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          When was this? (optional)
        </label>
        <input
          type="date"
          value={attendedAt}
          onChange={(event) => onAttendedAtChange(event.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="focus:border-power-orange rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
        />
      </div>
    </div>
  );
}
