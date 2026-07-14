"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { INDIAN_STATES } from "@/modules/guidance/constants";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileEditPanel } from "@/modules/player/components/ProfileEditPanel";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import {
    DEFAULT_DEPENDENT_RELATION,
    DEPENDENT_RELATIONS,
    normalizeDependentRelation,
} from "@/modules/player/constants/dependentRelations";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { ArrowRight, Calendar, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Dependent {
  _id?: string;
  name: string;
  dob: string | Date;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sportsFocus?: string[];
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
  heightCm?: number;
  weightKg?: number;
  medicalConditions?: string[];
  // Wizard fields (read-only in modal, editable only via /pathway)
  build?: "lean" | "average" | "stocky";
  heightCategory?: "short" | "average" | "tall";
  energyType?: "explosive" | "endurance";
  motorType?: "gross" | "fine";
  visualTracking?: "strong" | "moderate" | "weak";
  teamIndividual?: number;
  competitiveResponse?: "fired-up" | "calm" | "discouraged";
  focusStyle?: "bursts" | "sustained";
  decisionStyle?: "react" | "strategic";
  pressureResponse?: "thrives" | "manages" | "avoids";
  repetitionTolerance?: "high" | "low";
  contactComfort?: "loves" | "neutral" | "avoids";
  environment?: "outdoor" | "indoor" | "no-preference";
  waterComfort?: "comfortable" | "neutral" | "uncomfortable";
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  ambition?: "fun" | "competitive" | "national" | "professional";
  sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
  wizardCompletedAt?: string;
}

interface DependentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Dependent) => Promise<void>;
  initialDependent?: Dependent | null;
  isLoading?: boolean;
  mode: "add" | "edit";
}

const EMPTY_FORM: Dependent = {
  name: "",
  dob: "",
  gender: "MALE",
  relation: DEFAULT_DEPENDENT_RELATION,
  sportsFocus: [],
  personalityTags: [],
  primaryObjective: "Recreational",
  weeklyTimeCommitment: 3,
  budgetTier: "Moderate",
  location: "",
  heightCm: undefined,
  weightKg: undefined,
  medicalConditions: [],
};

const AMBITION_LABELS: Record<string, string> = {
  fun: "Plays for fun",
  competitive: "Competitive",
  national: "National-level goal",
  professional: "Professional pathway",
};
const ENERGY_LABELS: Record<string, string> = {
  explosive: "Explosive energy",
  endurance: "Endurance type",
};
const FOCUS_LABELS: Record<string, string> = {
  bursts: "Focuses in bursts",
  sustained: "Sustained focus",
};
const DECISION_LABELS: Record<string, string> = {
  react: "Instinctive player",
  strategic: "Strategic thinker",
};
const PRESSURE_LABELS: Record<string, string> = {
  thrives: "Thrives under pressure",
  manages: "Manages pressure",
  avoids: "Prefers low pressure",
};
const CONTACT_LABELS: Record<string, string> = {
  loves: "Contact OK",
  neutral: "Neutral on contact",
  avoids: "Avoids contact",
};
const ENV_LABELS: Record<string, string> = {
  outdoor: "Prefers outdoors",
  indoor: "Prefers indoors",
  "no-preference": "Any environment",
};
const BUILD_LABELS: Record<string, string> = {
  lean: "Lean build",
  average: "Average build",
  stocky: "Strong build",
};
const HEIGHT_LABELS: Record<string, string> = {
  short: "Compact for age",
  average: "Average height",
  tall: "Tall for age",
};

function chip(val: string | undefined, map: Record<string, string>) {
  return val ? map[val] ?? null : null;
}

function getDependentAge(dob: string | Date): number | null {
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

function WizardResultsCard({
  dep,
  onRetake,
}: {
  dep: Dependent;
  onRetake: () => void;
}) {
  if (!dep.wizardCompletedAt) {
    return (
      <div className="rounded-xl border border-dashed border-power-orange/40 bg-orange-50/60 p-4">
        <p className="text-sm font-bold text-slate-800 mb-0.5">
          Complete the pathway assessment
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-3">
          Get personalised sport picks based on personality, physical traits, and
          ambition — takes about 5 minutes.
        </p>
        <a
          href="/pathway"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-power-orange hover:text-orange-600 transition-colors"
        >
          Start assessment <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  const traitChips = [
    chip(dep.energyType, ENERGY_LABELS),
    chip(dep.ambition, AMBITION_LABELS),
    chip(dep.focusStyle, FOCUS_LABELS),
    chip(dep.decisionStyle, DECISION_LABELS),
    chip(dep.pressureResponse, PRESSURE_LABELS),
    chip(dep.contactComfort, CONTACT_LABELS),
    chip(dep.environment, ENV_LABELS),
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4">
      {/* Sport matches */}
      {(dep.sportMatches?.length ?? 0) > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Assessment picks
          </p>
          <div className="space-y-2">
            {dep.sportMatches!.map((m, i) => (
              <div
                key={m.sport}
                className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      i === 0
                        ? "bg-turf-green text-white"
                        : i === 1
                          ? "bg-slate-200 text-slate-600"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {m.sport}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${i === 0 ? "text-turf-green" : "text-slate-400"}`}
                  >
                    {m.fitLabel}
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-300">
                    {m.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Physical + personality snapshot */}
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Profile snapshot
        </p>
        <div className="flex flex-wrap gap-1.5">
          {dep.heightCm && dep.weightKg && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              {dep.heightCm} cm · {dep.weightKg} kg
            </span>
          )}
          {dep.heightCategory && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-600">
              {HEIGHT_LABELS[dep.heightCategory]}
            </span>
          )}
          {dep.build && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-600">
              {BUILD_LABELS[dep.build]}
            </span>
          )}
          {traitChips.map((label) => (
            <span
              key={label}
              className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] text-blue-600"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onRetake}
        className="text-xs text-slate-400 transition-colors hover:text-power-orange"
      >
        Retake assessment →
      </button>
    </div>
  );
}

export default function DependentManagementModal({
  isOpen,
  onClose,
  onSubmit,
  initialDependent,
  isLoading = false,
  mode,
}: DependentManagementModalProps) {
  const [formData, setFormData] = useState<Dependent>(EMPTY_FORM);

  const maxDob = useMemo(() => new Date().toISOString().split("T")[0], []);
  const minDob = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (initialDependent) {
      const dobValue = initialDependent.dob
        ? new Date(initialDependent.dob).toISOString().split("T")[0]
        : "";
      setFormData({
        ...initialDependent,
        dob: dobValue,
        relation: normalizeDependentRelation(initialDependent.relation),
      });
      return;
    }
    setFormData(EMPTY_FORM);
  }, [isOpen, initialDependent]);

  const handleChange = (field: keyof Dependent, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.dob) {
      toast.error("Date of birth is required");
      return;
    }
    const age = getDependentAge(formData.dob);
    if (age === null) {
      toast.error("Please enter a valid date of birth");
      return;
    }
    if (age >= 18) {
      toast.error("Dependents must be under 18 years old");
      return;
    }
    try {
      await onSubmit(formData);
      setFormData(EMPTY_FORM);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save dependent";
      toast.error(message);
    }
  };

  const previewAge = formData.dob ? getDependentAge(formData.dob) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === "add"
          ? "Add Dependent"
          : `Edit ${formData.name || "Dependent"}`
      }
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="dependent-form"
            loading={isLoading}
            className="w-full sm:min-w-[140px] sm:w-auto"
          >
            {mode === "add" ? "Add Dependent" : "Save Changes"}
          </Button>
        </div>
      }
    >
      <form id="dependent-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Wizard assessment — read-only display or CTA */}
        <WizardResultsCard
          dep={formData}
          onRetake={() => {
            onClose();
            window.location.href = "/pathway";
          }}
        />

        {/* Basic details — required for bookings */}
        <ProfileEditPanel
          title="Basic Details"
          description={
            mode === "add"
              ? "Add a child or ward you manage bookings for. Must be under 18."
              : "Update this dependent's details and save when done."
          }
        >
          <div className="space-y-4">
            <ProfileEditField
              label="Name"
              htmlFor="dep-name"
              required
              icon={UserRound}
            >
              <Input
                id="dep-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g., Riya Sharma"
                autoComplete="name"
              />
            </ProfileEditField>

            <ProfileEditField
              label="Date of Birth"
              htmlFor="dep-dob"
              required
              icon={Calendar}
              hint={
                previewAge !== null
                  ? `Age: ${previewAge} years · Must be under 18.`
                  : "Must be under 18 years old."
              }
            >
              <Input
                id="dep-dob"
                type="date"
                value={formData.dob as string}
                onChange={(e) => handleChange("dob", e.target.value)}
                min={minDob}
                max={maxDob}
              />
            </ProfileEditField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileEditField label="Gender" htmlFor="dep-gender">
                <ProfileFormSelect
                  id="dep-gender"
                  value={formData.gender || "MALE"}
                  onChange={(value) => handleChange("gender", value)}
                  options={[
                    { value: "MALE", label: "Male" },
                    { value: "FEMALE", label: "Female" },
                    { value: "OTHER", label: "Other" },
                  ]}
                />
              </ProfileEditField>

              <ProfileEditField label="Relation" htmlFor="dep-relation" required>
                <ProfileFormSelect
                  id="dep-relation"
                  value={formData.relation || DEFAULT_DEPENDENT_RELATION}
                  onChange={(value) => handleChange("relation", value)}
                  options={DEPENDENT_RELATIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                />
              </ProfileEditField>
            </div>

            <ProfileEditField
              label="Medical conditions / physical limitations"
              hint="Optional — helps avoid unsuitable sports"
            >
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="e.g., Asthma — press Enter to add"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (
                        val &&
                        !formData.medicalConditions?.includes(val)
                      ) {
                        handleChange("medicalConditions", [
                          ...(formData.medicalConditions || []),
                          val,
                        ]);
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
                {(formData.medicalConditions?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.medicalConditions?.map((cond) => (
                      <span
                        key={cond}
                        className="flex items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700"
                      >
                        {cond}
                        <button
                          type="button"
                          onClick={() =>
                            handleChange(
                              "medicalConditions",
                              formData.medicalConditions?.filter(
                                (c) => c !== cond,
                              ),
                            )
                          }
                          className="ml-0.5 text-orange-400 hover:text-orange-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </ProfileEditField>
          </div>
        </ProfileEditPanel>

        {/* Sports & preferences — supplements the wizard */}
        <ProfileEditPanel
          title="Sports & Preferences"
          description="Optional — supplements the pathway assessment data."
        >
          <div className="space-y-4">
            <ProfileEditField label="Sports">
              <SportsMultiSelect
                value={formData.sportsFocus || []}
                onChange={(sports) => handleChange("sportsFocus", sports)}
              />
            </ProfileEditField>

            {(formData.sportsFocus?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.sportsFocus?.map((sport) => (
                  <Badge
                    key={sport}
                    className="border-orange-200 bg-white text-orange-700 hover:bg-white"
                  >
                    {sport}
                  </Badge>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileEditField
                label="State / UT"
                htmlFor="dep-location"
                hint="For local resource recommendations"
              >
                <ProfileFormSelect
                  id="dep-location"
                  value={formData.location || ""}
                  onChange={(value) => handleChange("location", value)}
                  options={[
                    { value: "", label: "— Select state —" },
                    ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
                  ]}
                />
              </ProfileEditField>

              <ProfileEditField
                label="Primary Objective"
                htmlFor="dep-objective"
              >
                <ProfileFormSelect
                  id="dep-objective"
                  value={formData.primaryObjective || "Recreational"}
                  onChange={(value) => handleChange("primaryObjective", value)}
                  options={[
                    { value: "Recreational", label: "Recreational" },
                    { value: "Fitness", label: "Fitness" },
                    { value: "Compete", label: "Compete" },
                  ]}
                />
              </ProfileEditField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ProfileEditField
                label="Height (cm)"
                htmlFor="dep-height"
                hint="Improves sport matching"
              >
                <Input
                  id="dep-height"
                  type="number"
                  min="50"
                  max="250"
                  placeholder="e.g., 135"
                  value={formData.heightCm ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "heightCm",
                      e.target.value === ""
                        ? undefined
                        : parseFloat(e.target.value),
                    )
                  }
                />
              </ProfileEditField>

              <ProfileEditField
                label="Weight (kg)"
                htmlFor="dep-weight"
                hint="Improves sport matching"
              >
                <Input
                  id="dep-weight"
                  type="number"
                  min="10"
                  max="200"
                  placeholder="e.g., 32"
                  value={formData.weightKg ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "weightKg",
                      e.target.value === ""
                        ? undefined
                        : parseFloat(e.target.value),
                    )
                  }
                />
              </ProfileEditField>
            </div>
          </div>
        </ProfileEditPanel>
      </form>
    </Modal>
  );
}
