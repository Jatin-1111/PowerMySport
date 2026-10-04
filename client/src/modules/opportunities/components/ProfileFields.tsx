"use client";

import { INDIAN_STATES_AND_UTS } from "@/lib/indianStates";
import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";
import { parseTypedAge } from "@/modules/pathway/utils/childAge";
import { useId } from "react";

import { useOpportunityProfile } from "../hooks/useOpportunityProfile";

const MAX_AGE = 25;

const fieldClass =
  "focus-visible:border-power-orange-solid focus-visible:ring-power-orange-solid/30 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2";

/**
 * The four answers that let us mark which entries fit a child: age, sport,
 * gender, state. They are kept in this browser only (see useOpportunityProfile)
 * and each one is optional; an entry is checked against whatever was given.
 *
 * `sports` are the slugs worth offering. With none given, every sport we name.
 */
export function ProfileFields({ sports }: { sports: string[] }) {
  const { profile, setField } = useOpportunityProfile();
  const ids = { age: useId(), sport: useId(), gender: useId(), state: useId() };
  const sportOptions = sports.length > 0 ? sports : Object.keys(SPORT_LABEL);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label htmlFor={ids.age} className="mb-1 block text-xs font-semibold text-slate-600">
          Child&apos;s age
        </label>
        <input
          id={ids.age}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_AGE}
          placeholder="e.g. 12"
          value={profile.age ?? ""}
          onChange={(e) => {
            const age = parseTypedAge(e.target.value);
            setField("age", age === null ? null : Math.min(MAX_AGE, age));
          }}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={ids.sport} className="mb-1 block text-xs font-semibold text-slate-600">
          Sport
        </label>
        <select
          id={ids.sport}
          value={profile.sport ?? ""}
          onChange={(e) => setField("sport", e.target.value || null)}
          className={fieldClass}
        >
          <option value="">Not chosen</option>
          {sportOptions.map((slug) => (
            <option key={slug} value={slug}>
              {SPORT_LABEL[slug] ?? slug}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={ids.gender} className="mb-1 block text-xs font-semibold text-slate-600">
          Boy or girl
        </label>
        <select
          id={ids.gender}
          value={profile.gender ?? ""}
          onChange={(e) =>
            setField("gender", e.target.value === "" ? null : (e.target.value as "boy" | "girl"))
          }
          className={fieldClass}
        >
          <option value="">Not said</option>
          <option value="boy">Boy</option>
          <option value="girl">Girl</option>
        </select>
      </div>

      <div>
        <label htmlFor={ids.state} className="mb-1 block text-xs font-semibold text-slate-600">
          State
        </label>
        <select
          id={ids.state}
          value={profile.state ?? ""}
          onChange={(e) => setField("state", e.target.value || null)}
          className={fieldClass}
        >
          <option value="">Not chosen</option>
          {INDIAN_STATES_AND_UTS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
