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
import { ApprovalVerdictCard } from "@/modules/admin/components/opportunity/ApprovalVerdictCard";
import { readApiErrors } from "@/modules/admin/components/opportunity/apiErrors";
import {
  byPageOrder,
  ChangeRow,
  hasEvidenceAgainst,
} from "@/modules/admin/components/opportunity/ChangeRow";
import { CATEGORY_OPTIONS } from "@/modules/admin/components/opportunity/opportunityForm";
import { ErrorList, Field, TextInput } from "@/modules/admin/components/pathway/fields";
import {
  opportunitySourceApi,
  type OpportunitySourceDetail,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import { ArrowLeft, Check, ExternalLink, Loader2, RefreshCw, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

/** What the AI approver did, in the words an editor needs to decide whether to revert it. */
const AUTO_ACTION_TEXT: Record<string, string> = {
  published: "It published a new entry.",
  approved: "It applied a change to the entry.",
  reverified: "It confirmed the entry is still right and moved its verified date.",
};

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
  const [busy, setBusy] = useState<"approve" | "reject" | "reread" | "fix" | "revert" | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fixTitle, setFixTitle] = useState("");
  const [fixCategory, setFixCategory] = useState("");

  /**
   * Every row starts kept only if it has a quote and nothing found against it:
   * an unquoted row, a quote that is not on the page, or a figure that is not in
   * its quote has to be checked in the source and ticked on purpose. `alsoKeep`
   * is for values the reviewer typed themselves, which need no quote.
   */
  const adopt = useCallback((next: OpportunitySourceDetail, alsoKeep: string[] = []) => {
    setDetail(next);
    setKeep(
      new Set([
        ...next.changes.filter((c) => c.citation && !hasEvidenceAgainst(c)).map((c) => c.path),
        ...alsoKeep,
      ])
    );
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

  // A reading that follows documents takes minutes and runs in the background:
  // look again every few seconds until it has finished.
  const pending = detail?.submission.status === "PENDING_EXTRACTION";
  // Updated by the timer below, so "taking too long" is judged without reading the
  // clock during render.
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      setClock(Date.now());
      opportunitySourceApi
        .get(id)
        .then((res) => {
          if (res.data) adopt(res.data);
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [pending, id, adopt]);

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
  const drafted = Boolean(detail.drafted);
  const auto = submission.autoApproval;
  const autoActed =
    Boolean(auto) &&
    ["approved", "reverified", "published"].includes(auto?.action ?? "") &&
    !auto?.revertedAt;
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

  const revertAuto = () =>
    run("revert", async () => {
      if (!window.confirm("Revert what the AI approver did and take this over yourself?")) return;
      const res = await opportunitySourceApi.revertAuto(id);
      toast.success(res.message ?? "Reverted.");
      await reload();
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
        badge={
          drafted
            ? "Drafted automatically"
            : isNew
              ? "New entry from a source"
              : "Checking an entry"
        }
        title={submission.sourceLabel || "Source"}
        subtitle={
          drafted
            ? `Not yet checked by a person${entry ? ` · draft "${entry.title}"` : ""}`
            : `${STATUS_TEXT[submission.status] ?? submission.status}${
                entry ? ` · for "${entry.title}"` : ""
              }`
        }
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

      {autoActed && auto && (
        <Card variant="elevated" className="space-y-2">
          <p className="text-sm font-bold text-slate-900">
            Approved automatically on{" "}
            {new Date(auto.actedAt ?? auto.assessedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <p className="text-sm text-slate-700">
            {AUTO_ACTION_TEXT[auto.action] ?? "The AI approver acted on this."} It satisfied every
            approval rule, and no person looked at it. If it is wrong, revert it: the entry goes
            back exactly as it was, and this reading returns to the review queue for a person.
          </p>
          <button
            type="button"
            onClick={() => void revertAuto()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            <Undo2 className="h-4 w-4" />
            Revert this
          </button>
        </Card>
      )}
      {auto?.revertedAt && (
        <Card variant="elevated">
          <p className="text-sm text-slate-700">
            The automatic approval was reverted. The AI approver will not act on this reading again.
          </p>
        </Card>
      )}

      {detail.verdict && <ApprovalVerdictCard verdict={detail.verdict} />}

      {drafted && entry && (
        <Card variant="elevated" className="space-y-2">
          <p className="text-sm text-slate-700">
            This entry was drafted automatically from this source. Nobody has checked it, and it is
            not verified or published. Below is everything that was read, with the quote each value
            came from. Check them, correct the draft, then press Mark verified.
          </p>
          <Link
            href={`/admin/opportunities/${entry._id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Open the draft
          </Link>
        </Card>
      )}

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
        {reviewable &&
          submission.citationChecks &&
          (submission.citationChecks.against === "none" ||
            Object.keys(submission.citationChecks.quotes).length > 0) && (
            <p className="text-xs text-slate-500">
              {submission.citationChecks.against === "none"
                ? "The quotes could not be compared with the source, because it is a page our server could not read itself, or a PDF with no text in it (a scan). Check each one."
                : `${
                    Object.values(submission.citationChecks.quotes).filter((q) => q === "found")
                      .length
                  } of ${Object.keys(submission.citationChecks.quotes).length} quotes were found ${
                    submission.citationChecks.against === "pdf-text"
                      ? "in the PDF's text. A PDF table can read out of order, so the rest need a look rather than a rejection."
                      : "on the page."
                  }`}
            </p>
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

      {submission.status === "PENDING_EXTRACTION" && (
        <Card variant="elevated" className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the page{submission.followDocuments ? " and its documents" : ""}…
          </p>
          <p className="text-xs text-slate-500">
            {submission.followDocuments
              ? "This takes a few minutes. You can leave this page: it will be under Sources to review when it is done, and the editors are emailed."
              : "This takes about a minute."}{" "}
            This page updates by itself.
          </p>
          {clock > 0 &&
            clock - new Date(submission.updatedAt ?? submission.createdAt).getTime() >
              10 * 60 * 1000 && (
              <button
                type="button"
                onClick={() => void reread()}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Taking too long? Read it again
              </button>
            )}
        </Card>
      )}

      {(submission.documents?.length ?? 0) > 1 && (
        <Card variant="elevated" className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">
            Read {submission.documents!.filter((d) => d.status === "read").length} of{" "}
            {submission.documents!.length} sources
          </p>
          <ul className="space-y-1.5">
            {submission.documents!.map((d) => (
              <li key={d.url} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span
                  className={`rounded-md px-1.5 py-0.5 font-bold ${
                    d.status === "read"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {d.status === "read" ? "Read" : "Not read"}
                </span>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-800 hover:underline"
                >
                  {d.label}
                </a>
                <span className="text-slate-500">
                  {d.kind === "page" ? "the page" : "PDF"}
                  {d.sourcePublishedOn ? ` · issued ${d.sourcePublishedOn}` : ""}
                  {d.error ? ` · ${d.error}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Where documents disagree, each row shows the one it came from and what the others say,
            and starts unticked. Quotes from a PDF cannot be compared with its text.
          </p>
        </Card>
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
              kept={drafted || keep.has(change.path)}
              onToggle={() => reviewable && toggle(change.path)}
              isNew={isNew}
            />
          ))}
        </ul>
      ) : (
        submission.status !== "EXTRACTION_FAILED" &&
        submission.status !== "PENDING_EXTRACTION" && (
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
