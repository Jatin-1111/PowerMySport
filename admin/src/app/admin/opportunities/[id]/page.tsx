"use client";

// ─── Admissions & scholarships: one entry ───────────────────────────────────
//
// Save, verify and publish are three separate actions on purpose:
//   Save      keeps your edits. A draft may be half-checked.
//   Verify    stamps today's date as "last checked". Press it only after
//             opening every source and confirming what the form says.
//   Publish   re-validates the whole entry and puts it in front of parents.
// A live entry is held to the publishing bar on every save.

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { readApiErrors } from "@/modules/admin/components/opportunity/apiErrors";
import { OpportunityEditor } from "@/modules/admin/components/opportunity/OpportunityEditor";
import { SourceSubmitForm } from "@/modules/admin/components/opportunity/SourceSubmitForm";
import {
  formFromDoc,
  payloadFromForm,
  type OpportunityForm,
} from "@/modules/admin/components/opportunity/opportunityForm";
import { ErrorList } from "@/modules/admin/components/pathway/fields";
import { PublishCheckPanel } from "@/modules/admin/components/opportunity/PublishCheckPanel";
import {
  opportunityAdminApi,
  type AdminOpportunity,
  type PublishCheck,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import {
  ArrowLeft,
  BadgeCheck,
  Eye,
  EyeOff,
  FileSearch,
  ListChecks,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/modules/shared/ui/useConfirm";

const buttonClass =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50";

export default function AdminOpportunityEditPage() {
  const [confirm, confirmDialog] = useConfirm();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  // Arriving from a flagged source opens the check with its link filled in.
  const checkUrl = useSearchParams()?.get("check") ?? "";

  const [doc, setDoc] = useState<AdminOpportunity | null>(null);
  const [form, setForm] = useState<OpportunityForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "verify" | "status" | "check" | "delete" | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [checking, setChecking] = useState(Boolean(checkUrl));
  const [showCheck, setShowCheck] = useState(false);
  const [checkResult, setCheckResult] = useState<PublishCheck | null>(null);

  const adopt = useCallback((next: AdminOpportunity) => {
    setDoc(next);
    setForm(formFromDoc(next));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await opportunityAdminApi.get(id);
      if (res.data) adopt(res.data);
    } catch {
      toast.error("Could not load that entry.");
    } finally {
      setLoading(false);
    }
  }, [id, adopt]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    opportunityAdminApi
      .get(id)
      .then((res) => {
        if (!cancelled && res.data) adopt(res.data);
      })
      .catch(() => toast.error("Could not load that entry."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, adopt]);

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

  const save = () =>
    run("save", async () => {
      if (!form) return;
      const res = await opportunityAdminApi.update(id, payloadFromForm(form));
      if (res.data) adopt(res.data);
      toast.success("Saved.");
    });

  const verify = async () => {
    if (
      !(await confirm({
        title: "Mark as verified today?",
        description: "Only do this after opening every source and checking each figure against it.",
        confirmLabel: "Mark verified",
      }))
    )
      return;
    void run("verify", async () => {
      // Save first, so the date stamps what is actually on screen.
      if (form) await opportunityAdminApi.update(id, payloadFromForm(form));
      const res = await opportunityAdminApi.verify(id);
      if (res.data) adopt(res.data);
      toast.success(res.message ?? "Verified.");
    });
  };

  const runCheck = () =>
    run("check", async () => {
      // Save first, so the check reads what is on screen.
      if (form) await opportunityAdminApi.update(id, payloadFromForm(form));
      const res = await opportunityAdminApi.check(id);
      setCheckResult(res.data ?? null);
      setShowCheck(true);
    });

  const toggleStatus = () =>
    run("status", async () => {
      if (!doc) return;
      const next = doc.status === "published" ? "draft" : "published";
      if (next === "published" && form) await opportunityAdminApi.update(id, payloadFromForm(form));
      const res = await opportunityAdminApi.setStatus(id, next);
      toast.success(res.message ?? "Status changed.");
      // The check's findings come back with a publish; show what it let through.
      const findings = res.data?.findings ?? [];
      if (next === "published" && findings.some((f) => f.severity !== "note")) {
        setCheckResult({ findings, links: [] });
        setShowCheck(true);
        toast.warning("Published, with things worth a look. See the check below.");
      }
      await load();
    });

  const remove = async () => {
    if (
      !doc ||
      !(await confirm({
        title: `Delete "${doc.title}"?`,
        description: "This can't be undone.",
        confirmLabel: "Delete entry",
        variant: "danger",
      }))
    )
      return;
    void run("delete", async () => {
      await opportunityAdminApi.remove(id);
      toast.success("Deleted.");
      router.push("/admin/opportunities");
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!doc || !form) {
    return (
      <Card variant="elevated">
        <p className="text-sm text-slate-600">That entry no longer exists.</p>
        <Link
          href="/admin/opportunities"
          className="mt-2 inline-block text-sm font-semibold text-orange-700"
        >
          Back to the list
        </Link>
      </Card>
    );
  }

  const isPublished = doc.status === "published";
  const publicPath = `/${doc.track === "admission" ? "admissions" : "scholarships"}/${doc.slug}`;

  return (
    <div className="space-y-6">
      {confirmDialog}
      <AdminPageHeader
        badge={doc.track === "admission" ? "Admission" : "Scholarship"}
        title={doc.title}
        subtitle={`${isPublished ? `Live at ${publicPath}` : "Draft, not shown to anyone"} · ${
          doc.lastVerifiedOn ? `last verified ${doc.lastVerifiedOn}` : "never verified"
        }`}
        action={
          <Link
            href="/admin/opportunities"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            All entries
          </Link>
        }
      />

      {doc.draftedFrom && (
        <Card variant="elevated" className="space-y-2">
          <p className="text-sm text-slate-700">
            This entry was drafted automatically from &ldquo;{doc.draftedFrom.label}&rdquo;. Nobody
            has checked it. The reading shows every value with the quote it came from, and which
            approval rules it met.
          </p>
          <Link
            href={`/admin/opportunities/sources/${doc.draftedFrom.submissionId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            See what it relied on
          </Link>
        </Card>
      )}

      <div className="sticky top-0 z-10 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy !== null}
          className={`${buttonClass} bg-slate-900 text-white`}
        >
          {busy === "save" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </button>
        <button
          type="button"
          onClick={verify}
          disabled={busy !== null}
          className={`${buttonClass} border border-emerald-300 text-emerald-800 hover:bg-emerald-50`}
        >
          {busy === "verify" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BadgeCheck className="h-4 w-4" />
          )}
          Mark verified today
        </button>
        <button
          type="button"
          onClick={() => setChecking((v) => !v)}
          disabled={busy !== null}
          className={`${buttonClass} border border-slate-300 text-slate-700 hover:bg-slate-50`}
        >
          <FileSearch className="h-4 w-4" />
          Check against a source
        </button>
        <button
          type="button"
          onClick={() => setShowCheck((v) => !v)}
          disabled={busy !== null}
          className={`${buttonClass} border border-slate-300 text-slate-700 hover:bg-slate-50`}
        >
          <ListChecks className="h-4 w-4" />
          Check before publishing
        </button>
        <button
          type="button"
          onClick={() => void toggleStatus()}
          disabled={busy !== null}
          className={`${buttonClass} ${
            isPublished
              ? "border border-slate-300 text-slate-700 hover:bg-slate-50"
              : "bg-power-orange-solid text-white"
          }`}
        >
          {isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {isPublished ? "Unpublish" : "Publish"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          className={`${buttonClass} ml-auto text-red-700 hover:bg-red-50`}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      {checking && (
        <Card variant="elevated">
          <h2 className="text-sm font-semibold text-slate-900">Check against a source</h2>
          <p className="mt-1 text-xs text-slate-500">
            Give this year&apos;s document. You will see what it says differently from this entry,
            field by field, and approving marks the entry verified.
          </p>
          <div className="mt-3">
            <SourceSubmitForm
              opportunitySlug={doc.slug}
              defaultUrl={checkUrl}
              onCancel={() => setChecking(false)}
            />
          </div>
        </Card>
      )}

      {showCheck && (
        <PublishCheckPanel
          result={checkResult}
          running={busy === "check"}
          onRun={() => void runCheck()}
          onClose={() => setShowCheck(false)}
        />
      )}

      <ErrorList errors={errors} />
      <OpportunityEditor form={form} onChange={setForm} />
    </div>
  );
}
