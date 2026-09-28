"use client";

// ─── Admissions & scholarships (index) ──────────────────────────────────────
//
// Every entry, drafts included, with what needs attention: a draft nobody has
// verified, a live entry not checked in over a year, a window that has closed.
// Creating one makes an empty draft and opens the editor.

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { readApiErrors } from "@/modules/admin/components/opportunity/apiErrors";
import { SourceSubmitForm } from "@/modules/admin/components/opportunity/SourceSubmitForm";
import { SourceWatchPanel } from "@/modules/admin/components/opportunity/SourceWatchPanel";
import { CATEGORY_OPTIONS } from "@/modules/admin/components/opportunity/opportunityForm";
import { ErrorList, Field, TextInput } from "@/modules/admin/components/pathway/fields";
import {
  opportunityAdminApi,
  opportunitySourceApi,
  type AdminOpportunityRow,
  type OpportunitySourceRow,
  type OpportunityTrack,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const CYCLE_TEXT: Record<AdminOpportunityRow["cycleState"], string> = {
  open: "Window open",
  upcoming: "Opens soon",
  closed: "Window closed",
  rolling: "No window",
};

function Attention({ row }: { row: AdminOpportunityRow }) {
  if (!row.lastVerifiedOn) {
    return <span className="text-xs font-semibold text-amber-700">Not verified yet</span>;
  }
  if (row.stale) {
    return <span className="text-xs font-semibold text-red-700">Over a year since checked</span>;
  }
  return <span className="text-xs text-slate-500">Checked {row.lastVerifiedOn}</span>;
}

export default function AdminOpportunitiesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminOpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<OpportunityTrack>("admission");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [sources, setSources] = useState<OpportunitySourceRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    opportunityAdminApi
      .list()
      .then((res) => {
        if (!cancelled) setRows(res.data ?? []);
      })
      .catch(() => toast.error("Could not load admissions and scholarships."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sources still needing a person: waiting for review, or failed to read.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      opportunitySourceApi.list({ status: "PENDING_REVIEW" }),
      opportunitySourceApi.list({ status: "EXTRACTION_FAILED" }),
    ])
      .then(([pending, failed]) => {
        if (!cancelled) setSources([...(pending.data ?? []), ...(failed.data ?? [])]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    setCreating(true);
    setErrors([]);
    try {
      const res = await opportunityAdminApi.create({
        track,
        category: CATEGORY_OPTIONS[track][0]!.value,
        title: title.trim(),
        slug: slugify(title),
      });
      if (res.data?._id) router.push(`/admin/opportunities/${res.data._id}`);
    } catch (error) {
      setErrors(readApiErrors(error));
    } finally {
      setCreating(false);
    }
  };

  const sections: Array<{ track: OpportunityTrack; label: string }> = [
    { track: "admission", label: "Admissions" },
    { track: "scholarship", label: "Scholarships" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Content"
        title="Admissions & Scholarships"
        subtitle="Nothing reaches parents until someone has checked its sources, marked it verified and published it."
      />

      <SourceWatchPanel />

      {sources.length > 0 && (
        <Card variant="elevated">
          <h2 className="text-sm font-bold text-slate-900">
            Sources waiting for you <span className="text-slate-400">({sources.length})</span>
          </h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {sources.map((source) => (
              <li key={source._id}>
                <Link
                  href={`/admin/opportunities/sources/${source._id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {source.sourceLabel || source.sourceUrl || "Source"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {source.opportunitySlug ? `Checking ${source.opportunitySlug}` : "New entry"}
                    </span>
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                      source.status === "PENDING_REVIEW"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {source.status === "PENDING_REVIEW" ? "Review" : "Could not read"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card variant="elevated">
        <h2 className="text-sm font-bold text-slate-900">New entry from a link or PDF</h2>
        <p className="mt-1 text-xs text-slate-500">
          The document is read for you; you then keep or drop each field, checked against its quote.
        </p>
        <div className="mt-3">
          <SourceSubmitForm />
        </div>
      </Card>

      <Card variant="elevated">
        <h2 className="text-sm font-bold text-slate-900">New entry, typed in</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Page">
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value as OpportunityTrack)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="admission">Admissions</option>
              <option value="scholarship">Scholarships</option>
            </select>
          </Field>
          <Field label="Title">
            <TextInput
              value={title}
              onChange={setTitle}
              placeholder="e.g. Punjab sports scholarship"
            />
          </Field>
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || title.trim().length < 3}
            className="bg-power-orange-solid inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create draft
          </button>
        </div>
        <div className="mt-3">
          <ErrorList errors={errors} />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        sections.map((section) => {
          const list = rows.filter((row) => row.track === section.track);
          return (
            <Card key={section.track} variant="elevated">
              <h2 className="text-base font-bold text-slate-900">
                {section.label} <span className="text-slate-400">({list.length})</span>
              </h2>
              {list.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">None yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {list.map((row) => (
                    <li key={row._id}>
                      <Link
                        href={`/admin/opportunities/${row._id}`}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {row.title}
                          </span>
                          <span className="text-xs text-slate-500">
                            {CATEGORY_OPTIONS[row.track].find((c) => c.value === row.category)
                              ?.label ?? row.category}{" "}
                            · {CYCLE_TEXT[row.cycleState]}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <Attention row={row} />
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                              row.status === "published"
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.status === "published" ? "Live" : "Draft"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
