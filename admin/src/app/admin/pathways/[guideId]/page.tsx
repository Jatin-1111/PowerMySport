"use client";

// ─── Pathway editor ──────────────────────────────────────────────────────────
//
// Left: the stage list — add, reorder, delete, pick one to edit. Right: that one
// stage's five buckets.
//
// Every write hits its own endpoint and answers with the whole guide, so the
// list and the form can never drift out of sync with what is stored. Publishing
// is separate from saving and re-validates the whole guide: a draft is allowed
// to be half-written, a published pathway is not.

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  emptyStage,
  StageEditor,
} from "@/modules/admin/components/pathway/StageEditor";
import {
  ErrorList,
  Field,
  RepeatableList,
  TextArea,
  TextInput,
} from "@/modules/admin/components/pathway/fields";
import {
  adminApi,
  type AdminPathwayGuide,
  type AdminPathwayStage,
} from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { readApiErrors } from "../page";

/** `null` = the "add a stage" form; a string = the key of the stage being edited. */
type Selection = string | null;

export default function AdminPathwayEditPage() {
  const params = useParams();
  const guideId = params?.guideId as string;

  const [guide, setGuide] = useState<AdminPathwayGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Selection>(null);
  const [addingStage, setAddingStage] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);
  const [stageErrors, setStageErrors] = useState<string[]>([]);

  // Guide-level draft. Held separately from `guide` so the intro fields behave
  // like the stage form: type freely, save deliberately.
  const [eyebrow, setEyebrow] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [sportIntro, setSportIntro] = useState<string[]>([]);
  const [reviewedOn, setReviewedOn] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaErrors, setMetaErrors] = useState<string[]>([]);
  const [statusSaving, setStatusSaving] = useState(false);

  /** Adopt a server response as the new truth, including the intro draft. */
  const adopt = useCallback((next: AdminPathwayGuide) => {
    setGuide(next);
    setEyebrow(next.intro?.eyebrow ?? "");
    setHeadline(next.intro?.headline ?? "");
    setDescription(next.intro?.description ?? "");
    setSportIntro(next.sportIntro ?? []);
    setReviewedOn(next.reviewedOn ?? "");
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getPathwayGuide(guideId);
      if (res.data) {
        adopt(res.data);
        setSelected(res.data.stages?.[0]?.key ?? null);
      }
    } catch {
      toast.error("Could not load that pathway.");
    } finally {
      setLoading(false);
    }
  }, [guideId, adopt]);

  useEffect(() => {
    if (guideId) void load();
  }, [guideId, load]);

  // ── Guide-level ──

  const saveMeta = async () => {
    setMetaSaving(true);
    setMetaErrors([]);
    try {
      const res = await adminApi.updatePathwayGuide(guideId, {
        intro: {
          ...(eyebrow.trim() ? { eyebrow: eyebrow.trim() } : {}),
          ...(headline.trim() ? { headline: headline.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        },
        sportIntro: sportIntro.filter((p) => p.trim()),
        ...(reviewedOn.trim() ? { reviewedOn: reviewedOn.trim() } : {}),
      });
      if (res.data) adopt(res.data);
      toast.success("Saved.");
    } catch (error) {
      setMetaErrors(readApiErrors(error));
    } finally {
      setMetaSaving(false);
    }
  };

  const togglePublished = async () => {
    if (!guide) return;
    const next = guide.status === "published" ? "draft" : "published";
    setStatusSaving(true);
    setMetaErrors([]);
    try {
      const res = await adminApi.setPathwayGuideStatus(guideId, next);
      toast.success(res.message ?? "Status changed.");
      await load();
    } catch (error) {
      const errors = readApiErrors(error);
      setMetaErrors(errors);
      toast.error(errors[0] ?? "Could not change the status.");
    } finally {
      setStatusSaving(false);
    }
  };

  // ── Stage-level ──

  const saveStage = async (stage: AdminPathwayStage) => {
    setStageSaving(true);
    setStageErrors([]);
    try {
      const res = addingStage
        ? await adminApi.addPathwayStage(guideId, stage)
        : await adminApi.updatePathwayStage(guideId, selected as string, stage);
      if (res.data) adopt(res.data);
      setAddingStage(false);
      setSelected(stage.key);
      toast.success(res.message ?? "Saved.");
    } catch (error) {
      setStageErrors(readApiErrors(error));
    } finally {
      setStageSaving(false);
    }
  };

  const removeStage = async (key: string, name: string) => {
    if (!window.confirm(`Delete the "${name}" stage?`)) return;
    try {
      const res = await adminApi.deletePathwayStage(guideId, key);
      if (res.data) {
        adopt(res.data);
        setSelected(res.data.stages?.[0]?.key ?? null);
      }
      toast.success("Stage deleted.");
    } catch {
      toast.error("Could not delete that stage.");
    }
  };

  const moveStage = async (index: number, delta: number) => {
    if (!guide) return;
    const target = index + delta;
    if (target < 0 || target >= guide.stages.length) return;
    const keys = guide.stages.map((s) => s.key);
    const [moved] = keys.splice(index, 1);
    keys.splice(target, 0, moved as string);
    try {
      const res = await adminApi.reorderPathwayStages(guideId, keys);
      if (res.data) adopt(res.data);
    } catch {
      toast.error("Could not reorder the stages.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!guide) {
    return (
      <Card variant="elevated">
        <p className="text-sm text-slate-600">That pathway no longer exists.</p>
        <Link href="/admin/pathways" className="mt-2 inline-block text-sm font-semibold text-power-orange">
          Back to pathways
        </Link>
      </Card>
    );
  }

  const isPublished = guide.status === "published";
  const editing = addingStage
    ? emptyStage()
    : guide.stages.find((s) => s.key === selected);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge={guide.stateSlug ? `Pathway · ${guide.stateSlug}` : "Pathway · National"}
        title={guide.sportName}
        subtitle={`${guide.stages.length} stage${guide.stages.length === 1 ? "" : "s"} · ${
          isPublished ? "live for parents" : "draft, not shown to anyone"
        }`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/pathways"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              All pathways
            </Link>
            <button
              type="button"
              onClick={() => void togglePublished()}
              disabled={statusSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-40"
            >
              {statusSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPublished ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {isPublished ? "Unpublish" : "Publish"}
            </button>
          </div>
        }
      />

      {/* ── Intro copy ── */}
      <Card variant="elevated" className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Page introduction</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Eyebrow" hint="Small caps line above the title.">
            <TextInput
              value={eyebrow}
              onChange={setEyebrow}
              placeholder="Tennis pathway · for parents"
            />
          </Field>
          <Field label="Headline">
            <TextInput
              value={headline}
              onChange={setHeadline}
              placeholder="Understand. Question. Observe. Decide. Act."
            />
          </Field>
        </div>
        <Field label="Description" hint="The paragraph under the headline.">
          <TextArea value={description} rows={3} onChange={setDescription} />
        </Field>

        <RepeatableList
          label="About this sport"
          hint="One entry per paragraph, shown above the stages."
          items={sportIntro}
          onChange={setSportIntro}
          makeEmpty={() => ""}
          addLabel="Add paragraph"
          emptyText="No introduction yet."
          renderRow={(item, setItem) => (
            <TextArea value={item} rows={2} onChange={setItem} />
          )}
        />

        <Field label="Reviewed on" hint="Free text, e.g. “Reviewed with AITA coaches, Aug 2026”.">
          <TextInput value={reviewedOn} onChange={setReviewedOn} />
        </Field>

        <ErrorList errors={metaErrors} />

        <button
          type="button"
          onClick={() => void saveMeta()}
          disabled={metaSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {metaSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save introduction
        </button>
      </Card>

      {/* ── Stages ── */}
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <Card variant="elevated" className="lg:sticky lg:top-6">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Stages</h2>
          {guide.stages.length === 0 ? (
            <p className="text-sm text-slate-500">No stages yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {guide.stages.map((stage, index) => {
                const active = !addingStage && stage.key === selected;
                return (
                  <li key={stage.key} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingStage(false);
                        setSelected(stage.key);
                        setStageErrors([]);
                      }}
                      className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-left ${
                        active
                          ? "border-power-orange bg-orange-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-[10px] font-extrabold tracking-widest text-slate-400">
                        {String(stage.order).padStart(2, "0")}
                      </span>
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {stage.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {stage.ageRange}
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => void moveStage(index, -1)}
                        className="rounded border border-slate-200 p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={index === guide.stages.length - 1}
                        onClick={() => void moveStage(index, 1)}
                        className="rounded border border-slate-200 p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete stage"
                        onClick={() => void removeStage(stage.key, stage.name)}
                        className="rounded border border-slate-200 p-0.5 text-slate-400 hover:border-red-300 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <button
            type="button"
            onClick={() => {
              setAddingStage(true);
              setSelected(null);
              setStageErrors([]);
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add a stage
          </button>
        </Card>

        <Card variant="elevated">
          {editing ? (
            <StageEditor
              // Remounts when the author switches stage, so no draft can leak
              // from one stage into another.
              key={addingStage ? "__new__" : (selected as string)}
              stage={editing}
              isNew={addingStage}
              saving={stageSaving}
              errors={stageErrors}
              onSave={(stage) => void saveStage(stage)}
              {...(addingStage
                ? {
                    onCancel: () => {
                      setAddingStage(false);
                      setSelected(guide.stages[0]?.key ?? null);
                    },
                  }
                : {})}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Pick a stage on the left, or add the first one.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
