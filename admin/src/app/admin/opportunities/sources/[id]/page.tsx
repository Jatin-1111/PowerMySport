"use client";

// ─── Review what was read from a source ─────────────────────────────────────
//
// One row per proposed change, each with the quote the reading gave for it.
// Keep a row only after finding that quote in the source. Approving writes the
// kept rows into the entry, adds this document to its sources, and marks the
// entry verified today, including when nothing is kept: that records "I read
// this year's document and nothing changed".

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { readApiErrors } from "@/modules/admin/components/opportunity/apiErrors";
import { byPageOrder, ChangeRow } from "@/modules/admin/components/opportunity/ChangeRow";
import { CATEGORY_OPTIONS } from "@/modules/admin/components/opportunity/opportunityForm";
import { ErrorList, Field, TextInput } from "@/modules/admin/components/pathway/fields";
import {
  opportunitySourceApi,
  type OpportunitySourceDetail,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import { ArrowLeft, Check, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_TEXT: Record<string, string> = {
  PENDING_EXTRACTION: "Being read",
  EXTRACTION_FAILED: "Could not be read",
  PENDING_REVIEW: "Waiting for review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default function OpportunitySourceReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [detail, setDetail] = useState<OpportunitySourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"approve" | "reject" | "reread" | "fix" | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fixTitle, setFixTitle] = useState("");
  const [fixCategory, setFixCategory] = useState("");

  /**
   * Every row starts kept only if it has a quote: an unquoted row has to be
   * checked in the source and ticked on purpose. `alsoKeep` is for values the
   * reviewer typed themselves, which need no quote.
   */
  const adopt = useCallback((next: OpportunitySourceDetail, alsoKeep: string[] = []) => {
    setDetail(next);
    setKeep(new Set([...next.changes.filter((c) => c.citation).map((c) => c.path), ...alsoKeep]));
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    opportunitySourceApi
      .get(id)
      .then((res) => {
        if (!cancelled && res.data) adopt(res.data);
      })
      .catch(() => toast.error("Could not load that source."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, adopt]);

  const reload = async (alsoKeep: string[] = []) => {
    const res = await opportunitySourceApi.get(id);
    if (res.data) adopt(res.data, alsoKeep);
  };

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    setBusy(kind);
    setErrors([]);
    try {
      await action();
    } catch (error) {
      const problems = readApiErrors(error);
      setErrors(problems);
      toast.error(problems[0] ?? "That did not work.");
    } finally {
      setBusy(null);
    }
  };

  const changes = useMemo(() => [...(detail?.changes ?? [])].sort(byPageOrder), [detail]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!detail) {
    return (
      <Card variant="elevated">
        <p className="text-sm text-slate-600">That source no longer exists.</p>
      </Card>
    );
  }

  const { submission, entry } = detail;
  const isNew = !submission.opportunitySlug;
  const reviewable = submission.status === "PENDING_REVIEW";
  const track = submission.opportunityTrack ?? entry?.track ?? "scholarship";
  const link = submission.originUrl || submission.sourceUrl;
  const needsIdentity =
    isNew &&
    reviewable &&
    (!changes.some((c) => c.path === "title") || !changes.some((c) => c.path === "category"));

  const toggle = (path: string) =>
    setKeep((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const approve = () =>
    run("approve", async () => {
      const res = await opportunitySourceApi.approve(id, [...keep]);
      toast.success(res.message ?? "Approved.");
      if (res.data?.opportunityId) router.push(`/admin/opportunities/${res.data.opportunityId}`);
    });

  const reject = () => {
    const reason = window.prompt("Why reject this? (kept for the next reviewer)");
    if (!reason?.trim()) return;
    void run("reject", async () => {
      await opportunitySourceApi.reject(id, reason.trim());
      toast.success("Rejected.");
      await reload();
    });
  };

  const reread = () =>
    run("reread", async () => {
      await opportunitySourceApi.reExtract(id);
      toast.success("Read again.");
      await reload();
    });

  const saveIdentity = () =>
    run("fix", async () => {
      await opportunitySourceApi.edit(id, {
        ...(fixTitle.trim() ? { title: fixTitle.trim() } : {}),
        ...(fixCategory ? { category: fixCategory } : {}),
      });
      await reload([
        ...keep,
        ...(fixTitle.trim() ? ["title"] : []),
        ...(fixCategory ? ["category"] : []),
      ]);
    });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge={isNew ? "New entry from a source" : "Checking an entry"}
        title={submission.sourceLabel || "Source"}
        subtitle={`${STATUS_TEXT[submission.status] ?? submission.status}${
          entry ? ` · for "${entry.title}"` : ""
        }`}
        action={
          <Link
            href={entry ? `/admin/opportunities/${entry._id}` : "/admin/opportunities"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            {entry ? "Back to the entry" : "All entries"}
          </Link>
        }
      />

      <Card variant="elevated" className="space-y-2">
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 hover:underline"
          >
            Open the source <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {submission.extractionError && (
          <p className="text-sm text-red-700">{submission.extractionError}</p>
        )}
        {submission.reviewNotes && (
          <p className="text-sm text-slate-600">{submission.reviewNotes}</p>
        )}
        {(submission.extractionWarnings?.length ?? 0) > 0 && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold">
              {submission.extractionWarnings!.length} value(s) dropped as invalid
            </summary>
            <ul className="mt-1 list-disc pl-4">
              {submission.extractionWarnings!.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {needsIdentity && (
        <Card variant="elevated" className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            A new entry needs a title and a section. Set whichever the reading missed.
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px_auto] sm:items-end">
            <Field label="Title">
              <TextInput value={fixTitle} onChange={setFixTitle} />
            </Field>
            <Field label="Section">
              <select
                value={fixCategory}
                onChange={(e) => setFixCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Choose…</option>
                {CATEGORY_OPTIONS[track].map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={() => void saveIdentity()}
              disabled={busy !== null || (!fixTitle.trim() && !fixCategory)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Set
            </button>
          </div>
        </Card>
      )}

      <ErrorList errors={errors} />

      {reviewable && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
          <button
            type="button"
            onClick={() => void approve()}
            disabled={busy !== null}
            className="bg-power-orange-solid inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy === "approve" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isNew
              ? `Create a verified draft (${keep.size} field${keep.size === 1 ? "" : "s"})`
              : keep.size === 0
                ? "Nothing changed: mark verified"
                : `Apply ${keep.size} change${keep.size === 1 ? "" : "s"} and mark verified`}
          </button>
          <button
            type="button"
            onClick={() => void reread()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${busy === "reread" ? "animate-spin" : ""}`} />
            Read again
          </button>
          <button
            type="button"
            onClick={reject}
            disabled={busy !== null}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}

      {submission.status === "EXTRACTION_FAILED" && (
        <button
          type="button"
          onClick={() => void reread()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
        >
          <RefreshCw className={`h-4 w-4 ${busy === "reread" ? "animate-spin" : ""}`} />
          Try reading it again
        </button>
      )}

      {changes.length > 0 ? (
        <ul className="space-y-3">
          {changes.map((change) => (
            <ChangeRow
              key={change.path}
              change={change}
              kept={keep.has(change.path)}
              onToggle={() => reviewable && toggle(change.path)}
              isNew={isNew}
            />
          ))}
        </ul>
      ) : (
        submission.status !== "EXTRACTION_FAILED" && (
          <Card variant="elevated">
            <p className="text-sm text-slate-600">
              {isNew
                ? "Nothing usable was read from this source."
                : "The source matches the entry: nothing it says differs from what is published."}
            </p>
          </Card>
        )
      )}
    </div>
  );
}
