"use client";

import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { INDIAN_STATES } from "@/modules/guidance/constants";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import {
    DEFAULT_DEPENDENT_RELATION,
    DEPENDENT_RELATIONS,
} from "@/modules/player/constants/dependentRelations";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent, CardHeader } from "@/modules/shared/ui/Card";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { AnimatePresence, motion } from "framer-motion";
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Dumbbell,
    Sparkles,
    UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PERSONALITY_OPTIONS = [
  "Shy",
  "Energetic",
  "Competitive",
  "Social",
  "Focused",
  "Curious",
  "Patient",
  "Team-oriented",
];

const STEPS = [
  { label: "Your Story", icon: Sparkles },
  { label: "Child Info", icon: UserRound },
  { label: "Sports", icon: Dumbbell },
  { label: "Preferences", icon: Calendar },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

export default function ParentOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 0: parent's own context
  const [parentData, setParentData] = useState({
    bio: "",
    sportInterests: [] as string[],
    involvementYears: "" as string | number,
  });

  // Steps 1–3: dependent profile
  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
    relation: DEFAULT_DEPENDENT_RELATION,
    sports: [] as string[],
    yearsPlaying: undefined as number | undefined,
    personalityTags: [] as string[],
    primaryObjective: "Recreational" as "Recreational" | "Fitness" | "Compete",
    weeklyTimeCommitment: 3,
    budgetTier: "Moderate" as "Budget" | "Moderate" | "Premium",
    location: "",
  });

  const maxDob = new Date().toISOString().split("T")[0];
  const minDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split("T")[0];
  })();

  const getDependentAge = (dob: string): number | null => {
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (
      today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() &&
        today.getDate() < birthDate.getDate())
    )
      age -= 1;
    return age;
  };

  const previewAge = formData.dob ? getDependentAge(formData.dob) : null;

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handleNext = () => {
    if (step === 0) {
      if (!parentData.bio.trim()) { toast.error("Please tell us a little about yourself"); return; }
      if (parentData.sportInterests.length === 0) { toast.error("Please select at least one sport you follow"); return; }
      if (parentData.involvementYears === "") { toast.error("Please enter your years of involvement in sport"); return; }
    }
    if (step === 1) {
      if (!formData.name.trim()) { toast.error("Athlete name is required"); return; }
      if (!formData.dob) { toast.error("Date of birth is required"); return; }
      const age = getDependentAge(formData.dob);
      if (age === null || age >= 18) { toast.error("Dependents must be under 18 years old"); return; }
    }
    if (step === 2) {
      if (formData.sports.length === 0) { toast.error("Please select at least one sport for your athlete"); return; }
      if (formData.yearsPlaying === undefined) { toast.error("Please enter experience in years (use 0 if just starting)"); return; }
    }
    goTo(step + 1);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { toast.error("Athlete name is required"); return; }
    if (!formData.dob) { toast.error("Date of birth is required"); return; }
    const age = getDependentAge(formData.dob);
    if (age === null || age >= 18) { toast.error("Dependents must be under 18 years old"); return; }
    if (!formData.location) { toast.error("Please select your state / union territory"); return; }
    if (formData.personalityTags.length === 0) { toast.error("Please select at least one personality tag"); return; }

    setIsSubmitting(true);
    try {
      // Save parent's own context if any field was filled
      const bio = parentData.bio.trim();
      const sportInterests = parentData.sportInterests;
      const involvementYears =
        parentData.involvementYears !== ""
          ? Number(parentData.involvementYears)
          : undefined;
      if (bio || sportInterests.length > 0 || involvementYears !== undefined) {
        await authApi.updateProfile({
          parentProfile: {
            ...(bio ? { bio } : {}),
            ...(sportInterests.length > 0 ? { sportInterests } : {}),
            ...(involvementYears !== undefined ? { involvementYears } : {}),
          },
        });
      }

      // Save dependent profile
      await authApi.addDependent({
        ...formData,
        location: formData.location || undefined,
      });

      toast.success("Profile saved! Welcome to PowerMySport.");
      router.push("/dashboard/my-bookings");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles = [
    { heading: "Tell Us About Yourself", sub: "Your sports background helps us personalise AI guidance." },
    { heading: "Add Your Athlete", sub: "Basic info about the child you're managing." },
    { heading: "Sports Background", sub: "Which sports is your child playing or interested in?" },
    { heading: "Preferences", sub: "Helps us surface the right coaching and venue options." },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center p-4 py-10">
      <SlideUp duration={0.6} yOffset={20} className="w-full max-w-2xl">
        <Card className="w-full glass-panel-heavy premium-shadow border-0">
          <CardHeader className="pb-2">
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-6">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i < step;
                const active = i === step;
                return (
                  <div key={i} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1 min-w-0">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                          done
                            ? "border-power-orange bg-power-orange text-white"
                            : active
                            ? "border-power-orange bg-orange-50 text-power-orange"
                            : "border-slate-200 bg-white text-slate-400"
                        }`}
                      >
                        {done ? (
                          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold tracking-wide text-center hidden sm:block ${active ? "text-power-orange" : done ? "text-slate-500" : "text-slate-400"}`}>
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-2 transition-all ${i < step ? "bg-power-orange" : "bg-slate-200"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white">
              {stepTitles[step].heading}
            </h1>
            <p className="text-center text-slate-500 dark:text-slate-300 mt-1 text-sm">
              {stepTitles[step].sub}
            </p>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                >
                  {/* ── Step 0: Parent Story ── */}
                  {step === 0 && (
                    <div className="space-y-5">
                      <ProfileEditField
                        label="About You"
                        htmlFor="parent-bio"
                        required
                        hint={`${parentData.bio.length}/300 — your background as a sports parent helps the AI understand your perspective`}
                      >
                        <textarea
                          id="parent-bio"
                          rows={3}
                          maxLength={300}
                          value={parentData.bio}
                          onChange={(e) => setParentData((p) => ({ ...p, bio: e.target.value }))}
                          placeholder="e.g., Former club cricketer, now focused on my daughter's tennis journey."
                          className="w-full rounded-lg border border-slate-200 bg-white/50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20 resize-none backdrop-blur-sm"
                        />
                      </ProfileEditField>

                      <ProfileEditField
                        label="Sports You Follow or Have Played"
                        hint="Select sports you follow closely or have experience in"
                        required
                      >
                        <SportsMultiSelect
                          value={parentData.sportInterests}
                          onChange={(s) => setParentData((p) => ({ ...p, sportInterests: s }))}
                        />
                      </ProfileEditField>

                      <ProfileEditField
                        label="Years Involved in Sport"
                        htmlFor="parent-years"
                        required
                        hint="How long you've been involved or interested in sport (enter 0 if just starting)"
                      >
                        <div className="flex items-center gap-3">
                          <Input
                            id="parent-years"
                            type="number"
                            min="0"
                            max="40"
                            value={parentData.involvementYears}
                            onChange={(e) =>
                              setParentData((p) => ({
                                ...p,
                                involvementYears: e.target.value === "" ? "" : Math.min(40, parseInt(e.target.value, 10) || 0),
                              }))
                            }
                            placeholder="e.g., 5"
                            className="bg-white/50 backdrop-blur-sm w-28"
                          />
                          <span className="text-sm text-slate-500">years</span>
                        </div>
                      </ProfileEditField>
                    </div>
                  )}

                  {/* ── Step 1: Child Basic Info ── */}
                  {step === 1 && (
                    <div className="space-y-5">
                      <ProfileEditField label="Athlete Name" htmlFor="dependent-name" required icon={UserRound}>
                        <Input
                          id="dependent-name"
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                          placeholder="e.g., Aryan Sharma"
                          className="bg-white/50 backdrop-blur-sm"
                        />
                      </ProfileEditField>

                      <ProfileEditField
                        label="Date of Birth"
                        htmlFor="dependent-dob"
                        required
                        icon={Calendar}
                        hint={previewAge !== null ? `Age: ${previewAge} years · Must be under 18.` : "Must be under 18 years old."}
                      >
                        <Input
                          id="dependent-dob"
                          type="date"
                          value={formData.dob}
                          onChange={(e) => setFormData((p) => ({ ...p, dob: e.target.value }))}
                          min={minDob}
                          max={maxDob}
                          className="bg-white/50 backdrop-blur-sm"
                        />
                      </ProfileEditField>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <ProfileEditField label="Gender" htmlFor="dependent-gender">
                          <ProfileFormSelect
                            id="dependent-gender"
                            value={formData.gender}
                            onChange={(v) => setFormData((p) => ({ ...p, gender: v as any }))}
                            options={[
                              { value: "MALE", label: "Male" },
                              { value: "FEMALE", label: "Female" },
                              { value: "OTHER", label: "Other" },
                            ]}
                          />
                        </ProfileEditField>

                        <ProfileEditField label="Your Relation" htmlFor="dependent-relation" required>
                          <ProfileFormSelect
                            id="dependent-relation"
                            value={formData.relation}
                            onChange={(v) => setFormData((p) => ({ ...p, relation: v as any }))}
                            options={DEPENDENT_RELATIONS.map((o) => ({ value: o.value, label: o.label }))}
                          />
                        </ProfileEditField>
                      </div>
                    </div>
                  )}

                  {/* ── Step 2: Sports ── */}
                  {step === 2 && (
                    <div className="space-y-5">
                      <ProfileEditField label="Sports Interests" hint="Select at least one sport your child plays or is interested in" required>
                        <SportsMultiSelect
                          value={formData.sports}
                          onChange={(s) => setFormData((p) => ({ ...p, sports: s }))}
                        />
                      </ProfileEditField>

                      <ProfileEditField
                        label="Experience (Years)"
                        htmlFor="dependent-years-playing"
                        required
                        hint="Enter 0 if they haven't started yet"
                      >
                        <Input
                          id="dependent-years-playing"
                          type="number"
                          min="0"
                          max="20"
                          placeholder="e.g., 2"
                          value={formData.yearsPlaying ?? ""}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              yearsPlaying: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                            }))
                          }
                          className="bg-white/50 backdrop-blur-sm"
                        />
                      </ProfileEditField>
                    </div>
                  )}

                  {/* ── Step 3: Preferences ── */}
                  {step === 3 && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <ProfileEditField label="Objective" htmlFor="primary-objective">
                          <ProfileFormSelect
                            id="primary-objective"
                            value={formData.primaryObjective}
                            onChange={(v) => setFormData((p) => ({ ...p, primaryObjective: v as any }))}
                            options={[
                              { value: "Recreational", label: "Recreational" },
                              { value: "Fitness", label: "Fitness" },
                              { value: "Compete", label: "Compete" },
                            ]}
                          />
                        </ProfileEditField>

                        <ProfileEditField label="Budget Tier" htmlFor="budget-tier">
                          <ProfileFormSelect
                            id="budget-tier"
                            value={formData.budgetTier}
                            onChange={(v) => setFormData((p) => ({ ...p, budgetTier: v as any }))}
                            options={[
                              { value: "Budget", label: "Budget" },
                              { value: "Moderate", label: "Moderate" },
                              { value: "Premium", label: "Premium" },
                            ]}
                          />
                        </ProfileEditField>
                      </div>

                      <ProfileEditField
                        label="State / Union Territory"
                        htmlFor="dependent-location"
                        required
                        hint="Used for local scheme & resource recommendations"
                      >
                        <ProfileFormSelect
                          id="dependent-location"
                          value={formData.location}
                          onChange={(v) => setFormData((p) => ({ ...p, location: v }))}
                          options={[
                            { value: "", label: "— Select state —" },
                            ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
                          ]}
                        />
                      </ProfileEditField>

                      <ProfileEditField label="Weekly Time Commitment (Hours)" htmlFor="weekly-time">
                        <Input
                          id="weekly-time"
                          type="number"
                          min="1"
                          max="40"
                          value={formData.weeklyTimeCommitment}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, weeklyTimeCommitment: parseInt(e.target.value) || 3 }))
                          }
                          className="bg-white/50 backdrop-blur-sm"
                        />
                      </ProfileEditField>

                      <ProfileEditField label="Personality Tags" required hint="Select at least one tag that describes your child">
                        <div className="flex flex-wrap gap-2">
                          {PERSONALITY_OPTIONS.map((tag) => {
                            const selected = formData.personalityTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() =>
                                  setFormData((p) => ({
                                    ...p,
                                    personalityTags: selected
                                      ? p.personalityTags.filter((t) => t !== tag)
                                      : [...p.personalityTags, tag],
                                  }))
                                }
                                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                  selected
                                    ? "border-blue-600 bg-indigo-50 font-medium text-indigo-700"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </ProfileEditField>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-6">
              {step > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => goTo(step - 1)}
                  disabled={isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}

              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  variant="primary"
                  className="w-full premium-shadow"
                  onClick={handleNext}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  className="w-full premium-shadow"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving…" : "Save Athlete"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </SlideUp>
    </div>
  );
}
