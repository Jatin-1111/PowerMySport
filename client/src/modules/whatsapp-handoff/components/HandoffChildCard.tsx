import { Input } from "@/modules/shared/ui/Input";
import type { HandoffChild } from "../services/handoffApi";
import {
  AMBITION_OPTIONS,
  EXPERIENCE_OPTIONS,
  GENDER_OPTIONS,
  dobBounds,
  type ChildDraft,
} from "../utils/review";
import { OptionRow } from "./OptionRow";

interface HandoffChildCardProps {
  child: HandoffChild;
  draft: ChildDraft;
  error?: string;
  /** Read-only: the parent is not signed in yet, so there is nothing to fill in. */
  preview?: boolean;
  onChange: (patch: Partial<ChildDraft>) => void;
}

/** One child from the chat: what we kept, and what is needed to make the profile. */
export function HandoffChildCard({
  child,
  draft,
  error,
  preview,
  onChange,
}: HandoffChildCardProps) {
  const { min, max } = dobBounds();
  const facts = [
    child.ageText ? `Age ${child.ageText}` : null,
    child.sports.length ? child.sports.join(", ") : null,
    child.level ? `Level: ${child.level}` : null,
    child.goal ? `Goal: ${child.goal}` : null,
    child.state ?? null,
  ].filter(Boolean);
  const dobId = `handoff-dob-${child.key}`;

  return (
    <section className="border-ink/15 space-y-4 rounded-lg border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-ink text-lg font-semibold">{child.firstName}</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {facts.length ? facts.join(" · ") : "No details yet"}
          </p>
        </div>
        {!preview && (
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={draft.include}
              onChange={(e) => onChange({ include: e.target.checked })}
              className="accent-ink h-4 w-4"
            />
            Add {child.firstName}
          </label>
        )}
      </div>

      {!preview && draft.include && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={dobId} className="block text-sm font-medium text-slate-700">
              Date of birth
              <span className="ml-2 text-xs font-normal text-slate-500">
                We only asked for an age on WhatsApp.
              </span>
            </label>
            <Input
              id={dobId}
              type="date"
              min={min}
              max={max}
              value={draft.dob}
              onChange={(e) => onChange({ dob: e.target.value })}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${dobId}-error` : undefined}
            />
            {error && (
              <p id={`${dobId}-error`} className="text-xs text-red-600">
                {error}
              </p>
            )}
          </div>

          <OptionRow
            label="Boy or girl"
            hint="Optional"
            options={GENDER_OPTIONS}
            value={draft.gender}
            onChange={(gender) => onChange({ gender })}
          />
          <OptionRow
            label="What do you want from the sport"
            hint={
              child.suggestedAmbition
                ? "Suggested from what you told us. Change it if needed."
                : "Optional"
            }
            options={AMBITION_OPTIONS}
            value={draft.ambition}
            onChange={(ambition) => onChange({ ambition })}
          />
          <OptionRow
            label="Experience"
            hint={
              child.suggestedExperience
                ? "Suggested from what you told us. Change it if needed."
                : "Optional"
            }
            options={EXPERIENCE_OPTIONS}
            value={draft.experience}
            onChange={(experience) => onChange({ experience })}
          />
        </div>
      )}
    </section>
  );
}
