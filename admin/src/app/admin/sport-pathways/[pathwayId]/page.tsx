"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  adminApi,
  AdminPathwayCareer,
  AdminPathwayEquipment,
  AdminPathwayGovernmentScheme,
  AdminPathwayLevel,
  AdminSportPathway,
} from "@/modules/admin/services/admin";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { Card } from "@/modules/shared/ui/Card";
import { BadgeCheck, ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CATEGORIES = [
  "Ball Sports",
  "Racquet Sports",
  "Combat Sports",
  "Water Sports",
  "Winter Sports",
  "Team Sports",
  "Individual Sports",
  "Fitness",
  "Other",
];

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
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

function LevelEditor({
  level,
  onChange,
}: {
  level: AdminPathwayLevel;
  onChange: (level: AdminPathwayLevel) => void;
}) {
  const field = (key: keyof AdminPathwayLevel) => ({
    value: (level[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...level, [key]: e.target.value }),
  });

  // Helpers for updating nested objects without clobbering sibling keys
  const patch = (partial: Partial<AdminPathwayLevel>) => onChange({ ...level, ...partial });
  const benchmarks = level.benchmarks || {};
  const trialInfo = level.trialInfo || {};
  const injuryRisks = level.injuryRisks || {};
  const talentSignals = level.talentSignals || {};
  const coachGuide = level.coachSelectionGuide || {};
  const localResources = level.localResources || {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Label (short badge text)
          </label>
          <input {...field("label")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Age Range
          </label>
          <input {...field("ageRange")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Key Focus
          </label>
          <input {...field("keyFocus")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Governing Body
          </label>
          <input {...field("governingBody")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Title
        </label>
        <input {...field("title")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Description
        </label>
        <textarea rows={3} {...field("description")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Competitions
        </label>
        <textarea rows={2} {...field("competitions")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Key Objectives (Steps)
        </label>
        <StringListEditor
          items={level.steps || []}
          onChange={(steps) => onChange({ ...level, steps })}
          placeholder="Actionable step for the parent"
        />
      </div>

      <Section title="Performance Benchmarks">
        <div>
          <label className={labelCls}>Description</label>
          <textarea
            rows={2}
            value={benchmarks.description ?? ""}
            onChange={(e) => patch({ benchmarks: { ...benchmarks, description: e.target.value } })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Metrics (skill → target)</label>
          <div className="space-y-2">
            {(benchmarks.metrics || []).map((m, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={m.metric}
                  onChange={(e) => {
                    const next = [...(benchmarks.metrics || [])];
                    next[idx] = { ...m, metric: e.target.value };
                    patch({ benchmarks: { ...benchmarks, metrics: next } });
                  }}
                  placeholder="Metric (e.g. Sprint speed)"
                  className={inputCls}
                />
                <input
                  value={m.target}
                  onChange={(e) => {
                    const next = [...(benchmarks.metrics || [])];
                    next[idx] = { ...m, target: e.target.value };
                    patch({ benchmarks: { ...benchmarks, metrics: next } });
                  }}
                  placeholder="Target (e.g. 100m in 15s)"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      benchmarks: {
                        ...benchmarks,
                        metrics: (benchmarks.metrics || []).filter((_, i) => i !== idx),
                      },
                    })
                  }
                  className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch({
                  benchmarks: {
                    ...benchmarks,
                    metrics: [...(benchmarks.metrics || []), { metric: "", target: "" }],
                  },
                })
              }
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
            >
              <Plus size={14} /> Add metric
            </button>
          </div>
        </div>
      </Section>

      <Section title="Trial & Selection Info">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Typical Months</label>
            <input
              value={trialInfo.typicalMonths ?? ""}
              onChange={(e) => patch({ trialInfo: { ...trialInfo, typicalMonths: e.target.value } })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Eligibility Age</label>
            <input
              value={trialInfo.eligibilityAge ?? ""}
              onChange={(e) => patch({ trialInfo: { ...trialInfo, eligibilityAge: e.target.value } })}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Registration Process</label>
          <textarea
            rows={2}
            value={trialInfo.registrationProcess ?? ""}
            onChange={(e) => patch({ trialInfo: { ...trialInfo, registrationProcess: e.target.value } })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Selection Criteria</label>
          <StringListEditor
            items={trialInfo.selectionCriteria || []}
            onChange={(selectionCriteria) => patch({ trialInfo: { ...trialInfo, selectionCriteria } })}
            placeholder="What gets tested at trials"
          />
        </div>
        <div>
          <label className={labelCls}>Preparation Tips</label>
          <StringListEditor
            items={trialInfo.tips || []}
            onChange={(tips) => patch({ trialInfo: { ...trialInfo, tips } })}
            placeholder="Tip for parents preparing for trials"
          />
        </div>
      </Section>

      <Section title="Injury Risks & Prevention">
        <div>
          <label className={labelCls}>Common Injuries</label>
          <StringListEditor
            items={injuryRisks.commonInjuries || []}
            onChange={(commonInjuries) => patch({ injuryRisks: { ...injuryRisks, commonInjuries } })}
            placeholder="Common injury at this level"
          />
        </div>
        <div>
          <label className={labelCls}>Prevention Tips</label>
          <StringListEditor
            items={injuryRisks.preventionTips || []}
            onChange={(preventionTips) => patch({ injuryRisks: { ...injuryRisks, preventionTips } })}
            placeholder="Actionable prevention advice"
          />
        </div>
        <div>
          <label className={labelCls}>Warning Signs To Watch</label>
          <StringListEditor
            items={injuryRisks.warningSignsToWatch || []}
            onChange={(warningSignsToWatch) => patch({ injuryRisks: { ...injuryRisks, warningSignsToWatch } })}
            placeholder="Symptom a parent must not ignore"
          />
        </div>
      </Section>

      <Section title="Talent Signals">
        <div>
          <label className={labelCls}>Physical Markers</label>
          <StringListEditor
            items={talentSignals.physicalMarkers || []}
            onChange={(physicalMarkers) => patch({ talentSignals: { ...talentSignals, physicalMarkers } })}
            placeholder="Observable physical trait"
          />
        </div>
        <div>
          <label className={labelCls}>Cognitive Markers</label>
          <StringListEditor
            items={talentSignals.cognitiveMarkers || []}
            onChange={(cognitiveMarkers) => patch({ talentSignals: { ...talentSignals, cognitiveMarkers } })}
            placeholder="Mental/tactical aptitude sign"
          />
        </div>
        <div>
          <label className={labelCls}>Behavioral Markers</label>
          <StringListEditor
            items={talentSignals.behavioralMarkers || []}
            onChange={(behavioralMarkers) => patch({ talentSignals: { ...talentSignals, behavioralMarkers } })}
            placeholder="Character trait predicting success"
          />
        </div>
      </Section>

      <Section title="Mental Skills Focus">
        <StringListEditor
          items={level.mentalSkillsFocus || []}
          onChange={(mentalSkillsFocus) => patch({ mentalSkillsFocus })}
          placeholder="Mental skill to develop at this level"
        />
      </Section>

      <Section title="Coach Selection Guide">
        <div>
          <label className={labelCls}>Must Have</label>
          <StringListEditor
            items={coachGuide.mustHave || []}
            onChange={(mustHave) => patch({ coachSelectionGuide: { ...coachGuide, mustHave } })}
            placeholder="Non-negotiable coach qualification"
          />
        </div>
        <div>
          <label className={labelCls}>Nice To Have</label>
          <StringListEditor
            items={coachGuide.niceToHave || []}
            onChange={(niceToHave) => patch({ coachSelectionGuide: { ...coachGuide, niceToHave } })}
            placeholder="Desirable but not essential trait"
          />
        </div>
        <div>
          <label className={labelCls}>Red Flags</label>
          <StringListEditor
            items={coachGuide.redFlags || []}
            onChange={(redFlags) => patch({ coachSelectionGuide: { ...coachGuide, redFlags } })}
            placeholder="Warning sign of a bad coach"
          />
        </div>
        <div>
          <label className={labelCls}>Questions To Ask</label>
          <StringListEditor
            items={coachGuide.questionsToAsk || []}
            onChange={(questionsToAsk) => patch({ coachSelectionGuide: { ...coachGuide, questionsToAsk } })}
            placeholder="Interview question before hiring"
          />
        </div>
      </Section>

      <Section title="Government Schemes">
        <div className="space-y-3">
          {(level.governmentSchemes || []).map((scheme, idx) => {
            const updateScheme = (partial: Partial<AdminPathwayGovernmentScheme>) => {
              const next = [...(level.governmentSchemes || [])];
              next[idx] = { ...scheme, ...partial };
              patch({ governmentSchemes: next });
            };
            return (
              <div key={idx} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={scheme.name}
                    onChange={(e) => updateScheme({ name: e.target.value })}
                    placeholder="Scheme name (e.g. Khelo India)"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        governmentSchemes: (level.governmentSchemes || []).filter((_, i) => i !== idx),
                      })
                    }
                    className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-300 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={scheme.body}
                    onChange={(e) => updateScheme({ body: e.target.value })}
                    placeholder="Run by (e.g. SAI)"
                    className={inputCls}
                  />
                  <input
                    value={scheme.eligibility}
                    onChange={(e) => updateScheme({ eligibility: e.target.value })}
                    placeholder="Eligibility"
                    className={inputCls}
                  />
                  <input
                    value={scheme.benefit}
                    onChange={(e) => updateScheme({ benefit: e.target.value })}
                    placeholder="Benefit"
                    className={inputCls}
                  />
                  <input
                    value={scheme.howToApply}
                    onChange={(e) => updateScheme({ howToApply: e.target.value })}
                    placeholder="How to apply"
                    className={inputCls}
                  />
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() =>
              patch({
                governmentSchemes: [
                  ...(level.governmentSchemes || []),
                  { name: "", body: "", eligibility: "", benefit: "", howToApply: "" },
                ],
              })
            }
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
          >
            <Plus size={14} /> Add scheme
          </button>
        </div>
      </Section>

      <Section title="Local Resources">
        <div>
          <label className={labelCls}>Academies</label>
          <StringListEditor
            items={localResources.academies || []}
            onChange={(academies) => patch({ localResources: { ...localResources, academies } })}
            placeholder="Local academy name"
          />
        </div>
        <div>
          <label className={labelCls}>Facilities</label>
          <StringListEditor
            items={localResources.facilities || []}
            onChange={(facilities) => patch({ localResources: { ...localResources, facilities } })}
            placeholder="Training facility name"
          />
        </div>
        <div>
          <label className={labelCls}>Governing Bodies</label>
          <StringListEditor
            items={localResources.governingBodies || []}
            onChange={(governingBodies) => patch({ localResources: { ...localResources, governingBodies } })}
            placeholder="Local federation branch"
          />
        </div>
      </Section>

      <Section title="Academics & Documents">
        <div>
          <label className={labelCls}>Academic Integration Advice</label>
          <textarea
            rows={3}
            value={level.academicIntegration ?? ""}
            onChange={(e) => patch({ academicIntegration: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Documents To Collect Proactively</label>
          <StringListEditor
            items={level.proactiveDocuments || []}
            onChange={(proactiveDocuments) => patch({ proactiveDocuments })}
            placeholder="Document needed at a higher level"
          />
        </div>
      </Section>
    </div>
  );
}

function EquipmentEditor({
  items,
  onChange,
}: {
  items: AdminPathwayEquipment[];
  onChange: (items: AdminPathwayEquipment[]) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
          <input
            value={item.level}
            onChange={(e) => {
              const next = [...items];
              next[idx] = { ...item, level: e.target.value };
              onChange(next);
            }}
            placeholder="Tier (e.g. Beginner)"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            value={item.items.join(", ")}
            onChange={(e) => {
              const next = [...items];
              next[idx] = { ...item, items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
              onChange(next);
            }}
            placeholder="Items, comma-separated"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            value={item.estimatedCost}
            onChange={(e) => {
              const next = [...items];
              next[idx] = { ...item, estimatedCost: e.target.value };
              onChange(next);
            }}
            placeholder="Estimated cost"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { level: "", items: [], estimatedCost: "" }])}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
      >
        <Plus size={14} /> Add equipment tier
      </button>
    </div>
  );
}

function CareersEditor({
  items,
  onChange,
}: {
  items: AdminPathwayCareer[];
  onChange: (items: AdminPathwayCareer[]) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
          <input
            value={item.role}
            onChange={(e) => {
              const next = [...items];
              next[idx] = { ...item, role: e.target.value };
              onChange(next);
            }}
            placeholder="Role (e.g. Coach)"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            value={item.description}
            onChange={(e) => {
              const next = [...items];
              next[idx] = { ...item, description: e.target.value };
              onChange(next);
            }}
            placeholder="Description"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            value={item.demand}
            onChange={(e) => {
              const next = [...items];
              next[idx] = { ...item, demand: e.target.value };
              onChange(next);
            }}
            placeholder="Demand (e.g. High)"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { role: "", description: "", demand: "" }])}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
      >
        <Plus size={14} /> Add career path
      </button>
    </div>
  );
}

export default function AdminSportPathwayEditPage() {
  const params = useParams();
  const router = useRouter();
  const pathwayId = params?.pathwayId as string;

  const [pathway, setPathway] = useState<AdminSportPathway | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeLevel, setActiveLevel] = useState(0);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Editable draft state
  const [overview, setOverview] = useState("");
  const [category, setCategory] = useState("Other");
  const [levels, setLevels] = useState<AdminPathwayLevel[]>([]);
  const [equipment, setEquipment] = useState<AdminPathwayEquipment[]>([]);
  const [careers, setCareers] = useState<AdminPathwayCareer[]>([]);

  useEffect(() => {
    if (!pathwayId) return;
    (async () => {
      setLoading(true);
      try {
        const response = await adminApi.getPathwayById(pathwayId);
        if (response.success && response.data) {
          const p = response.data;
          setPathway(p);
          setOverview(p.overview || "");
          setCategory(p.category || "Other");
          setLevels(p.levels || []);
          setEquipment(p.equipment || []);
          setCareers(p.careers || []);
        } else {
          setError(response.message || "Failed to load pathway.");
        }
      } catch (err) {
        console.error("Failed to load pathway:", err);
        setError("Failed to load pathway.");
      } finally {
        setLoading(false);
      }
    })();
  }, [pathwayId]);

  const handleSave = async () => {
    if (!pathway) return;
    setSaving(true);
    try {
      const response = await adminApi.updatePathway(pathway._id, {
        overview,
        category,
        levels,
        equipment,
        careers,
      });
      if (response.success && response.data) {
        setPathway(response.data);
        toast.success("Pathway updated successfully.");
      } else {
        toast.error(response.message || "Failed to save changes.");
      }
    } catch (err) {
      console.error("Failed to save pathway:", err);
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyToggle = async () => {
    if (!pathway) return;
    setVerifyLoading(true);
    try {
      const nextVerified = !pathway.isVerified;
      const response = await adminApi.setPathwayVerified(pathway._id, nextVerified);
      if (response.success && response.data) {
        setPathway(response.data);
        toast.success(nextVerified ? "Pathway marked as verified." : "Verification removed.");
      }
    } catch (err) {
      console.error("Failed to update verification status:", err);
      toast.error("Failed to update verification status.");
    } finally {
      setVerifyLoading(false);
      setConfirmVerify(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading pathway...</div>;
  }

  if (error || !pathway) {
    return (
      <Card className="bg-white">
        <div className="py-10 text-center space-y-3">
          <p className="text-red-600 font-semibold">{error || "Pathway not found."}</p>
          <Link href="/admin/sport-pathways" className="text-power-orange font-semibold">
            Back to Sport Pathways
          </Link>
        </div>
      </Card>
    );
  }

  const verifierName =
    typeof pathway.verifiedBy === "object" ? pathway.verifiedBy?.name || pathway.verifiedBy?.email : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title={pathway.sportName}
        subtitle="Edit pathway content, then mark it verified once you've checked it against a sport expert's input."
        action={
          <Link
            href="/admin/sport-pathways"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={16} /> Back to list
          </Link>
        }
      />

      <Card className="bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {pathway.isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                <BadgeCheck size={14} /> Verified
                {pathway.verifiedAt && ` on ${new Date(pathway.verifiedAt).toLocaleDateString()}`}
                {verifierName ? ` by ${verifierName}` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                Unverified — AI-generated, pending expert review
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmVerify(true)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                pathway.isVerified
                  ? "border border-red-300 text-red-700 hover:bg-red-50"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {pathway.isVerified ? "Remove Verification" : "Mark as Verified"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Card>

      <Card className="bg-white space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Overview</h2>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-auto"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sport Overview
          </label>
          <textarea
            rows={3}
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </Card>

      <Card className="bg-white space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Levels</h2>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          {levels.map((lv, idx) => (
            <button
              key={idx}
              onClick={() => setActiveLevel(idx)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeLevel === idx
                  ? "bg-power-orange text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Level {lv.level}: {lv.label}
            </button>
          ))}
        </div>
        {levels[activeLevel] && (
          <LevelEditor
            level={levels[activeLevel]}
            onChange={(updated) => {
              const next = [...levels];
              next[activeLevel] = updated;
              setLevels(next);
            }}
          />
        )}
      </Card>

      <Card className="bg-white space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Equipment</h2>
        <EquipmentEditor items={equipment} onChange={setEquipment} />
      </Card>

      <Card className="bg-white space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Career Paths</h2>
        <CareersEditor items={careers} onChange={setCareers} />
      </Card>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <ConfirmModal
        open={confirmVerify}
        title={pathway.isVerified ? "Remove verification?" : "Mark pathway as verified?"}
        description={
          pathway.isVerified
            ? `${pathway.sportName} will show as unverified and become eligible for automatic AI refresh again.`
            : `${pathway.sportName} will show a "Verified by Expert" badge to parents and be protected from automatic AI refresh. Make sure you've saved your edits first.`
        }
        confirmLabel={pathway.isVerified ? "Unverify" : "Verify"}
        variant={pathway.isVerified ? "danger" : "default"}
        onConfirm={handleVerifyToggle}
        onCancel={() => setConfirmVerify(false)}
        loading={verifyLoading}
      />
    </div>
  );
}
