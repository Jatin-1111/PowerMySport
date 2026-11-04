"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Input } from "../../shared/ui/Input";
import { toast } from "@/lib/toast";
import { normalizeStoredState, stateSelectOptions } from "@/lib/indianStates";
import { BinaryCards } from "@/modules/find-sport/components/inputs/BinaryCards";
import { FourContextCards } from "@/modules/find-sport/components/inputs/FourContextCards";
import { ThreeOptionCards } from "@/modules/find-sport/components/inputs/ThreeOptionCards";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import {
  DEFAULT_DEPENDENT_RELATION,
  DEPENDENT_RELATIONS,
  normalizeDependentRelation,
} from "../data/dependentRelations";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import type { Dependent } from "@/types";
import { Calendar, ChevronRight, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// The form edits a child as the server stores it, minus the quiz answers: those are
// changed by retaking the quiz, so they are neither loaded here nor sent back.
type DependentFormData = Omit<Dependent, "quiz">;

interface DependentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Dependent) => Promise<void>;
  /** This modal is edit-only — creating a new dependent is the shorter
   * `QuickAddDependentModal` flow instead, so a dependent always exists by
   * the time this one opens. */
  initialDependent: Dependent;
  isLoading?: boolean;
  /** Deep-link to a specific step on open (e.g. from a "complete your profile"
   * nudge elsewhere) instead of always starting at step 0. */
  initialStepId?: DependentModalStepId;
}

const EMPTY_FORM: DependentFormData = {
  name: "",
  dob: "",
  gender: "MALE",
  relation: DEFAULT_DEPENDENT_RELATION,
  sportsFocus: [],
  location: "",
};

export const STEPS = [
  { id: "about", title: "About the child", sub: "Name, age, and key details", required: true },
  {
    id: "sport",
    title: "Sport & setup",
    sub: "What they play, their background, and where they're based",
    required: false,
  },
  {
    id: "goals",
    title: "Goals & commitment",
    sub: "Ambition, time, budget, and long-term flexibility",
    required: false,
  },
] as const;

export type DependentModalStepId = (typeof STEPS)[number]["id"];

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
  initialStepId,
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
    const deepLinkIndex = initialStepId ? STEPS.findIndex((s) => s.id === initialStepId) : -1;
    setStepIndex(deepLinkIndex >= 0 ? deepLinkIndex : 0);
    setDir(1);
    // The quiz answers are dropped on purpose; retaking the quiz is how they change.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { quiz: _quiz, ...profile } = initialDependent;
    setFormData({
      ...EMPTY_FORM,
      ...profile,
      name: initialDependent.name,
      dob: initialDependent.dob ? new Date(initialDependent.dob).toISOString().split("T")[0] : "",
      relation: normalizeDependentRelation(profile.relation),
      // Same reason as the relation above: a dependent saved with the old
      // "Jammu & Kashmir" spelling matches no option in the canonical list, so
      // the field would render blank and lose the state on the next save.
      location: normalizeStoredState(profile.location),
    });
  }, [isOpen, initialDependent, initialStepId]);

  const handleChange = (field: keyof DependentFormData, value: unknown) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const previewAge = formData.dob ? getDependentAge(formData.dob) : null;
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (stepIndex === 0) {
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
        toast.error("Enter a valid date of birth");
        return;
      }
      if (age >= 18) {
        toast.error("Must be under 18 years old");
        return;
      }
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
    if (!formData.name.trim()) {
      toast.error("Name is required");
      setStepIndex(0);
      return;
    }
    if (!formData.dob) {
      toast.error("Date of birth is required");
      setStepIndex(0);
      return;
    }
    const age = getDependentAge(formData.dob);
    if (age === null) {
      toast.error("Enter a valid date of birth");
      setStepIndex(0);
      return;
    }
    if (age >= 18) {
      toast.error("Must be under 18 years old");
      setStepIndex(0);
      return;
    }

    try {
      await onSubmit(formData);
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
      title={`Edit ${formData.name || "Profile"}`}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={handleBack} disabled={isLoading}>
            {stepIndex === 0 ? "Cancel" : "Back"}
          </Button>
          {/* Distinct keys: without them React reuses one button and flips its type to
              "submit" in the middle of the click that reaches the last step, so the form
              is submitted (and the dialog closes) before step 3 is ever shown. */}
          {isLastStep ? (
            <Button
              key="save"
              type="submit"
              form="dependent-form"
              loading={isLoading}
              className="min-w-[140px]"
            >
              Save changes
            </Button>
          ) : (
            <Button
              key="next"
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
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            {!currentStep.required && (
              <span className="text-[11px] text-slate-400">Optional, skip if you like</span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="bg-power-orange h-full rounded-full transition-all duration-500"
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
                    className="mt-2 text-xs text-slate-400 transition-colors hover:text-slate-600"
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

                <ProfileEditField
                  label="State / UT"
                  htmlFor="dep-location"
                  hint="For local resource recommendations"
                >
                  <ProfileFormSelect
                    id="dep-location"
                    value={formData.location || ""}
                    onChange={(v) => handleChange("location", v)}
                    options={[
                      { value: "", label: "Select a state" },
                      ...stateSelectOptions(formData.location),
                    ]}
                  />
                </ProfileEditField>

                <ProfileEditField label="Current level">
                  <ThreeOptionCards
                    options={[
                      {
                        value: "beginner",
                        label: "Beginner, city / neighbourhood, just getting started",
                      },
                      {
                        value: "intermediate",
                        label: "Intermediate, school, club or district level",
                      },
                      { value: "competitive", label: "Competitive, state or national level" },
                    ]}
                    value={formData.experienceLevel ?? null}
                    onChange={(v) => handleChange("experienceLevel", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Training setup">
                  <FourContextCards
                    options={[
                      {
                        value: "self",
                        label: "Self-practice",
                        context: "Home or local grounds, no formal coaching",
                      },
                      {
                        value: "club",
                        label: "School / Club",
                        context: "Group coaching at school or local club",
                      },
                      {
                        value: "academy",
                        label: "Academy",
                        context: "Enrolled in a structured programme",
                      },
                      {
                        value: "private",
                        label: "Private coaching",
                        context: "One-on-one with a dedicated coach",
                      },
                    ]}
                    value={formData.trainingType ?? null}
                    onChange={(v) => handleChange("trainingType", v)}
                  />
                </ProfileEditField>
              </>
            )}

            {/* ── Step 2: Goals ─────────────────────────────────────────────────── */}
            {stepIndex === 2 && (
              <>
                <ProfileEditField label="Ambition">
                  <FourContextCards
                    options={[
                      { value: "fun", label: "Just for fun", context: "Recreational, no pressure" },
                      {
                        value: "competitive",
                        label: "Competitive",
                        context: "District / state-level tournaments",
                      },
                      {
                        value: "national",
                        label: "National-level goal",
                        context: "Serious training commitment",
                      },
                      {
                        value: "career",
                        label: "Career in sport",
                        context: "A sports-quota job, a college place, or turning pro",
                      },
                    ]}
                    value={formData.ambition ?? null}
                    onChange={(v) => handleChange("ambition", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Weekly time commitment">
                  <FourContextCards
                    options={[
                      { value: "1-3", label: "1–3 hrs/week", context: "Light, casual commitment" },
                      { value: "4-7", label: "4–7 hrs/week", context: "Regular weekly practice" },
                      {
                        value: "8-12",
                        label: "8–12 hrs/week",
                        context: "Serious, structured training",
                      },
                      {
                        value: "13-plus",
                        label: "13+ hrs/week",
                        context: "High-performance schedule",
                      },
                    ]}
                    value={formData.weeklyHoursCategory ?? null}
                    onChange={(v) => handleChange("weeklyHoursCategory", v)}
                  />
                </ProfileEditField>

                <ProfileEditField label="Monthly training budget">
                  <FourContextCards
                    options={[
                      {
                        value: "under-3k",
                        label: "Under ₹3,000",
                        context: "Community programs, school teams",
                      },
                      {
                        value: "3k-7k",
                        label: "₹3,000 – 7,000",
                        context: "Local academies, group coaching",
                      },
                      {
                        value: "7k-15k",
                        label: "₹7,000 – 15,000",
                        context: "Structured academy training",
                      },
                      {
                        value: "15k-plus",
                        label: "₹15,000+",
                        context: "Elite academies, personal coaching",
                      },
                    ]}
                    value={formData.budgetRange ?? null}
                    onChange={(v) => handleChange("budgetRange", v)}
                  />
                </ProfileEditField>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </form>
    </Modal>
  );
}
