"use client";

// ─── Pathway stage guides ───────────────────────────────────────────────────
//
// Upload the hand-authored JSON that drives the pathway page for a sport.
//
// The flow is check-then-publish, not upload-and-hope. "Check" runs the file
// through the same validator the save endpoint uses and writes nothing, so a
// bad file is caught before it can reach a parent. Errors come back pathed
// (`stages[3].funding[0].benefit: …`) because the person fixing them is editing
// JSON by hand and "invalid payload" would send them hunting.
//
// Saving as a draft is the default for a NEW sport: it puts the guide in the
// database without putting it in front of anyone, so it can be read back and
// checked first.

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  adminApi,
  AdminStageGuideRow,
  StageGuideValidationResult,
} from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import axios from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "valid"; summary: NonNullable<StageGuideValidationResult["data"]> }
  | { kind: "invalid"; errors: string[] };

/** Pull the server's pathed errors out of an axios failure. */
function readErrors(error: unknown): string[] {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: string[] }
      | undefined;
    if (data?.errors?.length) return data.errors;
    if (data?.message) return [data.message];
  }
  return ["Something went wrong. Check the server logs."];
}

export default function AdminStageGuidesPage() {
  const [rows, setRows] = useState<AdminStageGuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, setState] = useState("");
  const [publish, setPublish] = useState(false);
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.listStageGuides();
      setRows(res.data ?? []);
    } catch {
      toast.error("Could not load the existing stage guides.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Parse locally first — a JSON syntax error needs no round trip. */
  const parsed = useCallback((): { ok: true; value: unknown } | { ok: false; error: string } => {
    if (!raw.trim()) return { ok: false, error: "Paste or choose a JSON file first." };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (error) {
      return {
        ok: false,
        error: `That isn't valid JSON — ${(error as Error).message}`,
      };
    }
  }, [raw]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setRaw(text);
    setFileName(file.name);
    setCheck({ kind: "idle" });
  };

  const runCheck = async () => {
    const p = parsed();
    if (!p.ok) {
      setCheck({ kind: "invalid", errors: [p.error] });
      return;
    }
    setCheck({ kind: "checking" });
    try {
      const res = await adminApi.validateStageGuide(p.value);
      if (res.success && res.data) setCheck({ kind: "valid", summary: res.data });
      else setCheck({ kind: "invalid", errors: res.errors ?? [res.message] });
    } catch (error) {
      setCheck({ kind: "invalid", errors: readErrors(error) });
    }
  };

  const save = async () => {
    const p = parsed();
    if (!p.ok) {
      setCheck({ kind: "invalid", errors: [p.error] });
      return;
    }
    setSaving(true);
    try {
      const res = await adminApi.upsertStageGuide({
        guide: p.value,
        state: state.trim() || null,
        status: publish ? "published" : "draft",
      });
      toast.success(res.message ?? "Stage guide saved.");
      setCheck({ kind: "idle" });
      setRaw("");
      setFileName(null);
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (error) {
      const errors = readErrors(error);
      setCheck({ kind: "invalid", errors });
      toast.error(errors[0] ?? "Could not save the stage guide.");
    } finally {
      setSaving(false);
    }
  };

  const download = async (row: AdminStageGuideRow) => {
    try {
      const res = await adminApi.getStageGuide(row.sportSlug, row.stateSlug);
      const blob = new Blob([JSON.stringify(res.data?.guide ?? {}, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${row.sportSlug}${row.stateSlug ? `-${row.stateSlug}` : ""}-stage-guide.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download that guide.");
    }
  };

  const remove = async (row: AdminStageGuideRow) => {
    const scope = row.stateSlug ? `${row.sportName} (${row.stateSlug})` : row.sportName;
    if (!window.confirm(`Delete the stage guide for ${scope}? The pathway page will fall back to generated stages.`))
      return;
    try {
      await adminApi.deleteStageGuide(row.sportSlug, row.stateSlug);
      toast.success("Stage guide deleted.");
      await load();
    } catch {
      toast.error("Could not delete that guide.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Content"
        title="Pathway stage guides"
        subtitle="Upload the India-specific JSON that drives the pathway page for a sport. Checked against the published format before anything is saved."
      />

      {/* ── Upload ── */}
      <Card variant="elevated" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
          />
          {fileName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              <FileJson className="h-3.5 w-3.5" />
              {fileName}
            </span>
          )}
        </div>

        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setCheck({ kind: "idle" });
          }}
          spellCheck={false}
          rows={12}
          placeholder="…or paste the JSON here"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-slate-400 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm text-slate-600">
            State
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="leave blank for national"
              className="ml-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Publish immediately
            <span className="text-xs text-slate-400">
              (otherwise saved as a draft and not shown to parents)
            </span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={check.kind === "checking" || !raw.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-40"
          >
            {check.kind === "checking" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Check the file
          </button>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !raw.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {publish ? "Save and publish" : "Save as draft"}
          </button>
        </div>

        {check.kind === "valid" && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              {check.summary.stageCount} stages, and the format checks out.
            </p>
            <ol className="mt-2 space-y-0.5 text-sm text-green-900">
              {check.summary.stages.map((s) => (
                <li key={s.number}>
                  {s.number}. {s.title}
                </li>
              ))}
            </ol>
          </div>
        )}

        {check.kind === "invalid" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-red-800">
              <AlertTriangle className="h-4 w-4" />
              {check.errors.length} problem{check.errors.length === 1 ? "" : "s"} to fix
            </p>
            <ul className="mt-2 space-y-1 font-mono text-xs text-red-900">
              {check.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* ── What's already uploaded ── */}
      <Card variant="elevated">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Uploaded guides</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing uploaded yet. Every sport is showing stages generated from its
            pathway data.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2">Sport</th>
                  <th className="py-2">Scope</th>
                  <th className="py-2">Stages</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Verified</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-b border-slate-100">
                    <td className="py-2.5 font-semibold text-slate-800">
                      {row.sportName}
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {row.stateSlug ?? "National"}
                    </td>
                    <td className="py-2.5 text-slate-600">{row.stageCount}</td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          row.status === "published"
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500">{row.verifiedOn ?? "—"}</td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void download(row)}
                          title="Download the stored JSON"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-slate-400 hover:text-slate-800"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(row)}
                          title="Delete"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-red-300 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
