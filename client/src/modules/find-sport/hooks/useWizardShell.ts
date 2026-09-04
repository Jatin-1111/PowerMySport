"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api/axios";
import { useFlow } from "@/flow/useFlow";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { useRefreshProfile } from "@/modules/auth/hooks/useProfile";
import { authApi } from "@/modules/auth/services/auth";
import type { PlayerProfile } from "@/modules/guidance/types";
import type { WizardAnswers } from "../types";
import { EMPTY_ANSWERS } from "../types";
import type { SportFitResult, SportResult } from "../types";
import { scoreChosenSports, scoreSports } from "../utils/scorer";
import { buildDependentPayload, prefillFromPlayer } from "../utils/dependentMapping";
import {
  ASSESSMENT_FLOW,
  SECTION_META,
  STEPS,
  getProfileChips,
  questionProgress,
} from "../components/wizard/wizardSteps";
import { firstNoteFor, scheduleTrialCheckIn, trialSignals } from "../components/wizard/wizardTrial";

export function useWizardShell() {
  const { token } = useAuthStore();
  const refreshProfile = useRefreshProfile();
  const [answers, setAnswers] = useState<WizardAnswers>({ ...EMPTY_ANSWERS });
  // Scores are a pure function of the answers, so they are derived, not stored.
  // Previously they lived in state and were populated by the `processing` step's
  // effect, which meant the results only existed once that effect had run —
  // fine for the linear flow, but it made the results step impossible to reach
  // from a URL (a deep link would render an empty report). Deriving them makes
  // the results a function of context, which is the prerequisite for putting
  // this wizard's step in the URL. The persistence side-effects (save to the
  // API, localStorage, trial check-in) stay in the processing effect below —
  // only the computation moved.
  const results = useMemo(() => scoreSports(answers), [answers]);
  const chosenFits = useMemo(() => scoreChosenSports(answers), [answers]);

  // The active step lives in the URL (?step=): Back walks the questionnaire
  // instead of leaving it, refresh keeps your place, and each step is linkable
  // for drop-off analytics. `goNext`/`goBack` below are this flow's next/back,
  // so every existing call site (question auto-advance, transitions, the
  // processing screen's auto-advance) is unchanged. Completion = the last
  // question answered; see ASSESSMENT_FLOW.
  const flow = useMemo(() => ASSESSMENT_FLOW, []);
  const {
    index: stepIndex,
    direction,
    next: goNext,
    back: goBack,
    goToStep,
  } = useFlow(flow, { completed: answers.weeklyHours != null });
  const [nameInput, setNameInput] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  // The sport the parent explicitly committed to on the results page — the one
  // decision this flow captures, as opposed to everything we infer from scores.
  const [chosenSport, setChosenSport] = useState<string | null>(null);
  const [choosingSport, setChoosingSport] = useState(false);
  // Holds wizard data to auto-import once we confirm the user has no children yet
  const pendingImport = useRef<{
    answers: WizardAnswers;
    scored: SportResult[];
    chosen: SportFitResult[];
    chosenSport?: string;
  } | null>(null);

  // Child profile selection
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [selectedDependentId, setSelectedDependentId] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedForName, setSavedForName] = useState<string | undefined>(undefined);

  // Restore wizard session from localStorage on mount (works for both guests and
  // newly-registered users who filled the wizard before signing up).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pms_wizard_results");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        answers: WizardAnswers;
        savedAt: string;
        chosenSport?: string;
      };
      if (Date.now() - new Date(saved.savedAt).getTime() > 24 * 60 * 60 * 1000) return;
      if (!saved.answers) return;

      const restored = { ...EMPTY_ANSWERS, ...saved.answers };
      setAnswers(restored);
      if (restored.childName) setNameInput(restored.childName);
      const scored = scoreSports(restored);
      const chosen = scoreChosenSports(restored);
      if (scored.length === 0 && chosen.length === 0) return;
      if (saved.chosenSport) setChosenSport(saved.chosenSport);
      goToStep(STEPS.length);

      // Logged-in user: defer the child profile creation until after the
      // players fetch confirms they have no existing children (newly registered).
      if (token) {
        pendingImport.current = {
          answers: restored,
          scored,
          chosen,
          // A sport picked as a guest has nowhere to live until the dependent
          // exists — it rides in on creation rather than being lost at signup.
          ...(saved.chosenSport ? { chosenSport: saved.chosenSport } : {}),
        };
        setSavedStatus("saving");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch full player profiles on mount (for pre-fill with wizard fields).
  // Also handles the post-registration auto-import: if the user has no children
  // yet and pendingImport holds their guest wizard session, create the child now.
  useEffect(() => {
    if (!token) return;
    api
      .get<{ success: boolean; data: PlayerProfile[] }>("/auth/players")
      .then((res) => {
        if (!res.data.success || !Array.isArray(res.data.data)) return;
        const dependents = res.data.data.filter((p) => p.type === "DEPENDENT");
        setPlayers(dependents);

        if (dependents.length === 0 && pendingImport.current) {
          // Newly registered user — create child profile from their guest session
          const { answers: a, scored, chosen, chosenSport: pickedSport } = pendingImport.current;
          pendingImport.current = null;
          const childName = a.childName?.trim() || "My Child";
          authApi
            .addDependent({
              name: childName,
              ...buildDependentPayload(a, scored, childName, chosen, pickedSport),
            })
            .then((r) => {
              if (r.data?._id) setSelectedDependentId(r.data._id);
              setSavedForName(childName);
              setSavedStatus("saved");
              try {
                localStorage.removeItem("pms_wizard_results");
              } catch {}
              void refreshProfile();
            })
            .catch(() => setSavedStatus("error"));
        } else {
          // Existing parent — discard any pending import (they already have children)
          pendingImport.current = null;
          if (savedStatus === "saving") setSavedStatus("idle");
          // Auto-select the only dependent for pre-fill
          if (dependents.length === 1) {
            setSelectedDependentId(dependents[0]._id);
            applyPlayer(dependents[0]);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function applyPlayer(player: PlayerProfile) {
    const prefilled = prefillFromPlayer(player);
    const firstName = player.name?.split(" ")[0] ?? "";
    if (firstName) {
      setNameInput(firstName);
      prefilled.childName = firstName;
    }
    setAnswers((prev) => ({ ...prev, ...prefilled }));
    // Carry the last decision forward on a retake — they can change it on any
    // card, but it shouldn't silently reset to "no sport picked".
    setChosenSport(player.chosenSport ?? null);
  }

  function selectDependent(player: PlayerProfile) {
    if (selectedDependentId === player._id) {
      // Deselect — reset to empty
      startNewChild();
    } else {
      setSelectedDependentId(player._id);
      applyPlayer(player);
    }
  }

  /** Clears the selection back to a blank profile — "Someone new" / deselect. */
  function startNewChild() {
    setSelectedDependentId(null);
    setAnswers({ ...EMPTY_ANSWERS });
    setNameInput("");
    setChosenSport(null);
  }

  const currentStep = STEPS[stepIndex];
  const progress = questionProgress(stepIndex);
  const showProgress = currentStep.kind !== "welcome" && currentStep.kind !== "results";
  const showBack =
    stepIndex > 0 && currentStep.kind !== "processing" && currentStep.kind !== "results";
  const isFullScreen =
    currentStep.kind === "welcome" ||
    currentStep.kind === "results" ||
    currentStep.kind === "processing";

  // Derive current section for the left panel
  const currentSection: string = (() => {
    if (currentStep.kind === "question") {
      const sectionMap: Record<string, string> = {
        dob: "Child",
        gender: "Child",
        state: "Child",
        priorSports: "Child",
        consideringSports: "Child",
        height: "Physical",
        weight: "Physical",
        energyType: "Physical",
        motorType: "Physical",
        visualTracking: "Physical",
        eyesight: "Physical",
        agility: "Physical",
        teamIndividual: "Personality",
        competitiveResponse: "Personality",
        focusStyle: "Personality",
        decisionStyle: "Personality",
        pressureResponse: "Personality",
        repetitionTolerance: "Personality",
        contactComfort: "Comfort",
        environment: "Comfort",
        waterComfort: "Comfort",
        medicalConditions: "Comfort",
        budget: "Practical",
        ambition: "Practical",
        weeklyHours: "Practical",
      };
      return sectionMap[currentStep.questionKey] ?? "";
    }
    if (currentStep.kind === "name") return "Child";
    if (currentStep.kind === "transition") {
      // Pick section based on which transition (before Physical, Personality, Practical)
      const textSnippet = currentStep.text;
      if (textSnippet.includes("physically")) return "Physical";
      if (textSnippet.includes("interesting")) return "Personality";
      return "Practical";
    }
    return "";
  })();

  const profileChips = getProfileChips(answers);
  const sectionMeta = SECTION_META[currentSection];

  const setAnswer = <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const retake = () => {
    setAnswers({ ...EMPTY_ANSWERS });
    setNameInput("");
    setSavedStatus("idle");
    setChosenSport(null);
    goToStep(1);
  };

  /**
   * The parent committing to a sport. Optimistic — the pick drives the trial
   * CTA, the screening pre-fill and the check-in immediately, and a failed
   * write shouldn't undo a decision they can see they made.
   */
  const chooseSport = (sport: string) => {
    if (sport === chosenSport) return;
    setChosenSport(sport);

    // Guests have no dependent to write to; the pick rides along with the
    // results in localStorage and transfers on registration.
    if (!token) {
      try {
        const raw = localStorage.getItem("pms_wizard_results");
        const saved = raw ? JSON.parse(raw) : { answers, savedAt: new Date().toISOString() };
        localStorage.setItem(
          "pms_wizard_results",
          JSON.stringify({ ...saved, chosenSport: sport })
        );
      } catch {}
      return;
    }

    setChoosingSport(true);
    api
      .post("/plan-checkins/find-sport-trial/choice", {
        dependentId: selectedDependentId || undefined,
        sport,
        signals: trialSignals(firstNoteFor(sport, results, chosenFits), answers.childName),
      })
      .then(() => {
        // The auth store's `user.dependents` otherwise keeps the pre-choice
        // snapshot — anything reading it (e.g. the homepage hero) would show
        // stale state until the next login/reload.
        if (selectedDependentId) void refreshProfile();
      })
      .catch(() => {})
      .finally(() => setChoosingSport(false));
  };

  // Run scoring on the processing screen, then auto-advance to results.
  useEffect(() => {
    if (currentStep.kind === "processing") {
      const timer = setTimeout(async () => {
        const scored = scoreSports(answers);
        const chosen = scoreChosenSports(answers);

        // Save to profile if logged in with a selected dependent (update)
        if (token && selectedDependentId) {
          setSavedStatus("saving");
          const displayName =
            players.find((p) => p._id === selectedDependentId)?.name.split(" ")[0] ??
            answers.childName;
          try {
            await authApi.updateDependent(
              selectedDependentId,
              buildDependentPayload(answers, scored, undefined, chosen)
            );
            setSavedForName(displayName || undefined);
            setSavedStatus("saved");
            scheduleTrialCheckIn(
              selectedDependentId,
              scored,
              chosen,
              displayName || answers.childName
            );
            void refreshProfile();
          } catch {
            setSavedStatus("error");
          }
        } else if (token && !selectedDependentId) {
          // Logged-in parent with no child selected — create a new child profile
          setSavedStatus("saving");
          const childName = answers.childName?.trim() || "My Child";
          try {
            const res = await authApi.addDependent({
              name: childName,
              ...buildDependentPayload(answers, scored, childName, chosen),
            });
            if (res.data?._id) setSelectedDependentId(res.data._id);
            setSavedForName(childName);
            setSavedStatus("saved");
            scheduleTrialCheckIn(res.data?._id ?? null, scored, chosen, childName);
            void refreshProfile();
          } catch {
            setSavedStatus("error");
          }
        } else if (!token) {
          // Guest: save to localStorage so the results survive a soft reload
          try {
            localStorage.setItem(
              "pms_wizard_results",
              JSON.stringify({
                answers,
                results: [
                  ...chosen.map((r) => ({
                    sport: r.sport.name,
                    fitLabel: r.fitLabel,
                    score: r.score,
                  })),
                  ...scored.map((r) => ({
                    sport: r.sport.name,
                    fitLabel: r.fitLabel,
                    score: r.score,
                  })),
                ].slice(0, 3),
                savedAt: new Date().toISOString(),
              })
            );
          } catch {}
        }

        goNext();
      }, 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Focus name input when on name screen
  useEffect(() => {
    if (currentStep.kind === "name") nameRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const transitionText = (text: string) =>
    text.replace("{name}", answers.childName || "your child");

  const selectedPlayer = players.find((p) => p._id === selectedDependentId);

  return {
    token,
    answers,
    setAnswer,
    nameInput,
    setNameInput,
    nameRef,
    chosenSport,
    choosingSport,
    players,
    selectedDependentId,
    selectDependent,
    startNewChild,
    savedStatus,
    savedForName,
    results,
    chosenFits,
    stepIndex,
    direction,
    goNext,
    goBack,
    currentStep,
    progress,
    showProgress,
    showBack,
    isFullScreen,
    currentSection,
    sectionMeta,
    profileChips,
    transitionText,
    retake,
    chooseSport,
    selectedPlayer,
  };
}
