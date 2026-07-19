"use client";

import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { LoginRequiredModal } from "@/modules/guidance/components/chat/LoginRequiredModal";
import RoadmapIntroModal from "./RoadmapIntroModal";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { PathwayConciergeModal } from "@/modules/sports/components/PathwayConciergeModal";
import { RoadmapChatDrawer } from "@/modules/sports/components/RoadmapChatDrawer";
import {
    groupLevelsIntoMacro,
} from "@/modules/sports/config/macroLevels";
import {
    federationApi,
    pathwayApi,
    type Federation,
    PathwayLevel,
    SportPathway,
} from "@/modules/sports/services/pathway";
import { FederationCard } from "./FederationCard";
import {
    AthleteStory,
    roadmapProfileApi,
} from "@/modules/sports/services/roadmapProfileApi";
import { Sport, sportsApi } from "@/modules/sports/services/sports";
import { AnimatePresence, motion } from "framer-motion";
import Fuse from "fuse.js";
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    Briefcase,
    Calculator,
    CheckCircle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Flag,
    GitCompare,
    // P5-P9 icons
    Heart,
    Info,
    Landmark,
    Loader2,
    MapPin,
    MessageSquareQuote,
    Search,
    ShoppingBag,
    Sparkles,
    Target,
    TrendingUp,
    Trophy,
    Users,
    Wallet,
    X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
    fadeUp,
    INDIAN_STATES,
    orchestrator,
    pathwayLevels,
    SPRING_STIFF
} from '../config/constants';
import { DEFAULT_PROGRESS, ProgressState } from '../types';
import {
    ApplicationRecord,
    highlightMatch,
    loadApplications,
    loadProgress,
    loadSaved,
    loadState,
    saveApplications,
    SavedItem,
    saveProgress,
    saveSaved,
    saveState
} from '../utils';
import { ApplicationsTab } from './ApplicationsTab';
import { BudgetCalculator } from './BudgetCalculator';
import { ComparePanel } from './ComparePanel';
import { PathwayLevelCard } from './PathwayLevelCard';
import { PathwayLevelDetail } from './PathwayLevelDetail';
import { ProgressionStepper } from './ProgressionStepper';
import { SaveButton } from './SaveButton';
import { SavedTab } from './SavedTab';
import { StoriesTab } from './StoriesTab';
import { AmbientBlob } from './SubComponents';

// ─── Sport search section ──────────────────────────────────────────────────────

// Maps 1:1 onto the 3 macro pathway tiers (MACRO_LEVEL_CONFIGS) — the same
// enum already collected by the find-sport/guidance wizards.
const EXPERIENCE_TO_MACRO_INDEX: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  competitive: 2,
};

export function PathwayExplorerSection() {
  const [query, setQuery] = useState("");
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [fuse, setFuse] = useState<Fuse<Sport> | null>(null);
  const [suggestions, setSuggestions] = useState<Sport[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "not_supported"
  >("idle");
  const [notSupportedSport, setNotSupportedSport] = useState<string>("");
  const [result, setResult] = useState<{
    pathway: SportPathway;
    source: "db" | "generated";
  } | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [entitiesStatus, setEntitiesStatus] = useState<
    "idle" | "loading" | "ready"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<
    "journey" | "opportunities" | "plan" | "inspire" | "saved" | "applications"
  >("journey");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const toggleCard = (key: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [ownedEquipment, setOwnedEquipment] = useState<Set<string>>(new Set());
  const toggleOwned = (key: string) =>
    setOwnedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [modalData, setModalData] = useState<{
    item: any;
    type: "tournament" | "scholarship" | "university";
  } | null>(null);
  const [federations, setFederations] = useState<Federation[]>([]);

  // P1: progress tracker state
  const [progress, setProgress] = useState<ProgressState>(DEFAULT_PROGRESS);

  // P2: state/city selector
  const [selectedState, setSelectedState] = useState<string>("");
  const [stateOpen, setStateOpen] = useState(false);

  // P5-P8 states
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  // Which child the saved-items/progress/applications profile belongs to
  const [dependents, setDependents] = useState<any[]>([]);
  const [selectedDependentId, setSelectedDependentId] = useState<string | null>(null);
  const ROADMAP_DEPENDENT_KEY = "pms_roadmap_dependent";

  const inputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuthStore();
  const [dbStories, setDbStories] = useState<AthleteStory[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoginModalOpen, setChatLoginModalOpen] = useState(false);
  const [introModalOpen, setIntroModalOpen] = useState(false);
  const _cacheRestoredRef = useRef(false);
  const INTRO_KEY = "pms_roadmap_intro_v2";

  const searchParams = useSearchParams();
  const router = useRouter();
  const [contextBanner, setContextBanner] = useState<{
    age: string;
    budget: string;
    state: string;
  } | null>(null);
  const [hasWizardResults, setHasWizardResults] = useState(false);

  // Restore cached pathway result before the browser paints — prevents any
  // loading/idle flash when the user navigates back from a federation or
  // tournament page. useLayoutEffect fires client-only, before first paint.
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sport = params.get("sport");
    if (!sport) return;
    try {
      const raw = sessionStorage.getItem("pms_pathway_cache");
      if (!raw) return;
      const { key, data, ts } = JSON.parse(raw);
      const state =
        params.get("state") ||
        localStorage.getItem("pms_pathway_state") ||
        "";
      if (
        key === `${sport.toLowerCase()}|${state}` &&
        Date.now() - ts < 5 * 60 * 1000
      ) {
        setResult(data);
        setQuery(data.pathway.sportName);
        setStatus("success");
        setEntitiesStatus("ready");
        _cacheRestoredRef.current = true;
      }
    } catch {}
  }, []);

  const loadProfileForDependent = async (depId: string | null) => {
    const dbProfile = await roadmapProfileApi.getProfile(depId);
    if (dbProfile) {
      setProgress(dbProfile.progress || DEFAULT_PROGRESS);
      setSavedItems(dbProfile.savedItems || []);
      setApplications(dbProfile.applications || []);
    } else {
      setProgress(DEFAULT_PROGRESS);
      setSavedItems([]);
      setApplications([]);
    }
  };

  const selectDependent = (depId: string | null) => {
    setSelectedDependentId(depId);
    if (depId) localStorage.setItem(ROADMAP_DEPENDENT_KEY, depId);
    else localStorage.removeItem(ROADMAP_DEPENDENT_KEY);
    loadProfileForDependent(depId);
  };

  // Load from DB or fallback to localStorage
  useEffect(() => {
    const initProfile = async () => {
      setSelectedState(loadState());
      if (user) {
        const res = await authApi.getPlayers();
        const deps = (res.data || []).filter((p: any) => p.type === "DEPENDENT");
        setDependents(deps);

        let initialDepId: string | null = null;
        if (deps.length === 1) {
          initialDepId = deps[0]._id;
        } else if (deps.length > 1) {
          const stored = localStorage.getItem(ROADMAP_DEPENDENT_KEY);
          initialDepId = stored && deps.some((d: any) => d._id === stored) ? stored : null;
        }
        setSelectedDependentId(initialDepId);
        await loadProfileForDependent(initialDepId);
        return;
      }
      setProgress(loadProgress());
      setSavedItems(loadSaved());
      setApplications(loadApplications());
    };
    initProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const fetchStories = async () => {
      if (result) {
        const fetchedStories = await roadmapProfileApi.getStories(
          result.pathway.sportSlug,
          undefined,
          selectedState || undefined,
        );
        setDbStories(fetchedStories);
      }
    };
    fetchStories();
  }, [result, selectedState]);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(INTRO_KEY)) {
      setIntroModalOpen(true);
    }
  }, []);

  // Show "Back to assessment" link when wizard results exist in localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pms_wizard_results");
      if (!raw) return;
      const { savedAt } = JSON.parse(raw);
      if (Date.now() - new Date(savedAt).getTime() < 24 * 60 * 60 * 1000) {
        setHasWizardResults(true);
      }
    } catch {}
  }, []);

  const handleSavedChange = (items: SavedItem[]) => {
    setSavedItems(items);
    saveSaved(items);
    if (user) roadmapProfileApi.updateProfile({ savedItems: items }, selectedDependentId);
  };

  const handleApplicationsChange = (items: ApplicationRecord[]) => {
    setApplications(items);
    saveApplications(items);
    if (user) roadmapProfileApi.updateProfile({ applications: items }, selectedDependentId);
  };

  const handleUpdateApplicationStatus = (
    id: string,
    status: ApplicationRecord["status"],
  ) => {
    const updated = applications.map((app) =>
      app.id === id ? { ...app, status } : app,
    );
    handleApplicationsChange(updated);
  };

  const handleProgressChange = (p: ProgressState) => {
    setProgress(p);
    saveProgress(p);
    if (user) roadmapProfileApi.updateProfile({ progress: p }, selectedDependentId);
  };

  const handleStateChange = (s: string) => {
    setSelectedState(s);
    saveState(s);
    setStateOpen(false);
  };

  // Fetch all sports on mount
  useEffect(() => {
    const fetchSports = async () => {
      try {
        const sports = await sportsApi.getAllSports();
        setAllSports(sports);
        setFuse(new Fuse(sports, { keys: ["name"], threshold: 0.3 }));
      } catch (error) {
        console.error("Failed to fetch sports:", error);
      }
    };
    fetchSports();
  }, []);

  // Filter suggestions instantly
  useEffect(() => {
    setActiveSuggestionIndex(-1);
    if (!fuse || query.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveTab("journey");
      return;
    }
    const results = fuse.search(query).map((r) => r.item);
    setSuggestions(results.slice(0, 5));
    // Keep the dropdown open even with zero matches so we can show a helpful
    // "no sport found" hint instead of the panel silently vanishing.
    setShowSuggestions(true);
  }, [query, fuse]);

  // `stateOverride` lets a caller pass a just-resolved state value directly
  // instead of reading the `selectedState` React state variable — needed by
  // the mount-time URL effect below, which otherwise races the "load saved
  // state from localStorage" effect and reads a stale (empty) `selectedState`
  // closure on the very first render.
  const handleSearch = async (sportName: string, stateOverride?: string) => {
    const name = sportName.trim();
    if (!name || name.length < 2) return;

    const effectiveState = stateOverride || selectedState;
    if (!effectiveState) {
      setErrorMsg("Please select your state first.");
      setStatus("error");
      return;
    }

    setShowSuggestions(false);
    setQuery(name);
    setStatus("loading");
    setResult(null);
    setIsStale(false);
    setErrorMsg("");
    setEntitiesStatus("idle");
    setFederations([]);
    setActiveIdx(0);
    setActiveTab("journey");
    setExpandedCards(new Set());
    setOwnedEquipment(new Set());

    const state = effectiveState;

    try {
      const res = await pathwayApi.getPathway(name, undefined, state);
      if (!res) throw new Error("Not found");

      if ("notSupported" in res) {
        setNotSupportedSport(res.sport);
        setStatus("not_supported");
        return;
      }

      // TypeScript narrowed: res is the normal pathway result from here.
      const pr = res as { pathway: SportPathway; source: "db" | "generated"; isStale?: boolean; entitiesReady?: boolean };

      if ((pr.pathway as any).status === "pending_review") {
        setErrorMsg(
          (pr.pathway as any).message ||
            "This pathway is being reviewed by experts and is not yet available for your state.",
        );
        setStatus("error");
        return;
      }

      setResult(pr as any);
      setIsStale(!!pr.isStale);
      setQuery(pr.pathway.sportName);
      setStatus("success");

      // Position-first: if the selected child already plays this exact sport
      // and told us their level, open there instead of always starting at
      // Beginner — a returning parent shouldn't have to re-navigate to where
      // their child already is.
      const activeDependent = dependents.find((d) => d._id === selectedDependentId);
      if (
        activeDependent?.experienceLevel &&
        (activeDependent.sportsFocus || []).some(
          (s: string) => s.toLowerCase() === pr.pathway.sportName.toLowerCase(),
        )
      ) {
        setActiveIdx(EXPERIENCE_TO_MACRO_INDEX[activeDependent.experienceLevel] ?? 0);
      }

      // Cache for instant back-navigation restore
      try {
        sessionStorage.setItem(
          "pms_pathway_cache",
          JSON.stringify({ key: `${name.toLowerCase()}|${state}`, data: pr, ts: Date.now() }),
        );
      } catch {}

      // Update URL so "back" from detail pages restores the search
      const returnUrl = `/roadmap?sport=${encodeURIComponent(pr.pathway.sportName)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
      router.replace(returnUrl, { scroll: false });
      localStorage.setItem("pms_roadmap_return_url", returnUrl);

      // Fetch governing federation for this sport (fire-and-forget)
      federationApi
        .listBySport(pr.pathway.sportSlug ?? pr.pathway.sportName.toLowerCase())
        .then((feds) => setFederations(feds))
        .catch(() => {});

      // If entities (tournaments/scholarships/universities) weren't ready yet,
      // fetch them in the background and merge when done.
      if (!pr.entitiesReady) {
        setEntitiesStatus("loading");
        pathwayApi
          .getEntities(pr.pathway.sportName, state)
          .then((entities) => {
            if (!entities) {
              setEntitiesStatus("ready");
              return;
            }
            setResult((prev: any) => {
              if (!prev) return prev;
              const updated = {
                ...prev,
                pathway: {
                  ...prev.pathway,
                  tournaments: entities.tournaments,
                  scholarships: entities.scholarships,
                  universities: entities.universities,
                },
              };
              // Keep cache fresh with full entities
              try {
                sessionStorage.setItem(
                  "pms_pathway_cache",
                  JSON.stringify({ key: `${name.toLowerCase()}|${state}`, data: updated, ts: Date.now() }),
                );
              } catch {}
              return updated;
            });
            setEntitiesStatus("ready");
          })
          .catch(() => setEntitiesStatus("ready"));
      } else {
        setEntitiesStatus("ready");
      }
    } catch (err: any) {
      const msg = err.message || "";
      setErrorMsg(
        msg && !msg.toLowerCase().includes("not found")
          ? msg
          : "Something went wrong. Please try again in a moment.",
      );
      setStatus("error");
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    setNotSupportedSport("");
    setSuggestions([]);
    setShowSuggestions(false);
    router.replace("/roadmap", { scroll: false });
    localStorage.removeItem("pms_roadmap_return_url");
    inputRef.current?.focus();
    if (savedItems.length > 0) setActiveTab("saved");
    else if (applications.length > 0) setActiveTab("applications");
    else setActiveTab("journey");
  };

  // Read URL params on mount and pre-fill sport/level/state/context banner
  useEffect(() => {
    const sport = searchParams.get("sport");
    const level = searchParams.get("level");
    const state = searchParams.get("state");
    // Support both legacy "age"/"budget" and wizard-generated "childAge"/"budgetTier"
    const age = searchParams.get("childAge") || searchParams.get("age");
    const budget = searchParams.get("budgetTier") || searchParams.get("budget");

    if (state) handleStateChange(state);

    if (sport) {
      const effectiveState = state || loadState();

      if (_cacheRestoredRef.current) {
        // useLayoutEffect already restored state from cache — just wire up
        // federations (fire-and-forget) and apply the level param.
        const cached = JSON.parse(sessionStorage.getItem("pms_pathway_cache") || "{}");
        federationApi
          .listBySport(
            cached.data?.pathway?.sportSlug ??
              cached.data?.pathway?.sportName?.toLowerCase() ??
              sport.toLowerCase(),
          )
          .then((feds) => setFederations(feds))
          .catch(() => {});
        if (level) setActiveIdx(Math.max(0, parseInt(level, 10) - 1));
      } else {
        handleSearch(sport, effectiveState).then(() => {
          if (level) setActiveIdx(Math.max(0, parseInt(level, 10) - 1));
        });
      }
    }

    if (age && budget) {
      setContextBanner({ age, budget, state: state || "" });
    }
  }, []);

  // Auto-open the chat drawer after a login redirect (?openChat=1) once the
  // pathway has loaded and the user session is available.
  const openChatParam = searchParams.get("openChat") === "1";
  useEffect(() => {
    if (openChatParam && result && user) {
      setChatOpen(true);
    }
  }, [openChatParam, result, user]);

  const handleChatCtaClick = () => {
    if (!user) {
      setChatLoginModalOpen(true);
    } else {
      setChatOpen(true);
    }
  };

  const currentLevels = result ? result.pathway.levels : pathwayLevels;
  const macroLevels = groupLevelsIntoMacro(currentLevels as PathwayLevel[]);
  const selectedMacroLevel = macroLevels[activeIdx] || macroLevels[0];
  const totalOpportunities = result
    ? (result.pathway.tournaments?.length || 0) +
      (result.pathway.scholarships?.length || 0) +
      (result.pathway.universities?.length || 0)
    : 0;

  return (
    <section className="relative overflow-hidden py-12 sm:py-16 md:py-20 lg:py-28">
      <AmbientBlob className="h-96 w-96 bg-orange-100/40 -left-40 top-10" />
      <AmbientBlob className="h-80 w-80 bg-indigo-100/30 -right-40 top-20" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          variants={orchestrator}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mb-10 text-center"
        >
          <motion.div variants={fadeUp} className="mb-4 flex justify-center">
            <SectionLabel label="For Parents" color="orange" />
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-title mx-auto max-w-2xl text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl lg:text-5xl"
          >
            Know the Journey
            <span className="relative ml-2 inline-block">
              Before It Begins.
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-200"
              />
            </span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:text-lg"
          >
            Search any sport to see the full development path — from first
            practice to national stage. Timeline, budget, competitions, and what
            your child needs at every level.
          </motion.p>
        </motion.div>

        {/* Whose progress is this — visible only when there's an actual choice to make */}
        {dependents.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            <span className="self-center text-xs font-medium text-slate-400 mr-1">
              Whose progress is this?
            </span>
            {dependents.map((dep) => (
              <button
                key={dep._id}
                type="button"
                onClick={() => selectDependent(dep._id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  selectedDependentId === dep._id
                    ? "border-power-orange bg-orange-50 text-power-orange"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {dep.name}
              </button>
            ))}
          </div>
        )}

        {/* Back-to-assessment pill — visible when wizard results are in localStorage */}
        {hasWizardResults && (
          <div className="flex justify-center mb-5">
            <a
              href="/assessment"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm hover:border-power-orange hover:text-power-orange transition-all"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to your assessment
            </a>
          </div>
        )}

        {/* Search bar + P2 State selector */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mx-auto max-w-3xl relative"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            {/* P2: State selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setStateOpen((o) => !o)}
                className="flex h-full min-h-[52px] items-center gap-2 rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-700 shadow-xl backdrop-blur-sm whitespace-nowrap transition hover:bg-white sm:min-w-[140px]"
              >
                <MapPin className="h-4 w-4 text-power-orange shrink-0" />
                <span className="truncate max-w-[100px]">
                  {selectedState || "Select your state"}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform shrink-0 ${stateOpen ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {stateOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.13 }}
                    className="absolute left-0 top-full z-30 mt-1.5 w-52 rounded-2xl border border-slate-100 bg-white shadow-2xl overflow-hidden"
                  >
                    <div className="max-h-60 overflow-y-auto py-1">
                      {INDIAN_STATES.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStateChange(s)}
                          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition hover:bg-orange-50 ${selectedState === s ? "font-bold text-power-orange" : "font-medium text-slate-700"}`}
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Search input */}
            <div className="relative flex flex-1 items-center gap-1.5 rounded-2xl border border-white/70 bg-white/90 p-1.5 sm:gap-3 sm:p-2 sm:pr-3 shadow-xl backdrop-blur-sm">
              <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-power-orange text-white sm:flex sm:h-12 sm:w-12">
                {status === "loading" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setStatus("idle");
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (!showSuggestions && suggestions.length > 0)
                      setShowSuggestions(true);
                    setActiveSuggestionIndex((i) =>
                      suggestions.length === 0
                        ? -1
                        : (i + 1) % suggestions.length,
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestionIndex((i) =>
                      suggestions.length === 0
                        ? -1
                        : (i - 1 + suggestions.length) % suggestions.length,
                    );
                  } else if (e.key === "Enter") {
                    const picked =
                      showSuggestions && activeSuggestionIndex >= 0
                        ? suggestions[activeSuggestionIndex]
                        : null;
                    handleSearch(picked ? picked.name : query);
                  } else if (e.key === "Escape") {
                    setShowSuggestions(false);
                    setActiveSuggestionIndex(-1);
                  }
                }}
                onFocus={() =>
                  query.trim().length > 0 && setShowSuggestions(true)
                }
                placeholder="e.g. Cricket, Badminton..."
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm font-medium text-slate-900 placeholder-slate-400 outline-none sm:px-0 sm:text-base"
                aria-label="Search sport pathway"
                role="combobox"
                aria-expanded={showSuggestions}
                aria-controls="sport-suggestions-listbox"
                aria-autocomplete="list"
                aria-activedescendant={
                  activeSuggestionIndex >= 0
                    ? `sport-suggestion-${activeSuggestionIndex}`
                    : undefined
                }
              />
              {query && (
                <button
                  onClick={clearSearch}
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              )}
              <button
                onClick={() => handleSearch(query)}
                disabled={status === "loading" || !query.trim()}
                className="shrink-0 rounded-xl bg-power-orange px-3 py-2.5 text-xs font-bold text-white shadow transition-all hover:bg-orange-600 disabled:opacity-50 sm:px-5 sm:text-sm"
              >
                Search
              </button>
            </div>
          </div>

          {/* State filter indicator */}
          {selectedState && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 flex items-center gap-2"
            >
              <span className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-power-orange">
                <MapPin className="h-3 w-3" />
                Localised for {selectedState}
                <button
                  onClick={() => handleStateChange("")}
                  className="ml-1 hover:text-orange-800 transition"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
              <span className="text-xs text-slate-400">
                Results will include {selectedState}-specific data
              </span>
            </motion.div>
          )}

          {/* Context banner from URL params */}
          {contextBanner && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2"
            >
              <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Personalised view · Age {contextBanner.age} ·{" "}
                {contextBanner.budget} tier
                {contextBanner.state ? ` · ${contextBanner.state}` : ""}
              </span>
              <button
                onClick={() => setContextBanner(null)}
                className="text-indigo-400 hover:text-indigo-700 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showSuggestions && status === "idle" && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
                style={{ top: "100%", marginTop: "8px" }}
              >
                <div className="h-0.5 w-full bg-gradient-to-r from-power-orange/60 via-power-orange to-power-orange/60" />
                {suggestions.length > 0 ? (
                  <>
                    <ul
                      id="sport-suggestions-listbox"
                      role="listbox"
                      className="py-1.5"
                    >
                      {suggestions.map((s, idx) => {
                        const active = idx === activeSuggestionIndex;
                        return (
                          <li key={s.slug || s.name} role="presentation">
                            <button
                              id={`sport-suggestion-${idx}`}
                              role="option"
                              aria-selected={active}
                              onClick={() => handleSearch(s.name)}
                              onMouseEnter={() => setActiveSuggestionIndex(idx)}
                              className={`group relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                active ? "bg-orange-50" : "hover:bg-orange-50"
                              }`}
                            >
                              {active && (
                                <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-power-orange" />
                              )}
                              <Search
                                className={`h-3.5 w-3.5 shrink-0 ${active ? "text-power-orange" : "text-slate-300"}`}
                              />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                                {highlightMatch(s.name, query)}
                              </span>
                              {s.category && (
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                  {s.category}
                                </span>
                              )}
                              <ChevronRight
                                className={`h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform ${active ? "translate-x-0.5 text-power-orange" : ""}`}
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="hidden items-center gap-3 border-t border-slate-100 px-4 py-1.5 sm:flex">
                      <span className="text-[10px] text-slate-400">
                        <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans">
                          ↑↓
                        </kbd>{" "}
                        Navigate
                      </span>
                      <span className="text-[10px] text-slate-400">
                        <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans">
                          ↵
                        </kbd>{" "}
                        Select
                      </span>
                      <span className="text-[10px] text-slate-400">
                        <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans">
                          Esc
                        </kbd>{" "}
                        Close
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
                    <Search className="h-5 w-5 text-slate-200" />
                    <p className="text-sm font-semibold text-slate-600">
                      No sport matches &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-xs text-slate-400">
                      Press Enter to search anyway — we&apos;ll check if
                      it&apos;s a valid sport.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Popular quick-picks */}
        {status === "idle" && !result && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-6 flex flex-col items-center gap-3 px-2"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Popular in India
            </p>
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Cricket",
                  "Football",
                  "Badminton",
                  "Tennis",
                  "Basketball",
                  "Hockey",
                  "Swimming",
                  "Chess",
                  "Table Tennis",
                  "Volleyball",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSearch(s)}
                    className="rounded-full border border-slate-200 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-power-orange hover:bg-orange-50 hover:text-power-orange hover:shadow-md"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <a
                href="/assessment"
                className="mt-2 flex items-center gap-2 rounded-full border border-power-orange/40 bg-orange-50 px-4 py-2 text-xs font-bold text-power-orange shadow-sm hover:bg-orange-100 hover:border-power-orange transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Not sure which sport? Find the right fit
              </a>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  icon: <Flag className="h-5 w-5" />,
                  tab: "The Journey",
                  desc: "3-stage map from local club to the international stage — with your role at each step.",
                  iconBg: "bg-orange-100",
                  iconColor: "text-power-orange",
                  border: "border-orange-100",
                  bg: "bg-orange-50/60",
                },
                {
                  icon: <Target className="h-5 w-5" />,
                  tab: "Opportunities",
                  desc: "Live tournaments, scholarships, and universities specific to this sport.",
                  iconBg: "bg-emerald-100",
                  iconColor: "text-emerald-600",
                  border: "border-emerald-100",
                  bg: "bg-emerald-50/60",
                },
                {
                  icon: <Calculator className="h-5 w-5" />,
                  tab: "The Plan",
                  desc: "Full budget estimate and gear checklist so you know what to prepare for.",
                  iconBg: "bg-amber-100",
                  iconColor: "text-amber-600",
                  border: "border-amber-100",
                  bg: "bg-amber-50/60",
                },
                {
                  icon: <Sparkles className="h-5 w-5" />,
                  tab: "Inspire",
                  desc: "Real career paths and family stories from parents who walked this road.",
                  iconBg: "bg-indigo-100",
                  iconColor: "text-indigo-600",
                  border: "border-indigo-100",
                  bg: "bg-indigo-50/60",
                },
              ].map((item) => (
                <div
                  key={item.tab}
                  className={`flex flex-col rounded-2xl border ${item.border} ${item.bg} p-4`}
                >
                  <div
                    className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${item.iconBg} ${item.iconColor} shrink-0`}
                  >
                    {item.icon}
                  </div>
                  <p className="font-title text-sm font-bold text-slate-800 mb-1">
                    {item.tab}
                  </p>
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Loading state ── */}
        <AnimatePresence>
          {status === "loading" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-12 max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-100"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 ring-8 ring-orange-50/50">
                <Loader2 className="h-7 w-7 text-power-orange animate-spin" />
              </div>
              <p className="font-title text-xl font-bold text-slate-900">
                Building your pathway
              </p>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                Mapping the{" "}
                <span className="font-semibold text-slate-800">{query}</span>{" "}
                journey
                {selectedState ? ` in ${selectedState}` : " across India"} —
                levels, competitions, costs, and what it all means for your
                family.
              </p>
              <div className="mt-6 flex items-center justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-power-orange"
                    style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error state ── */}
        <AnimatePresence>
          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-12 max-w-lg rounded-3xl border border-red-100 bg-red-50 p-6 sm:p-8 text-center shadow"
            >
              <p className="text-lg font-bold text-red-700">Not Found</p>
              <p className="mt-2 text-sm text-red-600 break-words">
                {errorMsg}
              </p>
              <button
                onClick={clearSearch}
                className="mt-5 rounded-xl bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Try Another Sport
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Sport not yet supported ── */}
        <AnimatePresence>
          {status === "not_supported" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-12 max-w-xl rounded-3xl border border-amber-100 bg-amber-50 p-6 sm:p-8 text-center shadow"
            >
              <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
                Coming Soon
              </span>
              <p className="mt-3 text-lg font-bold text-slate-900 capitalize">
                {notSupportedSport} Pathway
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Our team is actively building the{" "}
                <span className="font-semibold capitalize">
                  {notSupportedSport}
                </span>{" "}
                pathway. We&apos;ll have it ready soon — meanwhile, explore one
                of our 10 fully mapped sports below.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {[
                  "Cricket", "Tennis", "Chess", "Football", "Basketball",
                  "Hockey", "Table Tennis", "Swimming", "Badminton", "Volleyball",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSearch(s)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-power-orange hover:bg-orange-50 hover:text-power-orange"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={clearSearch}
                className="mt-5 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Back to Search
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Explorer View (Default or Result) ── */}
        <AnimatePresence mode="wait">
          {(status === "success" ||
            savedItems.length > 0 ||
            applications.length > 0) && (
            <motion.div
              key={result ? "result" : "default"}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING_STIFF}
              className="mt-12 sm:mt-16"
            >
              {/* Header logic */}
              {result ? (
                <>
                  <div className="mb-8 rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left: name + meta + overview */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {result.pathway.trustTier === "expert_verified" &&
                          result.pathway.expertVerifications &&
                          result.pathway.expertVerifications.length > 0 ? (
                            <span className="inline-flex flex-col gap-0.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs">
                              <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                                <BadgeCheck className="h-3 w-3" />
                                Verified by{" "}
                                {
                                  result.pathway.expertVerifications[0]
                                    .expertName
                                }
                                {result.pathway.expertVerifications.length >
                                  1 &&
                                  ` +${result.pathway.expertVerifications.length - 1} more`}
                              </span>
                              {result.pathway.expertVerifications[0]
                                .expertCredential && (
                                <span className="text-[10px] text-emerald-600 font-medium pl-4">
                                  {
                                    result.pathway.expertVerifications[0]
                                      .expertCredential
                                  }
                                </span>
                              )}
                            </span>
                          ) : result.pathway.trustTier === "admin_verified" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                              <BadgeCheck className="h-3 w-3" /> Verified by
                              Expert
                            </span>
                          ) : (
                            result.source === "generated" && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-power-orange border border-orange-200">
                                <Sparkles className="h-3 w-3" /> AI Generated
                              </span>
                            )
                          )}
                          {selectedState && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 border border-indigo-100">
                              <MapPin className="h-3 w-3" /> {selectedState}
                            </span>
                          )}
                          {result.pathway.category && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                              {result.pathway.category}
                            </span>
                          )}
                          {(() => {
                            const lastCheckedRaw =
                              result.pathway.lastRefreshedAt ||
                              result.pathway.updatedAt ||
                              result.pathway.createdAt;
                            if (!lastCheckedRaw) return null;
                            const label = new Date(lastCheckedRaw).toLocaleDateString("en-IN", {
                              month: "short",
                              year: "numeric",
                            });
                            return (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${
                                  isStale
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-slate-50 text-slate-400 border-slate-200"
                                }`}
                              >
                                Last checked {label}
                              </span>
                            );
                          })()}
                        </div>
                        {isStale && (
                          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 leading-relaxed">
                              This pathway hasn&apos;t been rechecked in over 6 months — costs, tournaments, and academy details may have changed. We&apos;re refreshing it; check back soon or verify specifics with a local academy.
                            </p>
                          </div>
                        )}
                        <h2 className="font-title text-2xl font-bold text-slate-900 break-words sm:text-3xl">
                          {result.pathway.sportName}
                          <span className="ml-2 text-slate-400 font-normal text-xl sm:text-2xl">
                            Pathway
                          </span>
                        </h2>
                        {result.pathway.overview && (
                          <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed sm:text-base">
                            {result.pathway.overview}
                          </p>
                        )}
                        {result.pathway.expertVerifications?.[0]?.note && (
                          <p className="mt-2 max-w-2xl text-sm italic text-emerald-700">
                            &ldquo;{result.pathway.expertVerifications[0].note}
                            &rdquo;
                            <span className="not-italic font-semibold">
                              {" "}
                              —{" "}
                              {result.pathway.expertVerifications[0].expertName}
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Right: stat chips */}
                      {entitiesStatus === "loading" ? (
                        <div className="flex items-center gap-2 shrink-0 self-start rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
                          <span className="text-xs font-medium text-slate-400">
                            Loading opportunities…
                          </span>
                        </div>
                      ) : totalOpportunities > 0 ? (
                        <div className="flex flex-wrap gap-2 shrink-0 self-start">
                          {(result.pathway.tournaments?.length ?? 0) > 0 && (
                            <button
                              onClick={() => setActiveTab("opportunities")}
                              className="flex flex-col items-center rounded-xl border border-orange-100 bg-orange-50 px-4 py-2.5 min-w-[68px] hover:bg-orange-100 transition group"
                            >
                              <span className="text-xl font-extrabold text-power-orange group-hover:scale-110 transition-transform">
                                {result.pathway.tournaments!.length}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mt-0.5 whitespace-nowrap">
                                Tournaments
                              </span>
                              <span className="text-[8px] text-orange-300 mt-0.5">
                                official sources
                              </span>
                            </button>
                          )}
                          {(result.pathway.scholarships?.length ?? 0) > 0 && (
                            <button
                              onClick={() => setActiveTab("opportunities")}
                              className="flex flex-col items-center rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 min-w-[68px] hover:bg-emerald-100 transition group"
                            >
                              <span className="text-xl font-extrabold text-emerald-600 group-hover:scale-110 transition-transform">
                                {result.pathway.scholarships!.length}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mt-0.5 whitespace-nowrap">
                                Scholarships
                              </span>
                              <span className="text-[8px] text-emerald-300 mt-0.5">
                                official sources
                              </span>
                            </button>
                          )}
                          {(result.pathway.universities?.length ?? 0) > 0 && (
                            <button
                              onClick={() => setActiveTab("opportunities")}
                              className="flex flex-col items-center rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 min-w-[68px] hover:bg-indigo-100 transition group"
                            >
                              <span className="text-xl font-extrabold text-indigo-600 group-hover:scale-110 transition-transform">
                                {result.pathway.universities!.length}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mt-0.5 whitespace-nowrap">
                                Universities
                              </span>
                              <span className="text-[8px] text-indigo-300 mt-0.5">
                                official sources
                              </span>
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                    {result.pathway.trustTier === "unverified" && (
                      <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Pathway data sourced from{" "}
                            {result.pathway.levels?.[0]?.governingBody ? (
                              <span className="font-semibold text-slate-600">
                                {result.pathway.levels[0].governingBody}
                              </span>
                            ) : (
                              "India's sports development records"
                            )}
                            {
                              ", Khelo India, and verified tournament & scholarship data. "
                            }
                            <span className="text-slate-400">
                              Expert review pending — details may vary by
                              region.
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {/* Tabs */}
              {(result || savedItems.length > 0 || applications.length > 0) && (
                <div className="mb-8 w-full overflow-x-auto hide-scrollbar">
                  <div className="inline-flex min-w-max gap-1.5 rounded-2xl bg-slate-100/70 p-1.5 backdrop-blur-md border border-slate-200/60 shadow-inner">
                    {[
                      {
                        id: "journey",
                        label: "The Journey",
                        icon: <Flag className="h-4 w-4" />,
                        show: !!result,
                      },
                      {
                        id: "opportunities",
                        label: "Opportunities",
                        icon: <Target className="h-4 w-4" />,
                        badge:
                          entitiesStatus === "ready" && totalOpportunities > 0
                            ? totalOpportunities
                            : undefined,
                        show: !!result,
                      },
                      {
                        id: "plan",
                        label: "The Plan",
                        icon: <Calculator className="h-4 w-4" />,
                        show: !!result,
                      },
                      {
                        id: "inspire",
                        label: "Inspire",
                        icon: <Sparkles className="h-4 w-4" />,
                        show: !!result && dbStories.length > 0,
                      },
                      {
                        id: "saved",
                        label: "Saved",
                        badge: savedItems.length,
                        icon: <Heart className="h-4 w-4" />,
                        show: savedItems.length > 0,
                      },
                      {
                        id: "applications",
                        label: "Applications",
                        badge: applications.length,
                        icon: <ClipboardList className="h-4 w-4" />,
                        show: applications.length > 0,
                      },
                    ]
                      .filter((t) => t.show)
                      .map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`relative flex shrink-0 items-center justify-center rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors duration-200 z-10 ${
                            activeTab === tab.id
                              ? "text-slate-900"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                          }`}
                        >
                          {activeTab === tab.id && (
                            <motion.div
                              layoutId="activeTabPill"
                              className="absolute inset-0 -z-10 rounded-xl bg-white shadow-sm ring-1 ring-slate-200/50"
                              transition={{
                                type: "spring",
                                bounce: 0.15,
                                duration: 0.5,
                              }}
                            />
                          )}
                          <span className="flex items-center gap-2">
                            <span
                              className={`transition-colors ${activeTab === tab.id ? "text-power-orange" : ""}`}
                            >
                              {tab.icon}
                            </span>
                            <span className="whitespace-nowrap">
                              {tab.label}
                            </span>
                            {(tab as any).badge !== undefined &&
                              (tab as any).badge > 0 && (
                                <span
                                  className={`ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold transition-colors ${
                                    activeTab === tab.id
                                      ? "bg-power-orange text-white shadow-sm"
                                      : "bg-slate-200 text-slate-500"
                                  }`}
                                >
                                  {(tab as any).badge}
                                </span>
                              )}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {activeTab === "journey" && (
                  <motion.div
                    key="journey"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="space-y-5">
                      {/* Visual progression stepper */}
                      <div className="rounded-3xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm overflow-hidden">
                        <ProgressionStepper
                          macroLevels={macroLevels}
                          activeIdx={activeIdx}
                          onSelect={setActiveIdx}
                          currentLevel={progress.currentLevel}
                        />
                      </div>

                      {/* Level detail panel */}
                      <div>
                        <AnimatePresence mode="wait">
                          {selectedMacroLevel && (
                            <PathwayLevelDetail
                              key={selectedMacroLevel.id}
                              macroLevel={selectedMacroLevel}
                              sportName={
                                result ? result.pathway.sportName : "General"
                              }
                              state={selectedState || undefined}
                              nextMacroLevel={macroLevels[activeIdx + 1]}
                            />
                          )}
                        </AnimatePresence>
                      </div>

                    </div>
                  </motion.div>
                )}

                {/* ── Opportunities ── */}
                {result && activeTab === "opportunities" && (
                  <motion.div
                    key="opportunities"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-10"
                  >
                    {entitiesStatus === "loading" && (
                      <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                        <div className="h-4 w-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin shrink-0" />
                        <p className="text-sm font-medium text-indigo-700">
                          Fetching live data — this takes a moment for a new
                          sport.
                        </p>
                      </div>
                    )}

                    {/* Governing Federations */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-power-orange">
                          <Landmark className="h-4 w-4" />
                        </div>
                        <h3 className="font-title text-lg font-bold text-slate-900">
                          Governing Federation
                        </h3>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>

                      {federations.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {federations.map((fed) => (
                            <FederationCard
                              key={fed.slug}
                              federation={fed}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4">
                          <p className="text-sm font-semibold text-slate-700 mb-1">
                            {result.pathway.levels?.[0]?.governingBody ?? `${result.pathway.sportName} Federation`}
                          </p>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Full federation profile coming soon — including verified eligibility criteria, registration steps, and tournament calendar.
                          </p>
                        </div>
                      )}

                    </div>

                    {/* Scholarships */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <h3 className="font-title text-lg font-bold text-slate-900">
                          Scholarships
                        </h3>
                        <div className="flex-1 h-px bg-slate-100" />
                        {result.pathway.scholarships?.length > 0 && (
                          <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-power-orange">
                            {result.pathway.scholarships.length} found
                          </span>
                        )}
                      </div>
                      {result.pathway.scholarships?.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {result.pathway.scholarships.map(
                            (s: any, i: number) => {
                              const key = `sch-${i}`;
                              const isOpen = expandedCards.has(key);
                              return (
                                <div
                                  key={i}
                                  className={`rounded-2xl overflow-hidden bg-white border shadow-sm transition-all duration-200 ${isOpen ? "border-slate-300 shadow-md sm:col-span-2 lg:col-span-3" : "border-slate-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:border-orange-200"}`}
                                >
                                  <div className="h-[3px] w-full bg-gradient-to-r from-power-orange to-amber-400" />
                                  {/* Card face — click to expand */}
                                  <button
                                    onClick={() => toggleCard(key)}
                                    className="w-full flex flex-col p-4 text-left"
                                    style={{ minHeight: "130px" }}
                                  >
                                    <div className="mb-3 flex items-start justify-between gap-2">
                                      <span className="inline-flex items-center rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-power-orange shrink-0">
                                        Scholarship
                                      </span>
                                      <ChevronDown
                                        className={`h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                      />
                                    </div>
                                    <p className="font-title font-bold text-slate-900 text-sm leading-snug line-clamp-2 flex-1 pr-2 break-words">
                                      {s.name}
                                    </p>
                                    <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400 min-w-0">
                                      <Wallet className="h-3 w-3 shrink-0" />
                                      <span className="truncate">
                                        {s.provider}
                                      </span>
                                    </div>
                                  </button>
                                  {/* Expanded detail */}
                                  <div
                                    className="overflow-hidden transition-all duration-300 ease-in-out"
                                    style={{
                                      maxHeight: isOpen ? "400px" : "0px",
                                      opacity: isOpen ? 1 : 0,
                                    }}
                                  >
                                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                                      <p className="text-sm text-slate-600 leading-relaxed">
                                        {s.description}
                                      </p>
                                      {s.eligibility && (
                                        <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                                          <p className="text-xs text-slate-600 leading-relaxed">
                                            {s.eligibility}
                                          </p>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 pt-1">
                                        <SaveButton
                                          item={s}
                                          type="scholarship"
                                          sport={result.pathway.sportName}
                                          savedItems={savedItems}
                                          onToggle={handleSavedChange}
                                        />
                                        <button
                                          onClick={() => {
                                            toggleCard(key);
                                            setModalData({
                                              item: s,
                                              type: "scholarship",
                                            });
                                          }}
                                          className="ml-auto flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
                                        >
                                          Apply{" "}
                                          <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-500 text-sm">
                          No scholarships found for this sport.
                        </div>
                      )}
                    </div>

                    {/* Universities */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                          <Landmark className="h-4 w-4" />
                        </div>
                        <h3 className="font-title text-lg font-bold text-slate-900">
                          Universities
                        </h3>
                        <div className="flex-1 h-px bg-slate-100" />
                        {result.pathway.universities?.length > 0 && (
                          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600">
                            {result.pathway.universities.length} found
                          </span>
                        )}
                      </div>
                      {result.pathway.universities?.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {result.pathway.universities.map(
                            (u: any, i: number) => {
                              const key = `uni-${i}`;
                              const isOpen = expandedCards.has(key);
                              return (
                                <div
                                  key={i}
                                  className={`rounded-2xl overflow-hidden bg-white border shadow-sm transition-all duration-200 ${isOpen ? "border-slate-300 shadow-md sm:col-span-2 lg:col-span-3" : "border-slate-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:border-orange-200"}`}
                                >
                                  <div className="h-[3px] w-full bg-gradient-to-r from-power-orange to-amber-400" />
                                  {/* Card face — click to expand */}
                                  <button
                                    onClick={() => toggleCard(key)}
                                    className="w-full flex flex-col p-4 text-left"
                                    style={{ minHeight: "130px" }}
                                  >
                                    <div className="mb-3 flex items-start justify-between gap-2">
                                      <span className="inline-flex items-center rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-power-orange shrink-0">
                                        University
                                      </span>
                                      <ChevronDown
                                        className={`h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                      />
                                    </div>
                                    <p className="font-title font-bold text-slate-900 text-sm leading-snug line-clamp-2 flex-1 pr-2 break-words">
                                      {u.name}
                                    </p>
                                    <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400 min-w-0">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      <span className="truncate">
                                        {u.location}
                                      </span>
                                    </div>
                                  </button>
                                  {/* Expanded detail */}
                                  <div
                                    className="overflow-hidden transition-all duration-300 ease-in-out"
                                    style={{
                                      maxHeight: isOpen ? "500px" : "0px",
                                      opacity: isOpen ? 1 : 0,
                                    }}
                                  >
                                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                                      {u.admissionCriteria && (
                                        <div>
                                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Admission Criteria
                                          </p>
                                          <p className="text-xs text-slate-600 leading-relaxed">
                                            {u.admissionCriteria}
                                          </p>
                                        </div>
                                      )}
                                      {u.sportsQuotaDetails && (
                                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Sports Quota
                                          </p>
                                          <p className="text-xs text-slate-600 leading-relaxed">
                                            {u.sportsQuotaDetails}
                                          </p>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 pt-1">
                                        <SaveButton
                                          item={u}
                                          type="university"
                                          sport={result.pathway.sportName}
                                          savedItems={savedItems}
                                          onToggle={handleSavedChange}
                                        />
                                        <button
                                          onClick={() => {
                                            toggleCard(key);
                                            setModalData({
                                              item: u,
                                              type: "university",
                                            });
                                          }}
                                          className="ml-auto flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
                                        >
                                          Learn More{" "}
                                          <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-500 text-sm">
                          No universities found for this sport.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── The Plan ── */}
                {result && activeTab === "plan" && (
                  <motion.div
                    key="plan"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-10"
                  >
                    {/* Budget */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                          <Calculator className="h-4 w-4" />
                        </div>
                        <h3 className="font-title text-lg font-bold text-slate-900">
                          Budget Estimate
                        </h3>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                      <BudgetCalculator pathway={result.pathway} />
                    </div>

                    {/* Equipment */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <ShoppingBag className="h-4 w-4" />
                        </div>
                        <h3 className="font-title text-lg font-bold text-slate-900">
                          Equipment
                        </h3>
                        <div className="flex-1 h-px bg-slate-100" />
                        {result.pathway.equipment?.length > 0 && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-500">
                            {result.pathway.equipment.length} levels
                          </span>
                        )}
                      </div>
                      {result.pathway.equipment?.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {result.pathway.equipment.map((e: any, i: number) => (
                            <div
                              key={i}
                              className="flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                            >
                              {/* Orange top accent (consistent with other cards) */}
                              <div className="h-[3px] w-full bg-gradient-to-r from-power-orange to-amber-400" />
                              <div className="flex flex-col p-4 flex-1">
                                {/* Header: level name + cost */}
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    {e.level}
                                  </p>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {e.estimatedCost}
                                  </span>
                                </div>
                                <ul className="space-y-1.5 flex-1">
                                  {e.items.map((item: string, j: number) => {
                                    const eKey = `equip-${i}-${j}`;
                                    const isOwned = ownedEquipment.has(eKey);
                                    return (
                                      <li key={j}>
                                        <button
                                          onClick={() => toggleOwned(eKey)}
                                          className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                                            isOwned
                                              ? "bg-orange-50/50"
                                              : "hover:bg-slate-50"
                                          }`}
                                        >
                                          <div
                                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                              isOwned
                                                ? "border-power-orange bg-power-orange"
                                                : "border-slate-300 bg-white"
                                            }`}
                                          >
                                            {isOwned && (
                                              <svg
                                                viewBox="0 0 10 8"
                                                className="h-2.5 w-2.5 fill-white"
                                              >
                                                <path
                                                  d="M1 4l3 3 5-6"
                                                  stroke="white"
                                                  strokeWidth="1.5"
                                                  fill="none"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                />
                                              </svg>
                                            )}
                                          </div>
                                          <span
                                            className={`text-sm leading-relaxed transition-colors ${
                                              isOwned
                                                ? "text-slate-400 line-through"
                                                : "text-slate-700"
                                            }`}
                                          >
                                            {item}
                                          </span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                                {/* Owned progress */}
                                {e.items.length > 0 &&
                                  (() => {
                                    const owned = e.items.filter(
                                      (_: string, j: number) =>
                                        ownedEquipment.has(`equip-${i}-${j}`),
                                    ).length;
                                    return owned > 0 ? (
                                      <div className="mt-4 border-t border-slate-100 pt-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Ready
                                          </span>
                                          <span className="text-[10px] font-bold text-power-orange">
                                            {owned}/{e.items.length}
                                          </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                          <div
                                            className="h-full bg-power-orange rounded-full transition-all duration-500"
                                            style={{
                                              width: `${(owned / e.items.length) * 100}%`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ) : null;
                                  })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-500 text-sm">
                          No equipment data found for this sport.
                        </div>
                      )}
                    </div>

                    {/* Compare Sports */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <GitCompare className="h-4 w-4" />
                        </div>
                        <h3 className="font-title text-lg font-bold text-slate-900">
                          Compare Sports
                        </h3>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                      <ComparePanel
                        primaryPathway={result.pathway}
                        allSports={allSports}
                      />
                    </div>
                  </motion.div>
                )}

                {/* ── Inspire ── */}
                {result && activeTab === "inspire" && (
                  <motion.div
                    key="inspire"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-10"
                  >
                    {/* Career Paths */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <h3 className="font-title text-lg font-bold text-slate-900">
                          Career Paths
                        </h3>
                        <div className="flex-1 h-px bg-slate-100" />
                        {result.pathway.careers?.length > 0 && (
                          <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-power-orange">
                            {result.pathway.careers.length} paths
                          </span>
                        )}
                      </div>
                      {result.pathway.careers?.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {result.pathway.careers.map((c: any, i: number) => {
                            const key = `career-${i}`;
                            const isOpen = expandedCards.has(key);
                            return (
                              <div
                                key={i}
                                className={`group rounded-2xl overflow-hidden bg-white border shadow-sm transition-all duration-200 ${isOpen ? "border-slate-300 shadow-md sm:col-span-2 lg:col-span-3" : "border-slate-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:border-orange-200"}`}
                              >
                                <div className="h-[3px] w-full bg-gradient-to-r from-power-orange to-amber-400" />
                                <button
                                  onClick={() => toggleCard(key)}
                                  className="w-full flex flex-col p-4 text-left"
                                  style={{ minHeight: "130px" }}
                                >
                                  <div className="mb-3 flex items-start justify-between gap-2">
                                    <span className="inline-flex items-center rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-power-orange">
                                      {c.demand || "Career"}
                                    </span>
                                    <ChevronDown
                                      className={`h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                    />
                                  </div>
                                  <p className="font-title font-bold text-slate-900 text-sm leading-snug line-clamp-2 flex-1">
                                    {c.role}
                                  </p>
                                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
                                      <TrendingUp className="h-3 w-3 shrink-0" />
                                      <span className="truncate">
                                        {c.description?.split(".")[0] ||
                                          "Sports career"}
                                      </span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-power-orange group-hover:translate-x-0.5 transition-all shrink-0" />
                                  </div>
                                </button>
                                <div
                                  className="overflow-hidden transition-all duration-300 ease-in-out"
                                  style={{
                                    maxHeight: isOpen ? "400px" : "0px",
                                    opacity: isOpen ? 1 : 0,
                                  }}
                                >
                                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                      {c.description}
                                    </p>
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <SaveButton
                                        item={c}
                                        type="career"
                                        sport={result.pathway.sportName}
                                        savedItems={savedItems}
                                        onToggle={handleSavedChange}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-500 text-sm">
                          No career paths found for this sport.
                        </div>
                      )}
                    </div>

                    {/* Athlete Stories */}
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-500">
                          <MessageSquareQuote className="h-4 w-4" />
                        </div>
                        <h3 className="font-title text-lg font-bold text-slate-900">
                          Athlete Stories
                        </h3>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                      <StoriesTab
                        sportName={result.pathway.sportName}
                        levels={currentLevels}
                        stories={dbStories}
                      />
                    </div>

                    <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 pb-24 lg:pb-8">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <p>
                          Pathway built from India's sports development data.{" "}
                          <span className="text-slate-400">
                            Verify specific milestones with a local academy.
                          </span>
                        </p>
                      </div>
                      <a
                        href={`/guidance?sport=${encodeURIComponent(result.pathway.sportName)}&level=${selectedMacroLevel?.representativeRawLevel ?? 1}&mode=level-plan&levelLabel=${encodeURIComponent(selectedMacroLevel?.representativeLabel ?? "")}${selectedState ? `&state=${encodeURIComponent(selectedState)}` : ""}`}
                        className="shrink-0 text-xs font-semibold text-power-orange hover:underline"
                      >
                        Personalise for your child →
                      </a>
                    </div>
                  </motion.div>
                )}

                {/* Saved */}
                {activeTab === "saved" && (
                  <SavedTab
                    savedItems={savedItems}
                    onUnsave={(id) =>
                      handleSavedChange(savedItems.filter((s) => s.id !== id))
                    }
                    onOpenModal={(item, type) => setModalData({ item, type })}
                  />
                )}

                {/* Applications */}
                {activeTab === "applications" && (
                  <ApplicationsTab
                    applications={applications}
                    onUpdateStatus={handleUpdateApplicationStatus}
                  />
                )}
              </AnimatePresence>

            </motion.div>
          )}
        </AnimatePresence>


        <RoadmapIntroModal
          isOpen={introModalOpen}
          onYes={() => {
            localStorage.setItem(INTRO_KEY, "1");
            setIntroModalOpen(false);
          }}
          onNo={() => {
            localStorage.setItem(INTRO_KEY, "1");
            setIntroModalOpen(false);
            router.push("/assessment");
          }}
        />

        {/* Concierge modal — scholarships & universities only */}
        {modalData && (
          <PathwayConciergeModal
            isOpen={!!modalData}
            onClose={() => setModalData(null)}
            item={modalData.item}
            type={modalData.type}
            onSubmitSuccess={(record) => {
              handleApplicationsChange([...applications, record]);
            }}
          />
        )}

        {/* Floating "Ask AI Coach" CTA — always visible, no scrolling needed */}
        {result && !chatOpen && (
          <motion.button
            type="button"
            onClick={handleChatCtaClick}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="fixed bottom-24 right-5 z-30 flex items-center gap-2 rounded-full bg-power-orange px-4 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(233,115,22,0.6)] transition hover:bg-orange-600 sm:bottom-24 sm:right-6"
          >
            <MessageSquareQuote className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">
              Got a quick question? Ask our AI Coach
            </span>
            <span className="sm:hidden">Ask AI Coach</span>
          </motion.button>
        )}

        {/* Roadmap chat drawer — opens inline, no navigation away from this page */}
        {result && (
          <RoadmapChatDrawer
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            sportSlug={result.pathway.sportSlug}
            sportName={result.pathway.sportName}
            level={selectedMacroLevel?.representativeRawLevel}
            levelLabel={selectedMacroLevel?.representativeLabel}
          />
        )}

        {/* Login required before chatting (guests) */}
        {result && (
          <LoginRequiredModal
            isOpen={chatLoginModalOpen}
            onClose={() => setChatLoginModalOpen(false)}
            sport={result.pathway.sportName}
            redirectPath={`/roadmap?sport=${encodeURIComponent(result.pathway.sportName)}&openChat=1`}
          />
        )}
      </div>
    </section>
  );
}

