"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { getCommunityAppUrl } from "@/lib/community/url";
import { pathwayApi, SportPathway, PathwayLevel } from "@/modules/sports/services/pathway";
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
  },
];

// ─── Sports Data ──────────────────────────────────────────────────────────────

const sports = [
  {
    id: "cricket",
    name: "Cricket",
    icon: <Swords className="h-5 w-5" />,
    color: "bg-amber-500",
    gradient: "from-amber-500 to-orange-500",
    description: "India's most popular sport with a highly structured pathway from grassroots clubs to the Indian Premier League and national team.",
    highlights: [
      "BCCI-affiliated district & state boards",
      "Under-14 / U-16 / U-19 / U-23 & Senior pathways",
      "Ranji Trophy → IPL → India team",
      "NCA training programmes in Bengaluru",
    ],
    tag: "Most Popular",
  },
  {
    id: "badminton",
    name: "Badminton",
    icon: <Zap className="h-5 w-5" />,
    color: "bg-indigo-500",
    gradient: "from-indigo-500 to-blue-500",
    description: "India's fastest-growing Olympic sport with a world-class pathway supported by the Badminton Association of India and Pullela Gopichand Academy.",
    highlights: [
      "BAI sub-junior → senior ranking tournaments",
      "Gopichand Academy & Prakash Padukone Academy",
      "BWF ranking system for global competition",
      "Olympic & Commonwealth Games pathway",
    ],
    tag: "Olympic Sport",
  },
  {
    id: "football",
    name: "Football",
    icon: <Target className="h-5 w-5" />,
    color: "bg-emerald-600",
    gradient: "from-emerald-500 to-teal-600",
    description: "AIFF's 'Mission 11 Million' and I-League's developmental pyramid give aspiring footballers a clear route from academies to the national team.",
    highlights: [
      "AIFF Baby League → Subroto Cup → I-League",
      "ISL Hero Young Player programme",
      "NFC (National Football Camp) selections",
      "AFC Asian Cup qualification pathway",
    ],
    tag: "Team Sport",
  },
  {
    id: "athletics",
    name: "Athletics",
    icon: <Flame className="h-5 w-5" />,
    color: "bg-red-500",
    gradient: "from-red-500 to-rose-600",
    description: "AFI's standardised qualification marks and SAI's Target Olympic Podium Scheme (TOPS) support track & field athletes aiming for global glory.",
    highlights: [
      "AFI qualification standards (100m, 200m, etc.)",
      "National Inter-State Championships",
      "TOPS scheme for medal-hopefuls",
      "World Athletics ranking & Road to Paris",
    ],
    tag: "Individual Sport",
  },
  {
    id: "swimming",
    name: "Swimming",
    icon: <Waves className="h-5 w-5" />,
    color: "bg-cyan-500",
    gradient: "from-cyan-500 to-blue-400",
    description: "The Swimming Federation of India manages a structured pathway from aquatic club training to national records and Olympic qualification marks.",
    highlights: [
      "SFI age-group ranking system",
      "National Aquatic Championships",
      "FINA / World Aquatics qualifying marks",
      "Paralympic swimming pathway via PCI",
    ],
    tag: "Olympic Sport",
  },
  {
    id: "cycling",
    name: "Cycling",
    icon: <Bike className="h-5 w-5" />,
    color: "bg-yellow-500",
    gradient: "from-yellow-400 to-amber-500",
    description: "Cycling Federation of India develops road, track, and mountain-bike athletes through progressive state-to-national competitions and UCI races.",
    highlights: [
      "CFI state federation ranking events",
      "National Cycling Championship (Road & Track)",
      "Tour de India & UCI Asia Tour qualifying",
      "Asian Cycling Championship pathway",
    ],
    tag: "Olympic Sport",
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

// ─── Pathway Level Card ───────────────────────────────────────────────────────

function LevelCard({
  level,
  isActive,
  onClick,
}: {
  level: (typeof pathwayLevels)[0];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      variants={cardReveal}
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={SPRING_STIFF}
      className={`group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 will-change-transform ${
        isActive
          ? `bg-gradient-to-br ${level.bgLight} ${level.border} shadow-lg`
          : "border-white/70 bg-white/80 backdrop-blur-sm hover:border-white/90 hover:bg-white/90 premium-shadow"
      }`}
    >
      {/* Active glow */}
      {isActive && (
        <div
          aria-hidden
          className={`absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl ${level.glowColor}`}
        />
      )}

      <div className="relative flex items-center gap-4">
        {/* Level number badge */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${level.color} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
        >
          {level.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-widest ${level.accent}`}
            >
              Level {level.level}
            </span>
          </div>
          <p className="font-bold text-slate-900 truncate">{level.label}</p>
          <p className="text-xs text-slate-500 truncate">{level.keyFocus}</p>
        </div>

        <motion.div
          animate={{ rotate: isActive ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className={`shrink-0 ${level.accent}`}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </div>
    </motion.button>
  );
}

// ─── Level Detail Panel ───────────────────────────────────────────────────────

function LevelDetail({ level }: { level: (typeof pathwayLevels)[0] }) {
  return (
    <motion.div
      key={level.id}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={SPRING_STIFF}
      className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${level.bgLight} ${level.border} p-8 shadow-xl`}
    >
      {/* Decorative glow */}
      <div
        aria-hidden
        className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${level.glowColor}`}
      />
      <div
        aria-hidden
        className={`absolute -bottom-8 -left-8 h-32 w-32 rounded-full blur-2xl ${level.glowColor}`}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start gap-5 mb-6">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${level.color} text-white shadow-lg`}
          >
            {level.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-widest ${level.badge}`}
              >
                Level {level.level}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${level.badge}`}
              >
                {level.ageRange}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {level.title}
            </h3>
          </div>
        </div>

        <p className="mb-8 text-base leading-relaxed text-slate-600">
          {level.description}
        </p>

        {/* Two-column info */}
        <div className="grid gap-6 sm:grid-cols-2 mb-6">
          {/* Steps */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              <TrendingUp className="h-4 w-4" />
              Key Steps
            </h4>
            <ul className="space-y-2">
              {level.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${level.accent}`}
                  />
                  <span className="text-sm leading-relaxed text-slate-700">
                    {step}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Meta info */}
          <div className="space-y-4">
            <div className={`rounded-xl border bg-white/60 p-4 ${level.border} backdrop-blur-sm`}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                Key Focus
              </p>
              <p className={`font-semibold ${level.accent}`}>
                {level.keyFocus}
              </p>
            </div>
            <div className={`rounded-xl border bg-white/60 p-4 ${level.border} backdrop-blur-sm`}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                Typical Age Range
              </p>
              <p className="font-semibold text-slate-800">{level.ageRange}</p>
            </div>
            <div className={`rounded-xl border bg-white/60 p-4 ${level.border} backdrop-blur-sm`}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                Competitions
              </p>
              <p className="text-sm text-slate-700">{level.competitions}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/register?role=PLAYER"
          className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${level.color} px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
        >
          Start Your Journey
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Sport Card ───────────────────────────────────────────────────────────────

function SportCard({ sport }: { sport: (typeof sports)[0] }) {
  return (
    <motion.div
      variants={cardReveal}
      whileHover={{ y: -6, scale: 1.015 }}
      transition={SPRING_STIFF}
      className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-6 backdrop-blur-sm premium-shadow will-change-transform hover:border-white/90 hover:bg-white/90"
    >
      {/* Hover glow */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 90% 10%, ${sport.color.replace("bg-", "")}15 0%, transparent 70%)`,
        }}
      />

      {/* Top row */}
      <div className="relative mb-4 flex items-start justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${sport.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
        >
          {sport.icon}
        </div>
        <span
          className={`rounded-full ${sport.color} px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm`}
        >
          {sport.tag}
        </span>
      </div>

      <h3 className="relative mb-2 text-lg font-bold text-slate-900">
        {sport.name}
      </h3>
      <p className="relative mb-5 text-sm leading-relaxed text-slate-600">
        {sport.description}
      </p>

      {/* Highlights */}
      <ul className="relative space-y-1.5">
        {sport.highlights.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" />
            <span className="text-xs leading-relaxed text-slate-600">{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
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

const levelColorMap: Record<number, { gradient: string; bg: string; border: string; text: string; badge: string }> = {
  1: { gradient: "from-emerald-500 to-teal-500", bg: "from-emerald-50 to-teal-50", border: "border-emerald-200", text: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  2: { gradient: "from-blue-500 to-indigo-500", bg: "from-blue-50 to-indigo-50", border: "border-blue-200", text: "text-blue-600", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  3: { gradient: "from-violet-500 to-purple-600", bg: "from-violet-50 to-purple-50", border: "border-violet-200", text: "text-violet-600", badge: "bg-violet-100 text-violet-700 border-violet-200" },
  4: { gradient: "from-orange-500 to-amber-500", bg: "from-orange-50 to-amber-50", border: "border-orange-200", text: "text-orange-600", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  5: { gradient: "from-rose-500 to-pink-600", bg: "from-rose-50 to-pink-50", border: "border-rose-200", text: "text-rose-600", badge: "bg-rose-100 text-rose-700 border-rose-200" },
};

// ─── Dynamic pathway level card ────────────────────────────────────────────────

function DynamicLevelCard({
  level,
  isActive,
  onClick,
}: {
  level: PathwayLevel;
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
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}>
          {levelIconMap[level.level]}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}>Level {level.level}</p>
          <p className="font-bold text-slate-900 truncate text-sm">{level.label}</p>
          <p className="text-xs text-slate-500 truncate">{level.keyFocus}</p>
        </div>
        <motion.div animate={{ rotate: isActive ? 180 : 0 }} transition={{ duration: 0.22 }} className={`shrink-0 ${colors.text}`}>
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </div>
    </motion.button>
  );
}

// ─── Dynamic pathway detail ────────────────────────────────────────────────────

function DynamicLevelDetail({ level }: { level: PathwayLevel }) {
  const colors = levelColorMap[level.level] ?? levelColorMap[1];
  return (
    <motion.div
      key={level.level}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={SPRING_STIFF}
      className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${colors.bg} ${colors.border} p-8 shadow-xl`}
    >
      <div className="flex items-start gap-5 mb-6">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colors.gradient} text-white shadow-lg`}>
          {levelIconMap[level.level]}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-widest ${colors.badge}`}>Level {level.level}</span>
            <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${colors.badge}`}>{level.ageRange}</span>
            {level.governingBody && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">{level.governingBody}</span>
            )}
          </div>
          <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">{level.title}</h3>
        </div>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-slate-600">{level.description}</p>
      <div className="grid gap-5 sm:grid-cols-2 mb-6">
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><TrendingUp className="h-3.5 w-3.5" />Key Steps</h4>
          <ul className="space-y-2">
            {level.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle className={`mt-0.5 h-4 w-4 shrink-0 ${colors.text}`} />
                <span className="text-sm leading-relaxed text-slate-700">{step}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div className={`rounded-xl border bg-white/60 p-4 ${colors.border}`}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Key Focus</p>
            <p className={`font-semibold text-sm ${colors.text}`}>{level.keyFocus}</p>
          </div>
          <div className={`rounded-xl border bg-white/60 p-4 ${colors.border}`}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Age Range</p>
            <p className="font-semibold text-sm text-slate-800">{level.ageRange}</p>
          </div>
          <div className={`rounded-xl border bg-white/60 p-4 ${colors.border}`}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Competitions</p>
            <p className="text-xs text-slate-700 leading-relaxed">{level.competitions}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sport search section ──────────────────────────────────────────────────────

function SportSearchSection() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<import("@/modules/sports/services/pathway").SportPathway[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{ pathway: SportPathway; source: "db" | "generated" } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocomplete
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); return; }
    const data = await pathwayApi.searchPathways(q);
    setSuggestions(data);
    setShowSuggestions(data.length > 0);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  const handleSearch = async (sportName: string) => {
    const name = sportName.trim();
    if (!name || name.length < 2) return;
    setShowSuggestions(false);
    setQuery(name);
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    setActiveIdx(0);
    try {
      const res = await pathwayApi.getPathway(name);
      if (res) {
        setResult(res);
        setStatus("success");
      } else {
        setErrorMsg(`"${name}" doesn't appear to be a recognised sport. Please try a different name.`);
        setStatus("error");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const selectedLevel = result?.pathway.levels[activeIdx];

  return (
    <section className="relative overflow-hidden py-14 sm:py-20">
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
            <SectionLabel label="AI-Powered Pathway Finder" color="orange" />
          </motion.div>
          <motion.h2 variants={fadeUp} className="font-title mx-auto max-w-2xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
            Search Any Sport.
            <span className="relative ml-2 inline-block">
              Instantly.
              <span aria-hidden className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-200" />
            </span>
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-lg text-lg text-slate-600">
            Type any sport — from Cricket to Kabaddi. If we have the pathway, we'll show it instantly. If not, our AI generates one on the spot.
          </motion.p>
        </motion.div>

        {/* Search bar */}
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="mx-auto max-w-2xl relative">
          <div className="relative flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-2 pr-3 shadow-xl backdrop-blur-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-power-orange text-white">
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
              onChange={(e) => { setQuery(e.target.value); setStatus("idle"); }}
              onKeyDown={(e) => { if (e.key === "Enter") { handleSearch(query); } if (e.key === "Escape") setShowSuggestions(false); }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="e.g. Cricket, Badminton, Kabaddi, Archery…"
              className="flex-1 bg-transparent text-base font-medium text-slate-900 placeholder-slate-400 outline-none"
              aria-label="Search sport pathway"
            />
            {query && (
              <button onClick={clearSearch} className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
            <button
              onClick={() => handleSearch(query)}
              disabled={status === "loading" || !query.trim()}
              className="shrink-0 rounded-xl bg-power-orange px-5 py-2.5 text-sm font-bold text-white shadow transition-all hover:bg-orange-600 disabled:opacity-50"
            >
              Search
            </button>
          </div>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showSuggestions && (
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
                      key={s.sportSlug}
                      onClick={() => handleSearch(s.sportName)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-orange-50"
                    >
                      <Database className="h-4 w-4 shrink-0 text-power-orange" />
                      <span className="text-sm font-medium text-slate-800">{s.sportName}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Popular quick-picks */}
        {status === "idle" && !result && (
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-5 flex flex-wrap justify-center gap-2">
            {["Cricket", "Badminton", "Football", "Kabaddi", "Wrestling", "Archery", "Table Tennis", "Boxing"].map((s) => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-orange-200 hover:bg-orange-50 hover:text-power-orange"
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
              className="mx-auto mt-12 max-w-lg rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-10 text-center shadow-lg"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-power-orange text-white shadow-lg">
                <Sparkles className="h-8 w-8 animate-pulse" />
              </div>
              <p className="text-lg font-bold text-slate-900">Generating Pathway…</p>
              <p className="mt-2 text-sm text-slate-500">
                Our AI is researching the <span className="font-semibold text-power-orange">{query}</span> development pathway in India.
              </p>
              <div className="mt-6 flex items-center justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 rounded-full bg-power-orange" style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
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
              className="mx-auto mt-12 max-w-lg rounded-3xl border border-red-100 bg-red-50 p-8 text-center shadow"
            >
              <p className="text-lg font-bold text-red-700">Not Found</p>
              <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
              <button onClick={clearSearch} className="mt-5 rounded-xl bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                Try Another Sport
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Result ── */}
        <AnimatePresence>
          {status === "success" && result && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING_STIFF}
              className="mt-12"
            >
              {/* Result header */}
              <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {result.source === "generated" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-power-orange border border-orange-200">
                        <Sparkles className="h-3 w-3" /> AI Generated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                        <Database className="h-3 w-3" /> From Database
                      </span>
                    )}
                    {result.pathway.category && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                        {result.pathway.category}
                      </span>
                    )}
                  </div>
                  <h2 className="font-title text-3xl font-bold text-slate-900 sm:text-4xl">
                    {result.pathway.sportName} Pathway
                  </h2>
                  {result.pathway.overview && (
                    <p className="mt-2 max-w-2xl text-slate-600">{result.pathway.overview}</p>
                  )}
                </div>
              </div>

              {/* Level grid */}
              <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                {/* Left: level pills */}
                <div className="space-y-2.5">
                  {result.pathway.levels.map((lv, i) => (
                    <DynamicLevelCard
                      key={lv.level}
                      level={lv}
                      isActive={i === activeIdx}
                      onClick={() => setActiveIdx(i)}
                    />
                  ))}
                </div>
                {/* Right: detail */}
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <AnimatePresence mode="wait">
                    {selectedLevel && (
                      <DynamicLevelDetail key={selectedLevel.level} level={selectedLevel} />
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
      `}</style>
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
        title="Sport Pathways in India"
        subtitle="Your Athletic Journey"
        description="From your first kick in the neighbourhood park to standing on the Olympic podium — understand every level of India's sports development pyramid and chart your own path to glory."
      />

      {/* ── AI Search Section ── */}
      <SportSearchSection />

      {/* ── Stats Banner ── */}
      <section className="relative py-12 sm:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-64 w-full -translate-x-1/2 bg-gradient-to-b from-orange-50/40 to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            {statCards.map((stat) => (
              <motion.div
                key={stat.label}
                variants={cardReveal}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={SPRING_STIFF}
                className="group flex flex-col items-center rounded-2xl border border-white/70 bg-white/80 p-6 text-center backdrop-blur-sm premium-shadow will-change-transform"
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

      {/* ── Pathway Levels ── */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-28">
        <AmbientBlob className="h-96 w-96 bg-orange-100/40 -left-48 top-24" />
        <AmbientBlob className="h-80 w-80 bg-violet-100/30 -right-40 top-1/3" />
        <AmbientBlob className="h-72 w-72 bg-blue-100/30 -left-32 bottom-1/4" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14 text-center"
          >
            <motion.div variants={fadeUp} className="mb-4 flex justify-center">
              <SectionLabel label="The Development Pyramid" color="orange" />
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="font-title mx-auto max-w-2xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Five Levels.{" "}
              <span className="relative inline-block">
                One Dream.
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-200"
                />
              </span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-4 max-w-xl text-lg text-slate-600"
            >
              India's sports ecosystem is structured across five tiers — each
              with its own competitions, coaching systems, and selection
              processes. Select a level to explore in detail.
            </motion.p>
          </motion.div>

          {/* Pyramid visual + interactive levels */}
          <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
            {/* Left: Level selector */}
            <motion.div
              variants={orchestrator}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="space-y-3"
            >
              {/* Pyramid SVG indicator */}
              <motion.div
                variants={scaleIn}
                className="mb-6 hidden lg:block"
              >
                <svg
                  viewBox="0 0 300 160"
                  className="w-full"
                  aria-hidden
                >
                  {/* Pyramid tiers */}
                  {[
                    { y: 130, width: 280, fill: "rgba(16,185,129,0.12)", stroke: "rgba(16,185,129,0.4)" },
                    { y: 104, width: 224, fill: "rgba(59,130,246,0.12)", stroke: "rgba(59,130,246,0.4)" },
                    { y: 78,  width: 168, fill: "rgba(139,92,246,0.12)", stroke: "rgba(139,92,246,0.4)" },
                    { y: 52,  width: 112, fill: "rgba(249,115,22,0.12)", stroke: "rgba(249,115,22,0.4)" },
                    { y: 26,  width: 56,  fill: "rgba(244,63,94,0.12)",  stroke: "rgba(244,63,94,0.4)"  },
                  ].map((tier, i) => (
                    <rect
                      key={i}
                      x={(300 - tier.width) / 2}
                      y={tier.y - 22}
                      width={tier.width}
                      height={22}
                      rx={4}
                      fill={i === activeLevel ? tier.fill.replace("0.12", "0.3") : tier.fill}
                      stroke={tier.stroke}
                      strokeWidth={i === activeLevel ? 1.5 : 1}
                      style={{ transition: "fill 0.3s" }}
                    />
                  ))}
                  {/* Labels */}
                  {["Grassroots", "District", "State", "National", "International"].map((label, i) => (
                    <text
                      key={i}
                      x="150"
                      y={130 - i * 26 - 8}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight={i === activeLevel ? "700" : "500"}
                      fill={i === activeLevel ? "#0f172a" : "#94a3b8"}
                      style={{ transition: "fill 0.3s" }}
                    >
                      {label}
                    </text>
                  ))}
                </svg>
              </motion.div>

              {pathwayLevels.map((level, i) => (
                <LevelCard
                  key={level.id}
                  level={level}
                  isActive={i === activeLevel}
                  onClick={() => setActiveLevel(i)}
                />
              ))}
            </motion.div>

            {/* Right: Detail panel */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <AnimatePresence mode="wait">
                <LevelDetail key={selected.id} level={selected} />
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sports Pathways ── */}
      <section className="relative overflow-hidden bg-slate-50 py-16 sm:py-20 lg:py-28">
        {/* Dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #0f172a 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <AmbientBlob className="h-96 w-96 bg-orange-100/50 -right-32 top-20" />
        <AmbientBlob className="h-72 w-72 bg-sky-100/40 -left-24 bottom-16" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14 text-center"
          >
            <motion.div variants={fadeUp} className="mb-4 flex justify-center">
              <SectionLabel label="Sport-Specific Pathways" color="blue" />
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="font-title mx-auto max-w-2xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Choose Your Sport.{" "}
              <span className="relative inline-block">
                Own Your Path.
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-300"
                />
              </span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-4 max-w-xl text-lg text-slate-600"
            >
              Each sport has its own governing body, ranking system, and
              competitive structure. Explore the pathway for your discipline
              below.
            </motion.p>
          </motion.div>

          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {sports.map((sport) => (
              <SportCard key={sport.id} sport={sport} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How PowerMySport Helps ── */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-28">
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
              <SectionLabel label="Your Partner at Every Level" color="green" />
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="font-title mx-auto max-w-2xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              PowerMySport Accelerates Your Pathway
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-4 max-w-xl text-lg text-slate-600"
            >
              No matter which level you are at today, we give you the tools,
              coaches, and venues to reach the next one faster.
            </motion.p>
          </motion.div>

          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-6 md:grid-cols-3"
          >
            {[
              {
                icon: <Dumbbell className="h-7 w-7" />,
                title: "Elite Coaching Network",
                description:
                  "Connect with verified coaches who have competed at district, state, and national levels. Learn from those who have walked the same path.",
                color: "bg-orange-100 text-power-orange",
                accent: "text-power-orange",
              },
              {
                icon: <MapPin className="h-7 w-7" />,
                title: "Premium Training Venues",
                description:
                  "Book accredited training venues used by state and national athletes. Get access to the same facilities the pros use, on demand.",
                color: "bg-indigo-100 text-indigo-600",
                accent: "text-indigo-600",
              },
              {
                icon: <Award className="h-7 w-7" />,
                title: "AI Sports Roadmap",
                description:
                  "Our AI generates a personalised roadmap based on your child's age, sport preference, and current level — showing clear next steps up the pyramid.",
                color: "bg-emerald-100 text-emerald-600",
                accent: "text-emerald-600",
              },
            ].map((item) => (
              <motion.div
                key={item.title}
                variants={cardReveal}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={SPRING_STIFF}
                className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-8 backdrop-blur-sm premium-shadow will-change-transform hover:border-white/90"
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
        title="Ready to Climb the Pathway?"
        description="Find the right coach, book the right venue, and get an AI-powered roadmap that shows exactly how your child can move from grassroots to glory."
        primaryCTA={{
          label: "Get Your Sports Roadmap",
          href: "/register?role=PLAYER",
        }}
        secondaryCTA={{
          label: "Explore the Community",
          href: communityUrl,
        }}
      />
    </main>
  );
}
