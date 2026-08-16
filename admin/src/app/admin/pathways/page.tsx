"use client";

// ─── Pathways (index) ────────────────────────────────────────────────────────
//
// One row per sport. Creating a pathway makes an empty draft and drops you
// straight into the editor — stages are added there, one at a time, rather than
// demanded up front.

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { slugify } from "@/modules/admin/components/pathway/StageEditor";
import {
  Field,
  TextInput,
} from "@/modules/admin/components/pathway/fields";
import {
  adminApi,
  type AdminPathwayGuideRow,
} from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import axios from "axios";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** Pull the server's message (and pathed errors) out of an axios failure. */
export function readApiErrors(error: unknown): string[] {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: string[] }
      | undefined;
    if (data?.errors?.length) return data.errors;
    if (data?.message) return [data.message];
  }
  return ["Something went wrong. Check the server logs."];
}

export default function AdminPathwaysPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminPathwayGuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sportName, setSportName] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await adminApi.listPathwayGuides();
      setRows(res.data ?? []);
    } catch {
      toast.error("Could not load the pathways.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const name = sportName.trim();
    if (!name) {
      toast.error("Give the sport a name first.");
      return;
    }
    setCreating(true);
    try {
      const res = await adminApi.createPathwayGuide({
        sport: { slug: slugify(name), name },
      });
      toast.success(res.message ?? "Pathway created.");
      if (res.data?._id) router.push(`/admin/pathways/${res.data._id}`);
    } catch (error) {
      toast.error(readApiErrors(error)[0] ?? "Could not create the pathway.");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (row: AdminPathwayGuideRow) => {
    if (
      !window.confirm(
        `Delete the ${row.sportName} pathway and all ${row.stageCount} of its stages? This cannot be undone.`,
      )
    )
      return;
    try {
      await adminApi.deletePathwayGuide(row._id);
      toast.success("Pathway deleted.");
      await load();
    } catch {
      toast.error("Could not delete that pathway.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Content"
        title="Pathways"
        subtitle="The parent-facing journey for each sport: six stages, each answering the same five questions. Edited stage by stage, published when it's ready."
      />

      {/* ── New pathway ── */}
      <Card variant="elevated" className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Start a new pathway</h2>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Sport" hint="The display name — the slug is derived from it.">
            <TextInput
              value={sportName}
              onChange={setSportName}
              placeholder="Tennis"
            />
          </Field>
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || !sportName.trim()}
            className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create draft
          </button>
        </div>
      </Card>

      {/* ── Existing ── */}
      <Card variant="elevated">
        <h2 className="mb-3 text-lg font-bold text-slate-900">All pathways</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            No pathways yet. Create one above and add its stages.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2">Sport</th>
                  <th className="py-2">Stages</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Updated</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-b border-slate-100">
                    <td className="py-2.5">
                      <Link
                        href={`/admin/pathways/${row._id}`}
                        className="font-semibold text-slate-800 hover:text-power-orange"
                      >
                        {row.sportName}
                      </Link>
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
                    <td className="py-2.5 text-slate-500">
                      {row.updatedAt
                        ? new Date(row.updatedAt).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="py-2.5">
                      <div className="flex justify-end">
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
