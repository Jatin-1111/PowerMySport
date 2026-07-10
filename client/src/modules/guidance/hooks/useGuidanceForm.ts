"use client";

import api from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { useEffect, useRef, useState } from "react";
import { buildLevelPlanQuestion, initialForm } from "../constants";
import type {
    GuidanceFormState,
    GuidanceSubmission,
    PlayerProfile,
} from "../types";

export function useGuidanceForm({
  initialSport,
  initialLevel,
  initialLevelLabel,
  initialState,
}: {
  initialSport?: string;
  initialLevel?: number;
  initialLevelLabel?: string;
  initialState?: string;
} = {}) {
  const isLevelPlan = !!initialSport && !!initialLevel;
  const levelLabel =
    initialLevelLabel || (initialLevel ? `Level ${initialLevel}` : "");

  // NOTE: current_pathway_level intentionally does NOT default to initialLevel
  // here. initialLevel is "which level's plan/roadmap page the parent is
  // viewing", not "which level the child is currently at" — those are
  // different questions. Defaulting them to the same value used to make the
  // backend assume every level-plan request was for a child ALREADY playing
  // at that level, contradicting the "are we ready to start?" framing shown
  // to parents who haven't started yet. Step1Profile's explicit "already
  // here" vs "not there yet" toggle (shown only when levelContext is passed)
  // is the only place that sets current_pathway_level.
  const buildInitialForm = (): GuidanceFormState => {
    const base: GuidanceFormState = {
      ...initialForm,
      ...(initialSport ? { sport: initialSport } : {}),
      ...(initialState ? { location: initialState } : {}),
    };
    if (isLevelPlan) {
      base.parent_specific_question = buildLevelPlanQuestion(
        initialSport!,
        levelLabel,
        false,
      );
    }
    return base;
  };

  const [form, setForm] = useState<GuidanceFormState>(buildInitialForm);

  // Tracks the last auto-generated level-plan question so the toggle-driven
  // regeneration below never clobbers text the parent has since hand-edited.
  const lastAutoQuestion = useRef<string | null>(
    isLevelPlan
      ? buildLevelPlanQuestion(initialSport!, levelLabel, false)
      : null,
  );

  useEffect(() => {
    if (!isLevelPlan) return;
    const alreadyAtLevel = form.current_pathway_level === initialLevel;
    const next = buildLevelPlanQuestion(
      initialSport!,
      levelLabel,
      alreadyAtLevel,
    );
    // The comparison + ref mutation happen here, outside the setForm updater —
    // mutating a ref inside a functional updater is impure and breaks under
    // React Strict Mode's double-invocation of updaters (the second, discarded
    // invocation would see the ref already mutated by the first and bail).
    if (form.parent_specific_question === lastAutoQuestion.current) {
      lastAutoQuestion.current = next;
      setForm((f) => ({ ...f, parent_specific_question: next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.current_pathway_level]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<GuidanceSubmission | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [achievement, setAchievement] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [autofillFields, setAutofillFields] = useState<Set<string>>(new Set());
  const resultsRef = useRef<HTMLDivElement>(null);

  // Shared by manual dropdown selection and the auto-fill-on-load path below —
  // takes the player object directly rather than looking it up from `players`
  // state, since the auto-fill path fires right after the fetch resolves,
  // before that state update has re-rendered into this closure.
  const applyPlayerToForm = (player: PlayerProfile) => {
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

    // GuidanceFormState only models male/female — "OTHER" has no equivalent
    // slot, so leave the existing selection untouched rather than guess.
    const gender: GuidanceFormState["child_gender"] | undefined =
      player.gender === "MALE"
        ? "male"
        : player.gender === "FEMALE"
          ? "female"
          : undefined;

    const filled = new Set<string>();
    setForm((f) => {
      const next = { ...f };
      if (age) {
        next.child_age = age;
        filled.add("child_age");
      }
      if (gender) {
        next.child_gender = gender;
        filled.add("child_gender");
      }
      if (player.skillLevel) {
        next.current_fitness_level = fitness;
        filled.add("current_fitness_level");
      }
      if (player.yearsPlaying !== undefined) {
        next.years_playing = player.yearsPlaying;
        filled.add("years_playing");
      }
      if (player.personalityTags?.length) {
        next.personality_tags = player.personalityTags;
        filled.add("personality_tags");
      }
      if (player.primaryObjective) {
        next.primary_objective = player.primaryObjective;
        filled.add("primary_objective");
      }
      if (player.weeklyTimeCommitment) {
        next.weekly_time_commitment = player.weeklyTimeCommitment;
        filled.add("weekly_time_commitment");
      }
      if (player.budgetTier) {
        next.budget_tier = player.budgetTier;
        filled.add("budget_tier");
      }
      if (player.sportsFocus?.length && !initialSport) {
        next.sport = player.sportsFocus.join(", ");
        filled.add("sport");
      }
      if (player.location) {
        next.location = player.location;
        filled.add("location");
      }
      return next;
    });
    setAutofillFields(filled);
  };

  useEffect(() => {
    api
      .get("/auth/players")
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          const list: PlayerProfile[] = res.data.data;
          setPlayers(list);
          // Sync automatically when there's exactly one saved profile — no
          // ambiguity about which child this guidance is for. With multiple
          // profiles, the parent still picks via the dropdown in Step1.
          if (list.length === 1) {
            setSelectedProfileId(list[0]._id);
            applyPlayerToForm(list[0]);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => setForm((c) => ({ ...c, [k]: v }));

  const handleProfileSelect = (id: string) => {
    setSelectedProfileId(id);
    if (!id) {
      const next = buildInitialForm();
      lastAutoQuestion.current = isLevelPlan
        ? next.parent_specific_question
        : null;
      setForm(next);
      setAutofillFields(new Set());
      return;
    }
    const player = players.find((p) => p._id === id);
    if (!player) return;
    applyPlayerToForm(player);
  };

  const nextStep = () => {
    const messages = [
      "Great start! ✨",
      "Step Complete!",
      "Keep Going! ⚡",
      "Almost There! 🔥",
      "Final Step! 🏆",
    ];
    setAchievement(messages[step - 1] || "Progress!");
    setTimeout(() => setAchievement(null), 2000);
    setStep((s) => Math.min(s + 1, 5));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async (onSuccess: (sub: GuidanceSubmission) => void) => {
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
        status?: string;
        sport?: string;
        data: GuidanceSubmission;
      }>("/guidance", payload);

      if (response.data.status === "not_supported") {
        const sport = response.data.sport ?? form.sport ?? "that sport";
        toast.error(
          `We're building the ${sport} pathway — our team is working on it! Try Cricket, Tennis, Football, or any of our 10 supported sports.`,
          { duration: 6000 } as any,
        );
        return;
      }

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
    const next = buildInitialForm();
    lastAutoQuestion.current = isLevelPlan
      ? next.parent_specific_question
      : null;
    setForm(next);
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
