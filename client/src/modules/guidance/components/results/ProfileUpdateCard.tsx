import { toast } from "@/lib/toast";
import { useSaveChild } from "@/modules/player/hooks/useSaveChild";
import type { ProfileSuggestion } from "@/modules/guidance/utils/profileSuggestions";
import { useState } from "react";

/**
 * Offered under a guidance plan when the answers differ from the child's profile.
 * Nothing is saved unless the parent chooses to.
 */
export function ProfileUpdateCard({
  childId,
  childName,
  suggestions,
}: {
  childId: string;
  childName: string;
  suggestions: ProfileSuggestion[];
}) {
  const { updateChild } = useSaveChild();
  const [state, setState] = useState<"asking" | "saving" | "saved" | "dismissed">("asking");

  if (suggestions.length === 0 || state === "dismissed") return null;

  const save = async () => {
    setState("saving");
    try {
      const changes = Object.fromEntries(suggestions.map((s) => [s.field, s.value]));
      await updateChild(childId, changes);
      setState("saved");
      toast.success(`${childName}'s profile is updated.`);
    } catch {
      setState("asking");
      toast.error("Could not update the profile. Try again from their profile page.");
    }
  };

  if (state === "saved") {
    return (
      <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {childName}&apos;s profile now matches these answers.
      </p>
    );
  }

  return (
    <section
      aria-label={`Update ${childName}'s profile`}
      className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
    >
      <h3 className="text-sm font-bold text-slate-900">
        Update {childName}&apos;s profile with these answers?
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Your answers differ from what we have saved. Your plan is already made; this only changes
        the profile.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
        {suggestions.map((s) => (
          <li key={s.field}>
            <span className="font-medium">{s.label}:</span>{" "}
            {s.current ? <span className="text-slate-500">{s.current} to </span> : null}
            <span className="font-medium">{s.next}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="bg-power-orange-solid rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {state === "saving" ? "Saving…" : "Update profile"}
        </button>
        <button
          type="button"
          onClick={() => setState("dismissed")}
          disabled={state === "saving"}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
