"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  ChevronRight,
  Target,
  Wallet,
  Activity,
  MapPin,
} from "lucide-react";
import { Button } from "@/modules/shared/ui/Button";
import {
  PERSONALITY_OPTIONS,
  OBJECTIVES,
  BUDGET_OPTIONS,
  INDIAN_STATES,
} from "../../constants";
import type { PlayerProfile } from "../../types";
import { authApi } from "@/modules/auth/services/auth";
import axiosInstance from "@/lib/api/axios";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { DEPENDENT_RELATIONS } from "@/modules/player/constants/dependentRelations";
import { AIDisclaimer } from "@/components/shared/AIDisclaimer";

type SportRecommendation = {
  sportSlug: string;
  sportName: string;
  matchScore: number;
  reasons: string[];
  monthlyCostRange: string | null;
  keyTalentSignal: string | null;
};

interface SportMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerProfile?: PlayerProfile | null;
  dependents?: PlayerProfile[];
  onExplore: (sportName: string, dependentId?: string) => void;
  onRecommendationsReady?: () => void;
}

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
  const [recommendations, setRecommendations] = useState<SportRecommendation[]>(
    [],
  );
  const [selectedDependent, setSelectedDependent] =
    useState<PlayerProfile | null>(null);
  const [localDependents, setLocalDependents] = useState<PlayerProfile[]>(
    dependents || [],
  );
  const [manualData, setManualData] = useState({
    name: "",
    gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
    relation: "CHILD",
    child_age: "",
    location: "",
    sports: [] as string[],
    yearsPlaying: "",
    primary_objective: "",
    weeklyTimeCommitment: 3,
    budget_tier: "",
    personality_tags: [] as string[],
  });
  const [qStep, setQStep] = useState(1);
  const [inlineAge, setInlineAge] = useState("");
  const [inlineLocation, setInlineLocation] = useState("");

  // Check if we have data on open
  useEffect(() => {
    if (isOpen) {
      if (recommendations.length > 0) {
        setStep("results");
        return;
      }
      if (playerProfile) {
        setSelectedDependent(playerProfile);
        setStep("profile_summary");
      } else {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
          setStep("questions");
          return;
        }

        // Fetch fresh dependents just in case store is stale
        authApi
          .getProfile()
          .then((res) => {
            if (
              res.success &&
              res.data?.dependents &&
              res.data.dependents.length > 0
            ) {
              setLocalDependents(
                res.data.dependents as unknown as PlayerProfile[],
              );
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

  const fetchRecommendations = async (data: any) => {
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

            {step === "select_dependent" && (
              <div className="mx-auto max-w-xl py-8 text-center">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">
                  Who are we finding a sport for?
                </h3>
                {localDependents && localDependents.length > 0 ? (
                  <div className="space-y-3">
                    {localDependents.map((dep) => {
                      const calcAge =
                        dep.age ||
                        (dep.dob
                          ? Math.floor(
                              (new Date().getTime() -
                                new Date(dep.dob).getTime()) /
                                31557600000,
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
                            <p className="font-bold text-slate-900">
                              {dep.name}
                            </p>
                            <p className="text-sm text-slate-500">
                              {calcAge ? `${calcAge} years old` : "Age not set"}
                            </p>
                          </div>
                          <ChevronRight className="ml-auto h-5 w-5 text-slate-400" />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            {step === "questions" && (
              <div className="mx-auto max-w-2xl py-6">
                <div className="mb-8 flex justify-center">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm transition-all ${qStep === s ? "bg-power-orange text-white ring-4 ring-orange-50" : qStep > s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400"}`}
                        >
                          {s}
                        </div>
                        {s < 3 && (
                          <div
                            className={`h-1 w-12 rounded-full ${qStep > s ? "bg-slate-800" : "bg-slate-100"}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">
                  {qStep === 1
                    ? "Let's get to know the athlete"
                    : qStep === 2
                      ? "Activity & Location"
                      : "Goals & Preferences"}
                </h3>

                <div className="space-y-6">
                  {qStep === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Athlete Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., John Doe"
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.name}
                            onChange={(e) =>
                              setManualData({
                                ...manualData,
                                name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Child's Age
                          </label>
                          <input
                            type="number"
                            min="3"
                            max="21"
                            placeholder="e.g., 8"
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.child_age}
                            onChange={(e) =>
                              setManualData({
                                ...manualData,
                                child_age: e.target.value,
                              })
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
                              setManualData({
                                ...manualData,
                                gender: e.target.value as any,
                              })
                            }
                          >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Relation to you
                          </label>
                          <select
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all appearance-none"
                            value={manualData.relation}
                            onChange={(e) =>
                              setManualData({
                                ...manualData,
                                relation: e.target.value,
                              })
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

                  {qStep === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            State/Location
                          </label>
                          <select
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all appearance-none"
                            value={manualData.location}
                            onChange={(e) =>
                              setManualData({
                                ...manualData,
                                location: e.target.value,
                              })
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
                            Weekly Time Commitment (Hours)
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
                                weeklyTimeCommitment:
                                  parseInt(e.target.value) || 3,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          Sports Currently Playing (Optional)
                        </label>
                        <SportsMultiSelect
                          value={manualData.sports}
                          onChange={(sports) =>
                            setManualData({ ...manualData, sports })
                          }
                        />
                      </div>

                      {manualData.sports.length > 0 && (
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Years Playing
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            placeholder="e.g., 2"
                            className="w-full rounded-2xl border-slate-200 px-4 py-3 focus:border-power-orange focus:ring-power-orange bg-slate-50 focus:bg-white transition-all"
                            value={manualData.yearsPlaying}
                            onChange={(e) =>
                              setManualData({
                                ...manualData,
                                yearsPlaying: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {qStep === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">
                          Primary Objective
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {OBJECTIVES.map((obj) => {
                            const Icon = obj.icon;
                            const isSelected =
                              manualData.primary_objective === obj.value;
                            return (
                              <button
                                key={obj.value}
                                onClick={() =>
                                  setManualData({
                                    ...manualData,
                                    primary_objective: obj.value,
                                  })
                                }
                                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${isSelected ? "border-power-orange bg-orange-50 text-power-orange scale-105 shadow-sm" : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"}`}
                              >
                                <Icon
                                  className={`h-8 w-8 mb-3 ${isSelected ? "text-power-orange" : "text-slate-400"}`}
                                />
                                <span className="text-sm font-bold">
                                  {obj.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">
                          Budget Tier
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {BUDGET_OPTIONS.map((b) => (
                            <button
                              key={b.value}
                              onClick={() =>
                                setManualData({
                                  ...manualData,
                                  budget_tier: b.value,
                                })
                              }
                              className={`py-3 px-4 rounded-2xl border-2 text-sm font-bold transition-all ${manualData.budget_tier === b.value ? "border-power-orange bg-power-orange text-white shadow-md" : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"}`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">
                          Personality Traits (Select up to 3)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {PERSONALITY_OPTIONS.map((p) => {
                            const isSelected =
                              manualData.personality_tags.includes(p.label);
                            return (
                              <button
                                key={p.label}
                                onClick={() => {
                                  if (isSelected) {
                                    setManualData({
                                      ...manualData,
                                      personality_tags:
                                        manualData.personality_tags.filter(
                                          (t) => t !== p.label,
                                        ),
                                    });
                                  } else if (
                                    manualData.personality_tags.length < 3
                                  ) {
                                    setManualData({
                                      ...manualData,
                                      personality_tags: [
                                        ...manualData.personality_tags,
                                        p.label,
                                      ],
                                    });
                                  }
                                }}
                                className={`flex items-center gap-2 py-2 px-4 rounded-full border-2 text-sm font-bold transition-all ${isSelected ? "border-power-orange bg-power-orange text-white" : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"}`}
                              >
                                <p.icon className="h-4 w-4" /> {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-8 border-t border-slate-100 mt-8">
                    <Button
                      variant="outline"
                      onClick={() =>
                        qStep > 1
                          ? setQStep(qStep - 1)
                          : setStep("select_dependent")
                      }
                    >
                      Back
                    </Button>

                    {qStep < 3 ? (
                      <Button
                        variant="primary"
                        disabled={
                          (qStep === 1 &&
                            (!manualData.name || !manualData.child_age)) ||
                          (qStep === 2 && !manualData.location)
                        }
                        onClick={() => setQStep(qStep + 1)}
                      >
                        Continue <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        disabled={
                          !manualData.primary_objective ||
                          !manualData.budget_tier ||
                          manualData.personality_tags.length === 0
                        }
                        onClick={() =>
                          fetchRecommendations({
                            child_age: parseInt(manualData.child_age),
                            location: manualData.location,
                            primary_objective: manualData.primary_objective,
                            budget_tier: manualData.budget_tier,
                            personality_tags: manualData.personality_tags,
                          })
                        }
                      >
                        Find Matches <Sparkles className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === "profile_summary" && selectedDependent && (
              <div className="mx-auto max-w-xl py-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2 text-center">
                  Using {selectedDependent.name}'s Profile
                </h3>
                <p className="text-center text-slate-500 mb-8">
                  We'll use these details to find the best sport.
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
                        <span className="text-sm text-slate-500 italic">
                          No tags specified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline prompts for missing data */}
                {(() => {
                  const hasAge = selectedDependent.age || selectedDependent.dob;
                  const hasLocation = !!selectedDependent.location;
                  const needsAge = !hasAge;
                  const needsLocation = !hasLocation;
                  const isBlocked =
                    (needsAge && !inlineAge) ||
                    (needsLocation && !inlineLocation);

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
                                  What is {selectedDependent.name}'s age?
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
                                  onChange={(e) =>
                                    setInlineLocation(e.target.value)
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
                                      new Date(
                                        selectedDependent.dob,
                                      ).getTime()) /
                                      31557600000,
                                  )
                                : null);
                            const finalAge = pAge || parseInt(inlineAge);
                            const finalLocation =
                              selectedDependent.location || inlineLocation;

                            fetchRecommendations({
                              child_age: finalAge,
                              location: finalLocation,
                              primary_objective:
                                selectedDependent.primaryObjective ||
                                "Recreational",
                              budget_tier:
                                selectedDependent.budgetTier || "Moderate",
                              personality_tags: selectedDependent
                                .personalityTags?.length
                                ? selectedDependent.personalityTags
                                : ["Energetic"],
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

            {step === "results" && (
              <div className="space-y-6">
                <div className="flex justify-center mb-2">
                  <AIDisclaimer variant="sportmatch" />
                </div>
                {recommendations.length > 0 &&
                recommendations[0].matchScore < 30 ? (
                  <div className="text-center mb-6">
                    <h3 className="font-title text-xl font-bold text-slate-900 mb-2">
                      We don't have a strong match yet
                    </h3>
                    <p className="text-sm text-slate-500">
                      Here are some options to explore based on the data we
                      have.
                    </p>
                  </div>
                ) : (
                  <div className="text-center mb-6">
                    <h3 className="font-title text-xl font-bold text-slate-900 mb-2">
                      Your Top Matches
                    </h3>
                    <p className="text-sm text-slate-500">
                      Based on your profile, these are the best sports to
                      pursue.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                          Explore Pathway{" "}
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
