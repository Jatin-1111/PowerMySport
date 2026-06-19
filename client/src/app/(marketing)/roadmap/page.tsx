"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { getCommunityAppUrl } from "@/lib/community/url";
import {
  pathwayApi,
  SportPathway,
  PathwayLevel,
} from "@/modules/sports/services/pathway";
import { sportsApi, Sport } from "@/modules/sports/services/sports";
import { PathwayConciergeModal } from "@/modules/sports/components/PathwayConciergeModal";
import Fuse from "fuse.js";
import { motion, Variants, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Target,
  Star,
  Globe,
  MapPin,
  Award,
  Flame,
  Dumbbell,
  Swords,
  Bike,
  Waves,
  ChevronDown,
  ArrowRight,
  Shield,
  Medal,
  Zap,
  Flag,
  Users,
  TrendingUp,
  CheckCircle,
  Search,
  Loader2,
  Sparkles,
  Database,
  X,
  Wallet,
  Clock,
  Map,
  HeartHandshake,
  GraduationCap,
  Landmark,
  Compass,
  ShoppingBag,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────

const SPRING_STIFF = { type: "spring", stiffness: 260, damping: 22 } as const;
const SPRING_SOFT = { type: "spring", stiffness: 200, damping: 28 } as const;

// ─── Motion Variants ──────────────────────────────────────────────────────────

const orchestrator: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.06 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: SPRING_STIFF },
};

const cardReveal: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING_STIFF },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  show: { opacity: 1, scale: 1, transition: SPRING_SOFT },
};

// ─── Pathway Levels ───────────────────────────────────────────────────────────

const pathwayLevels = [
  {
    id: "grassroots",
    level: 1,
    label: "Grassroots",
    title: "Neighbourhood & Club Level",
    description:
      "Every sporting legend starts here. Grassroots sport focuses on participation, fun, and building fundamental movement skills. Local clubs, school sport, and community programs form the foundation of every athlete's journey.",
    icon: <MapPin className="h-6 w-6" />,
    color: "from-emerald-500 to-teal-500",
    bgLight: "from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    accent: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    glowColor: "bg-emerald-400/10",
    steps: [
      "Join a local club or school sports program",
      "Learn the basics under structured coaching",
      "Participate in intra-school or club competitions",
      "Build fitness, teamwork, and sports IQ",
    ],
    keyFocus: "Participation & Fundamentals",
    ageRange: "5 – 14 years",
    competitions: "School meets, local clubs, area leagues",
    parentalCommitment: {
      time: "2-3 days a week",
      financial: "Low (Basic gear & club fees)",
      travel: "Local neighbourhood only",
      role: "Cheerleader & Chauffeur",
    },
  },
  {
    id: "district",
    level: 2,
    label: "District",
    title: "District & Zonal Level",
    description:
      "Talented players step up to compete across their district. Selection trials, zonal tournaments, and inter-district championships mark this level. Specialised coaching becomes crucial and consistent training schedules are essential.",
    icon: <Shield className="h-6 w-6" />,
    color: "from-blue-500 to-indigo-500",
    bgLight: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    accent: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    glowColor: "bg-blue-400/10",
    steps: [
      "Attend district-level selection trials",
      "Train under district coaches 5–6 days/week",
      "Compete in inter-district & zonal championships",
      "Obtain a Sports Authority registration ID",
    ],
    keyFocus: "Technical Skills & Competition",
    ageRange: "12 – 18 years",
    competitions: "District championships, Zonal leagues, Sub-junior meets",
    parentalCommitment: {
      time: "4-6 days a week",
      financial: "Moderate (Coaching fees, kit, district travel)",
      travel: "Inter-district & regional",
      role: "Schedule Manager & Motivator",
    },
  },
  {
    id: "state",
    level: 3,
    label: "State",
    title: "State Level",
    description:
      "Representing your state is a milestone of serious athletic achievement. State-level athletes train at dedicated academies, receive structured coaching support, and compete in national-qualifying tournaments.",
    icon: <Flag className="h-6 w-6" />,
    color: "from-violet-500 to-purple-600",
    bgLight: "from-violet-50 to-purple-50",
    border: "border-violet-200",
    accent: "text-violet-600",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    glowColor: "bg-violet-400/10",
    steps: [
      "Pass state selection / qualifying trials",
      "Enrol in a state sports academy or SAI programme",
      "Represent your state in national-level meets",
      "Build a competition portfolio & ranking",
    ],
    keyFocus: "Performance & State Representation",
    ageRange: "14 – 22 years",
    competitions: "State championships, National-qualifying meets, SAF Games",
    parentalCommitment: {
      time: "Daily training, often twice a day",
      financial: "High (Academy fees, specialized gear, state travel)",
      travel: "State-wide & some national",
      role: "Financial Sponsor & Emotional Anchor",
    },
  },
  {
    id: "national",
    level: 4,
    label: "National",
    title: "National Level",
    description:
      "The pinnacle of domestic sport. National-level athletes compete in premier domestic leagues, national championships, and attract selection for international squads. This requires full-time athletic commitment, elite coaching, and sports science support.",
    icon: <Trophy className="h-6 w-6" />,
    color: "from-orange-500 to-amber-500",
    bgLight: "from-orange-50 to-amber-50",
    border: "border-orange-200",
    accent: "text-orange-600",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    glowColor: "bg-orange-400/10",
    steps: [
      "Clear national selection trials / ranking cutoff",
      "Join a national academy or elite sports programme",
      "Compete in National Games, Senior Nationals",
      "Get access to SAI nutrition & physio support",
    ],
    keyFocus: "Elite Performance & National Ranking",
    ageRange: "16 – 30+ years",
    competitions: "National Games, Senior Nationals, Premier League",
    parentalCommitment: {
      time: "Full-time athletic commitment",
      financial: "Very High (Nutrition, physio, elite camps)",
      travel: "Extensive national travel",
      role: "Support Team Coordinator",
    },
  },
  {
    id: "international",
    level: 5,
    label: "International",
    title: "International Level",
    description:
      "Representing India on the world stage — the ultimate goal. International athletes compete at the Asian Games, Commonwealth Games, World Championships, and the Olympics. Sustained excellence, peak conditioning, and mental fortitude separate the world's best.",
    icon: <Globe className="h-6 w-6" />,
    color: "from-rose-500 to-pink-600",
    bgLight: "from-rose-50 to-pink-50",
    border: "border-rose-200",
    accent: "text-rose-600",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    glowColor: "bg-rose-400/10",
    steps: [
      "Achieve top national ranking / merit selection",
      "Train under a national coaching programme (NIS/SAI)",
      "Compete in continental & world-level events",
      "Pursue Olympic / Paralympic qualification",
    ],
    keyFocus: "World-Class Excellence & Olympic Pathway",
    ageRange: "18 – 35 years",
    competitions: "Asian Games, CWG, World Championships, Olympics",
    parentalCommitment: {
      time: "Life centers around the sport",
      financial: "Sponsorships usually take over",
      travel: "Global",
      role: "Trusted Advisor & Biggest Fan",
    },
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AmbientBlob({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl will-change-transform ${className}`}
    />
  );
}

// ─── Search result level icons ────────────────────────────────────────────────

const levelIconMap: Record<number, React.ReactNode> = {
  1: <MapPin className="h-5 w-5" />,
  2: <Shield className="h-5 w-5" />,
  3: <Flag className="h-5 w-5" />,
  4: <Trophy className="h-5 w-5" />,
  5: <Globe className="h-5 w-5" />,
};

const levelColorMap: Record<
  number,
  { gradient: string; bg: string; border: string; text: string; badge: string }
> = {
  1: {
    gradient: "from-emerald-500 to-teal-500",
    bg: "from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  2: {
    gradient: "from-blue-500 to-indigo-500",
    bg: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    text: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  3: {
    gradient: "from-violet-500 to-purple-600",
    bg: "from-violet-50 to-purple-50",
    border: "border-violet-200",
    text: "text-violet-600",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
  },
  4: {
    gradient: "from-orange-500 to-amber-500",
    bg: "from-orange-50 to-amber-50",
    border: "border-orange-200",
    text: "text-orange-600",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
  5: {
    gradient: "from-rose-500 to-pink-600",
    bg: "from-rose-50 to-pink-50",
    border: "border-rose-200",
    text: "text-rose-600",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
  },
};

// ─── Dynamic pathway level card ────────────────────────────────────────────────

function PathwayLevelCard({
  level,
  isActive,
  onClick,
}: {
  level: any;
  isActive: boolean;
  onClick: () => void;
}) {
  const colors = levelColorMap[level.level] ?? levelColorMap[1];
  return (
    <motion.button
      variants={cardReveal}
      onClick={onClick}
      whileHover={{ y: -3, scale: 1.02 }}
      transition={SPRING_STIFF}
      className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 will-change-transform ${
        isActive
          ? `bg-gradient-to-br ${colors.bg} ${colors.border} shadow-lg`
          : "border-white/70 bg-white/80 backdrop-blur-sm hover:border-white/90 hover:bg-white/90 premium-shadow"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
        >
          {levelIconMap[level.level]}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}
          >
            Level {level.level}
          </p>
          <p className="font-bold text-slate-900 truncate text-sm">
            {level.label}
          </p>
          <p className="text-xs text-slate-500 truncate">{level.keyFocus}</p>
        </div>
        <motion.div
          animate={{ rotate: isActive ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          className={`shrink-0 lg:hidden ${colors.text}`}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </div>
    </motion.button>
  );
}

// ─── Dynamic pathway detail ────────────────────────────────────────────────────

function PathwayLevelDetail({
  level,
  sportName,
}: {
  level: any;
  sportName?: string;
}) {
  const colors = levelColorMap[level.level] ?? levelColorMap[1];
  const commitment = (level as any).parentalCommitment ||
    pathwayLevels.find((l) => l.level === level.level)?.parentalCommitment || {
      time: "Varies",
      financial: "Varies",
      travel: "Varies",
      role: "Supportive Parent",
    };

  return (
    <motion.div
      key={level.level}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={SPRING_STIFF}
      className={`relative flex-1 flex flex-col overflow-hidden rounded-3xl border bg-gradient-to-br ${colors.bg} ${colors.border} p-5 sm:p-6 lg:p-8 shadow-xl`}
    >
      <div className="flex items-start gap-3 sm:gap-5 mb-6">
        <div
          className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colors.gradient} text-white shadow-lg`}
        >
          {levelIconMap[level.level]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`inline-block max-w-full break-words rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-widest ${colors.badge}`}
            >
              Level {level.level}
            </span>
            <span
              className={`inline-block max-w-full break-words rounded-full border px-3 py-0.5 text-xs font-semibold ${colors.badge}`}
            >
              {level.ageRange}
            </span>
            {level.governingBody && (
              <span className="inline-block max-w-full break-words rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">
                {level.governingBody}
              </span>
            )}
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 lg:text-2xl break-words">
            {level.title}
          </h3>
        </div>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        {level.description}
      </p>

      {/* Parent's Corner */}
      <div
        className={
          "mb-8 rounded-2xl border bg-white/90 p-4 sm:p-6 " +
          colors.border +
          " shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md"
        }
      >
        <h4 className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
          <HeartHandshake className={"h-5 w-5 " + colors.text} />
          Parent's Corner
        </h4>
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <div
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow " +
                colors.gradient
              }
            >
              <Clock className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Time Investment
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {commitment.time}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow " +
                colors.gradient
              }
            >
              <Wallet className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Financial Impact
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {commitment.financial}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow " +
                colors.gradient
              }
            >
              <Map className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Travel
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {commitment.travel}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow " +
                colors.gradient
              }
            >
              <Compass className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Your Role
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {commitment.role}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 mt-6 lg:mt-auto">
        <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <TrendingUp className="h-3.5 w-3.5" />
          Key Objectives
        </h4>
        <ul className="space-y-2">
          {level.steps.map((step: string, i: number) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckCircle
                className={"mt-0.5 h-4 w-4 shrink-0 " + colors.text}
              />
              <span className="flex-1 min-w-0 text-sm leading-relaxed text-slate-700">
                {step}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actionable CTAs */}
      <div className="mt-2 flex flex-col sm:flex-row gap-3">
        <Link
          href={`${getCommunityAppUrl()}/discover?tab=COMMUNITIES`}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 bg-gradient-to-r ${colors.gradient}`}
        >
          <Users className="h-4 w-4" />
          Find Local Communities
        </Link>
        <Link
          href={`${getCommunityAppUrl()}/discover?tab=COACHES`}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
        >
          <Trophy className="h-4 w-4" />
          Find Coaches
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Sport search section ──────────────────────────────────────────────────────

function PathwayExplorerSection() {
  const [query, setQuery] = useState("");
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [fuse, setFuse] = useState<Fuse<Sport> | null>(null);
  const [suggestions, setSuggestions] = useState<Sport[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<{
    pathway: SportPathway;
    source: "db" | "generated";
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<
    | "pathway"
    | "tournaments"
    | "scholarships"
    | "universities"
    | "equipment"
    | "careers"
  >("pathway");
  const [modalData, setModalData] = useState<{ item: any; type: "tournament" | "scholarship" | "university" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!fuse || query.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveTab("pathway");
      return;
    }
    const results = fuse.search(query).map((r) => r.item);
    setSuggestions(results.slice(0, 5));
    setShowSuggestions(results.length > 0);
  }, [query, fuse]);

  const handleSearch = async (sportName: string) => {
    const name = sportName.trim();
    if (!name || name.length < 2) return;
    setShowSuggestions(false);
    setQuery(name);
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    setActiveIdx(0);
    setActiveTab("pathway");
    try {
      const res = await pathwayApi.getPathway(name);
      if (res) {
        setResult(res);
        setQuery(res.pathway.sportName); // Update input field to match the properly formatted DB name
        setStatus("success");
      } else {
        setErrorMsg(
          `"${name}" doesn't appear to be a recognised sport. Please try a different name.`,
        );
        setStatus("error");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const currentLevels = result ? result.pathway.levels : pathwayLevels;
  const selectedLevel = currentLevels[activeIdx] || currentLevels[0];

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
            Find the Right Pathway.
            <span className="relative ml-2 inline-block">
              Instantly.
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-200"
              />
            </span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-lg text-base text-slate-600 sm:text-lg"
          >
            Type any sport to see what it takes for your child to excel. We
            break down the timeline, requirements, and steps needed.
          </motion.p>
        </motion.div>

        {/* Search bar */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mx-auto max-w-2xl relative"
        >
          <div className="relative flex items-center gap-1.5 rounded-2xl border border-white/70 bg-white/90 p-1.5 sm:gap-3 sm:p-2 sm:pr-3 shadow-xl backdrop-blur-sm">
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
                if (e.key === "Enter") {
                  handleSearch(query);
                }
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="e.g. Cricket, Badminton..."
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm font-medium text-slate-900 placeholder-slate-400 outline-none sm:px-0 sm:text-base"
              aria-label="Search sport pathway"
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

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showSuggestions && status === "idle" && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
              >
                <div className="h-0.5 w-full bg-gradient-to-r from-power-orange/60 via-power-orange to-power-orange/60" />
                <div className="py-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s.slug || s.name}
                      onClick={() => handleSearch(s.name)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-orange-50"
                    >
                      <Database className="h-4 w-4 shrink-0 text-power-orange" />
                      <span className="text-sm font-medium text-slate-800">
                        {s.name}
                      </span>
                    </button>
                  ))}
                </div>
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
            className="mt-5 flex flex-wrap justify-center gap-2 px-2"
          >
            {[
              "Cricket",
              "Badminton",
              "Football",
              "Kabaddi",
              "Wrestling",
              "Archery",
              "Table Tennis",
              "Boxing",
            ].map((s) => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-orange-200 hover:bg-orange-50 hover:text-power-orange sm:px-4"
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}

        {/* ── Loading state ── */}
        <AnimatePresence>
          {status === "loading" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-12 max-w-lg rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-6 sm:p-10 text-center shadow-lg"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-power-orange text-white shadow-lg">
                <Sparkles className="h-8 w-8 animate-pulse" />
              </div>
              <p className="text-lg font-bold text-slate-900">
                Generating Pathway…
              </p>
              <p className="mt-2 text-sm text-slate-500 break-words">
                Our AI is researching the{" "}
                <span className="font-semibold text-power-orange">{query}</span>{" "}
                development pathway in India.
              </p>
              <div className="mt-6 flex items-center justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-power-orange"
                    style={{
                      animation: "bounce 1.2s " + i * 0.2 + "s infinite",
                    }}
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

        {/* ── Explorer View (Default or Result) ── */}
        <AnimatePresence mode="wait">
          {(status === "idle" || status === "success") && (
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
                <div className="mb-8">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {/* We no longer show "From Database" to keep the experience unified */}
                    {result.source === "generated" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-power-orange border border-orange-200">
                        <Sparkles className="h-3 w-3" /> AI Generated
                      </span>
                    )}
                    {result.pathway.category && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                        {result.pathway.category}
                      </span>
                    )}
                  </div>
                  <h2 className="font-title text-2xl font-bold text-slate-900 break-words sm:text-3xl md:text-4xl">
                    {result.pathway.sportName} Pathway
                  </h2>
                  {result.pathway.overview && (
                    <p className="mt-2 max-w-2xl text-slate-600">
                      {result.pathway.overview}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-8 text-center sm:text-left">
                  <h2 className="font-title text-xl font-bold text-slate-900 sm:text-2xl md:text-3xl">
                    The General Sports Pathway
                  </h2>
                  <p className="mt-2 max-w-2xl text-slate-600 mx-auto sm:mx-0">
                    Discover the five universal stages of athletic development
                    in India. Search for a specific sport above to see tailored
                    insights.
                  </p>
                </div>
              )}

              {/* Tabs */}
              {result && (
                <div className="mb-10 grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200/50 bg-slate-100/50 p-1.5 backdrop-blur-sm sm:grid-cols-3 sm:gap-2 sm:p-2 lg:flex lg:flex-wrap">
                  {[
                    {
                      id: "pathway",
                      label: "Pathway",
                      icon: <Flag className="h-4 w-4" />,
                    },
                    {
                      id: "tournaments",
                      label: "Tournaments",
                      icon: <Trophy className="h-4 w-4" />,
                    },
                    {
                      id: "scholarships",
                      label: "Scholarships",
                      icon: <Wallet className="h-4 w-4" />,
                    },
                    {
                      id: "universities",
                      label: "Universities",
                      icon: <Landmark className="h-4 w-4" />,
                    },
                    {
                      id: "equipment",
                      label: "Equipment",
                      icon: <ShoppingBag className="h-4 w-4" />,
                    },
                    {
                      id: "careers",
                      label: "Careers",
                      icon: <Briefcase className="h-4 w-4" />,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-semibold transition-all sm:gap-2 sm:text-sm lg:flex-1 lg:px-4 ${
                        activeTab === tab.id
                          ? "text-power-orange shadow-sm"
                          : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                      }`}
                    >
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-slate-200/50"
                          transition={{
                            type: "spring",
                            bounce: 0.2,
                            duration: 0.6,
                          }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                        {tab.icon}
                        <span className="truncate">{tab.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {(!result || activeTab === "pathway") && (
                  <motion.div
                    key="pathway"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr]"
                  >
                    {/* Left: level pills */}
                    <div className="space-y-3">
                      {/* Visual Pyramid Indicator for Desktop */}
                      <motion.div
                        variants={scaleIn}
                        className="mb-6 hidden lg:block"
                      >
                        <svg
                          viewBox="0 0 300 160"
                          className="w-full"
                          aria-hidden
                        >
                          {[
                            {
                              y: 130,
                              width: 280,
                              fill: "rgba(16,185,129,0.12)",
                              stroke: "rgba(16,185,129,0.4)",
                              label: "Grassroots",
                            },
                            {
                              y: 104,
                              width: 224,
                              fill: "rgba(59,130,246,0.12)",
                              stroke: "rgba(59,130,246,0.4)",
                              label: "District",
                            },
                            {
                              y: 78,
                              width: 168,
                              fill: "rgba(139,92,246,0.12)",
                              stroke: "rgba(139,92,246,0.4)",
                              label: "State",
                            },
                            {
                              y: 52,
                              width: 112,
                              fill: "rgba(249,115,22,0.12)",
                              stroke: "rgba(249,115,22,0.4)",
                              label: "National",
                            },
                            {
                              y: 26,
                              width: 56,
                              fill: "rgba(244,63,94,0.12)",
                              stroke: "rgba(244,63,94,0.4)",
                              label: "International",
                            },
                          ].map((tier, i) => (
                            <g
                              key={i}
                              onClick={() => setActiveIdx(i)}
                              className="cursor-pointer transition-opacity hover:opacity-80"
                            >
                              <rect
                                x={(300 - tier.width) / 2}
                                y={tier.y - 22}
                                width={tier.width}
                                height={22}
                                rx={4}
                                fill={
                                  i === activeIdx
                                    ? tier.fill.replace("0.12", "0.3")
                                    : tier.fill
                                }
                                stroke={tier.stroke}
                                strokeWidth={i === activeIdx ? 1.5 : 1}
                                style={{ transition: "fill 0.3s" }}
                              />
                              <text
                                x="150"
                                y={130 - i * 26 - 8}
                                textAnchor="middle"
                                fontSize="8"
                                fontWeight={i === activeIdx ? "700" : "500"}
                                fill={i === activeIdx ? "#0f172a" : "#94a3b8"}
                                style={{ transition: "fill 0.3s" }}
                              >
                                {tier.label}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </motion.div>

                      {currentLevels.map((lv, i) => (
                        <div key={lv.level} className="flex flex-col gap-3">
                          <PathwayLevelCard
                            level={lv}
                            isActive={i === activeIdx}
                            onClick={() => {
                              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                                setActiveIdx(activeIdx === i ? -1 : i);
                              } else {
                                setActiveIdx(i);
                              }
                            }}
                          />
                          <AnimatePresence initial={false}>
                            {i === activeIdx && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                  height: { type: "spring", stiffness: 300, damping: 30 },
                                  opacity: { duration: 0.2 },
                                }}
                                className="lg:hidden overflow-hidden origin-top"
                              >
                                <div className="pt-1 pb-2">
                                  <PathwayLevelDetail
                                    level={lv}
                                    sportName={
                                      result
                                        ? result.pathway.sportName
                                        : "General"
                                    }
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>

                    {/* Right: detail (Desktop Only) */}
                    <div className="hidden h-full lg:flex lg:flex-col">
                      <AnimatePresence mode="wait">
                        {selectedLevel && (
                          <PathwayLevelDetail
                            key={selectedLevel.level}
                            level={selectedLevel}
                            sportName={
                              result ? result.pathway.sportName : "General"
                            }
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {result && activeTab === "tournaments" && (
                  <motion.div
                    key="tournaments"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {result.pathway.tournaments?.length > 0 ? (
                      result.pathway.tournaments.map((t: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => setModalData({ item: t, type: "tournament" })}
                          className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-power-orange hover:ring-1 hover:ring-power-orange group cursor-pointer"
                        >
                          <div>
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <h3 className="font-title font-bold text-slate-800 break-words group-hover:text-power-orange transition-colors">
                                {t.name}
                              </h3>
                              <span className="shrink-0 max-w-[50%] truncate rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-power-orange">
                                {t.level}
                              </span>
                            </div>
                            <p className="mb-4 text-sm text-slate-600 line-clamp-3">
                              {t.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 min-w-0 flex-1">
                              <Users className="h-4 w-4 text-slate-400 shrink-0" />
                              <span className="truncate">{t.ageGroup}</span>
                            </div>
                            <span className="text-xs font-bold text-power-orange flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 whitespace-nowrap">
                              View Details <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-500">
                        No specific tournaments found for this sport.
                      </div>
                    )}
                  </motion.div>
                )}

                {result && activeTab === "scholarships" && (
                  <motion.div
                    key="scholarships"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                  >
                    {result.pathway.scholarships?.length > 0 ? (
                      result.pathway.scholarships.map((s: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => setModalData({ item: s, type: "scholarship" })}
                          className="flex flex-col rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/60 to-slate-50/60 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-emerald-200 group cursor-pointer"
                        >
                          <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-inner">
                              <Wallet className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-title font-bold text-slate-800 text-lg leading-tight break-words">
                                {s.name}
                              </h3>
                              <p className="text-xs font-semibold text-emerald-600 mt-1">
                                {s.provider}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed mb-4 flex-1">
                            {s.description}
                          </p>
                          <div className="mt-auto border-t border-slate-100 pt-4 flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                                  Eligibility
                                </span>
                              </div>
                              <p className="text-sm font-medium text-slate-700 leading-relaxed truncate">
                                {s.eligibility}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 whitespace-nowrap">
                              View Details <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-500">
                        No specific scholarships found for this sport.
                      </div>
                    )}
                  </motion.div>
                )}

                {result && activeTab === "universities" && (
                  <motion.div
                    key="universities"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {result.pathway.universities?.length > 0 ? (
                      result.pathway.universities.map((u: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => setModalData({ item: u, type: "university" })}
                          className="flex flex-col rounded-2xl border border-slate-200/60 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-indigo-200 group cursor-pointer"
                        >
                          <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                              <Landmark className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-title font-bold leading-tight text-slate-800 break-words">
                                {u.name}
                              </h3>
                              <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3 shrink-0" />{" "}
                                <span className="truncate">{u.location}</span>
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3 flex-1">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Admission Criteria
                              </p>
                              <p className="text-sm text-slate-700">
                                {u.admissionCriteria}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Sports Quota Details
                              </p>
                              <p className="text-sm text-slate-700">
                                {u.sportsQuotaDetails}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-end">
                            <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 whitespace-nowrap">
                              View Details <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-500">
                        No specific universities found for this sport.
                      </div>
                    )}
                  </motion.div>
                )}

                {result && activeTab === "equipment" && (
                  <motion.div
                    key="equipment"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {result.pathway.equipment?.length > 0 ? (
                      result.pathway.equipment.map((e: any, i: number) => (
                        <div
                          key={i}
                          className="flex flex-col rounded-2xl border border-slate-200/60 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-power-orange/30"
                        >
                          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                            <span className="inline-block rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200 text-left leading-snug max-w-full break-words">
                              {e.level}
                            </span>
                            <div className="flex shrink-0 items-center gap-1.5 text-power-orange bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                              <Wallet className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-xs font-bold whitespace-nowrap">
                                {e.estimatedCost}
                              </span>
                            </div>
                          </div>
                          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                            Essential Gear
                          </h4>
                          <ul className="space-y-2.5 flex-1 mt-1">
                            {e.items.map((item: string, j: number) => (
                              <li key={j} className="flex items-start gap-2.5">
                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                                <span className="text-sm font-medium text-slate-700 leading-relaxed">
                                  {item}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-500">
                        No equipment data found for this sport.
                      </div>
                    )}
                  </motion.div>
                )}

                {result && activeTab === "careers" && (
                  <motion.div
                    key="careers"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                  >
                    {result.pathway.careers?.length > 0 ? (
                      result.pathway.careers.map((c: any, i: number) => (
                        <div
                          key={i}
                          className="flex flex-col rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/60 to-slate-50/60 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-blue-200 group"
                        >
                          <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-inner">
                              <Briefcase className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-title font-bold text-slate-800 text-lg leading-tight break-words">
                                {c.role}
                              </h3>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed mb-4 flex-1">
                            {c.description}
                          </p>
                          <div className="mt-auto border-t border-slate-100 pt-4">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                                Demand
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-700 leading-relaxed">
                              {c.demand}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-500">
                        No alternative career paths found for this sport.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        
        {modalData && (
          <PathwayConciergeModal 
            isOpen={!!modalData} 
            onClose={() => setModalData(null)} 
            item={modalData.item} 
            type={modalData.type} 
          />
        )}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PathwaysPage() {
  const communityUrl = getCommunityAppUrl();
  const [activeLevel, setActiveLevel] = useState(0);
  const selected = pathwayLevels[activeLevel];

  const statCards = [
    {
      icon: <Users className="h-6 w-6" />,
      value: "500M+",
      label: "Sports Participants in India",
      color: "bg-orange-100 text-power-orange",
    },
    {
      icon: <Medal className="h-6 w-6" />,
      value: "28",
      label: "Olympic Medals (All-time)",
      color: "bg-indigo-100 text-indigo-600",
    },
    {
      icon: <Trophy className="h-6 w-6" />,
      value: "40+",
      label: "National Federations",
      color: "bg-amber-100 text-amber-600",
    },
    {
      icon: <Star className="h-6 w-6" />,
      value: "5 Levels",
      label: "From Grassroots to World Stage",
      color: "bg-emerald-100 text-emerald-600",
    },
  ];

  return (
    <main className="overflow-x-hidden">
      {/* ── Hero ── */}
      <Hero
        variant="page"
        title="Plan Your Child's Sports Journey"
        subtitle="A Simple Guide for Parents"
        description="From playing in the local park to reaching the highest level in sports. Find out exactly how much time, money, and effort it takes to support your child's dream."
      />

      {/* ── AI Search Section ── */}
      <PathwayExplorerSection />

      {/* ── Stats Banner ── */}
      <section className="relative py-10 sm:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-64 w-full -translate-x-1/2 bg-gradient-to-b from-orange-50/40 to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4"
          >
            {statCards.map((stat) => (
              <motion.div
                key={stat.label}
                variants={cardReveal}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={SPRING_STIFF}
                className="group flex flex-col items-center rounded-2xl border border-white/70 bg-white/80 p-5 sm:p-6 text-center backdrop-blur-sm premium-shadow will-change-transform"
              >
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${stat.color}`}
                >
                  {stat.icon}
                </div>
                <p className="font-title text-2xl font-extrabold text-slate-900 sm:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How PowerMySport Helps ── */}
      <section className="relative overflow-hidden py-12 sm:py-16 md:py-20 lg:py-28">
        <AmbientBlob className="h-80 w-80 bg-orange-100/40 -right-24 top-16" />
        <AmbientBlob className="h-72 w-72 bg-emerald-100/30 -left-32 bottom-20" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14 text-center"
          >
            <motion.div variants={fadeUp} className="mb-4 flex justify-center">
              <SectionLabel
                label="We Support You at Every Step"
                color="green"
              />
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="font-title mx-auto max-w-2xl text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl lg:text-5xl"
            >
              PowerMySport Helps You Grow Faster
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:text-lg"
            >
              No matter where you start, we provide the tools, coaches, and
              places you need to reach the next level.
            </motion.p>
          </motion.div>

          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[
              {
                icon: <Dumbbell className="h-7 w-7" />,
                title: "Expert Coaches",
                description:
                  "Connect with verified coaches who have played at top levels. Learn from people who know exactly what it takes to succeed.",
                color: "bg-orange-100 text-power-orange",
                accent: "text-power-orange",
              },
              {
                icon: <MapPin className="h-7 w-7" />,
                title: "Top Training Grounds",
                description:
                  "Book the best training grounds used by top athletes. Get access to the same great facilities the pros use, whenever you need them.",
                color: "bg-indigo-100 text-indigo-600",
                accent: "text-indigo-600",
              },
              {
                icon: <Award className="h-7 w-7" />,
                title: "Smart AI Planning",
                description:
                  "Our AI creates a custom plan based on your child's age, sport, and current skill level — showing you exactly what to do next.",
                color: "bg-emerald-100 text-emerald-600",
                accent: "text-emerald-600",
              },
            ].map((item) => (
              <motion.div
                key={item.title}
                variants={cardReveal}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={SPRING_STIFF}
                className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-6 sm:p-8 backdrop-blur-sm premium-shadow will-change-transform hover:border-white/90"
              >
                {/* decorative circle */}
                <div
                  aria-hidden
                  className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-slate-50 opacity-60 transition-transform duration-500 group-hover:scale-150"
                />
                <div
                  className={`relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${item.color}`}
                >
                  {item.icon}
                </div>
                <h3 className="relative mb-3 text-lg font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="relative text-sm leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <CTA
        variant="gradient"
        title="Ready to Support Their Dream?"
        description="Find the right coach, book the right ground, and get a smart plan that shows exactly how to help your child grow in sports."
        primaryCTA={{
          label: "Get Your Parent Guide",
          href: "/register?role=PARENT",
        }}
        secondaryCTA={{
          label: "Join Parent Community",
          href: communityUrl,
        }}
      />
    </main>
  );
}
