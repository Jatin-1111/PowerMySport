"use client";

// ─── Pathways (index) ────────────────────────────────────────────────────────
//
// One row per sport. Creating a pathway makes an empty draft and drops you
// straight into the editor — stages are added there, one at a time, rather than
// demanded up front.

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { slugify } from "@/modules/admin/components/pathway/StageEditor";
import { Field, TextInput } from "@/modules/admin/components/pathway/fields";
import { adminApi, type AdminPathwayGuideRow } from "@/modules/admin/services/admin";
import { btn } from "@/modules/shared/ui/buttonStyles";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { Panel } from "@/modules/shared/ui/Panel";
import { EmptyState, SkeletonBlock } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Pull the server's message (and pathed errors) out of a failed request. Not
 * `axios.isAxiosError`: the shared instance's interceptor rewraps failures as a
 * plain `Error` with `.response`, so that check is always false.
 */
export function readApiErrors(error: unknown): string[] {
  const data = (error as { response?: { data?: { message?: string; errors?: string[] } } } | null)
    ?.response?.data;
  if (data?.errors?.length) return data.errors;
  if (data?.message) return [data.message];
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

  const [pendingDelete, setPendingDelete] = useState<AdminPathwayGuideRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const remove = async (row: AdminPathwayGuideRow) => {
    setDeleting(true);
    try {
      await adminApi.deletePathwayGuide(row._id);
      toast.success("Pathway deleted.");
      await load();
    } catch {
      toast.error("Could not delete that pathway.");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Content"
        title="Pathways"
        subtitle="The parent-facing journey for each sport: six stages, each answering the same five questions. Edit stage by stage and publish when it's ready."
      />

      {/* ── Existing ── */}
      <Panel flush title="All pathways" description="One per sport. Open a row to edit its stages.">
        {loading ? (
          <div className="px-5 pb-5">
            <SkeletonBlock rows={4} label="Loading pathways" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No pathways yet"
            description="Start one below, then add its stages in the editor."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sport</th>
                  <th>Stages</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <Link
                        href={`/admin/pathways/${row._id}`}
                        className="font-semibold text-slate-900 hover:text-orange-800 hover:underline"
                      >
                        {row.sportName}
                      </Link>
                    </td>
                    <td className="tabular-nums">{row.stageCount}</td>
                    <td>
                      <StatusBadge
                        status={row.status}
                        tone={row.status === "published" ? "green" : "slate"}
                        size="sm"
                      />
                    </td>
                    <td className="text-slate-500">
                      {row.updatedAt
                        ? new Date(row.updatedAt).toLocaleDateString("en-IN")
                        : "Never"}
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/pathways/${row._id}`} className={btn("outline", "sm")}>
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(row)}
                          aria-label={`Delete the ${row.sportName} pathway`}
                          className={btn("dangerOutline", "sm", "!px-2")}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── New pathway ── */}
      <Panel title="Start a new pathway" description="Creates an empty draft and opens the editor.">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Sport" hint="The display name. The slug is derived from it.">
            <TextInput value={sportName} onChange={setSportName} placeholder="Tennis" />
          </Field>
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || !sportName.trim()}
            className={btn("accent", "md", "h-[38px]")}
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Create draft
          </button>
        </div>
      </Panel>

      <ConfirmModal
        open={pendingDelete !== null}
        variant="danger"
        title={`Delete the ${pendingDelete?.sportName ?? ""} pathway?`}
        description={`This also deletes all ${pendingDelete?.stageCount ?? 0} of its stages. It can't be undone.`}
        confirmLabel="Delete pathway"
        loading={deleting}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
