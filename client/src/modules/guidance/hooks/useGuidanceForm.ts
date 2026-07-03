"use client";

import { useState, useRef, useEffect } from "react";
import api from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { initialForm } from "../constants";
import type { GuidanceFormState, GuidanceSubmission, PlayerProfile } from "../types";

export function useGuidanceForm({
  initialSport,
  initialLevel,
}: {
  initialSport?: string;
  initialLevel?: number;
} = {}) {
  // NOTE: current_pathway_level intentionally does NOT default to initialLevel
  // here. initialLevel is "which level's plan/roadmap page the parent is
  // viewing", not "which level the child is currently at" — those are
  // different questions. Defaulting them to the same value used to make the
  // backend assume every level-plan request was for a child ALREADY playing
  // at that level, contradicting the "are we ready to start?" framing shown
  // to parents who haven't started yet. LevelPlanFlow's explicit
  // "already here" vs "not there yet" toggle is now the only place that sets
  // current_pathway_level.
  const [form, setForm] = useState<GuidanceFormState>({
    ...initialForm,
    ...(initialSport ? { sport: initialSport } : {}),
  });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<GuidanceSubmission | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [achievement, setAchievement] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [autofillFields, setAutofillFields] = useState<Set<string>>(new Set());
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get("/auth/players")
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data))
          setPlayers(res.data.data);
      })
      .catch(() => {});
  }, []);

  const update = <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => setForm((c) => ({ ...c, [k]: v }));

  const handleProfileSelect = (id: string) => {
    setSelectedProfileId(id);
    if (!id) {
      setForm(initialForm);
      return;
    }
    const player = players.find((p) => p._id === id);
    if (!player) return;

    let age = form.child_age;
    if (player.age) age = player.age;
    else if (player.dob) {
      const bd = new Date(player.dob);
      age = Math.abs(
        new Date(Date.now() - bd.getTime()).getUTCFullYear() - 1970,
      );
    }

    let fitness: GuidanceFormState["current_fitness_level"] =
      form.current_fitness_level;
    if (player.skillLevel?.toLowerCase().includes("beginner")) fitness = "Low";
    else if (player.skillLevel?.toLowerCase().includes("intermediate"))
      fitness = "Moderate";
    else if (player.skillLevel?.toLowerCase().includes("advanced"))
      fitness = "High";

    const filled = new Set<string>();
    setForm((f) => {
      const next = { ...f };
      if (age) { next.child_age = age; filled.add("child_age"); }
      if (player.skillLevel) { next.current_fitness_level = fitness; filled.add("current_fitness_level"); }
      if (player.personalityTags?.length) { next.personality_tags = player.personalityTags; filled.add("personality_tags"); }
      if (player.primaryObjective) { next.primary_objective = player.primaryObjective; filled.add("primary_objective"); }
      if (player.weeklyTimeCommitment) { next.weekly_time_commitment = player.weeklyTimeCommitment; filled.add("weekly_time_commitment"); }
      if (player.budgetTier) { next.budget_tier = player.budgetTier; filled.add("budget_tier"); }
      if (player.sportsFocus?.length && !initialSport) { next.sport = player.sportsFocus.join(", "); filled.add("sport"); }
      if (player.location) { next.location = player.location; filled.add("location"); }
      return next;
    });
    setAutofillFields(filled);
  };

  const nextStep = () => {
    const messages = [
      "Step Complete!",
      "Keep Going! ⚡",
      "Almost There! 🔥",
      "Final Step! 🏆",
    ];
    setAchievement(messages[step - 1] || "Progress!");
    setTimeout(() => setAchievement(null), 2000);
    setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async (
    onSuccess: (sub: GuidanceSubmission) => void,
  ) => {
    setLoading(true);
    const payload = {
      ...form,
      child_age: Number(form.child_age),
      weekly_time_commitment: Number(form.weekly_time_commitment),
    };
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        data: GuidanceSubmission;
      }>("/guidance", payload);
      setSubmission(response.data.data);
      setShowResults(true);
      setAchievement("🏆 Roadmap unlocked!");
      setTimeout(() => {
        setAchievement(null);
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 2000);
      toast.success("Guidance generated!");
      onSuccess(response.data.data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to generate guidance.";
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setStep(1);
    setShowResults(false);
    setSubmission(null);
    setAutofillFields(new Set());
    setSelectedProfileId("");
  };

  const editInputs = () => {
    setShowResults(false);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return {
    form,
    setForm,
    step,
    loading,
    submission,
    setSubmission,
    players,
    selectedProfileId,
    achievement,
    setAchievement,
    showResults,
    setShowResults,
    autofillFields,
    resultsRef,
    update,
    handleProfileSelect,
    nextStep,
    prevStep,
    handleSubmit,
    resetForm,
    editInputs,
  };
}
