"use client";

import axiosInstance from "@/lib/api/axios";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { calendarApi } from "@/modules/booking/services/calendarApi";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircle,
    ArrowRight,
    Award,
    CalendarDays,
    CalendarPlus,
    CheckCheck,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    ExternalLink,
    FileText,
    Globe,
    Heart,
    Info,
    Loader2,
    MapPin,
    Shield,
    ShieldAlert,
    Sparkles,
    Target,
    Trophy,
    UploadCloud,
    Users,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "detail"
  | "question"
  | "unlocked"
  | "doc_check"
  | "no_docs"
  | "upload"
  | "loading"
  | "success";

export interface TournamentModalProps {
  tournament: any;
  isOpen: boolean;
  onClose: () => void;
  // Detail view
  currentLevel?: number; // 0 = not set, 1-5
  sportName?: string;
  isSaved?: boolean;
  onToggleSave?: () => void;
  // Concierge flow
  type?: "tournament" | "scholarship" | "university";
  satisfiedPrerequisites?: string[];
  onSubmitSuccess?: (record: {
    id: string;
    itemName: string;
    itemType: "tournament" | "scholarship" | "university";
    sport: string;
    status: "Submitted" | "In Review" | "Approved";
    documents: { name: string }[];
    submittedAt: string;
  }) => void;
}

// ─── Level helpers ────────────────────────────────────────────────────────────

function normalizeTournamentLevel(levelStr: string): number {
  const l = (levelStr || "").toLowerCase();
  if (
    l.includes("international") ||
    l.includes("world") ||
    l.includes("asian") ||
    l.includes("olympic")
  )
    return 5;
  if (l.includes("national") || l.includes("senior")) return 4;
  if (l.includes("state")) return 3;
  if (l.includes("district") || l.includes("zonal") || l.includes("sub-junior"))
    return 2;
  return 1;
}

const LEVEL_CONFIG = {
  1: {
    label: "Grassroots",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  2: {
    label: "District",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  3: {
    label: "State",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
  4: {
    label: "National",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  5: {
    label: "International",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
} as const;

type LevelKey = keyof typeof LEVEL_CONFIG;

function getWhyThisTournament(
  tournament: any,
  currentLevel: number,
  sportName: string,
): {
  headline: string;
  body: string;
  priority: "next-step" | "goal" | "aspirational" | "consolidate";
} {
  const tLevel = normalizeTournamentLevel(tournament.level || "");
  const sport = sportName || "this sport";
  const curLabel = LEVEL_CONFIG[currentLevel as LevelKey] ?? LEVEL_CONFIG[1];

  if (currentLevel === 0) {
    return {
      headline: "A Key Tournament for Your Child's Journey",
      body: `${tournament.name} is an established tournament in ${sport}. Competing here gives your child structured match experience, official rankings, and exposure to other trained athletes — all critical building blocks for progression.`,
      priority: "next-step",
    };
  }
  if (tLevel === currentLevel) {
    return {
      headline: "Consolidate at This Level",
      body: `Your child is currently at the ${curLabel.label} level. Competing in ${tournament.name} builds a stronger track record and refines technique under real match pressure — both required before advancing further.`,
      priority: "consolidate",
    };
  }
  if (tLevel === currentLevel + 1) {
    return {
      headline: "Your Child's Ideal Next Step",
      body: `This is the direct stepping stone from the ${curLabel.label} level. ${tournament.name} offers your child their first taste of higher competition and is often used as a qualifier for further advancement.`,
      priority: "next-step",
    };
  }
  if (tLevel === currentLevel + 2) {
    return {
      headline: "A Medium-Term Goal to Work Towards",
      body: `${tournament.name} is 1–2 levels ahead of where your child is now. Focus on Level ${currentLevel + 1} tournaments first, build a results portfolio, and then aim for this one within 1–2 years.`,
      priority: "goal",
    };
  }
  return {
    headline: "An Aspirational Milestone",
    body: `${tournament.name} represents elite-level competition in ${sport}. Reaching this consistently requires a structured multi-year development pathway. Our team can help map the exact steps needed.`,
    priority: "aspirational",
  };
}

const PRIORITY_CONFIG = {
  "next-step": {
    label: "Next Step",
    icon: <ChevronRight className="h-3 w-3" />,
    style: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  consolidate: {
    label: "Consolidate",
    icon: <CheckCheck className="h-3 w-3" />,
    style: "bg-blue-100   text-blue-700   border-blue-200",
  },
  goal: {
    label: "Near-term Goal",
    icon: <Target className="h-3 w-3" />,
    style: "bg-violet-100 text-violet-700 border-violet-200",
  },
  aspirational: {
    label: "Aspirational",
    icon: <Award className="h-3 w-3" />,
    style: "bg-amber-100  text-amber-700  border-amber-200",
  },
} as const;

const STEP_TITLES: Partial<Record<Step, string>> = {
  question: "Register with PowerMySport",
  unlocked: "You're Ready to Apply",
  doc_check: "Documents Check",
  no_docs: "Gather Your Documents",
  upload: "Upload Documents",
  loading: "Submitting...",
  success: "Request Submitted!",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TournamentModal({
  tournament,
  isOpen,
  onClose,
  currentLevel = 0,
  sportName = "",
  isSaved = false,
  onToggleSave,
  type = "tournament",
  satisfiedPrerequisites = [],
  onSubmitSuccess,
}: TournamentModalProps) {
  const { user } = useAuthStore();

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("detail");
  // Calendar
  const [calendarDate, setCalendarDate] = useState("");
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  // Concierge
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [reminderSent, setReminderSent] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pastDocs, setPastDocs] = useState<string[]>([]);
  const [applyTarget, setApplyTarget] = useState<"prerequisite" | "direct">(
    "prerequisite",
  );

  useEffect(() => {
    if (!isOpen) return;
    setStep("detail");
    setCalendarDate("");
    setCalendarAdded(false);
    setCalendarError("");
    setUploadedFiles({});
    setUploadError("");
    setReminderSent(false);
    setApplyTarget("prerequisite");
    try {
      const raw = localStorage.getItem("pms_applications");
      if (raw) {
        const apps = JSON.parse(raw);
        const names = new Set<string>();
        apps.forEach((a: any) =>
          a.documents?.forEach((d: any) => {
            if (d.name) names.add(d.name);
          }),
        );
        setPastDocs(Array.from(names));
      }
    } catch {}
  }, [isOpen]);

  if (!isOpen || !tournament) return null;

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasPrerequisite = !!tournament?.prerequisiteName;
  const prerequisiteName = tournament?.prerequisiteName || "";
  const tLevel = normalizeTournamentLevel(tournament.level || "");
  const levelCfg = LEVEL_CONFIG[tLevel as LevelKey] || LEVEL_CONFIG[1];
  const whyInfo = getWhyThisTournament(tournament, currentLevel, sportName);
  const priorityCfg = PRIORITY_CONFIG[whyInfo.priority];
  const documentChecklist: string[] =
    tournament?.documentChecklist?.length > 0
      ? tournament.documentChecklist
      : [
          "Proof of Age (Birth Certificate or Passport)",
          "Medical Fitness Certificate",
        ];
  const isInConciergeFlow = step !== "detail";

  // Progress dots (shown in concierge header)
  const PROGRESS_STEPS: Step[] = hasPrerequisite
    ? ["question", "doc_check", "upload"]
    : ["doc_check", "upload"];
  const progressIdx = PROGRESS_STEPS.indexOf(step);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const BACK_MAP: Partial<Record<Step, Step>> = {
    question: "detail",
    unlocked: "question",
    doc_check: applyTarget === "prerequisite" ? "question" : "unlocked",
    no_docs: "doc_check",
    upload: "doc_check",
  };
  const handleBack = () => setStep(BACK_MAP[step] ?? "detail");

  const handleRegisterWithUs = () => {
    if (!hasPrerequisite) {
      setApplyTarget("direct");
      setStep("doc_check");
    } else if (satisfiedPrerequisites.includes(tournament?.prerequisiteId)) {
      setStep("unlocked");
    } else {
      setStep("question");
    }
  };

  // ── Calendar ───────────────────────────────────────────────────────────────
  const handleAddToCalendar = async () => {
    if (!calendarDate) {
      setCalendarError("Please select a date first.");
      return;
    }
    setCalendarError("");
    setAddingToCalendar(true);
    try {
      await calendarApi.createEvent({
        title: `${tournament.name} — ${sportName}`,
        date: calendarDate,
        type: "COMPETITION",
        color: "#8b5cf6",
        notes:
          `${tournament.level || ""} level tournament. Age group: ${tournament.ageGroup || "Open"}. ${tournament.description || ""}`.trim(),
      });
      setCalendarAdded(true);
    } catch {
      setCalendarError("Failed to add to calendar. Please try again.");
    } finally {
      setAddingToCalendar(false);
    }
  };

  // ── Concierge handlers ─────────────────────────────────────────────────────
  const handleHasCard = async () => {
    setStep("unlocked");
    try {
      if (hasPrerequisite && tournament.prerequisiteId) {
        await axiosInstance.put("/auth/profile", {
          playerProfile: {
            pathwayState: {
              satisfiedPrerequisites: [tournament.prerequisiteId],
            },
          },
        });
      }
    } catch {}
  };

  const handleReminder = async () => {
    setReminderLoading(true);
    try {
      await axiosInstance.post("/reminders", {
        type: "PATHWAY_DOCUMENT_REMINDER",
        itemName: tournament.name,
        itemType: type,
        daysFromNow: 7,
      });
    } catch {}
    setReminderSent(true);
    setReminderLoading(false);
  };

  const handleUploadSubmit = async () => {
    for (const doc of documentChecklist) {
      if (!uploadedFiles[doc]) {
        setUploadError(`Please upload: ${doc}`);
        return;
      }
    }
    setStep("loading");
    try {
      const documents = await Promise.all(
        documentChecklist.map(async (docName: string) => {
          const file = uploadedFiles[docName];
          const res = await axiosInstance.post("/concierge/presigned-url", {
            fileName: file.name,
            contentType: file.type,
            documentType: docName,
          });
          await fetch(res.data.uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
          return { documentName: docName, s3Key: res.data.key };
        }),
      );
      await axiosInstance.post("/concierge/request", {
        sportSlug: tournament.sportName || "sport",
        itemType: type,
        itemId: tournament._id || "unknown",
        itemName: tournament.name,
        prerequisiteId:
          applyTarget === "prerequisite"
            ? tournament.prerequisiteId
            : undefined,
        prerequisiteName:
          applyTarget === "prerequisite" ? prerequisiteName : undefined,
        documents,
      });
    } catch {}

    onSubmitSuccess?.({
      id: `app-${Date.now()}`,
      itemName: tournament.name,
      itemType: type,
      sport: tournament.sportName || "General",
      status: "Submitted",
      documents: documentChecklist.map((d: string) => ({
        name: uploadedFiles[d]?.name || d,
      })),
      submittedAt: new Date().toISOString(),
    });
    setStep("success");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-stretch justify-end sm:items-center sm:justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "100%" }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          className="relative z-10 flex flex-col w-full max-w-xl h-full sm:h-auto sm:max-h-[92vh] overflow-hidden bg-white sm:rounded-3xl shadow-2xl"
        >
          {/* ── Header — transitions between detail and concierge style ── */}
          <AnimatePresence mode="wait">
            {!isInConciergeFlow ? (
              <motion.div
                key="header-detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="shrink-0 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${levelCfg.bg} ${levelCfg.color} ${levelCfg.border}`}
                      >
                        <Trophy className="h-3 w-3" />
                        {tournament.level || levelCfg.label}
                      </span>
                      {currentLevel > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${priorityCfg.style}`}
                        >
                          {priorityCfg.icon}
                          {priorityCfg.label}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold leading-snug break-words">
                      {tournament.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onToggleSave && (
                      <button
                        onClick={onToggleSave}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${isSaved ? "border-rose-200 bg-rose-50 text-rose-500" : "border-white/20 bg-white/10 text-white/70 hover:bg-white/20"}`}
                      >
                        <Heart
                          className={`h-4 w-4 ${isSaved ? "fill-rose-500" : ""}`}
                        />
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {tournament.ageGroup && (
                    <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90">
                      <Users className="h-3 w-3" />
                      {tournament.ageGroup}
                    </span>
                  )}
                  {tournament.city && (
                    <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90">
                      <MapPin className="h-3 w-3" />
                      {tournament.city}
                    </span>
                  )}
                  {tournament.federation && (
                    <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90">
                      <Shield className="h-3 w-3" />
                      {tournament.federation}
                    </span>
                  )}
                  {sportName && (
                    <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90">
                      <Globe className="h-3 w-3" />
                      {sportName}
                    </span>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="header-concierge"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={`shrink-0 p-5 text-white transition-colors ${step === "success" ? "bg-gradient-to-r from-emerald-600 to-teal-600" : "bg-gradient-to-r from-power-orange to-amber-500"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {step !== "loading" && step !== "success" && (
                      <button
                        onClick={handleBack}
                        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 truncate">
                        {tournament.name}
                      </p>
                      <h3 className="text-base font-bold">
                        {STEP_TITLES[step]}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {progressIdx >= 0 && (
                      <div className="flex items-center gap-1">
                        {PROGRESS_STEPS.map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              i < progressIdx
                                ? "w-3 bg-white"
                                : i === progressIdx
                                  ? "w-5 bg-white"
                                  : "w-1.5 bg-white/30"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      onClick={onClose}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <AnimatePresence mode="wait">
              {/* Detail step */}
              {step === "detail" && (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 space-y-5"
                >
                  {tournament.description && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> About This Tournament
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {tournament.description}
                      </p>
                    </div>
                  )}

                  {/* Schedule — dates & registration deadline */}
                  {(tournament.typicalDates ||
                    tournament.registrationDeadline) && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row gap-4">
                      {tournament.typicalDates && (
                        <div className="flex items-start gap-3 flex-1">
                          <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 border border-violet-100">
                            <CalendarDays className="h-4 w-4 text-violet-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              Typical Dates
                            </p>
                            <p className="text-sm font-semibold text-slate-800">
                              {tournament.typicalDates}
                            </p>
                          </div>
                        </div>
                      )}
                      {tournament.registrationDeadline && (
                        <div className="flex items-start gap-3 flex-1">
                          <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 border border-amber-100">
                            <Clock className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              Registration
                            </p>
                            <p className="text-sm font-semibold text-slate-800">
                              {tournament.registrationDeadline}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Why this tournament */}
                  <div
                    className={`rounded-2xl border p-4 ${priorityCfg.style}`}
                    style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1 opacity-60">
                      <Sparkles className="h-3 w-3" /> Why This Tournament
                    </p>
                    <h4 className="font-bold text-sm mb-1">
                      {whyInfo.headline}
                    </h4>
                    <p className="text-sm leading-relaxed opacity-80">
                      {whyInfo.body}
                    </p>
                  </div>

                  {/* Prerequisite alert */}
                  {tournament.prerequisiteName && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1.5 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Prerequisite
                        Required
                      </p>
                      <p className="font-semibold text-amber-800 text-sm">
                        {tournament.prerequisiteName}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        You'll need this registration/ID before entering. Our
                        team can help you obtain it.
                      </p>
                    </div>
                  )}

                  {/* Documents checklist */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Documents Needed for
                      Entry
                    </p>
                    <ul className="space-y-2">
                      {documentChecklist.map((doc: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span className="text-sm text-slate-700">{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* External link */}
                  {tournament.sourceUrls?.[0] && (
                    <a
                      href={tournament.sourceUrls[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <ExternalLink className="h-4 w-4 text-slate-400 shrink-0" />
                      View Official Tournament Page
                    </a>
                  )}

                  {/* Add to Calendar */}
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 mb-3 flex items-center gap-1">
                      <CalendarPlus className="h-3 w-3" /> Add to Your Calendar
                    </p>
                    {!user ? (
                      <div className="flex items-start gap-2.5">
                        <Info className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-violet-700">
                          <a
                            href="/login"
                            className="font-bold underline underline-offset-2"
                          >
                            Log in
                          </a>{" "}
                          or{" "}
                          <a
                            href="/register"
                            className="font-bold underline underline-offset-2"
                          >
                            sign up
                          </a>{" "}
                          to add this tournament to your calendar.
                        </p>
                      </div>
                    ) : calendarAdded ? (
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        <p className="text-sm font-semibold">
                          Added to your competition calendar!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="date"
                            value={calendarDate}
                            onChange={(e) => {
                              setCalendarDate(e.target.value);
                              setCalendarError("");
                            }}
                            min={new Date().toISOString().split("T")[0]}
                            className="flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                          />
                          <button
                            onClick={handleAddToCalendar}
                            disabled={addingToCalendar || !calendarDate}
                            className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {addingToCalendar ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CalendarPlus className="h-4 w-4" />
                            )}
                            {addingToCalendar ? "Adding..." : "Add"}
                          </button>
                        </div>
                        {calendarError && (
                          <p className="text-xs text-rose-600">
                            {calendarError}
                          </p>
                        )}
                        <p className="text-xs text-violet-600">
                          Select the date — it'll appear as a Competition event
                          on your dashboard.
                          {tournament.typicalDates && (
                            <span className="block mt-1 text-violet-500">
                              Hint: this tournament is typically held{" "}
                              {tournament.typicalDates
                                .toLowerCase()
                                .replace(/^usually held in /i, "")}
                              .
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Concierge pitch */}
                  <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-power-orange mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> PowerMySport Concierge
                    </p>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">
                      We Handle the Registration for You
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed mb-3">
                      Obtaining federation IDs, preparing documents, and
                      navigating registration portals takes hours. Our concierge
                      team handles all of it — completely free.
                    </p>
                    <ul className="space-y-1.5">
                      {[
                        "Generate your child's federation registration ID",
                        "Prepare and submit all required documents",
                        "Confirm your entry and notify you when done",
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* bottom padding so sticky footer never covers content */}
                  <div className="h-2" />
                </motion.div>
              )}

              {/* Question step — do you have the prerequisite? */}
              {step === "question" && (
                <motion.div
                  key="question"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 space-y-5"
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-power-orange" />
                    </div>
                    <div className="flex-1 rounded-2xl rounded-tl-none bg-slate-100 p-4 text-slate-800 text-sm leading-relaxed">
                      To register for <strong>{tournament.name}</strong>, your
                      child needs an active <strong>{prerequisiteName}</strong>.
                      Do they currently have one?
                    </div>
                  </div>

                  {/* Prerequisite context */}
                  {tournament.prerequisiteGuide?.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                        What is a {prerequisiteName}?
                      </p>
                      <ol className="space-y-2">
                        {(tournament.prerequisiteGuide as string[])
                          .slice(0, 3)
                          .map((s, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-sm text-slate-700"
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                                {i + 1}
                              </span>
                              {s}
                            </li>
                          ))}
                      </ol>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Unlocked — they have the prerequisite */}
              {step === "unlocked" && (
                <motion.div
                  key="unlocked"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 space-y-5"
                >
                  <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 border border-emerald-100">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-emerald-800">
                        You're ready to proceed!
                      </h4>
                      <p className="text-sm text-emerald-600 mt-1">
                        Here's everything you need for{" "}
                        <strong>{tournament.name}</strong>.
                      </p>
                    </div>
                  </div>

                  {(tournament.level || tournament.ageGroup) && (
                    <div className="flex flex-wrap gap-2">
                      {tournament.level && (
                        <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                          Level: {tournament.level}
                        </span>
                      )}
                      {tournament.ageGroup && (
                        <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                          Age Group: {tournament.ageGroup}
                        </span>
                      )}
                    </div>
                  )}

                  {tournament.prerequisiteGuide?.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                        How to Register / Apply
                      </h5>
                      <ol className="space-y-2.5">
                        {(tournament.prerequisiteGuide as string[]).map(
                          (s, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                                {i + 1}
                              </span>
                              <span className="text-sm leading-relaxed text-slate-700">
                                {s}
                              </span>
                            </li>
                          ),
                        )}
                      </ol>
                    </div>
                  )}

                  {documentChecklist.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Documents You'll Need
                      </h5>
                      <ul className="space-y-2">
                        {documentChecklist.map((doc, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <span className="text-sm text-slate-700">
                              {doc}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {prerequisiteName && (
                    <p className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5 text-xs text-amber-700">
                      Remember to mention your{" "}
                      <strong>{prerequisiteName}</strong> during the
                      registration process.
                    </p>
                  )}
                </motion.div>
              )}

              {/* Doc check step */}
              {step === "doc_check" && (
                <motion.div
                  key="doc_check"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 space-y-5"
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-power-orange" />
                    </div>
                    <div className="flex-1 rounded-2xl rounded-tl-none bg-slate-100 p-4 text-slate-800 text-sm leading-relaxed">
                      {applyTarget === "prerequisite" ? (
                        <>
                          No problem — we can get your child a{" "}
                          <strong>{prerequisiteName}</strong> for free! To do
                          that, the federation requires:
                        </>
                      ) : (
                        <>
                          Great — we can apply for{" "}
                          <strong>{tournament.name}</strong> on your behalf!{" "}
                          We'll need:
                        </>
                      )}
                      <ul className="mt-2 space-y-1">
                        {documentChecklist.map((d, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="h-1 w-1 rounded-full bg-slate-500" />
                            <strong>{d}</strong>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3">Do you have these ready?</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* No docs step */}
              {step === "no_docs" && (
                <motion.div
                  key="no_docs"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 space-y-5"
                >
                  <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100">
                    <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-amber-800">
                        You'll need these documents first.
                      </h3>
                      <p className="text-sm text-amber-700 mt-1">
                        Gather them and come back — we'll be right here.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Required Documents
                    </h5>
                    <ul className="space-y-2.5">
                      {documentChecklist.map((doc, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <div className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-slate-300" />
                          <span className="text-sm text-slate-700">{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Want a reminder?
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        We'll ping you in 7 days to check if you're ready.
                      </p>
                    </div>
                    {reminderSent ? (
                      <span className="shrink-0 flex items-center gap-1.5 rounded-lg bg-emerald-100 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Reminder set!
                      </span>
                    ) : (
                      <button
                        onClick={handleReminder}
                        disabled={reminderLoading}
                        className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition disabled:opacity-60 flex items-center gap-1.5"
                      >
                        {reminderLoading && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        Remind me in 7 days
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Upload step */}
              {step === "upload" && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 space-y-5"
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-power-orange" />
                    </div>
                    <div className="flex-1 rounded-2xl rounded-tl-none bg-slate-100 p-4 text-slate-800 text-sm leading-relaxed">
                      Excellent! Upload the documents below and our team will
                      process your{" "}
                      <strong>
                        {applyTarget === "prerequisite" && prerequisiteName
                          ? prerequisiteName
                          : tournament.name}
                      </strong>{" "}
                      {applyTarget === "prerequisite"
                        ? "registration"
                        : "application"}{" "}
                      — completely free of charge.
                    </div>
                  </div>

                  <div className="space-y-4">
                    {documentChecklist.map((docName: string) => {
                      const file = uploadedFiles[docName];
                      return (
                        <div
                          key={docName}
                          className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">
                              {docName}
                            </span>
                            {file && (
                              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Ready
                              </span>
                            )}
                          </div>
                          <label className="flex flex-col items-center gap-1.5 border-2 border-dashed border-slate-200 bg-white rounded-xl p-4 text-center hover:border-power-orange hover:bg-orange-50/30 transition cursor-pointer">
                            <UploadCloud
                              className={`h-5 w-5 ${file ? "text-emerald-500" : "text-slate-400"}`}
                            />
                            <span className="text-xs font-bold text-slate-700">
                              {file ? file.name : `Upload ${docName}`}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {file ? "Click to change" : "PDF, JPG, or PNG"}
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  setUploadedFiles((prev) => ({
                                    ...prev,
                                    [docName]: f,
                                  }));
                                  setUploadError("");
                                }
                              }}
                            />
                          </label>
                          {pastDocs.length > 0 && !file && (
                            <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1.5">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                Reuse a previously uploaded document:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {pastDocs.map((name) => (
                                  <button
                                    key={name}
                                    type="button"
                                    onClick={() => {
                                      setUploadedFiles((prev) => ({
                                        ...prev,
                                        [docName]: new File([], name),
                                      }));
                                      setUploadError("");
                                    }}
                                    className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-power-orange hover:text-power-orange px-2 py-1 text-[10px] font-semibold text-slate-600 transition"
                                  >
                                    Use "{name}"
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {uploadError && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">
                      {uploadError}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Loading */}
              {step === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-24 space-y-4"
                >
                  <Loader2 className="h-10 w-10 text-power-orange animate-spin" />
                  <h3 className="font-bold text-slate-800 text-lg">
                    Uploading Documents...
                  </h3>
                  <p className="text-sm text-slate-500 text-center max-w-xs">
                    Please don't close this window.
                  </p>
                </motion.div>
              )}

              {/* Success */}
              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-14 px-5 space-y-5"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1, stiffness: 200 }}
                    className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center"
                  >
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-xl">
                      Documents Received!
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-sm mx-auto">
                      Our team is verifying your files and will{" "}
                      {type === "tournament" ? "generate" : "process"} your
                      child's {prerequisiteName || tournament.name} within 48
                      hours. We'll notify you once it's done.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-full max-w-[220px]">
                    <a
                      href="/dashboard/concierge-requests"
                      className="block rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow hover:bg-slate-800 transition text-center"
                    >
                      View My Requests
                    </a>
                    <button
                      onClick={onClose}
                      className="rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Sticky footer CTAs (per step) ── */}
          <AnimatePresence mode="wait">
            {step === "detail" && (
              <motion.div
                key="footer-detail"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="shrink-0 border-t border-slate-100 bg-white p-4 space-y-2"
              >
                <button
                  onClick={handleRegisterWithUs}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-power-orange to-amber-500 py-3.5 text-sm font-bold text-white shadow-md hover:opacity-90 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  Register with PowerMySport
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-center text-xs text-slate-400">
                  or{" "}
                  <button
                    onClick={onClose}
                    className="underline underline-offset-2 hover:text-slate-600 transition"
                  >
                    I'll register independently
                  </button>
                </p>
              </motion.div>
            )}

            {step === "question" && (
              <motion.div
                key="footer-question"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="shrink-0 border-t border-slate-100 bg-white p-4"
              >
                <div className="flex gap-3">
                  <button
                    onClick={handleHasCard}
                    className="flex-1 rounded-xl bg-power-orange py-3.5 text-sm font-bold text-white shadow-md hover:bg-orange-600 transition"
                  >
                    Yes, they have it
                  </button>
                  <button
                    onClick={() => {
                      setApplyTarget("prerequisite");
                      setStep("doc_check");
                    }}
                    className="flex-1 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    No — help us get it
                  </button>
                </div>
              </motion.div>
            )}

            {step === "unlocked" && (
              <motion.div
                key="footer-unlocked"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="shrink-0 border-t border-slate-100 bg-white p-4"
              >
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    I'll apply myself
                  </button>
                  <button
                    onClick={() => {
                      setApplyTarget("direct");
                      setStep("doc_check");
                    }}
                    className="flex-1 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition"
                  >
                    Apply on my behalf
                  </button>
                </div>
              </motion.div>
            )}

            {step === "doc_check" && (
              <motion.div
                key="footer-doc-check"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="shrink-0 border-t border-slate-100 bg-white p-4"
              >
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("upload")}
                    className="flex-1 rounded-xl bg-power-orange py-3.5 text-sm font-bold text-white shadow-md hover:bg-orange-600 transition"
                  >
                    Yes, I have them
                  </button>
                  <button
                    onClick={() => setStep("no_docs")}
                    className="flex-1 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    I need to collect them
                  </button>
                </div>
              </motion.div>
            )}

            {step === "no_docs" && (
              <motion.div
                key="footer-no-docs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="shrink-0 border-t border-slate-100 bg-white p-4"
              >
                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  I'll gather them and come back
                </button>
              </motion.div>
            )}

            {step === "upload" && (
              <motion.div
                key="footer-upload"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="shrink-0 border-t border-slate-100 bg-white p-4"
              >
                <button
                  onClick={handleUploadSubmit}
                  className="w-full rounded-xl bg-power-orange py-3.5 text-sm font-bold text-white shadow-md hover:bg-orange-600 transition"
                >
                  Submit Documents
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Backwards-compatible alias so existing imports don't break
export { TournamentModal as TournamentDetailModal };
