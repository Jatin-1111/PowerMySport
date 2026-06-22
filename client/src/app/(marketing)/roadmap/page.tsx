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
import { TournamentModal } from "@/modules/sports/components/TournamentDetailModal";
import { TournamentRecommendationPanel } from "@/modules/sports/components/TournamentRecommendationPanel";
import { pathwayProfileApi, AthleteStory } from "@/modules/sports/services/pathwayProfileApi";
import { useAuthStore } from "@/modules/auth/store/authStore";
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
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronUp,
  BarChart3,
  Download,
  Copy,
  Check,
  Plus,
  Minus,
  Calculator,
  SlidersHorizontal,
  GitCompare,
  Pin,
  // P5-P9 icons
  Heart,
  Bookmark,
  Bell,
  MessageSquareQuote,
  ExternalLink,
  CheckCheck,
  RotateCcw,
  FileText,
  ClipboardList,
  Quote,
  BadgeCheck,
  PartyPopper,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman & Nicobar", "Chandigarh", "Dadra & Nagar Haveli", "Daman & Diu",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

// Coaching fee tiers derived from parentalCommitment.financial text
const COACHING_FEE_TIERS: Record<number, { label: string; low: number; high: number }> = {
  1: { label: "₹1,000–₹3,000/mo", low: 1000, high: 3000 },
  2: { label: "₹3,000–₹10,000/mo", low: 3000, high: 10000 },
  3: { label: "₹10,000–₹30,000/mo", low: 10000, high: 30000 },
  4: { label: "₹30,000–₹80,000/mo", low: 30000, high: 80000 },
  5: { label: "Sponsorship / ₹80,000+", low: 80000, high: 150000 },
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

// ─── Types ────────────────────────────────────────────────────────────────────

type ProgressState = {
  currentLevel: number; // 1-5, 0 = not set
  completedSteps: Record<number, boolean[]>; // level -> step index -> done
};

const DEFAULT_PROGRESS: ProgressState = {
  currentLevel: 0,
  completedSteps: {},
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadProgress(): ProgressState {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const raw = localStorage.getItem("pms_pathway_progress");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_PROGRESS;
}

function saveProgress(p: ProgressState) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pms_pathway_progress", JSON.stringify(p));
}

function loadState(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("pms_selected_state") || "";
}

function saveState(s: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pms_selected_state", s);
}

// ─── P5-P9 Types & Helpers ────────────────────────────────────────────────────

type SavedItem = {
  id: string;
  type: "tournament" | "scholarship" | "university" | "career";
  name: string;
  sport: string;
  data: any;
  savedAt: string;
};

type ApplicationRecord = {
  id: string;
  itemName: string;
  itemType: "tournament" | "scholarship" | "university";
  sport: string;
  status: "Submitted" | "In Review" | "Approved";
  documents: { name: string }[];
  submittedAt: string;
};


function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function lsSet(key: string, val: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
}

function loadSaved(): SavedItem[] { return lsGet("pms_saved_items", []); }
function saveSaved(items: SavedItem[]) { lsSet("pms_saved_items", items); }

function loadApplications(): ApplicationRecord[] { return lsGet("pms_applications", []); }
function saveApplications(items: ApplicationRecord[]) { lsSet("pms_applications", items); }


// Stories are now fetched from the backend

// ─── P9: Deep-link helper ──────────────────────────────────────────────────────

function buildDiscoveryUrl(objective: string, sportName: string, levelLabel: string): string {
  const base = "/discover";
  const lower = objective.toLowerCase();
  let tab = "VENUES";
  if (lower.includes("coach") || lower.includes("training")) tab = "COACHES";
  else if (lower.includes("club") || lower.includes("community") || lower.includes("school")) tab = "VENUES";
  else if (lower.includes("tournament") || lower.includes("compet") || lower.includes("trial")) tab = "EVENTS";
  const params = new URLSearchParams({ tab, sport: sportName, level: levelLabel });
  return `${base}?${params.toString()}`;
}

// ─── P5: Save Button ──────────────────────────────────────────────────────────

function SaveButton({
  item,
  type,
  sport,
  savedItems,
  onToggle,
}: {
  item: any;
  type: SavedItem["type"];
  sport: string;
  savedItems: SavedItem[];
  onToggle: (items: SavedItem[]) => void;
}) {
  const id = `${type}:${item.name || item.role}:${sport}`;
  const isSaved = savedItems.some((s) => s.id === id);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    let updated: SavedItem[];
    if (isSaved) {
      updated = savedItems.filter((s) => s.id !== id);
    } else {
      updated = [
        ...savedItems,
        { id, type, name: item.name || item.role, sport, data: item, savedAt: new Date().toISOString() },
      ];
    }
    onToggle(updated);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={isSaved ? "Remove from saved" : "Save for later"}
      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all shrink-0 ${
        isSaved
          ? "border-rose-200 bg-rose-50 text-rose-500 shadow-sm"
          : "border-slate-200 bg-white/80 text-slate-300 hover:border-rose-200 hover:text-rose-400"
      }`}
    >
      <Heart className={`h-3.5 w-3.5 ${isSaved ? "fill-rose-500" : ""}`} />
    </button>
  );
}

// ─── P5: Saved Tab ────────────────────────────────────────────────────────────

function SavedTab({
  savedItems,
  onUnsave,
  onOpenModal,
}: {
  savedItems: SavedItem[];
  onUnsave: (id: string) => void;
  onOpenModal: (item: any, type: any) => void;
}) {
  const grouped = {
    tournament: savedItems.filter((s) => s.type === "tournament"),
    scholarship: savedItems.filter((s) => s.type === "scholarship"),
    university: savedItems.filter((s) => s.type === "university"),
    career: savedItems.filter((s) => s.type === "career"),
  };

  const typeConfig = {
    tournament: { label: "Tournaments", icon: <Trophy className="h-4 w-4" />, color: "text-power-orange", bg: "bg-orange-50 border-orange-100" },
    scholarship: { label: "Scholarships", icon: <Wallet className="h-4 w-4" />, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
    university: { label: "Universities", icon: <Landmark className="h-4 w-4" />, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100" },
    career: { label: "Careers", icon: <Briefcase className="h-4 w-4" />, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
  } as const;

  if (savedItems.length === 0) {
    return (
      <motion.div
        key="saved-empty"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center gap-4"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
          <Heart className="h-7 w-7 text-rose-300" />
        </div>
        <div>
          <p className="font-bold text-slate-700 text-lg">No saved items yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">
            Tap the <Heart className="inline h-3.5 w-3.5 text-rose-400" /> on any tournament, scholarship, university, or career card to shortlist it here.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="saved"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      {(["tournament", "scholarship", "university", "career"] as const).map((type) => {
        const items = grouped[type];
        if (items.length === 0) return null;
        const cfg = typeConfig[type];
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-3">
              <span className={cfg.color}>{cfg.icon}</span>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{cfg.label}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{items.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((saved) => (
                <div
                  key={saved.id}
                  className={`relative flex flex-col rounded-2xl border ${cfg.bg} p-4 shadow-sm`}
                >
                  <button
                    onClick={() => onUnsave(saved.id)}
                    className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 border border-rose-100 text-rose-400 hover:bg-rose-50 transition"
                    title="Remove from saved"
                  >
                    <Heart className="h-3 w-3 fill-rose-400" />
                  </button>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {saved.sport} · Saved {new Date(saved.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                  <p className="font-bold text-slate-900 text-sm mb-3 pr-8 break-words">{saved.name}</p>
                  {type !== "career" && (
                    <button
                      onClick={() => onOpenModal(saved.data, type)}
                      className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open Guide
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

// ─── P6: Applications Tab ─────────────────────────────────────────────────────

function ApplicationsTab({
  applications,
  onUpdateStatus,
}: {
  applications: ApplicationRecord[];
  onUpdateStatus: (id: string, status: ApplicationRecord["status"]) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const statusConfig: Record<ApplicationRecord["status"], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    Submitted: { label: "Submitted", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: <FileText className="h-3.5 w-3.5" /> },
    "In Review": { label: "In Review", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: <RotateCcw className="h-3.5 w-3.5 animate-spin-slow" /> },
    Approved: { label: "Approved", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCheck className="h-3.5 w-3.5" /> },
  };

  if (applications.length === 0) {
    return (
      <motion.div
        key="apps-empty"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center gap-4"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
          <ClipboardList className="h-7 w-7 text-slate-300" />
        </div>
        <div>
          <p className="font-bold text-slate-700 text-lg">No applications yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">
            Submit documents through the Sports Pathway Guide on any tournament, scholarship, or university card — they'll appear here.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="applications"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
        <Bell className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span>Status updates will appear here as our team reviews your submission. Documents already uploaded can be reused on new applications.</span>
      </div>

      {applications.map((app) => {
        const sc = statusConfig[app.status];
        const isOpen = expanded === app.id;
        const nextStatus: ApplicationRecord["status"] =
          app.status === "Submitted" ? "In Review" : app.status === "In Review" ? "Approved" : "Approved";

        return (
          <div key={app.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : app.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold shrink-0 ${sc.bg} ${sc.color}`}>
                {sc.icon} {sc.label}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate text-sm">{app.itemName}</p>
                <p className="text-[10px] text-slate-400">{app.sport} · {app.itemType} · {new Date(app.submittedAt).toLocaleDateString("en-IN")}</p>
              </div>
              <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-slate-400 shrink-0">
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ height: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.15 } }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-slate-100 px-4 py-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Documents Submitted</p>
                      <ul className="space-y-1.5">
                        {app.documents.map((doc, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {doc.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {app.status !== "Approved" && (
                      <button
                        onClick={() => onUpdateStatus(app.id, nextStatus)}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-600 underline underline-offset-2 transition"
                      >
                        Demo: Mark as "{nextStatus}"
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </motion.div>
  );
}


// ─── P8: Stories Tab ──────────────────────────────────────────────────────────

function StoriesTab({ sportName, levels, stories }: { sportName: string; levels: any[], stories: AthleteStory[] }) {
  const [filterLevel, setFilterLevel] = useState<number | null>(null);

  const displayStories = filterLevel
    ? stories.filter((s) => s.level === filterLevel)
    : stories;

  return (
    <motion.div
      key="stories"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified Stories
          </span>
          <span className="text-xs text-slate-400">Illustrative family accounts based on real journeys</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setFilterLevel(null)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${!filterLevel ? "bg-slate-800 text-white border-transparent" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
          >
            All Levels
          </button>
          {levels.map((lv) => {
            const c = levelColorMap[lv.level];
            const active = filterLevel === lv.level;
            return (
              <button key={lv.level} onClick={() => setFilterLevel(active ? null : lv.level)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${active ? `bg-gradient-to-r ${c.gradient} text-white border-transparent shadow` : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                {lv.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Story cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {displayStories.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-500">
            <MessageSquareQuote className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p>No stories verified for this level yet.</p>
          </div>
        ) : (
          displayStories.map((story) => {
            const c = levelColorMap[story.level];
            return (
              <div key={story._id || story.name} className={`relative flex flex-col rounded-2xl border ${c.border} bg-gradient-to-br ${c.bg} p-5 shadow-sm overflow-hidden`}>
                {/* Level badge */}
                <div className={`absolute top-4 right-4 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${c.badge}`}>
                  {levels.find((l) => l.level === story.level)?.label}
                </div>

                {/* Quote */}
                <Quote className={`h-5 w-5 mb-3 opacity-30 ${c.text}`} />
                <p className="text-sm leading-relaxed text-slate-700 italic mb-4 flex-1">
                  "{story.quote}"
                </p>

                {/* Divider */}
                <div className={`border-t ${c.border} pt-4 space-y-3`}>
                  <div>
                    <p className={`font-bold text-slate-900 text-sm`}>{story.name}</p>
                    <p className="text-xs text-slate-500">{sportName} · {story.location}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 rounded-xl border ${c.badge} px-3 py-1.5 w-fit`}>
                    <Trophy className={`h-3 w-3 shrink-0 ${c.text}`} />
                    <span className={`text-[10px] font-bold ${c.text}`}>{story.achievement}</span>
                  </div>
                  {story.parentNote && (
                    <div className="rounded-xl bg-white/70 border border-white px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                        <HeartHandshake className="h-3 w-3" /> Parent's Note
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed italic">"{story.parentNote}"</p>
                    </div>
                  )}
                </div>
                {/* Verified badge */}
                <div className="mt-3 flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-600">Verified Story</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

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

// ─── P1: Progress Tracker ─────────────────────────────────────────────────────

function ProgressTracker({
  progress,
  onChange,
  levels,
}: {
  progress: ProgressState;
  onChange: (p: ProgressState) => void;
  levels: typeof pathwayLevels;
}) {
  const [open, setOpen] = useState(false);

  const currentLevelData =
    progress.currentLevel > 0
      ? levels.find((l) => l.level === progress.currentLevel)
      : null;

  const toggleStep = (levelNum: number, stepIdx: number) => {
    const safeCompletedSteps = progress.completedSteps || {};
    const existing = safeCompletedSteps[levelNum] || [];
    const updated = [...existing];
    updated[stepIdx] = !updated[stepIdx];
    const next: ProgressState = {
      ...progress,
      completedSteps: { ...safeCompletedSteps, [levelNum]: updated },
    };
    onChange(next);
  };

  const setLevel = (lvl: number) => {
    const next: ProgressState = { ...progress, currentLevel: lvl };
    onChange(next);
  };

  const stepsForCurrentLevel = currentLevelData?.steps || [];
  const safeCompletedSteps = progress.completedSteps || {};
  const completedForLevel = safeCompletedSteps[progress.currentLevel] || [];
  const completedCount = completedForLevel.filter(Boolean).length;
  const totalSteps = stepsForCurrentLevel.length;
  const remainingCount = totalSteps - completedCount;

  const nextLevel =
    progress.currentLevel > 0 && progress.currentLevel < 5
      ? levels.find((l) => l.level === progress.currentLevel + 1)
      : null;

  const colors = currentLevelData
    ? levelColorMap[currentLevelData.level]
    : levelColorMap[1];

  return (
    <div className="mb-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <Pin className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
            Where Is My Child Now?
          </p>
          {progress.currentLevel > 0 ? (
            <p className="text-sm font-bold text-slate-900 truncate">
              Level {progress.currentLevel} · {currentLevelData?.label} —{" "}
              {completedCount}/{totalSteps} objectives done
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-500">
              Tap to mark your child's current level
            </p>
          )}
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-amber-500"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-amber-100 pt-3">
              {/* Level selector */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Current Level
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {levels.map((lv) => {
                    const c = levelColorMap[lv.level];
                    const active = progress.currentLevel === lv.level;
                    return (
                      <button
                        key={lv.level}
                        type="button"
                        onClick={() => setLevel(lv.level)}
                        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? `bg-gradient-to-r ${c.gradient} text-white border-transparent shadow-md`
                            : `border-slate-200 bg-white text-slate-600 hover:border-slate-300`
                        }`}
                      >
                        {active && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                        {lv.label}
                      </button>
                    );
                  })}
                  {progress.currentLevel > 0 && (
                    <button
                      type="button"
                      onClick={() => setLevel(0)}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-50 transition"
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Objectives for current level */}
              {currentLevelData && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Objectives at this level
                  </p>
                  <ul className="space-y-2">
                    {stepsForCurrentLevel.map((step, idx) => {
                      const done = !!completedForLevel[idx];
                      return (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() => toggleStep(progress.currentLevel, idx)}
                            className={`w-full flex items-start gap-2.5 rounded-xl border p-2.5 text-left text-sm transition-all ${
                              done
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                            )}
                            <span className={done ? "line-through opacity-70" : ""}>
                              {step}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Gap / progress summary */}
                  {remainingCount > 0 && nextLevel ? (
                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-blue-500 shrink-0" />
                      <p className="text-xs font-semibold text-blue-700">
                        <span className="font-bold">{remainingCount} objective{remainingCount > 1 ? "s" : ""}</span> remaining before you're ready for{" "}
                        <span className="font-bold">{nextLevel.label} level</span>
                      </p>
                    </div>
                  ) : remainingCount === 0 && nextLevel ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <p className="text-xs font-bold text-emerald-700 flex flex-wrap items-center gap-1">
                        All objectives complete! Ready to step up to{" "}
                        <span className="flex items-center gap-1">{nextLevel.label} level <PartyPopper className="h-3.5 w-3.5 text-emerald-600 mb-0.5" /></span>
                      </p>
                    </div>
                  ) : remainingCount === 0 && !nextLevel ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-rose-500 shrink-0" />
                      <p className="text-xs font-bold text-rose-700 flex items-center gap-1">
                        Peak achieved — International level! <Trophy className="h-3.5 w-3.5 text-rose-600 mb-0.5" />
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Dynamic pathway level card ────────────────────────────────────────────────

function PathwayLevelCard({
  level,
  isActive,
  onClick,
  isCurrentLevel,
}: {
  level: any;
  isActive: boolean;
  onClick: () => void;
  isCurrentLevel?: boolean;
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
        <div className="flex items-center gap-1.5 shrink-0">
          {isCurrentLevel && (
            <span className="hidden sm:flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-700">
              <Pin className="h-2.5 w-2.5" /> HERE
            </span>
          )}
          <motion.div
            animate={{ rotate: isActive ? 180 : 0 }}
            transition={{ duration: 0.22 }}
            className={`lg:hidden ${colors.text}`}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Dynamic pathway detail ────────────────────────────────────────────────────

function PathwayLevelDetail({
  level,
  sportName,
  onSelectTab,
}: {
  level: any;
  sportName?: string;
  onSelectTab?: (tab: any) => void;
}) {
  const colors = levelColorMap[level.level] ?? levelColorMap[1];
  const commitment = (level as any).parentalCommitment ||
    pathwayLevels.find((l) => l.level === level.level)?.parentalCommitment || {
      time: "Varies",
      financial: "Varies",
      travel: "Varies",
      role: "Supportive Parent",
    };
  const sName = sportName && sportName !== "General" ? sportName : "";
  const lLabel = level.label || `Level ${level.level}`;
  const communityUrl = getCommunityAppUrl();

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
        {/* P9: each objective has an inline deep-link chip */}
        <ul className="space-y-2.5">
          {level.steps.map((step: string, i: number) => {
            const discUrl = sName ? buildDiscoveryUrl(step, sName, lLabel) : null;
            return (
              <li key={i} className="flex items-start gap-2.5 group">
                <CheckCircle
                  className={"mt-0.5 h-4 w-4 shrink-0 " + colors.text}
                />
                <span className="flex-1 min-w-0 text-sm leading-relaxed text-slate-700">
                  {step}
                </span>
                {discUrl && (
                  <Link
                    href={discUrl}
                    onClick={(e) => e.stopPropagation()}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Find nearby venues/coaches for this step"
                    className={`shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center gap-1 rounded-lg border ${colors.badge} px-2 py-0.5 text-[10px] font-bold whitespace-nowrap`}
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> Go
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Local Resources Section */}
      {level.localResources &&
        (level.localResources.academies?.length ||
          level.localResources.facilities?.length ||
          level.localResources.governingBodies?.length) ? (
        <div className="mb-6 rounded-xl bg-slate-50 border border-slate-100 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            Local Resources
          </h4>
          <div className="space-y-4">
            {level.localResources.academies && level.localResources.academies.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Academies
                </p>
                <div className="flex flex-wrap gap-2">
                  {level.localResources.academies.map((item: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      <Star className="h-3 w-3 text-amber-500" /> {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {level.localResources.facilities && level.localResources.facilities.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Facilities
                </p>
                <div className="flex flex-wrap gap-2">
                  {level.localResources.facilities.map((item: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      <Pin className="h-3 w-3 text-emerald-500" /> {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {level.localResources.governingBodies && level.localResources.governingBodies.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Governing Bodies
                </p>
                <div className="flex flex-wrap gap-2">
                  {level.localResources.governingBodies.map((item: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      <Shield className="h-3 w-3 text-blue-500" /> {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Stories teaser */}
      {sName && onSelectTab && (
        <div className="mt-4 mb-2 flex items-center justify-center">
          <button
            onClick={() => onSelectTab("stories")}
            className={`flex items-center gap-1.5 text-xs font-semibold ${colors.text} hover:opacity-85 transition`}
          >
            <MessageSquareQuote className="h-4 w-4" />
            <span>Success story at this level</span>
          </button>
        </div>
      )}

      {/* Actionable CTAs — P9: include sport + level params */}
      <div className="mt-2 flex flex-col sm:flex-row gap-3">
        <Link
          href={`${communityUrl}/discover?tab=COMMUNITIES${sName ? `&sport=${encodeURIComponent(sName)}&level=${encodeURIComponent(lLabel)}` : ""}`}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 bg-gradient-to-r ${colors.gradient}`}
        >
          <Users className="h-4 w-4" />
          Find Local Communities
        </Link>
        <Link
          href={`${communityUrl}/discover?tab=COACHES${sName ? `&sport=${encodeURIComponent(sName)}&level=${encodeURIComponent(lLabel)}` : ""}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
        >
          <Trophy className="h-4 w-4" />
          Find Coaches
        </Link>
      </div>
    </motion.div>
  );
}

// ─── P3: Compare Panel ────────────────────────────────────────────────────────

function ComparePanel({
  primaryPathway,
  allSports,
}: {
  primaryPathway: SportPathway;
  allSports: Sport[];
}) {
  const [compareList, setCompareList] = useState<SportPathway[]>([primaryPathway]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fuse, setFuse] = useState<Fuse<Sport> | null>(null);
  const [suggestions, setSuggestions] = useState<Sport[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (allSports.length > 0)
      setFuse(new Fuse(allSports, { keys: ["name"], threshold: 0.3 }));
  }, [allSports]);

  useEffect(() => {
    if (!fuse || searchQuery.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const res = fuse.search(searchQuery).map((r) => r.item);
    setSuggestions(res.slice(0, 5));
    setShowSuggestions(res.length > 0);
  }, [searchQuery, fuse]);

  const addSport = async (name: string) => {
    if (compareList.length >= 3) return;
    if (compareList.some((p) => p.sportSlug === name.toLowerCase().replace(/\s+/g, "-"))) return;
    setShowSuggestions(false);
    setSearchQuery("");
    const idx = compareList.length;
    setLoadingIdx(idx);
    try {
      const res = await pathwayApi.getPathway(name);
      if (res) setCompareList((prev) => [...prev, res.pathway]);
    } catch {}
    setLoadingIdx(null);
  };

  const removeSport = (idx: number) => {
    if (idx === 0) return; // keep primary
    setCompareList((prev) => prev.filter((_, i) => i !== idx));
  };

  // Extract cost midpoint from string like "₹2,000–₹5,000"
  const parseCost = (cost: string): number => {
    const nums = cost.replace(/[₹,]/g, "").match(/\d+/g);
    if (!nums) return 0;
    if (nums.length >= 2) return (Number(nums[0]) + Number(nums[nums.length - 1])) / 2;
    return Number(nums[0]);
  };

  const getEquipmentCost = (pathway: SportPathway): { total: number; label: string } => {
    if (!pathway.equipment?.length) return { total: 0, label: "N/A" };
    const total = pathway.equipment.reduce((sum, e) => sum + parseCost(e.estimatedCost), 0);
    return {
      total,
      label: total > 0 ? `₹${Math.round(total).toLocaleString("en-IN")}` : "Varies",
    };
  };

  const getScholarshipCount = (pathway: SportPathway) =>
    pathway.scholarships?.length || 0;

  const getCareerCount = (pathway: SportPathway) =>
    pathway.careers?.length || 0;

  const getTimeCommitment = (pathway: SportPathway): string => {
    const lvl = pathwayLevels.find((l) => l.level === 3);
    return lvl?.parentalCommitment.time || "Daily";
  };

  const colBg = ["bg-orange-50 border-orange-200", "bg-blue-50 border-blue-200", "bg-violet-50 border-violet-200"];
  const colAccent = ["text-power-orange", "text-blue-600", "text-violet-600"];

  return (
    <motion.div
      key="compare"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Add sport */}
      {compareList.length < 3 && (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <Plus className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions.length > 0) addSport(suggestions[0].name);
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={`Add sport ${compareList.length + 1} of 3 to compare…`}
              className="flex-1 bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 outline-none"
            />
            {loadingIdx !== null && (
              <Loader2 className="h-4 w-4 animate-spin text-power-orange shrink-0" />
            )}
          </div>
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 right-0 top-full z-20 mt-1.5 rounded-2xl border border-slate-100 bg-white shadow-xl overflow-hidden"
              >
                {suggestions.map((s) => (
                  <button
                    key={s.slug || s.name}
                    onClick={() => addSport(s.name)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-orange-50 transition"
                  >
                    <Database className="h-4 w-4 shrink-0 text-power-orange" />
                    {s.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Comparison grid */}
      <div className={`grid gap-4 ${compareList.length === 1 ? "grid-cols-1" : compareList.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {compareList.map((pathway, idx) => {
          const equipCost = getEquipmentCost(pathway);
          const scholarships = getScholarshipCount(pathway);
          const careers = getCareerCount(pathway);
          const fees = COACHING_FEE_TIERS;
          return (
            <div
              key={pathway.sportSlug || idx}
              className={`relative rounded-2xl border ${colBg[idx]} p-5 shadow-sm`}
            >
              {idx > 0 && (
                <button
                  onClick={() => removeSport(idx)}
                  className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 border border-slate-200 text-slate-400 hover:text-rose-500 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {idx === 0 && (
                <span className={`absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest ${colAccent[idx]} bg-white/80 border border-slate-200 rounded-full px-2 py-0.5`}>
                  Primary
                </span>
              )}

              <h3 className={`font-title text-lg font-bold mb-4 pr-16 break-words ${colAccent[idx]}`}>
                {pathway.sportName}
              </h3>

              <div className="space-y-3">
                {/* Equipment cost */}
                <div className="rounded-xl bg-white/70 border border-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" /> Equipment Cost
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {equipCost.label}
                    {equipCost.total > 0 && (
                      <span className="text-[10px] font-normal text-slate-400 ml-1">total across levels</span>
                    )}
                  </p>
                </div>

                {/* Coaching */}
                <div className="rounded-xl bg-white/70 border border-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Weekly Commitment
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {getTimeCommitment(pathway)}
                  </p>
                </div>

                {/* Scholarships */}
                <div className="rounded-xl bg-white/70 border border-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Scholarships
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-extrabold ${colAccent[idx]}`}>{scholarships}</span>
                    <span className="text-xs text-slate-500">available</span>
                  </div>
                </div>

                {/* Careers */}
                <div className="rounded-xl bg-white/70 border border-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> Career Paths
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-extrabold ${colAccent[idx]}`}>{careers}</span>
                    <span className="text-xs text-slate-500">options</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty slot */}
        {compareList.length < 3 && (
          <button
            onClick={() => inputRef.current?.focus()}
            className="rounded-2xl border-2 border-dashed border-slate-200 p-5 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-slate-300 hover:text-slate-500 transition min-h-[200px]"
          >
            <Plus className="h-6 w-6" />
            <span className="text-xs font-semibold">Add sport</span>
          </button>
        )}
      </div>

      {compareList.length > 1 && (
        <p className="text-center text-xs text-slate-400">
          Showing data for {compareList.map((p) => p.sportName).join(", ")}. Data sourced from pathway analysis.
        </p>
      )}
    </motion.div>
  );
}

// ─── P4: Budget Calculator ────────────────────────────────────────────────────

function BudgetCalculator({ pathway }: { pathway: SportPathway }) {
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3, 4, 5]);
  const [copied, setCopied] = useState(false);

  const toggleLevel = (lvl: number) => {
    setSelectedLevels((prev) =>
      prev.includes(lvl) ? prev.filter((l) => l !== lvl) : [...prev, lvl].sort()
    );
  };

  // Parse a cost string like "₹2,000 – ₹5,000" → midpoint
  const parseCostMid = (cost: string): number => {
    const nums = cost.replace(/[₹,\s]/g, "").match(/\d+/g);
    if (!nums || nums.length === 0) return 0;
    if (nums.length >= 2) return (Number(nums[0]) + Number(nums[nums.length - 1])) / 2;
    return Number(nums[0]);
  };

  const levelData = pathwayLevels.filter((l) => selectedLevels.includes(l.level));

  type RowData = {
    level: number;
    label: string;
    equipment: string;
    equipmentMid: number;
    coaching: string;
    coachingMid: number;
    travel: string;
    financial: string;
  };

  const rows: RowData[] = levelData.map((lv) => {
    const equip = pathway.equipment?.find((e) =>
      e.level.toLowerCase().includes(lv.label.toLowerCase())
    ) || pathway.equipment?.[lv.level - 1];
    const fees = COACHING_FEE_TIERS[lv.level];
    return {
      level: lv.level,
      label: lv.label,
      equipment: equip?.estimatedCost || "Varies",
      equipmentMid: equip ? parseCostMid(equip.estimatedCost) : 0,
      coaching: fees.label,
      coachingMid: (fees.low + fees.high) / 2,
      travel: lv.parentalCommitment.travel,
      financial: lv.parentalCommitment.financial,
    };
  });

  const totalEquip = rows.reduce((s, r) => s + r.equipmentMid, 0);
  // Coaching: annual midpoint per level (assume 10 months active)
  const totalCoaching = rows.reduce((s, r) => s + r.coachingMid * 10, 0);
  const grandTotal = totalEquip + totalCoaching;

  const fmt = (n: number) =>
    n > 0 ? `₹${Math.round(n).toLocaleString("en-IN")}` : "Varies";

  const handleExport = async () => {
    const lines: string[] = [
      `Cost-of-the-Journey Estimate — ${pathway.sportName}`,
      `Generated by PowerMySport on ${new Date().toLocaleDateString("en-IN")}`,
      "",
      "Level-by-Level Breakdown:",
      "─".repeat(50),
    ];
    rows.forEach((r) => {
      lines.push(`\n[Level ${r.level}] ${r.label}`);
      lines.push(`  Equipment : ${r.equipment}`);
      lines.push(`  Coaching  : ${r.coaching} (est. 10 active months)`);
      lines.push(`  Travel    : ${r.travel}`);
    });
    lines.push("");
    lines.push("─".repeat(50));
    lines.push(`Equipment Total  : ${fmt(totalEquip)}`);
    lines.push(`Coaching Total   : ${fmt(totalCoaching)} (10 months/level)`);
    lines.push(`GRAND ESTIMATE   : ${fmt(grandTotal)}`);
    lines.push("");
    lines.push("Note: All figures are indicative estimates. Actual costs vary by location, academy, and individual progression.");

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  const colColors = ["emerald", "blue", "violet", "orange", "rose"] as const;
  const colBgs: Record<number, string> = {
    1: "bg-emerald-50 border-emerald-100",
    2: "bg-blue-50 border-blue-100",
    3: "bg-violet-50 border-violet-100",
    4: "bg-orange-50 border-orange-100",
    5: "bg-rose-50 border-rose-100",
  };
  const colTexts: Record<number, string> = {
    1: "text-emerald-600",
    2: "text-blue-600",
    3: "text-violet-600",
    4: "text-orange-600",
    5: "text-rose-600",
  };

  return (
    <motion.div
      key="budget"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header & level toggles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-title font-bold text-slate-900 text-lg">
            {pathway.sportName} — Cost Journey
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Toggle levels to include / exclude from the estimate
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-500" /> Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Export
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {pathwayLevels.map((lv) => {
          const active = selectedLevels.includes(lv.level);
          const c = levelColorMap[lv.level];
          return (
            <button
              key={lv.level}
              onClick={() => toggleLevel(lv.level)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                active
                  ? `bg-gradient-to-r ${c.gradient} text-white border-transparent shadow`
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              {active ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {lv.label}
            </button>
          );
        })}
      </div>

      {/* Level cards */}
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.level}
            className={`rounded-2xl border ${colBgs[row.level]} p-4`}
          >
            <div className="flex flex-wrap items-start gap-3 mb-3">
              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${levelColorMap[row.level].badge}`}>
                {levelIconMap[row.level]}
                Level {row.level} · {row.label}
              </div>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {row.financial}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <ShoppingBag className="h-3 w-3" /> Equipment
                </p>
                <p className={`text-sm font-bold ${colTexts[row.level]}`}>
                  {row.equipment}
                </p>
                {row.equipmentMid > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5">≈ {fmt(row.equipmentMid)} mid-est.</p>
                )}
              </div>
              <div className="rounded-xl bg-white/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Coaching Fees
                </p>
                <p className={`text-sm font-bold ${colTexts[row.level]}`}>
                  {row.coaching}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">≈ {fmt(row.coachingMid * 10)} / 10 mo.</p>
              </div>
              <div className="rounded-xl bg-white/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <Map className="h-3 w-3" /> Travel
                </p>
                <p className="text-sm font-semibold text-slate-700">{row.travel}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Grand total */}
      <div className="rounded-2xl border-2 border-power-orange/30 bg-gradient-to-br from-orange-50 to-amber-50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-power-orange/10">
            <Calculator className="h-4 w-4 text-power-orange" />
          </div>
          <h4 className="font-title font-bold text-slate-900">
            Journey Total Estimate
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-white/80 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Equipment</p>
            <p className="text-lg font-extrabold text-slate-900">{fmt(totalEquip)}</p>
          </div>
          <div className="rounded-xl bg-white/80 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Coaching (10 mo/lvl)</p>
            <p className="text-lg font-extrabold text-slate-900">{fmt(totalCoaching)}</p>
          </div>
          <div className="rounded-xl bg-power-orange/10 border border-power-orange/20 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-power-orange mb-1">Grand Estimate</p>
            <p className="text-xl font-extrabold text-power-orange">{fmt(grandTotal)}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          ⚠️ These are indicative estimates only. Actual costs vary significantly by city, academy, coaching level, and individual progression speed. Use this as a planning guide, not a quote.
        </p>
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
  const [entitiesStatus, setEntitiesStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<
    | "pathway"
    | "tournaments"
    | "scholarships"
    | "universities"
    | "equipment"
    | "careers"
    | "compare"
    | "budget"
    | "saved"
    | "applications"
    | "calendar"
    | "stories"
  >("pathway");
  const [modalData, setModalData] = useState<{ item: any; type: "tournament" | "scholarship" | "university" } | null>(null);
  const [detailTournament, setDetailTournament] = useState<any | null>(null);

  // P1: progress tracker state
  const [progress, setProgress] = useState<ProgressState>(DEFAULT_PROGRESS);

  // P2: state/city selector
  const [selectedState, setSelectedState] = useState<string>("");
  const [stateOpen, setStateOpen] = useState(false);

  // P5-P8 states
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuthStore();
  const [dbStories, setDbStories] = useState<AthleteStory[]>([]);

  // Load from DB or fallback to localStorage
  useEffect(() => {
    const initProfile = async () => {
      setSelectedState(loadState());
      if (user) {
        const dbProfile = await pathwayProfileApi.getProfile();
        if (dbProfile) {
          setProgress(dbProfile.progress || DEFAULT_PROGRESS);
          setSavedItems(dbProfile.savedItems || []);
          setApplications(dbProfile.applications || []);
          return;
        }
      }
      setProgress(loadProgress());
      setSavedItems(loadSaved());
      setApplications(loadApplications());
    };
    initProfile();
  }, [user]);

  useEffect(() => {
    const fetchStories = async () => {
      if (result && activeTab === "stories") {
        const currentLevels = result.pathway.levels;
        const selectedLevel = currentLevels[activeIdx] || currentLevels[0];
        const fetchedStories = await pathwayProfileApi.getStories(result.pathway.sportSlug, selectedLevel.level);
        setDbStories(fetchedStories);
      }
    };
    fetchStories();
  }, [result, activeTab, activeIdx]);

  const handleSavedChange = (items: SavedItem[]) => {
    setSavedItems(items);
    saveSaved(items);
    if (user) pathwayProfileApi.updateProfile({ savedItems: items });
  };

  const handleApplicationsChange = (items: ApplicationRecord[]) => {
    setApplications(items);
    saveApplications(items);
    if (user) pathwayProfileApi.updateProfile({ applications: items });
  };

  const handleUpdateApplicationStatus = (id: string, status: ApplicationRecord["status"]) => {
    const updated = applications.map((app) =>
      app.id === id ? { ...app, status } : app
    );
    handleApplicationsChange(updated);
  };

  const handleProgressChange = (p: ProgressState) => {
    setProgress(p);
    saveProgress(p);
    if (user) pathwayProfileApi.updateProfile({ progress: p });
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
    setEntitiesStatus("idle");
    setActiveIdx(0);
    setActiveTab("pathway");

    const city = selectedState || undefined;

    try {
      const res = await pathwayApi.getPathway(name, undefined, city);
      if (!res) {
        setErrorMsg(`"${name}" doesn't appear to be a recognised sport. Please try a different name.`);
        setStatus("error");
        return;
      }

      setResult(res);
      setQuery(res.pathway.sportName);
      setStatus("success");

      // If entities (tournaments/scholarships/universities) weren't ready yet,
      // fetch them in the background and merge when done.
      if (!res.entitiesReady) {
        setEntitiesStatus("loading");
        pathwayApi.getEntities(res.pathway.sportName, city).then((entities) => {
          if (!entities) { setEntitiesStatus("ready"); return; }
          setResult((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              pathway: {
                ...prev.pathway,
                tournaments: entities.tournaments,
                scholarships: entities.scholarships,
                universities: entities.universities,
              },
            };
          });
          setEntitiesStatus("ready");
        }).catch(() => setEntitiesStatus("ready"));
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
                  {selectedState || "All India"}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform shrink-0 ${stateOpen ? "rotate-180" : ""}`} />
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
                      <button
                        onClick={() => handleStateChange("")}
                        className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold transition hover:bg-orange-50 ${!selectedState ? "text-power-orange" : "text-slate-700"}`}
                      >
                        <Globe className="h-4 w-4 shrink-0" />
                        All India
                      </button>
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
              <span className="text-xs text-slate-400">Results will include {selectedState}-specific data</span>
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
                development pathway{selectedState ? ` in ${selectedState}` : " in India"}.
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
                    {result.source === "generated" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-power-orange border border-orange-200">
                        <Sparkles className="h-3 w-3" /> AI Generated
                      </span>
                    )}
                    {selectedState && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 border border-blue-100">
                        <MapPin className="h-3 w-3" /> {selectedState}
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
              {(result || savedItems.length > 0 || applications.length > 0) && (
                <div className="mb-8 w-full overflow-x-auto hide-scrollbar">
                  <div className="inline-flex min-w-max gap-1.5 rounded-2xl bg-slate-100/70 p-1.5 backdrop-blur-md border border-slate-200/60 shadow-inner">
                  {[
                    {
                      id: "pathway",
                      label: "Pathway",
                      icon: <Flag className="h-4 w-4" />,
                      show: true,
                    },
                    {
                      id: "tournaments",
                      label: "Tournaments",
                      icon: <Trophy className="h-4 w-4" />,
                      show: !!result,
                    },
                    {
                      id: "scholarships",
                      label: "Scholarships",
                      icon: <Wallet className="h-4 w-4" />,
                      show: !!result,
                    },
                    {
                      id: "universities",
                      label: "Universities",
                      icon: <Landmark className="h-4 w-4" />,
                      show: !!result,
                    },
                    {
                      id: "equipment",
                      label: "Equipment",
                      icon: <ShoppingBag className="h-4 w-4" />,
                      show: !!result,
                    },
                    {
                      id: "careers",
                      label: "Careers",
                      icon: <Briefcase className="h-4 w-4" />,
                      show: !!result,
                    },
                    {
                      id: "compare",
                      label: "Compare",
                      icon: <GitCompare className="h-4 w-4" />,
                      show: !!result,
                    },
                    {
                      id: "budget",
                      label: "Budget",
                      icon: <Calculator className="h-4 w-4" />,
                      show: !!result,
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
                    {
                      id: "stories",
                      label: "Stories",
                      icon: <MessageSquareQuote className="h-4 w-4" />,
                      show: !!result,
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
                          <span className={`transition-colors ${activeTab === tab.id ? "text-power-orange" : ""}`}>
                            {tab.icon}
                          </span>
                          <span className="whitespace-nowrap">{tab.label}</span>
                          {tab.badge !== undefined && tab.badge > 0 && (
                            <span className={`ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold transition-colors ${
                              activeTab === tab.id
                                ? "bg-power-orange text-white shadow-sm"
                                : "bg-slate-200 text-slate-500"
                            }`}>
                              {tab.badge}
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
                {activeTab === "pathway" && (
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
                      {/* P1: Progress Tracker */}
                      <ProgressTracker
                        progress={progress}
                        onChange={handleProgressChange}
                        levels={pathwayLevels}
                      />

                      {/* Visual Pyramid Indicator for Desktop */}
                      <motion.div
                        variants={scaleIn}
                        className="mb-6 hidden lg:block"
                      >
                        <svg
                          viewBox="0 0 300 170"
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
                              level: 1,
                            },
                            {
                              y: 104,
                              width: 224,
                              fill: "rgba(59,130,246,0.12)",
                              stroke: "rgba(59,130,246,0.4)",
                              label: "District",
                              level: 2,
                            },
                            {
                              y: 78,
                              width: 168,
                              fill: "rgba(139,92,246,0.12)",
                              stroke: "rgba(139,92,246,0.4)",
                              label: "State",
                              level: 3,
                            },
                            {
                              y: 52,
                              width: 112,
                              fill: "rgba(249,115,22,0.12)",
                              stroke: "rgba(249,115,22,0.4)",
                              label: "National",
                              level: 4,
                            },
                            {
                              y: 26,
                              width: 56,
                              fill: "rgba(244,63,94,0.12)",
                              stroke: "rgba(244,63,94,0.4)",
                              label: "International",
                              level: 5,
                            },
                          ].map((tier, i) => {
                            const isCurrentLevel = progress.currentLevel === tier.level;
                            return (
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
                                      : isCurrentLevel
                                      ? tier.fill.replace("0.12", "0.25")
                                      : tier.fill
                                  }
                                  stroke={isCurrentLevel ? tier.stroke.replace("0.4", "0.9") : tier.stroke}
                                  strokeWidth={isCurrentLevel ? 2 : i === activeIdx ? 1.5 : 1}
                                  style={{ transition: "fill 0.3s, stroke 0.3s" }}
                                />
                                <text
                                  x="150"
                                  y={130 - i * 26 - 8}
                                  textAnchor="middle"
                                  fontSize="8"
                                  fontWeight={i === activeIdx || isCurrentLevel ? "700" : "500"}
                                  fill={i === activeIdx ? "#0f172a" : isCurrentLevel ? "#0f172a" : "#94a3b8"}
                                  style={{ transition: "fill 0.3s" }}
                                >
                                  {tier.label}
                                </text>
                                {/* "You Are Here" animated dot */}
                                {isCurrentLevel && (
                                  <>
                                    <circle
                                      cx={(300 - tier.width) / 2 - 10}
                                      cy={130 - i * 26 - 11}
                                      r={4}
                                      fill={tier.stroke.replace("0.4", "1")}
                                      style={{ filter: "drop-shadow(0 0 3px rgba(0,0,0,0.3))" }}
                                    >
                                      <animate
                                        attributeName="r"
                                        values="3;5;3"
                                        dur="1.5s"
                                        repeatCount="indefinite"
                                      />
                                      <animate
                                        attributeName="opacity"
                                        values="1;0.6;1"
                                        dur="1.5s"
                                        repeatCount="indefinite"
                                      />
                                    </circle>
                                  </>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      </motion.div>

                      {currentLevels.map((lv, i) => (
                        <div key={lv.level} className="flex flex-col gap-3">
                          <PathwayLevelCard
                            level={lv}
                            isActive={i === activeIdx}
                            isCurrentLevel={progress.currentLevel === lv.level}
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
                    className="space-y-0"
                  >
                    {/* Entities loading banner */}
                    {entitiesStatus === "loading" && (
                      <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 mb-4">
                        <div className="h-4 w-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin shrink-0" />
                        <p className="text-sm font-medium text-violet-700">
                          Fetching live tournament data — this takes a moment the first time for a new sport.
                        </p>
                      </div>
                    )}
                    {/* Recommendation Panel */}
                    {result.pathway.tournaments?.length > 0 && (
                      <TournamentRecommendationPanel
                        tournaments={result.pathway.tournaments}
                        currentLevel={progress.currentLevel}
                        sportName={result.pathway.sportName}
                        onViewTournament={(t) => setDetailTournament(t)}
                      />
                    )}

                    {/* Tournament Grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {result.pathway.tournaments?.length > 0 ? (
                        result.pathway.tournaments.map((t: any, i: number) => (
                          <div
                            key={i}
                            onClick={() => setDetailTournament(t)}
                            className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-power-orange hover:ring-1 hover:ring-power-orange group cursor-pointer relative"
                          >
                            <div>
                              <div className="mb-3 flex items-start justify-between gap-2">
                                <h3 className="font-title font-bold text-slate-800 break-words group-hover:text-power-orange transition-colors pr-8">
                                  {t.name}
                                </h3>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-power-orange">
                                    {t.level}
                                  </span>
                                  <SaveButton
                                    item={t}
                                    type="tournament"
                                    sport={result.pathway.sportName}
                                    savedItems={savedItems}
                                    onToggle={handleSavedChange}
                                  />
                                </div>
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
                    </div>
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
                    {entitiesStatus === "loading" && (
                      <div className="col-span-full flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                        <div className="h-4 w-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin shrink-0" />
                        <p className="text-sm font-medium text-violet-700">Fetching live scholarship data...</p>
                      </div>
                    )}
                    {result.pathway.scholarships?.length > 0 ? (
                      result.pathway.scholarships.map((s: any, i: number) => (
                        <div
                          key={i}
                          onClick={() => setModalData({ item: s, type: "scholarship" })}
                          className="flex flex-col rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/60 to-slate-50/60 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-emerald-200 group cursor-pointer relative"
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-inner">
                                <Wallet className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-title font-bold text-slate-800 text-lg leading-tight break-words pr-8">
                                  {s.name}
                                </h3>
                                <p className="text-xs font-semibold text-emerald-600 mt-1">
                                  {s.provider}
                                </p>
                              </div>
                            </div>
                            <SaveButton
                              item={s}
                              type="scholarship"
                              sport={result.pathway.sportName}
                              savedItems={savedItems}
                              onToggle={handleSavedChange}
                            />
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
                    {entitiesStatus === "loading" && (
                      <div className="col-span-full flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                        <div className="h-4 w-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin shrink-0" />
                        <p className="text-sm font-medium text-violet-700">Fetching live university data...</p>
                      </div>
                    )}
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
                          className="flex flex-col rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/60 to-slate-50/60 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-blue-200 group relative"
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-inner">
                                <Briefcase className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-title font-bold text-slate-800 text-lg leading-tight break-words pr-8">
                                  {c.role}
                                </h3>
                              </div>
                            </div>
                            <SaveButton
                              item={c}
                              type="career"
                              sport={result.pathway.sportName}
                              savedItems={savedItems}
                              onToggle={handleSavedChange}
                            />
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

                {/* P3: Compare Tab */}
                {result && activeTab === "compare" && (
                  <ComparePanel
                    primaryPathway={result.pathway}
                    allSports={allSports}
                  />
                )}

                {/* P4: Budget Tab */}
                {result && activeTab === "budget" && (
                  <BudgetCalculator pathway={result.pathway} />
                )}

                {/* P5: Saved Tab */}
                {activeTab === "saved" && (
                  <SavedTab
                    savedItems={savedItems}
                    onUnsave={(id) => handleSavedChange(savedItems.filter((s) => s.id !== id))}
                    onOpenModal={(item, type) => setModalData({ item, type })}
                  />
                )}

                {/* P6: Applications Tab */}
                {activeTab === "applications" && (
                  <ApplicationsTab
                    applications={applications}
                    onUpdateStatus={handleUpdateApplicationStatus}
                  />
                )}

                {/* P7: Stories Tab */}
                {result && activeTab === "stories" && (
                  <StoriesTab
                    sportName={result.pathway.sportName}
                    levels={currentLevels}
                    stories={dbStories}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tournament modal — detail view + concierge flow in one panel */}
        {detailTournament && (
          <TournamentModal
            isOpen={!!detailTournament}
            tournament={detailTournament}
            onClose={() => setDetailTournament(null)}
            currentLevel={progress.currentLevel}
            sportName={result?.pathway.sportName || ""}
            type="tournament"
            isSaved={savedItems.some(s => s.id === `tournament:${detailTournament?.name || ""}:${result?.pathway.sportName || ""}`)}
            onToggleSave={() => {
              if (!detailTournament || !result) return;
              const id = `tournament:${detailTournament.name}:${result.pathway.sportName}`;
              const isSaved = savedItems.some(s => s.id === id);
              const updated = isSaved
                ? savedItems.filter(s => s.id !== id)
                : [...savedItems, { id, type: "tournament" as const, name: detailTournament.name, sport: result.pathway.sportName, data: detailTournament, savedAt: new Date().toISOString() }];
              handleSavedChange(updated);
            }}
            onSubmitSuccess={(record) => {
              handleApplicationsChange([...applications, record]);
            }}
          />
        )}

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
