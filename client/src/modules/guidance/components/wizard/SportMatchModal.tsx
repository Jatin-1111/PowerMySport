"use client";

import { AIDisclaimer } from "@/components/shared/AIDisclaimer";
import axiosInstance from "@/lib/api/axios";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { DEPENDENT_RELATIONS } from "@/modules/player/constants/dependentRelations";
import { Button } from "@/modules/shared/ui/Button";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ChevronRight,
  MessageCircle,
  PlusCircle,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  BUDGET_OPTIONS,
  INDIAN_STATES,
  OBJECTIVES,
  PERSONALITY_OPTIONS,
} from "../../constants";
import type { PlayerProfile } from "../../types";

type SportRecommendation = {
  sportSlug: string;
  sportName: string;
  matchScore: number;
  reasons: string[];
  monthlyCostRange: string | null;
  keyTalentSignal: string | null;
};

const TEAM_PREFS = [
  { value: "Team", label: "Team" },
  { value: "Individual", label: "Individual" },
  { value: "Both", label: "No preference" },
];

const INDOOR_OUTDOOR_PREFS = [
  { value: "Indoor", label: "Indoor" },
  { value: "Outdoor", label: "Outdoor" },
  { value: "Both", label: "No preference" },
];

const INTENSITY_PREFS = [
  { value: "Low", label: "Low intensity" },
  { value: "Medium", label: "Moderate" },
  { value: "High", label: "High intensity" },
];

interface SportMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerProfile?: PlayerProfile | null;
  dependents?: PlayerProfile[];
  onExplore: (sportName: string, dependentId?: string) => void;
  onRecommendationsReady?: () => void;
}

const TOTAL_QSTEPS = 5;

export function SportMatchModal({
  isOpen,
  onClose,
  playerProfile,
  dependents,
  onExplore,
  onRecommendationsReady,
}: SportMatchModalProps) {
  const [step, setStep] = useState<
    "select_dependent" | "questions" | "profile_summary" | "loading" | "results"
  >("select_dependent");
  const [recommendations, setRecommendations] = useState<SportRecommendation[]>([]);
  const [selectedDependent, setSelectedDependent] = useState<PlayerProfile | null>(null);
  const [localDependents, setLocalDependents] = useState<PlayerProfile[]>(dependents || []);
  const [manualData, setManualData] = useState({
    name: "",
    gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
    relation: "CHILD",
    child_age: "",
    // Step 2 — Physical profile
    height_cm: "",
    weight_kg: "",
    medical_conditions: [] as string[],
    medicalConditionsInput: "",
    // Step 3 — Activity & location
    location: "",
    weeklyTimeCommitment: 5,
    school_sport_involvement: false,
    sports: [] as string[],
    yearsPlaying: "",
    // Step 4 — Goals & budget
    primary_objective: "",
    budget_tier: "",
    // Step 5 — Personality & preferences
    personality_tags: [] as string[],
    team_preference: "" as "" | "Team" | "Individual" | "Both",
    indoor_outdoor_preference: "" as "" | "Indoor" | "Outdoor" | "Both",
    intensity_preference: "" as "" | "Low" | "Medium" | "High",
  });
  const [qStep, setQStep] = useState(1);
  const [saveAsDependent, setSaveAsDependent] = useState(false);
  const [inlineAge, setInlineAge] = useState("");
  const [inlineLocation, setInlineLocation] = useState("");
  const { user } = useAuthStore();

  const savedState =
    typeof window !== "undefined"
      ? localStorage.getItem("pms_selected_state") || ""
      : "";

  useEffect(() => {
    if (isOpen) {
      // Always sync location from the pathway page's state selector — covers
      // the case where the user changed state in the explorer after a previous run.
      if (savedState) {
        setManualData((prev) => ({ ...prev, location: savedState }));
        setInlineLocation(savedState);
      }

      if (recommendations.length > 0) {
        setStep("results");
        return;
      }
      if (playerProfile) {
        setSelectedDependent(playerProfile);
        setStep("profile_summary");
      } else {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
          setStep("questions");
          return;
        }
        authApi
          .getProfile()
          .then((res) => {
            if (res.success && res.data?.dependents && res.data.dependents.length > 0) {
              setLocalDependents(res.data.dependents as unknown as PlayerProfile[]);
              setStep("select_dependent");
            } else {
              setStep("questions");
            }
          })
          .catch((err) => {
            console.error("Failed to fetch fresh dependents:", err);
            if (dependents && dependents.length > 0) {
              setStep("select_dependent");
            } else {
              setStep("questions");
            }
          });
      }
    }
  }, [isOpen, playerProfile, recommendations]);

  const fetchRecommendations = async (data: Record<string, unknown>) => {
    setStep("loading");
    try {
      const res = await axiosInstance.post("/guidance/recommend-sport", data);
      if (res.data.success) {
        setRecommendations(res.data.data.recommendations);
        setStep("results");
        onRecommendationsReady?.();
      } else {
        throw new Error(res.data.message);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
      setStep("profile_summary");
    }
  };

  const addMedicalCondition = () => {
    const trimmed = manualData.medicalConditionsInput.trim();
    if (trimmed && !manualData.medical_conditions.includes(trimmed)) {
      setManualData({
        ...manualData,
        medical_conditions: [...manualData.medical_conditions, trimmed],
        medicalConditionsInput: "",
      });
    }
  };

  const removeMedicalCondition = (cond: string) => {
    setManualData({
      ...manualData,
      medical_conditions: manualData.medical_conditions.filter((c) => c !== cond),
    });
  };

  const canProceedQStep = () => {
    if (qStep === 1) return !!manualData.name && !!manualData.child_age;
    if (qStep === 2) return true; // all optional
    if (qStep === 3) return !!manualData.location;
    if (qStep === 4) return !!manualData.primary_objective && !!manualData.budget_tier;
    if (qStep === 5) return manualData.personality_tags.length > 0;
    return true;
  };

  const submitManual = async () => {
    if (saveAsDependent && user) {
      const approxDob = new Date();
      approxDob.setFullYear(approxDob.getFullYear() - parseInt(manualData.child_age));
      approxDob.setMonth(0);
      approxDob.setDate(1);
      try {
        await authApi.addDependent({
          name: manualData.name,
          dob: approxDob.toISOString().split("T")[0],
          gender: manualData.gender,
          relation: manualData.relation,
          sportsFocus: manualData.sports,
          yearsPlaying: manualData.yearsPlaying ? parseInt(manualData.yearsPlaying) : undefined,
          personalityTags: manualData.personality_tags,
          primaryObjective: manualData.primary_objective as "Recreational" | "Fitness" | "Compete",
          weeklyTimeCommitment: manualData.weeklyTimeCommitment,
          budgetTier: manualData.budget_tier as "Budget" | "Moderate" | "Premium",
          location: manualData.location,
          heightCm: manualData.height_cm ? parseFloat(manualData.height_cm) : undefined,
          weightKg: manualData.weight_kg ? parseFloat(manualData.weight_kg) : undefined,
          medicalConditions: manualData.medical_conditions.length > 0 ? manualData.medical_conditions : undefined,
        });
      } catch {
        // non-blocking — recommendations still proceed
      }
    }
    fetchRecommendations({
      child_age: parseInt(manualData.child_age),
      gender: manualData.gender,
      location: manualData.location,
      primary_objective: manualData.primary_objective,
      budget_tier: manualData.budget_tier,
      personality_tags: manualData.personality_tags,
      height_cm: manualData.height_cm ? parseFloat(manualData.height_cm) : undefined,
      weight_kg: manualData.weight_kg ? parseFloat(manualData.weight_kg) : undefined,
      medical_conditions: manualData.medical_conditions.length > 0 ? manualData.medical_conditions : undefined,
      team_preference: manualData.team_preference || undefined,
      indoor_outdoor_preference: manualData.indoor_outdoor_preference || undefined,
      intensity_preference: manualData.intensity_preference || undefined,
      weekly_time_commitment: manualData.weeklyTimeCommitment,
      school_sport_involvement: manualData.school_sport_involvement,
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/80 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-power-orange/10">
                <Sparkles className="h-4 w-4 text-power-orange" />
              </div>
              <h2 className="font-title text-lg font-bold text-slate-900">
                Sport Match Recommendation
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Loading */}
            {step === "loading" && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-100 border-t-power-orange mb-4" />
                <p className="font-title text-lg font-bold text-slate-900">
                  Finding the perfect match...
                </p>
                <p className="text-sm text-slate-500">
                  Analyzing pathways, costs, and traits.
                </p>
              </div>
            )}

            {/* Select dependent */}
            {step === "select_dependent" && (
              <div className="mx-auto max-w-xl py-8 text-center">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">
                  Who are we finding a sport for?
                </h3>
                <div className="space-y-3">
                  {localDependents.map((dep) => {
                    const calcAge =
                      dep.age ||
                      (dep.dob
                        ? Math.floor(
                            (new Date().getTime() - new Date(dep.dob).getTime()) / 31557600000,
                          )
                        : null);
                    return (
                      <button
                        key={dep._id}
                        onClick={() => {
                          setSelectedDependent(dep);
                          setStep("profile_summary");
                        }}
                        className="flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all border-slate-200 bg-white hover:border-power-orange hover:bg-orange-50/50"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold text-lg">
                          {dep.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{dep.name}</p>
                          <p className="text-sm text-slate-500">
                            {calcAge ? `${calcAge} years old` : "Age not set"}
                          </p>
                        </div>
                        <ChevronRight className="ml-auto h-5 w-5 text-slate-400" />
                      </button>
                    );
                  })}

                  {/* New Athlete option */}
                  <button
                    onClick={() => {
                      setSelectedDependent(null);
                      setQStep(1);
                      setStep("questions");
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 p-4 text-left transition-all bg-white hover:border-power-orange hover:bg-orange-50/30"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-power-orange">
                      <PlusCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">New Athlete</p>
                      <p className="text-sm text-slate-500">
                        Enter details for someone not in your profile
                      </p>
                    </div>
                    <ChevronRight className="ml-auto h-5 w-5 text-slate-400" />
                  </button>
                </div>
              </div>
            )}

            {/* 5-step questions wizard */}
            {step === "questions" && (
              <div className="mx-auto max-w-2xl py-6">
                {/* Progress bar */}
                <div className="mb-8 flex justify-center">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: TOTAL_QSTEPS }, (_, i) => i + 1).map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm transition-all ${
                            qStep === s
                              ? "bg-power-orange text-white ring-4 ring-orange-50"
                              : qStep > s
                                ? "bg-slate-800 text-white"
                                : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {s}
                        </div>
                        {s < TOTAL_QSTEPS && (
                          <div
                            className={`h-1 w-8 rounded-full ${qStep > s ? "bg-slate-800" : "bg-slate-100"}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-1 text-center">
                  {qStep === 1
                    ? "Let's get to know the athlete"
                    : qStep === 2
                      ? "Physical profile"
                      : qStep === 3
                        ? "Activity & location"
                        : qStep === 4
                          ? "Goals & budget"
                          : "Personality & preferences"}
                </h3>
                {qStep === 2 && (
                  <p className="text-center text-sm text-slate-400 mb-6">
                    All fields optional — the more you share, the sharper the match.
                  </p>
                )}
                {qStep !== 2 && <div className="mb-6" />}

                <div className="space-y-6">
                  {/* Step 1 — Basic info */}
                  {qStep === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Athlete Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Arjun"
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.name}
                            onChange={(e) => setManualData({ ...manualData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Age
                          </label>
                          <input
                            type="number"
                            min="3"
                            max="21"
                            placeholder="e.g., 10"
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.child_age}
                            onChange={(e) =>
                              setManualData({ ...manualData, child_age: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Gender
                          </label>
                          <select
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all appearance-none"
                            value={manualData.gender}
                            onChange={(e) =>
                              setManualData({ ...manualData, gender: e.target.value as any })
                            }
                          >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Your relation to them
                          </label>
                          <select
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all appearance-none"
                            value={manualData.relation}
                            onChange={(e) =>
                              setManualData({ ...manualData, relation: e.target.value })
                            }
                          >
                            {DEPENDENT_RELATIONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2 — Physical profile */}
                  {qStep === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Height (cm)
                          </label>
                          <input
                            type="number"
                            min="50"
                            max="250"
                            placeholder="e.g., 135"
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.height_cm}
                            onChange={(e) =>
                              setManualData({ ...manualData, height_cm: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Weight (kg)
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="200"
                            placeholder="e.g., 32"
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.weight_kg}
                            onChange={(e) =>
                              setManualData({ ...manualData, weight_kg: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          Any medical conditions or physical limitations?
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g., Asthma, Knee injury"
                            className="flex-1 rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.medicalConditionsInput}
                            onChange={(e) =>
                              setManualData({ ...manualData, medicalConditionsInput: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addMedicalCondition();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={addMedicalCondition}
                            className="px-4 py-3 rounded-2xl bg-orange-50 text-power-orange font-semibold text-sm hover:bg-orange-100 transition-colors border border-orange-100"
                          >
                            Add
                          </button>
                        </div>
                        {manualData.medical_conditions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {manualData.medical_conditions.map((cond) => (
                              <span
                                key={cond}
                                className="flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-3 py-1 text-sm font-medium text-orange-700"
                              >
                                {cond}
                                <button
                                  onClick={() => removeMedicalCondition(cond)}
                                  className="ml-1 text-orange-400 hover:text-orange-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-slate-400">
                          This helps us avoid suggesting sports that may aggravate a condition.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 3 — Activity & location */}
                  {qStep === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            State / Location <span className="text-red-400">*</span>
                          </label>
                          <select
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all appearance-none"
                            value={manualData.location}
                            onChange={(e) =>
                              setManualData({ ...manualData, location: e.target.value })
                            }
                          >
                            <option value="">Select state...</option>
                            {INDIAN_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Weekly Time Available (hours)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="40"
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.weeklyTimeCommitment}
                            onChange={(e) =>
                              setManualData({
                                ...manualData,
                                weeklyTimeCommitment: parseInt(e.target.value) || 5,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                        <input
                          type="checkbox"
                          id="school_sport"
                          checked={manualData.school_sport_involvement}
                          onChange={(e) =>
                            setManualData({ ...manualData, school_sport_involvement: e.target.checked })
                          }
                          className="h-4 w-4 rounded accent-power-orange"
                        />
                        <label
                          htmlFor="school_sport"
                          className="text-sm font-semibold text-slate-700 cursor-pointer"
                        >
                          Already playing a sport at school / club level
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          Sports currently playing (optional)
                        </label>
                        <SportsMultiSelect
                          value={manualData.sports}
                          onChange={(sports) => setManualData({ ...manualData, sports })}
                        />
                      </div>

                      {manualData.sports.length > 0 && (
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Years playing
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            placeholder="e.g., 2"
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.yearsPlaying}
                            onChange={(e) =>
                              setManualData({ ...manualData, yearsPlaying: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4 — Goals & budget */}
                  {qStep === 4 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">
                          Primary objective <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {OBJECTIVES.map((obj) => {
                            const Icon = obj.icon;
                            const isSelected = manualData.primary_objective === obj.value;
                            return (
                              <button
                                key={obj.value}
                                onClick={() =>
                                  setManualData({ ...manualData, primary_objective: obj.value })
                                }
                                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                                  isSelected
                                    ? "border-power-orange bg-orange-50 text-power-orange scale-105 shadow-sm"
                                    : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <Icon
                                  className={`h-8 w-8 mb-3 ${isSelected ? "text-power-orange" : "text-slate-400"}`}
                                />
                                <span className="text-sm font-bold">{obj.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">
                          Budget tier <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {BUDGET_OPTIONS.map((b) => (
                            <button
                              key={b.value}
                              onClick={() =>
                                setManualData({ ...manualData, budget_tier: b.value })
                              }
                              className={`py-3 px-4 rounded-2xl border-2 text-sm font-bold transition-all ${
                                manualData.budget_tier === b.value
                                  ? "border-power-orange bg-power-orange text-white shadow-md"
                                  : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 5 — Personality & preferences */}
                  {qStep === 5 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">
                          Personality traits — select up to 3{" "}
                          <span className="text-red-400">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {PERSONALITY_OPTIONS.map((p) => {
                            const isSelected = manualData.personality_tags.includes(p.label);
                            return (
                              <button
                                key={p.label}
                                onClick={() => {
                                  if (isSelected) {
                                    setManualData({
                                      ...manualData,
                                      personality_tags: manualData.personality_tags.filter(
                                        (t) => t !== p.label,
                                      ),
                                    });
                                  } else if (manualData.personality_tags.length < 3) {
                                    setManualData({
                                      ...manualData,
                                      personality_tags: [...manualData.personality_tags, p.label],
                                    });
                                  }
                                }}
                                className={`flex items-center gap-2 py-2 px-4 rounded-full border-2 text-sm font-bold transition-all ${
                                  isSelected
                                    ? "border-power-orange bg-power-orange text-white"
                                    : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <p.icon className="h-4 w-4" /> {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Team or individual?
                          </label>
                          <div className="flex flex-col gap-2">
                            {TEAM_PREFS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() =>
                                  setManualData({
                                    ...manualData,
                                    team_preference: opt.value as any,
                                  })
                                }
                                className={`py-2.5 px-4 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                                  manualData.team_preference === opt.value
                                    ? "border-power-orange bg-orange-50 text-power-orange"
                                    : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Indoor or outdoor?
                          </label>
                          <div className="flex flex-col gap-2">
                            {INDOOR_OUTDOOR_PREFS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() =>
                                  setManualData({
                                    ...manualData,
                                    indoor_outdoor_preference: opt.value as any,
                                  })
                                }
                                className={`py-2.5 px-4 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                                  manualData.indoor_outdoor_preference === opt.value
                                    ? "border-power-orange bg-orange-50 text-power-orange"
                                    : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Preferred intensity?
                          </label>
                          <div className="flex flex-col gap-2">
                            {INTENSITY_PREFS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() =>
                                  setManualData({
                                    ...manualData,
                                    intensity_preference: opt.value as any,
                                  })
                                }
                                className={`py-2.5 px-4 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                                  manualData.intensity_preference === opt.value
                                    ? "border-power-orange bg-orange-50 text-power-orange"
                                    : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save as dependent — shown only on last step */}
                  {qStep === TOTAL_QSTEPS && (
                    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      {user ? (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={saveAsDependent}
                            onChange={(e) => setSaveAsDependent(e.target.checked)}
                            className="h-4 w-4 rounded accent-power-orange"
                          />
                          <span className="text-sm font-medium text-slate-700">
                            Save {manualData.name || "this athlete"} as a dependent in my profile
                          </span>
                        </label>
                      ) : (
                        <p className="text-sm text-slate-500 text-center">
                          <a href="/login" className="font-semibold text-power-orange hover:underline">
                            Log in
                          </a>{" "}
                          to save this athlete as a dependent for future sessions.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-between pt-8 border-t border-slate-100 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (qStep > 1) {
                          setQStep(qStep - 1);
                        } else if (localDependents.length > 0) {
                          setStep("select_dependent");
                        }
                        // if no dependents and step 1, no back (nowhere to go)
                      }}
                    >
                      Back
                    </Button>

                    {qStep < TOTAL_QSTEPS ? (
                      <Button
                        variant="primary"
                        disabled={!canProceedQStep()}
                        onClick={() => setQStep(qStep + 1)}
                      >
                        Continue <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        disabled={!canProceedQStep()}
                        onClick={submitManual}
                      >
                        Find Matches <Sparkles className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Profile summary for existing dependent */}
            {step === "profile_summary" && selectedDependent && (
              <div className="mx-auto max-w-xl py-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2 text-center">
                  Using {selectedDependent.name}&apos;s Profile
                </h3>
                <p className="text-center text-slate-500 mb-8">
                  We&apos;ll use these details to find the best sport.
                </p>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Age
                      </p>
                      <p className="font-semibold text-slate-800">
                        {selectedDependent.age ||
                          (selectedDependent.dob
                            ? Math.floor(
                                (new Date().getTime() -
                                  new Date(selectedDependent.dob).getTime()) /
                                  31557600000,
                              )
                            : "Not specified")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Location
                      </p>
                      <p className="font-semibold text-slate-800">
                        {selectedDependent.location || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Objective
                      </p>
                      <p className="font-semibold text-slate-800">
                        {selectedDependent.primaryObjective || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Budget
                      </p>
                      <p className="font-semibold text-slate-800">
                        {selectedDependent.budgetTier || "Not specified"}
                      </p>
                    </div>
                    {((selectedDependent as any).heightCm || (selectedDependent as any).weightKg) && (
                      <>
                        {(selectedDependent as any).heightCm && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Height
                            </p>
                            <p className="font-semibold text-slate-800">
                              {(selectedDependent as any).heightCm} cm
                            </p>
                          </div>
                        )}
                        {(selectedDependent as any).weightKg && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Weight
                            </p>
                            <p className="font-semibold text-slate-800">
                              {(selectedDependent as any).weightKg} kg
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Personality Tags
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDependent.personalityTags?.length ? (
                        selectedDependent.personalityTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500 italic">No tags specified</span>
                      )}
                    </div>
                  </div>
                  {(selectedDependent as any).medicalConditions?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Medical Conditions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedDependent as any).medicalConditions.map((cond: string) => (
                          <span
                            key={cond}
                            className="rounded-full bg-orange-50 border border-orange-100 px-3 py-1 text-[11px] font-semibold text-orange-700"
                          >
                            {cond}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Inline prompts for missing required data */}
                {(() => {
                  const hasAge = selectedDependent.age || selectedDependent.dob;
                  const hasLocation = !!selectedDependent.location;
                  const needsAge = !hasAge;
                  const needsLocation = !hasLocation;
                  const isBlocked =
                    (needsAge && !inlineAge) || (needsLocation && !inlineLocation);

                  return (
                    <>
                      {(needsAge || needsLocation) && (
                        <div className="mb-8 rounded-2xl bg-orange-50 border border-orange-100 p-5">
                          <div className="flex items-start gap-3 mb-4">
                            <Activity className="h-5 w-5 text-power-orange mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                Missing Information
                              </p>
                              <p className="text-xs text-slate-600">
                                We need a bit more info to find the right sport.
                              </p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            {needsAge && (
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                  What is {selectedDependent.name}&apos;s age?
                                </label>
                                <input
                                  type="number"
                                  min="3"
                                  max="21"
                                  className="w-full rounded-xl border-slate-200 px-4 py-2 focus:border-power-orange focus:ring-power-orange"
                                  value={inlineAge}
                                  onChange={(e) => setInlineAge(e.target.value)}
                                />
                              </div>
                            )}
                            {needsLocation && (
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                  Which state are you in?
                                </label>
                                <select
                                  className="w-full rounded-xl border-slate-200 px-4 py-2 focus:border-power-orange focus:ring-power-orange"
                                  value={inlineLocation}
                                  onChange={(e) => setInlineLocation(e.target.value)}
                                >
                                  <option value="">Select state...</option>
                                  {INDIAN_STATES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (playerProfile) {
                              onClose();
                            } else {
                              setSelectedDependent(null);
                              setStep("select_dependent");
                            }
                          }}
                        >
                          {playerProfile ? "Cancel" : "Back"}
                        </Button>
                        <Button
                          variant="primary"
                          disabled={isBlocked}
                          onClick={() => {
                            const pAge =
                              selectedDependent.age ||
                              (selectedDependent.dob
                                ? Math.floor(
                                    (new Date().getTime() -
                                      new Date(selectedDependent.dob).getTime()) /
                                      31557600000,
                                  )
                                : null);
                            const finalAge = pAge || parseInt(inlineAge);
                            const finalLocation = selectedDependent.location || inlineLocation;
                            const dep = selectedDependent as any;

                            fetchRecommendations({
                              child_age: finalAge,
                              gender: dep.gender,
                              location: finalLocation,
                              primary_objective: dep.primaryObjective || "Recreational",
                              budget_tier: dep.budgetTier || "Moderate",
                              personality_tags: dep.personalityTags?.length
                                ? dep.personalityTags
                                : ["Energetic"],
                              height_cm: dep.heightCm,
                              weight_kg: dep.weightKg,
                              medical_conditions: dep.medicalConditions?.length
                                ? dep.medicalConditions
                                : undefined,
                              weekly_time_commitment: dep.weeklyTimeCommitment,
                            });
                          }}
                        >
                          Find Matches <Sparkles className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Results */}
            {step === "results" && (
              <div className="space-y-6">
                <div className="flex justify-center mb-2">
                  <AIDisclaimer variant="sportmatch" />
                </div>
                {recommendations.length > 0 && recommendations[0].matchScore < 30 ? (
                  <div className="text-center mb-6">
                    <h3 className="font-title text-xl font-bold text-slate-900 mb-2">
                      We don&apos;t have a strong match yet
                    </h3>
                    <p className="text-sm text-slate-500">
                      Here are some options to explore based on the data we have.
                    </p>
                  </div>
                ) : (
                  <div className="text-center mb-6">
                    <h3 className="font-title text-xl font-bold text-slate-900 mb-2">
                      Your Top Matches
                    </h3>
                    <p className="text-sm text-slate-500">
                      Based on your profile, these are the best sports to pursue.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="rec-cards">
                  {recommendations.map((rec, i) => (
                    <div
                      key={rec.sportSlug}
                      className="flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition"
                    >
                      <div
                        className={`p-4 ${i === 0 ? "bg-orange-50 border-b border-orange-100" : "bg-slate-50 border-b border-slate-100"}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-title text-xl font-bold text-slate-900">
                            {rec.sportName}
                          </h3>
                          {i === 0 && rec.matchScore >= 30 && (
                            <span className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-bold text-power-orange">
                              Top Match
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Match Score: {rec.matchScore}%
                        </p>
                      </div>

                      <div className="p-5 flex-1 flex flex-col gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Why this sport?
                          </p>
                          <ul className="space-y-2">
                            {rec.reasons.map((r, ri) => (
                              <li
                                key={ri}
                                className="flex items-start gap-2 text-sm text-slate-600"
                              >
                                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-power-orange" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {rec.monthlyCostRange && rec.keyTalentSignal ? (
                          <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Wallet className="h-3 w-3" /> Cost/mo
                              </p>
                              <p className="text-sm font-semibold text-slate-800">
                                {rec.monthlyCostRange}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Activity className="h-3 w-3" /> Key Trait
                              </p>
                              <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                                {rec.keyTalentSignal}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-auto pt-4 border-t border-slate-100">
                            <p className="text-sm italic text-slate-600 text-center">
                              Full details ready once you explore this sport →
                            </p>
                          </div>
                        )}

                        <Button
                          variant={i === 0 ? "primary" : "outline"}
                          className="w-full mt-2"
                          onClick={() => {
                            onExplore(rec.sportName, selectedDependent?._id);
                          }}
                        >
                          Explore Pathway <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Start over */}
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => {
                      setRecommendations([]);
                      setStep("select_dependent");
                      setQStep(1);
                      setSelectedDependent(null);
                      setManualData({
                        name: "",
                        gender: "MALE",
                        relation: "CHILD",
                        child_age: "",
                        height_cm: "",
                        weight_kg: "",
                        medical_conditions: [],
                        medicalConditionsInput: "",
                        location: savedState,
                        weeklyTimeCommitment: 5,
                        school_sport_involvement: false,
                        sports: [],
                        yearsPlaying: "",
                        primary_objective: "",
                        budget_tier: "",
                        personality_tags: [],
                        team_preference: "",
                        indoor_outdoor_preference: "",
                        intensity_preference: "",
                      });
                    }}
                    className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                  >
                    Try different inputs
                  </button>
                </div>

                {/* Expert / Team CTAs */}
                <div className="mt-2 flex flex-col items-center gap-3 pt-6 border-t border-slate-100">
                  <p className="text-sm text-slate-500">Still unsure? Get a human perspective.</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <a
                      href="/experts"
                      className="flex items-center gap-2 rounded-xl border-2 border-power-orange px-5 py-2.5 text-sm font-bold text-power-orange hover:bg-orange-50 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Talk to our expert
                    </a>
                    <a
                      href="https://wa.me/918968582443?text=Hi!%20I%20found%20PowerMySport%20and%20would%20like%20to%20know%20more%20about%20sports%20guidance%20for%20my%20child."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border-2 border-[#25D366] px-5 py-2.5 text-sm font-bold text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
                    >
                      <Users className="h-4 w-4" />
                      Talk to our team
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
