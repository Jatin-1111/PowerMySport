"use client";

import { Variants } from "framer-motion";
import {
    Flag,
    Globe,
    MapPin,
    Shield,
    Trophy,
} from "lucide-react";


// ─── Design Tokens ────────────────────────────────────────────────────────────

export const SPRING_STIFF = { type: "spring", stiffness: 260, damping: 22 } as const;
export const SPRING_SOFT = { type: "spring", stiffness: 200, damping: 28 } as const;

// ─── Motion Variants ──────────────────────────────────────────────────────────

export const orchestrator: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.06 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: SPRING_STIFF },
};

export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING_STIFF },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  show: { opacity: 1, scale: 1, transition: SPRING_SOFT },
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman & Nicobar",
  "Chandigarh",
  "Dadra & Nagar Haveli",
  "Daman & Diu",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
].sort((a, b) => a.localeCompare(b));

// Coaching fee tiers derived from parentalCommitment.financial text
export const COACHING_FEE_TIERS: Record<
  number,
  { label: string; low: number; high: number }
> = {
  1: { label: "₹1,000–₹3,000/mo", low: 1000, high: 3000 },
  2: { label: "₹3,000–₹10,000/mo", low: 3000, high: 10000 },
  3: { label: "₹10,000–₹30,000/mo", low: 10000, high: 30000 },
  4: { label: "₹30,000–₹80,000/mo", low: 30000, high: 80000 },
  5: { label: "Sponsorship / ₹80,000+", low: 80000, high: 150000 },
};

// ─── Pathway Levels ───────────────────────────────────────────────────────────

export const pathwayLevels = [
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
    glowColor: "bg-turf-green/10",
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
    border: "border-indigo-200",
    accent: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
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
    border: "border-indigo-200",
    accent: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
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

