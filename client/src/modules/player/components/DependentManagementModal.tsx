"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { INDIAN_STATES } from "@/modules/guidance/constants";
import { BinaryCards } from "@/modules/pathway/components/inputs/BinaryCards";
import { FourContextCards } from "@/modules/pathway/components/inputs/FourContextCards";
import { SpectrumSlider } from "@/modules/pathway/components/inputs/SpectrumSlider";
import { ThreeOptionCards } from "@/modules/pathway/components/inputs/ThreeOptionCards";
import {
  buildDependentPayload,
  cmToFeetInches,
  dependentToWizardAnswers,
  deriveBuild,
  deriveHeightCategoryFromCm,
  hasWizardSignal,
} from "@/modules/pathway/utils/dependentMapping";
import { scoreSports } from "@/modules/pathway/utils/scorer";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import {
  DEFAULT_DEPENDENT_RELATION,
  DEPENDENT_RELATIONS,
  normalizeDependentRelation,
} from "@/modules/player/constants/dependentRelations";
import {
  AGILITY_LABELS,
  BUILD_LABELS,
  COMPETITIVE_RESPONSE_LABELS,
  CONTACT_LABELS,
  ENV_LABELS,
  EYESIGHT_LABELS,
  HEIGHT_LABELS,
  MATCH_RANK_META,
  PRESSURE_LABELS,
  VISUAL_TRACKING_LABELS,
  WATER_COMFORT_LABELS,
} from "@/modules/player/constants/wizardLabels";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import type { Dependent } from "@/types";
import { Calendar, ChevronRight, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DependentFormData = Omit<Dependent, "dob"> & { dob: string | Date };

interface DependentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Dependent) => Promise<void>;
  initialDependent?: Dependent | null;
  isLoading?: boolean;
  mode: "add" | "edit";
}

const EMPTY_FORM: DependentFormData = {
  name: "",
  dob: "",
  gender: "MALE",
  relation: DEFAULT_DEPENDENT_RELATION,
  sportsFocus: [],
  location: "",
  heightCm: undefined,
  weightKg: undefined,
  medicalConditions: [],
};

const STEPS = [
  { id: "about",       title: "About the child",       sub: "Name, age, and key details",                      required: true  },
  { id: "sport",       title: "Sport & setup",          sub: "What they play and where they're based",          required: false },
  { id: "goals",       title: "Goals & commitment",     sub: "Ambition, time, and budget",                      required: false },
  { id: "physical",    title: "Physical traits",        sub: "Body type, energy, and motor skills — optional",  required: false },
  { id: "personality", title: "Mind & play style",      sub: "How they think and compete — optional",           required: false },
  { id: "environment", title: "Environment & senses",   sub: "Preferences and sensory profile — optional",      required: false },
] as const;

const stepVariants = {
  enter: (d: number) => ({ opacity: 0, x: d * 32 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -32 }),
};

export default function DependentManagementModal({
  isOpen,
  onClose,
  onSubmit,
  initialDependent,
  isLoading = false,
  mode,
}: DependentManagementModalProps) {
  const [formData, setFormData] = useState<DependentFormData>(EMPTY_FORM);
  const [stepIndex, setStepIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);

  const maxDob = useMemo(() => new Date().toISOString().split("T")[0], []);
  const minDob = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
    setDir(1);
    if (initialDependent) {
      setFormData({
        ...initialDependent,
        dob: initialDependent.dob
          ? new Date(initialDependent.dob).toISOString().split("T")[0]
          : "",
        relation: normalizeDependentRelation(initialDependent.relation),
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [isOpen, initialDependent]);

  const handleChange = (field: keyof DependentFormData, value: unknown) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const previewAge = formData.dob ? getDependentAge(formData.dob) : null;
  const childLabel = formData.name || "your child";
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (stepIndex === 0) {
      if (!formData.name.trim()) { toast.error("Name is required"); return; }
      if (!formData.dob)         { toast.error("Date of birth is required"); return; }
      const age = getDependentAge(formData.dob);
      if (age === null)  { toast.error("Enter a valid date of birth"); return; }
      if (age >= 18)     { toast.error("Must be under 18 years old"); return; }
    }
    setDir(1);
    setStepIndex((i) => i + 1);
  };

  const handleBack = () => {
    setDir(-1);
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("Name is required"); setStepIndex(0); return; }
    if (!formData.dob)         { toast.error("Date of birth is required"); setStepIndex(0); return; }
    const age = getDependentAge(formData.dob);
    if (age === null)  { toast.error("Please enter a valid date of birth"); setStepIndex(0); return; }
    if (age >= 18)     { toast.error("Dependents must be under 18 years old"); setStepIndex(0); return; }

    let submitData: DependentFormData = formData;
    const sportIsKnown = (formData.sportsFocus?.length ?? 0) > 0;
    if (!sportIsKnown && hasWizardSignal(formData, age)) {
      const answers = dependentToWizardAnswers(formData, formData.name, age);
      const scored  = scoreSports(answers);
      const derived = buildDependentPayload(answers, scored, formData.name);
      submitData = {
        ...formData, ...derived,
        dob: formData.dob, relation: formData.relation,
        medicalConditions: formData.medicalConditions, _id: formData._id,
      };
    }

    try {
      await onSubmit(submitData as Dependent);
      setFormData(EMPTY_FORM);
      setStepIndex(0);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    }
  };

  const step0CanAdvance = formData.name.trim().length > 0 && !!formData.dob;
  const currentStep = STEPS[stepIndex];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "add" ? "Add Child Profile" : `Edit ${formData.name || "Profile"}`}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={handleBack} disabled={isLoading}>
            {stepIndex === 0 ? "Cancel" : "Back"}
          </Button>
          {isLastStep ? (
            <Button type="submit" form="dependent-form" loading={isLoading} className="min-w-[140px]">
              {mode === "add" ? "Save profile" : "Save changes"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={stepIndex === 0 && !step0CanAdvance}
              className="inline-flex items-center gap-2"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      }
    >
      <form id="dependent-form" onSubmit={handleSubmit}>
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            {!currentStep.required && (
              <span className="text-[11px] text-slate-400">Optional — skip if you like</span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-power-orange transition-all duration-500"
              style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">{currentStep.title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{currentStep.sub}</p>
        </div>

        {/* Animated step content */}
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={stepIndex}
            custom={dir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="space-y-5"
          >

            {/* ── Step 0: About ─────────────────────────────────────────────────── */}
            {stepIndex === 0 && (
              <>
                <ProfileEditField label="Name" htmlFor="dep-name" required icon={UserRound}>
                  <Input
                    id="dep-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="e.g., Riya Sharma"
                    autoComplete="name"
                    autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                  />
                </ProfileEditField>

                <ProfileEditField
                  label="Date of birth"
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

                <ProfileEditField label="Gender">
                  <BinaryCards
                    options={[
                      { value: "MALE", title: "Boy", sub: "" },
                      { value: "FEMALE", title: "Girl", sub: "" },
                    ]}
                    value={formData.gender === "OTHER" ? null : (formData.gender ?? null)}
                    onChange={(v) => handleChange("gender", v)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleChange("gender", formData.gender === "OTHER" ? "MALE" : "OTHER")
                    }
                    className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {formData.gender === "OTHER"
                      ? "✓ Marked as Other / prefer not to say"
                      : "Other / prefer not to say"}
                  </button>
                </ProfileEditField>

                <ProfileEditField label="Relation" htmlFor="dep-relation" required>
                  <ProfileFormSelect
                    id="dep-relation"
                    value={formData.relation || DEFAULT_DEPENDENT_RELATION}
                    onChange={(v) => handleChange("relation", v)}
                    options={DEPENDENT_RELATIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </ProfileEditField>
              </>
            )}

            {/* ── Step 1: Sport & Setup ─────────────────────────────────────────── */}
            {stepIndex === 1 && (
              <>
                <ProfileEditField label="Sports">
                  <SportsMultiSelect
                    value={formData.sportsFocus || []}
                    onChange={(sports) => handleChange("sportsFocus", sports)}
                  />
                </ProfileEditField>

                <ProfileEditField label="State / UT" htmlFor="dep-location" hint="For local resource recommendations">
                  <ProfileFormSelect
                    id="dep-location"
                    value={formData.location || ""}
                    onChange={(v) => handleChange("location", v)}
                    options={[
                      { value: "", label: "— Select state —" },
                      ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
                    ]}
                  />
                </ProfileEditField>

                <ProfileEditField label="Current level">
                  <ThreeOptionCards
                    options={[
                      { value: "beginner",     label: "Beginner — city / neighbourhood, just getting started" },
                      { value: "intermediate", label: "Intermediate — school, club or district level" },
                      { value: "competitive",  label: "Competitive — state or national level" },
                    ]}
                    value={formData.experienceLevel ?? null}
                    onChange={(v) => handleChange("experienceLevel", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Training setup">
                  <FourContextCards
                    options={[
                      { value: "self",    label: "Self-practice",    context: "Home or local grounds, no formal coaching" },
                      { value: "club",    label: "School / Club",    context: "Group coaching at school or local club" },
                      { value: "academy", label: "Academy",          context: "Enrolled in a structured programme" },
                      { value: "private", label: "Private coaching", context: "One-on-one with a dedicated coach" },
                    ]}
                    value={formData.trainingType ?? null}
                    onChange={(v) => handleChange("trainingType", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Medical conditions / limitations" hint="Optional — helps avoid unsuitable sports">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="e.g., Asthma — press Enter to add"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !formData.medicalConditions?.includes(val)) {
                            handleChange("medicalConditions", [...(formData.medicalConditions || []), val]);
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
                                handleChange("medicalConditions", formData.medicalConditions?.filter((c) => c !== cond))
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
              </>
            )}

            {/* ── Step 2: Goals ─────────────────────────────────────────────────── */}
            {stepIndex === 2 && (
              <>
                <ProfileEditField label="Ambition">
                  <FourContextCards
                    options={[
                      { value: "fun",          label: "Just for fun",       context: "Recreational, no pressure" },
                      { value: "competitive",  label: "Competitive",        context: "District / state-level tournaments" },
                      { value: "national",     label: "National-level goal", context: "Serious training commitment" },
                      { value: "professional", label: "Professional",        context: "Elite, career-track training" },
                    ]}
                    value={formData.ambition ?? null}
                    onChange={(v) => handleChange("ambition", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Weekly time commitment">
                  <FourContextCards
                    options={[
                      { value: "1-3",      label: "1–3 hrs/week",  context: "Light, casual commitment" },
                      { value: "4-7",      label: "4–7 hrs/week",  context: "Regular weekly practice" },
                      { value: "8-12",     label: "8–12 hrs/week", context: "Serious, structured training" },
                      { value: "13-plus",  label: "13+ hrs/week",  context: "High-performance schedule" },
                    ]}
                    value={formData.weeklyHoursCategory ?? null}
                    onChange={(v) => handleChange("weeklyHoursCategory", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Monthly training budget">
                  <FourContextCards
                    options={[
                      { value: "under-3k", label: "Under ₹3,000",     context: "Community programs, school teams" },
                      { value: "3k-7k",    label: "₹3,000 – 7,000",   context: "Local academies, group coaching" },
                      { value: "7k-15k",   label: "₹7,000 – 15,000",  context: "Structured academy training" },
                      { value: "15k-plus", label: "₹15,000+",          context: "Elite academies, personal coaching" },
                    ]}
                    value={formData.budgetRange ?? null}
                    onChange={(v) => handleChange("budgetRange", v)}
                  />
                </ProfileEditField>
              </>
            )}

            {/* ── Step 3: Physical ──────────────────────────────────────────────── */}
            {stepIndex === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <ProfileEditField label="Height (cm)" htmlFor="dep-height">
                    <Input
                      id="dep-height"
                      type="number"
                      min="50"
                      max="250"
                      placeholder="e.g., 135"
                      value={formData.heightCm ?? ""}
                      onChange={(e) =>
                        handleChange("heightCm", e.target.value === "" ? undefined : parseFloat(e.target.value))
                      }
                    />
                  </ProfileEditField>

                  <ProfileEditField label="Weight (kg)" htmlFor="dep-weight">
                    <Input
                      id="dep-weight"
                      type="number"
                      min="10"
                      max="200"
                      placeholder="e.g., 32"
                      value={formData.weightKg ?? ""}
                      onChange={(e) =>
                        handleChange("weightKg", e.target.value === "" ? undefined : parseFloat(e.target.value))
                      }
                    />
                  </ProfileEditField>
                </div>

                {formData.heightCm && formData.weightKg && (
                  <p className="text-xs text-slate-500">
                    {cmToFeetInches(formData.heightCm)} ·{" "}
                    {BUILD_LABELS[deriveBuild(formData.weightKg, formData.heightCm)]}
                    {previewAge !== null &&
                      ` · ${HEIGHT_LABELS[deriveHeightCategoryFromCm(formData.heightCm, previewAge)]}`}
                  </p>
                )}

                <ProfileEditField label="Energy type">
                  <BinaryCards
                    options={[
                      { value: "explosive", title: "Explosive", sub: "Short bursts of intense power" },
                      { value: "endurance", title: "Endurance", sub: "Sustains effort over long periods" },
                    ]}
                    value={formData.energyType ?? null}
                    onChange={(v) => handleChange("energyType", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Motor skill type">
                  <BinaryCards
                    options={[
                      { value: "gross", title: "Gross motor", sub: "Big, powerful whole-body movements" },
                      { value: "fine",  title: "Fine motor",  sub: "Precise, small-muscle control" },
                    ]}
                    value={formData.motorType ?? null}
                    onChange={(v) => handleChange("motorType", v)}
                  />
                </ProfileEditField>
              </>
            )}

            {/* ── Step 4: Personality ───────────────────────────────────────────── */}
            {stepIndex === 4 && (
              <>
                <ProfileEditField label={`How does ${childLabel} prefer to play?`}>
                  <SpectrumSlider
                    value={formData.teamIndividual ?? null}
                    onChange={(v) => handleChange("teamIndividual", v)}
                    leftLabel="Individual"
                    rightLabel="Team"
                    leftExamples="Tennis, gymnastics, athletics, chess"
                    rightExamples="Football, basketball, volleyball, kabaddi"
                  />
                </ProfileEditField>

                <ProfileEditField label="Response to competition">
                  <ThreeOptionCards
                    options={[
                      { value: "fired-up",   label: COMPETITIVE_RESPONSE_LABELS["fired-up"] },
                      { value: "calm",        label: COMPETITIVE_RESPONSE_LABELS.calm },
                      { value: "discouraged", label: COMPETITIVE_RESPONSE_LABELS.discouraged },
                    ]}
                    value={formData.competitiveResponse ?? null}
                    onChange={(v) => handleChange("competitiveResponse", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Focus style">
                  <BinaryCards
                    options={[
                      { value: "bursts",    title: "Bursts",    sub: "Sharp focus in short stretches" },
                      { value: "sustained", title: "Sustained", sub: "Stays locked in for long periods" },
                    ]}
                    value={formData.focusStyle ?? null}
                    onChange={(v) => handleChange("focusStyle", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Decision style">
                  <BinaryCards
                    options={[
                      { value: "react",     title: "Instinctive", sub: "Reacts fast, trusts the first read" },
                      { value: "strategic", title: "Strategic",   sub: "Plans ahead before acting" },
                    ]}
                    value={formData.decisionStyle ?? null}
                    onChange={(v) => handleChange("decisionStyle", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Response to pressure">
                  <ThreeOptionCards
                    options={[
                      { value: "thrives", label: PRESSURE_LABELS.thrives },
                      { value: "manages", label: PRESSURE_LABELS.manages },
                      { value: "avoids",  label: PRESSURE_LABELS.avoids  },
                    ]}
                    value={formData.pressureResponse ?? null}
                    onChange={(v) => handleChange("pressureResponse", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Repetition tolerance">
                  <BinaryCards
                    options={[
                      { value: "high", title: "High tolerance",  sub: "Enjoys repeated drilling of the same skill" },
                      { value: "low",  title: "Prefers variety", sub: "Gets bored with repetitive practice" },
                    ]}
                    value={formData.repetitionTolerance ?? null}
                    onChange={(v) => handleChange("repetitionTolerance", v)}
                  />
                </ProfileEditField>
              </>
            )}

            {/* ── Step 5: Environment & Senses ──────────────────────────────────── */}
            {stepIndex === 5 && (
              <>
                <ProfileEditField label="Contact comfort">
                  <ThreeOptionCards
                    options={[
                      { value: "loves",   label: CONTACT_LABELS.loves   },
                      { value: "neutral", label: CONTACT_LABELS.neutral  },
                      { value: "avoids",  label: CONTACT_LABELS.avoids   },
                    ]}
                    value={formData.contactComfort ?? null}
                    onChange={(v) => handleChange("contactComfort", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Environment preference">
                  <ThreeOptionCards
                    options={[
                      { value: "outdoor",        label: ENV_LABELS.outdoor         },
                      { value: "indoor",         label: ENV_LABELS.indoor          },
                      { value: "no-preference",  label: ENV_LABELS["no-preference"] },
                    ]}
                    value={formData.environment ?? null}
                    onChange={(v) => handleChange("environment", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Water comfort">
                  <ThreeOptionCards
                    options={[
                      { value: "comfortable",   label: WATER_COMFORT_LABELS.comfortable   },
                      { value: "neutral",        label: WATER_COMFORT_LABELS.neutral        },
                      { value: "uncomfortable",  label: WATER_COMFORT_LABELS.uncomfortable  },
                    ]}
                    value={formData.waterComfort ?? null}
                    onChange={(v) => handleChange("waterComfort", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Visual tracking">
                  <ThreeOptionCards
                    options={[
                      { value: "strong",   label: VISUAL_TRACKING_LABELS.strong   },
                      { value: "moderate", label: VISUAL_TRACKING_LABELS.moderate  },
                      { value: "weak",     label: VISUAL_TRACKING_LABELS.weak      },
                    ]}
                    value={formData.visualTracking ?? null}
                    onChange={(v) => handleChange("visualTracking", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Eyesight">
                  <ThreeOptionCards
                    options={[
                      { value: "sharp",     label: EYESIGHT_LABELS.sharp     },
                      { value: "corrected", label: EYESIGHT_LABELS.corrected  },
                      { value: "limited",   label: EYESIGHT_LABELS.limited    },
                    ]}
                    value={formData.eyesight ?? null}
                    onChange={(v) => handleChange("eyesight", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Agility & flexibility">
                  <ThreeOptionCards
                    options={[
                      { value: "high",     label: AGILITY_LABELS.high     },
                      { value: "moderate", label: AGILITY_LABELS.moderate  },
                      { value: "low",      label: AGILITY_LABELS.low       },
                    ]}
                    value={formData.agility ?? null}
                    onChange={(v) => handleChange("agility", v)}
                  />
                </ProfileEditField>

                {/* Show current sport matches if any */}
                {(formData.sportMatches?.length ?? 0) > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Current sport matches
                    </p>
                    <div className="space-y-2">
                      {formData.sportMatches!.slice(0, 3).map((m, i) => {
                        const meta = MATCH_RANK_META[i] ?? MATCH_RANK_META[2];
                        const RankIcon = meta.icon;
                        return (
                          <div
                            key={m.sport}
                            className={`flex items-center justify-between rounded-lg border ${meta.ring} bg-white px-3 py-2`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${meta.badge}`}>
                                <RankIcon className="h-3.5 w-3.5" />
                              </span>
                              <span className="text-sm font-semibold text-slate-800">{m.sport}</span>
                            </div>
                            <span className="text-xs font-medium text-slate-500">{m.fitLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Recalculated automatically on save.</p>
                  </div>
                )}
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </form>
    </Modal>
  );
}
