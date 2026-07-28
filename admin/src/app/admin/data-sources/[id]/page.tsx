"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi, AdminDataSourceSubmission } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

// ─── Human-readable Live vs. Proposed comparison (replaces a raw JSON dump) ───

// Bookkeeping/identity fields — noise for a content review, not part of "what changed".
const HIDDEN_DIFF_KEYS = new Set([
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "slug",
  "sportSlug",
  "isActive",
  "isCurated",
  "isVerified",
  "dataVerifiedAt",
  "lastScrapedAt",
]);

function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function formatScalar(value: unknown): string {
  if (isEmptyValue(value)) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

function DiffValue({ value }: { value: unknown }) {
  if (isEmptyValue(value)) return <span className="text-slate-400">—</span>;

  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <ul className="space-y-1">
        {value.map((item, i) => (
          <li key={i} className="rounded-lg bg-slate-50 px-2 py-1 text-sm text-slate-700">
            {item && typeof item === "object" ? (
              <DiffValue value={item} />
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => !isEmptyValue(v));
    if (entries.length === 0) return <span className="text-slate-400">—</span>;
    return (
      <div className="space-y-1 text-sm text-slate-700">
        {entries.map(([k, v]) => (
          <div key={k}>
            <span className="font-semibold">{humanizeKey(k)}:</span>{" "}
            {typeof v === "object" && v !== null ? <DiffValue value={v} /> : formatScalar(v)}
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-sm text-slate-700">{formatScalar(value)}</span>;
}

function FieldDiff({ live, proposed }: { live: unknown; proposed: unknown }) {
  const liveObj = live && typeof live === "object" && !Array.isArray(live) ? (live as Record<string, unknown>) : null;
  const proposedObj =
    proposed && typeof proposed === "object" && !Array.isArray(proposed) ? (proposed as Record<string, unknown>) : null;

  if (!liveObj && !proposedObj) {
    return <p className="text-sm text-slate-500">Nothing to compare yet.</p>;
  }

  const keys = Array.from(
    new Set([...(liveObj ? Object.keys(liveObj) : []), ...(proposedObj ? Object.keys(proposedObj) : [])]),
  ).filter((k) => !HIDDEN_DIFF_KEYS.has(k));

  return (
    <div className="divide-y divide-slate-100">
      <div className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-[160px_1fr_1fr]">
        <span />
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Currently Live</p>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Proposed</p>
      </div>
      {keys.map((key) => {
        const liveVal = liveObj?.[key];
        const proposedVal = proposedObj?.[key];
        const changed = !valuesEqual(liveVal, proposedVal);
        return (
          <div
            key={key}
            className={`grid grid-cols-1 gap-3 rounded-lg px-2 py-3 sm:grid-cols-[160px_1fr_1fr] ${changed ? "bg-amber-50" : ""}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{humanizeKey(key)}</p>
            <DiffValue value={liveVal} />
            <div className={changed ? "font-medium" : ""}>
              <DiffValue value={proposedVal} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatEditionDate(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function CalendarComparison({ live, proposed }: { live: unknown; proposed: unknown }) {
  const liveList = Array.isArray(live) ? (live as Array<Record<string, unknown>>) : [];
  const proposedList = Array.isArray(proposed) ? (proposed as Array<Record<string, unknown>>) : [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Currently in Calendar ({liveList.length})
        </p>
        <ul className="space-y-1.5">
          {liveList.length === 0 ? (
            <li className="text-sm text-slate-400">No editions yet.</li>
          ) : (
            liveList.map((e, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-medium">{String(e.name || "Untitled")}</span> — {formatEditionDate(e.startDate)}
              </li>
            ))
          )}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Proposed ({proposedList.length})</p>
        <ul className="space-y-1.5">
          {proposedList.length === 0 ? (
            <li className="text-sm text-slate-400">No editions proposed.</li>
          ) : (
            proposedList.map((e, i) => (
              <li key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-medium">{String(e.name || "Untitled")}</span> — {formatEditionDate(e.startDate)}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50/60 p-3" open>
      <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-600">
        {title}
      </summary>
      <div className="mt-3 space-y-4">{children}</div>
    </details>
  );
}

function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[idx] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
      >
        <Plus size={14} /> Add item
      </button>
    </div>
  );
}

// ─── Draft shapes (loosely typed extractedData, per targetType) ──────────────

interface EligibilityCategoryDraft {
  name: string;
  maxAge: number;
  genders: string[];
  minRanking?: string;
  notes?: string;
}
interface EligibilityCriteriaDraft {
  ageCutoffRule?: string;
  categories: EligibilityCategoryDraft[];
  registrationRequired: boolean;
  stateAssociationFirst: boolean;
  notes?: string;
}
interface StateAssociationDraft {
  name: string;
  state: string;
  website?: string;
}
interface FederationDraft {
  name: string;
  acronym: string;
  type: "govt" | "national" | "hybrid";
  about: string;
  founded?: number;
  headquarters?: string;
  website?: string;
  officialCalendarUrl?: string;
  affiliations: string[];
  stateAssociations: StateAssociationDraft[];
  keyFacts: string[];
  eligibilityCriteria?: EligibilityCriteriaDraft;
  registrationSteps: string[];
  requiredDocuments: string[];
  contact?: { email?: string; phone?: string; address?: string };
}
interface CuratedTournamentDraft {
  name: string;
  level: string;
  description: string;
  ageGroup: string;
  typicalDates?: string;
  registrationDeadline?: string;
  participationGuide: string[];
  qualificationPath?: string;
  circuitContext?: string;
  format?: string;
  prestige?: "flagship" | "ranking" | "developmental";
  prizePool?: string;
  registrationUrl?: string;
}
interface EditionDraft {
  name: string;
  startDate: string;
  endDate?: string;
  registrationDeadlineDate?: string;
  venue?: string;
  city?: string;
  level?: string;
  ageGroups: string[];
  sourceQuote?: string;
}

function FederationEditor({
  data,
  onChange,
}: {
  data: FederationDraft;
  onChange: (data: FederationDraft) => void;
}) {
  const patch = (partial: Partial<FederationDraft>) => onChange({ ...data, ...partial });
  const eligibility: EligibilityCriteriaDraft =
    data.eligibilityCriteria || { categories: [], registrationRequired: true, stateAssociationFirst: true };
  const contact = data.contact || {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Name</label>
          <input value={data.name} onChange={(e) => patch({ name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Acronym</label>
          <input value={data.acronym} onChange={(e) => patch({ acronym: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select
            value={data.type}
            onChange={(e) => patch({ type: e.target.value as FederationDraft["type"] })}
            className={inputCls}
          >
            <option value="national">National</option>
            <option value="govt">Government</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Founded (year)</label>
          <input
            type="number"
            value={data.founded ?? ""}
            onChange={(e) => patch({ founded: e.target.value ? Number(e.target.value) : undefined })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Headquarters</label>
          <input
            value={data.headquarters || ""}
            onChange={(e) => patch({ headquarters: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input value={data.website || ""} onChange={(e) => patch({ website: e.target.value })} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Official Calendar URL</label>
          <input
            value={data.officialCalendarUrl || ""}
            onChange={(e) => patch({ officialCalendarUrl: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>About</label>
        <textarea rows={3} value={data.about} onChange={(e) => patch({ about: e.target.value })} className={inputCls} />
      </div>

      <Section title="Affiliations">
        <StringListEditor
          items={data.affiliations}
          onChange={(affiliations) => patch({ affiliations })}
          placeholder="e.g. Badminton World Federation (BWF)"
        />
      </Section>

      <Section title="Key Facts">
        <StringListEditor items={data.keyFacts} onChange={(keyFacts) => patch({ keyFacts })} placeholder="Verifiable fact" />
      </Section>

      <Section title="State Associations">
        <div className="space-y-3">
          {data.stateAssociations.map((sa, idx) => {
            const update = (partial: Partial<StateAssociationDraft>) => {
              const next = [...data.stateAssociations];
              next[idx] = { ...sa, ...partial };
              patch({ stateAssociations: next });
            };
            return (
              <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input value={sa.name} onChange={(e) => update({ name: e.target.value })} placeholder="Name" className={inputCls} />
                <input value={sa.state} onChange={(e) => update({ state: e.target.value })} placeholder="State" className={inputCls} />
                <input
                  value={sa.website || ""}
                  onChange={(e) => update({ website: e.target.value })}
                  placeholder="Website"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => patch({ stateAssociations: data.stateAssociations.filter((_, i) => i !== idx) })}
                  className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-300 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => patch({ stateAssociations: [...data.stateAssociations, { name: "", state: "", website: "" }] })}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400"
          >
            <Plus size={14} /> Add state association
          </button>
        </div>
      </Section>

      <Section title="Eligibility Criteria">
        <div>
          <label className={labelCls}>Age Cutoff Rule</label>
          <textarea
            rows={2}
            value={eligibility.ageCutoffRule || ""}
            onChange={(e) => patch({ eligibilityCriteria: { ...eligibility, ageCutoffRule: e.target.value } })}
            className={inputCls}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={eligibility.registrationRequired}
              onChange={(e) => patch({ eligibilityCriteria: { ...eligibility, registrationRequired: e.target.checked } })}
            />
            Registration required
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={eligibility.stateAssociationFirst}
              onChange={(e) => patch({ eligibilityCriteria: { ...eligibility, stateAssociationFirst: e.target.checked } })}
            />
            State association first
          </label>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            rows={2}
            value={eligibility.notes || ""}
            onChange={(e) => patch({ eligibilityCriteria: { ...eligibility, notes: e.target.value } })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Categories</label>
          <div className="space-y-2">
            {eligibility.categories.map((cat, idx) => {
              const update = (partial: Partial<EligibilityCategoryDraft>) => {
                const next = [...eligibility.categories];
                next[idx] = { ...cat, ...partial };
                patch({ eligibilityCriteria: { ...eligibility, categories: next } });
              };
              return (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1.5fr_0.6fr_1fr_1fr_auto]">
                  <input value={cat.name} onChange={(e) => update({ name: e.target.value })} placeholder="Category name" className={inputCls} />
                  <input
                    type="number"
                    value={cat.maxAge}
                    onChange={(e) => update({ maxAge: Number(e.target.value) })}
                    placeholder="Max age"
                    className={inputCls}
                  />
                  <input
                    value={cat.genders.join(", ")}
                    onChange={(e) => update({ genders: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    placeholder="Genders, comma-separated"
                    className={inputCls}
                  />
                  <input
                    value={cat.notes || ""}
                    onChange={(e) => update({ notes: e.target.value })}
                    placeholder="Notes"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({ eligibilityCriteria: { ...eligibility, categories: eligibility.categories.filter((_, i) => i !== idx) } })
                    }
                    className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                patch({
                  eligibilityCriteria: {
                    ...eligibility,
                    categories: [...eligibility.categories, { name: "", maxAge: 0, genders: [] }],
                  },
                })
              }
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400"
            >
              <Plus size={14} /> Add category
            </button>
          </div>
        </div>
      </Section>

      <Section title="Registration Steps">
        <StringListEditor items={data.registrationSteps} onChange={(registrationSteps) => patch({ registrationSteps })} placeholder="Ordered step" />
      </Section>

      <Section title="Required Documents">
        <StringListEditor items={data.requiredDocuments} onChange={(requiredDocuments) => patch({ requiredDocuments })} placeholder="Document" />
      </Section>

      <Section title="Contact">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={contact.email || ""}
            onChange={(e) => patch({ contact: { ...contact, email: e.target.value } })}
            placeholder="Email"
            className={inputCls}
          />
          <input
            value={contact.phone || ""}
            onChange={(e) => patch({ contact: { ...contact, phone: e.target.value } })}
            placeholder="Phone"
            className={inputCls}
          />
          <input
            value={contact.address || ""}
            onChange={(e) => patch({ contact: { ...contact, address: e.target.value } })}
            placeholder="Address"
            className={inputCls}
          />
        </div>
      </Section>
    </div>
  );
}

function CuratedTournamentEditor({
  data,
  onChange,
}: {
  data: CuratedTournamentDraft;
  onChange: (data: CuratedTournamentDraft) => void;
}) {
  const patch = (partial: Partial<CuratedTournamentDraft>) => onChange({ ...data, ...partial });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Name</label>
          <input value={data.name} onChange={(e) => patch({ name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Level</label>
          <select value={data.level} onChange={(e) => patch({ level: e.target.value })} className={inputCls}>
            <option value="District">District</option>
            <option value="State">State</option>
            <option value="National">National</option>
            <option value="International">International</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Age Group</label>
          <input value={data.ageGroup} onChange={(e) => patch({ ageGroup: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Typical Dates</label>
          <input value={data.typicalDates || ""} onChange={(e) => patch({ typicalDates: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Registration Deadline</label>
          <input
            value={data.registrationDeadline || ""}
            onChange={(e) => patch({ registrationDeadline: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Prestige</label>
          <select
            value={data.prestige || ""}
            onChange={(e) => patch({ prestige: (e.target.value || undefined) as CuratedTournamentDraft["prestige"] })}
            className={inputCls}
          >
            <option value="">—</option>
            <option value="flagship">Flagship</option>
            <option value="ranking">Ranking</option>
            <option value="developmental">Developmental</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Format</label>
          <input value={data.format || ""} onChange={(e) => patch({ format: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Prize Pool</label>
          <input value={data.prizePool || ""} onChange={(e) => patch({ prizePool: e.target.value })} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Registration URL</label>
          <input value={data.registrationUrl || ""} onChange={(e) => patch({ registrationUrl: e.target.value })} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea rows={3} value={data.description} onChange={(e) => patch({ description: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Qualification Path</label>
        <textarea rows={2} value={data.qualificationPath || ""} onChange={(e) => patch({ qualificationPath: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Circuit Context</label>
        <textarea rows={4} value={data.circuitContext || ""} onChange={(e) => patch({ circuitContext: e.target.value })} className={inputCls} />
      </div>
      <Section title="Participation Guide">
        <StringListEditor
          items={data.participationGuide}
          onChange={(participationGuide) => patch({ participationGuide })}
          placeholder="Ordered step for a player to participate"
        />
      </Section>
    </div>
  );
}

function CalendarEditor({ data, onChange }: { data: EditionDraft[]; onChange: (data: EditionDraft[]) => void }) {
  const update = (idx: number, partial: Partial<EditionDraft>) => {
    const next = [...data];
    next[idx] = { ...next[idx], ...partial };
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {data.map((edition, idx) => (
        <div key={idx} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <input
              value={edition.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder="Event name"
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={() => onChange(data.filter((_, i) => i !== idx))}
              className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-300 hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              value={edition.startDate}
              onChange={(e) => update(idx, { startDate: e.target.value })}
              placeholder="Start (YYYY-MM-DD)"
              className={inputCls}
            />
            <input
              value={edition.endDate || ""}
              onChange={(e) => update(idx, { endDate: e.target.value })}
              placeholder="End (YYYY-MM-DD)"
              className={inputCls}
            />
            <input
              value={edition.registrationDeadlineDate || ""}
              onChange={(e) => update(idx, { registrationDeadlineDate: e.target.value })}
              placeholder="Reg. deadline (YYYY-MM-DD)"
              className={inputCls}
            />
            <input
              value={edition.level || ""}
              onChange={(e) => update(idx, { level: e.target.value })}
              placeholder="Level"
              className={inputCls}
            />
            <input value={edition.venue || ""} onChange={(e) => update(idx, { venue: e.target.value })} placeholder="Venue" className={inputCls} />
            <input value={edition.city || ""} onChange={(e) => update(idx, { city: e.target.value })} placeholder="City" className={inputCls} />
            <input
              value={edition.ageGroups.join(", ")}
              onChange={(e) => update(idx, { ageGroups: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              placeholder="Age groups, comma-separated"
              className={`${inputCls} col-span-2`}
            />
          </div>
          {edition.sourceQuote && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-slate-500">
              “{edition.sourceQuote}”
            </p>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...data, { name: "", startDate: "", ageGroups: [] }])}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400"
      >
        <Plus size={14} /> Add edition
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDataSourceDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [submission, setSubmission] = useState<AdminDataSourceSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reExtracting, setReExtracting] = useState(false);
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await adminApi.getDataSource(id);
      if (response.success && response.data) {
        setSubmission(response.data);
        setDraft(response.data.extractedData ?? null);
      } else {
        setError(response.message || "Failed to load data source.");
      }
    } catch (err) {
      console.error("Failed to load data source:", err);
      setError("Failed to load data source.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    if (!submission) return;
    setSaving(true);
    try {
      const response = await adminApi.updateDataSource(submission._id, draft);
      if (response.success && response.data) {
        setSubmission(response.data);
        toast.success("Draft saved");
      } else {
        toast.error(response.message || "Failed to save");
      }
    } catch (err) {
      console.error("Failed to save data source:", err);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!submission) return;
    setApproving(true);
    try {
      // Save any pending edits first so approve validates the latest draft.
      await adminApi.updateDataSource(submission._id, draft);
      const response = await adminApi.approveDataSource(submission._id);
      if (response.success && response.data) {
        setSubmission(response.data);
        toast.success("Approved and published");
      } else {
        toast.error(response.message || "Failed to approve");
      }
    } catch (err) {
      console.error("Failed to approve data source:", err);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to approve";
      toast.error(message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!submission || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      const response = await adminApi.rejectDataSource(submission._id, rejectReason.trim());
      if (response.success && response.data) {
        setSubmission(response.data);
        toast.success("Rejected");
        setShowRejectPanel(false);
        setRejectReason("");
      } else {
        toast.error(response.message || "Failed to reject");
      }
    } catch (err) {
      console.error("Failed to reject data source:", err);
      toast.error("Failed to reject");
    } finally {
      setRejecting(false);
    }
  };

  const handleReExtract = async () => {
    if (!submission) return;
    setReExtracting(true);
    try {
      const response = await adminApi.reExtractDataSource(submission._id);
      if (response.success && response.data) {
        setSubmission(response.data);
        setDraft(response.data.extractedData ?? null);
        toast.success("Re-extraction complete");
      } else {
        toast.error(response.message || "Failed to re-extract");
      }
    } catch (err) {
      console.error("Failed to re-extract data source:", err);
      toast.error("Failed to re-extract");
    } finally {
      setReExtracting(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading data source...</div>;
  if (error || !submission) {
    return (
      <Card className="bg-white">
        <div className="py-10 text-center space-y-3">
          <p className="text-red-600 font-semibold">{error || "Data source not found."}</p>
          <Link href="/admin/data-sources" className="text-power-orange font-semibold">
            Back to Data Sources
          </Link>
        </div>
      </Card>
    );
  }

  const canApprove = submission.status === "PENDING_REVIEW";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title={`${submission.targetType.replace(/_/g, " ")} — ${submission.sportSlug}`}
        subtitle="Review the AI-extracted data against the source and the live record below, edit as needed, then approve or reject."
        action={
          <Link
            href="/admin/data-sources"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={16} /> Back to list
          </Link>
        }
      />

      <Card className="bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-slate-600">
              Status: <span className="font-semibold text-slate-900">{submission.status.replace(/_/g, " ")}</span>
            </p>
            <p className="text-sm text-slate-600">
              Source:{" "}
              {submission.sourceKind === "LINK" ? (
                <a href={submission.sourceUrl} target="_blank" rel="noreferrer" className="text-power-orange inline-flex items-center gap-1">
                  {submission.sourceUrl} <ExternalLink size={12} />
                </a>
              ) : (
                <span>{submission.fileName || "Uploaded PDF"}</span>
              )}
            </p>
            {submission.originUrl && (
              <p className="text-sm text-slate-600">
                Cited origin:{" "}
                <a href={submission.originUrl} target="_blank" rel="noreferrer" className="text-power-orange">
                  {submission.originUrl}
                </a>
              </p>
            )}
            {submission.extractionError && <p className="text-sm text-red-600">Error: {submission.extractionError}</p>}
          </div>
          <button
            onClick={handleReExtract}
            disabled={reExtracting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={reExtracting ? "animate-spin" : ""} /> Re-extract
          </button>
        </div>
      </Card>

      <Card className="bg-white space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Live Now vs. Proposed</h2>
        <p className="text-xs text-slate-500">
          Fields highlighted below differ from what's currently live. Bookkeeping fields (IDs, timestamps, status
          flags) are hidden since they're not content you need to review.
        </p>
        {submission.targetType === "TOURNAMENT_CALENDAR" ? (
          <CalendarComparison live={submission.currentLiveData} proposed={draft} />
        ) : (
          <FieldDiff live={submission.currentLiveData} proposed={draft} />
        )}
      </Card>

      {submission.citations && Object.keys(submission.citations).length > 0 && (
        <Card className="bg-white space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Source Citations</h2>
          <p className="text-xs text-slate-500">
            Where the AI says it found each field — check these against the source instead of re-reading the whole
            thing.
          </p>
          <div className="space-y-2">
            {Object.entries(submission.citations).map(([field, quote]) => (
              <div key={field} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field}</p>
                <p className="mt-1 text-sm italic text-slate-700">“{quote}”</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {draft != null && (
        <Card className="bg-white space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Edit Before Approving</h2>
          {submission.targetType === "FEDERATION" && (
            <FederationEditor data={draft as FederationDraft} onChange={setDraft} />
          )}
          {submission.targetType === "CURATED_TOURNAMENT" && (
            <CuratedTournamentEditor data={draft as CuratedTournamentDraft} onChange={setDraft} />
          )}
          {submission.targetType === "TOURNAMENT_CALENDAR" && (
            <CalendarEditor data={draft as EditionDraft[]} onChange={setDraft} />
          )}
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
          </div>
        </Card>
      )}

      <Card className="bg-white space-y-3">
        {showRejectPanel && (
          <div className="space-y-3 border-b border-slate-100 pb-4">
            <p className="text-sm font-semibold text-slate-800">Rejection reason</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this submission is being rejected"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {showRejectPanel ? (
            <>
              <button
                onClick={() => {
                  setShowRejectPanel(false);
                  setRejectReason("");
                }}
                disabled={rejecting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? "Rejecting..." : "Confirm Reject"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowRejectPanel(true)}
              disabled={rejecting || submission.status === "REJECTED"}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>
          )}
          <button
            onClick={handleApprove}
            disabled={!canApprove || approving}
            className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {approving ? "Approving..." : "Approve & Publish"}
          </button>
        </div>
      </Card>
    </div>
  );
}
