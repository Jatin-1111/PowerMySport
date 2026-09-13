"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  adminApi,
  type AdminContributorMatch,
  type AdminPathwayContributor,
  type PathwayContributorType,
} from "../../services/admin";
import { Field, TextArea, TextInput } from "./fields";

// ─── The byline editor ───────────────────────────────────────────────────────
//
// Two halves that do different jobs, and the form says so rather than leaving an
// author to guess:
//
//   · The written credit (name, organisation, site, one line of credentials) is
//     stored on the guide and is what a reader always sees.
//   · The platform link is optional, and only adds the photo and booking button.
//
// The link is chosen by SEARCHING FOR A PERSON, never by pasting an id. An admin
// does not know a Mongo id, and a form that asks for one gets a wrong one.
//
// Picking someone fills the name field when it is still empty, because the
// overwhelmingly common case is that the byline IS the person being linked —
// but it never overwrites a name already typed, since a contributor may well
// write under an academy's name rather than their own.

const TYPES: Array<{ value: PathwayContributorType; label: string }> = [
  { value: "coach", label: "Coach" },
  { value: "expert", label: "Expert" },
];

export function ContributorPicker({
  value,
  onChange,
}: {
  value: AdminPathwayContributor;
  onChange: (next: AdminPathwayContributor) => void;
}) {
  const [type, setType] = useState<PathwayContributorType>(value.profile?.type ?? "coach");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<AdminContributorMatch[]>([]);
  const [searching, setSearching] = useState(false);

  const set = (patch: Partial<AdminPathwayContributor>) => onChange({ ...value, ...patch });

  // Debounced, and short queries never leave the browser — the endpoint ignores
  // anything under two characters, so sending them is a round trip for nothing.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setMatches([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void adminApi
        .searchPathwayContributors(type, term)
        .then((res) => setMatches(res.data ?? []))
        .catch(() => setMatches([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type]);

  const attach = (match: AdminContributorMatch) => {
    onChange({
      ...value,
      ...(value.name.trim() ? {} : { name: match.name }),
      profile: { type: match.type, id: match.id },
    });
    setQuery("");
    setMatches([]);
  };

  const detach = () => {
    const { profile: _dropped, ...rest } = value;
    onChange(rest);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contributor name" hint="The byline. Leave blank for an in-house pathway.">
          <TextInput
            value={value.name}
            onChange={(name) => set({ name })}
            placeholder="Lalit Akhade"
          />
        </Field>
        <Field label="Organisation">
          <TextInput
            value={value.organisation ?? ""}
            onChange={(organisation) => set({ organisation })}
            placeholder="ChessMates Academy"
          />
        </Field>
      </div>

      <Field label="Website" hint="Their own site. Must start with http:// or https://.">
        <TextInput
          value={value.url ?? ""}
          onChange={(url) => set({ url })}
          placeholder="https://chessmates.in"
        />
      </Field>

      <Field label="Credentials" hint="One line, shown under the name.">
        <TextArea value={value.blurb ?? ""} rows={2} onChange={(blurb) => set({ blurb })} />
      </Field>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Platform profile</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Optional. Adds their photo and a booking button, and drops both automatically if they stop
          being bookable. Only verified, active people can be found here.
        </p>

        {value.profile ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="text-sm text-slate-700">
              Linked to a <strong>{value.profile.type}</strong> profile
            </span>
            <button
              type="button"
              onClick={detach}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <X className="h-3.5 w-3.5" />
              Unlink
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PathwayContributorType)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
              >
                {TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-300" />
                )}
              </div>
            </div>

            {matches.length > 0 && (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {matches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      onClick={() => attach(match)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm font-medium text-slate-800">{match.name}</span>
                      <span className="text-xs text-slate-400">
                        {match.sports.join(", ") || match.type}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!searching && query.trim().length >= 2 && matches.length === 0 && (
              <p className="text-xs text-slate-400">
                No verified {type} matches that name. Check they have finished verification.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
