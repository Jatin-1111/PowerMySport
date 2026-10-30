"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  providerChangesApi,
  type PendingChangeRow,
  type ProviderKind,
} from "@/modules/admin/services/providerChanges";
import { toast } from "@/lib/toast";
import { btn } from "@/modules/shared/ui/buttonStyles";
import { Panel } from "@/modules/shared/ui/Panel";
import { EmptyState, ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";
import { useCallback, useEffect, useState } from "react";

const KIND_LABEL: Record<ProviderKind, string> = {
  coach: "Coach",
  expert: "Expert",
  venue: "Venue",
};

const FIELD_LABEL: Record<string, string> = {
  sports: "Sports",
  certifications: "Certifications",
  achievements: "Achievements",
  name: "Name",
  address: "Address",
  location: "Location",
};

const show = (field: string, value: unknown): string => {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (field === "location") {
    const coords = (value as { coordinates?: number[] } | undefined)?.coordinates;
    return coords && coords.length === 2 ? `${coords[1]}, ${coords[0]}` : "Not set";
  }
  const text = typeof value === "string" ? value.trim() : "";
  return text || "Not set";
};

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

export default function ProviderChangesPage() {
  const [rows, setRows] = useState<PendingChangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await providerChangesApi.list());
    } catch {
      setError("Could not load pending changes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    providerChangesApi
      .list()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch(() => {
        if (active) setError("Could not load pending changes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const decide = async (row: PendingChangeRow, action: "approve" | "reject") => {
    const key = `${row.kind}:${row.id}`;
    setBusyKey(key);
    try {
      if (action === "approve") await providerChangesApi.approve(row.kind, row.id);
      else await providerChangesApi.reject(row.kind, row.id);
      toast.success(action === "approve" ? "Changes approved" : "Changes rejected");
      setRows((prev) => prev.filter((r) => `${r.kind}:${r.id}` !== key));
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(message || "Could not save the decision.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="People"
        title="Provider changes"
        subtitle="Edits to sports, certifications, achievements, venue name, address or location made after approval. The approved values stay live until you decide."
      />

      <Panel title="Waiting for review" description="Oldest first.">
        {loading ? (
          <SkeletonBlock rows={4} label="Loading pending changes" />
        ) : error ? (
          <ErrorNotice message={error} onRetry={() => void load()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            description="Changes to approved providers appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-200">
            {rows.map((row) => {
              const key = `${row.kind}:${row.id}`;
              const busy = busyKey === key;
              return (
                <li key={key} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {row.name}{" "}
                      <span className="font-normal text-slate-500">{KIND_LABEL[row.kind]}</span>
                    </p>
                    {row.submittedAt && (
                      <p className="text-xs text-slate-500">
                        Submitted {formatDate(row.submittedAt)}
                      </p>
                    )}
                  </div>

                  <dl className="space-y-2">
                    {row.changes.map((change) => (
                      <div
                        key={change.field}
                        className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr_1fr]"
                      >
                        <dt className="font-medium text-slate-600">
                          {FIELD_LABEL[change.field] ?? change.field}
                        </dt>
                        <dd className="text-slate-600">
                          <span className="block text-xs uppercase text-slate-500">Approved</span>
                          {show(change.field, change.current)}
                        </dd>
                        <dd className="text-slate-900">
                          <span className="block text-xs uppercase text-slate-500">Proposed</span>
                          {show(change.field, change.proposed)}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={btn("accent", "sm")}
                      disabled={busy}
                      onClick={() => void decide(row, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className={btn("outline", "sm")}
                      disabled={busy}
                      onClick={() => void decide(row, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
