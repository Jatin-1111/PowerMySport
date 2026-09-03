import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { GuidanceChatDrawer } from "@/modules/guidance/components/chat/GuidanceChatDrawer";
import { LoginRequiredModal } from "@/modules/guidance/components/chat/LoginRequiredModal";
import { ResultsView } from "@/modules/guidance/components/results/ResultsView";
import {
  downloadGuidanceReportPdf,
  getGuidanceWhatsAppUrl,
} from "@/modules/guidance/services/guidance";
import type { GuidanceSubmission } from "@/modules/guidance/types";
import type { ProblemId } from "@/modules/guidance/config/wizard/guidanceUtils";
import { PROBLEM_TYPES } from "@/modules/guidance/config/wizard/wizardConfig";
import {
  CompleteProfileNudge,
  shouldShowTraitsNudge,
} from "@/modules/player/components/CompleteProfileNudge";
import { motion } from "framer-motion";
import { BrainCircuit, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";

/**
 * The post-wizard "loading" and "results" screens — extracted from
 * `app/(marketing)/guidance/page.tsx`. No behavior changed.
 */

export function LoadingView({ problemId }: { problemId: ProblemId }) {
  const labels: Record<ProblemId, { title: string; sub: string }> = {
    weakness: {
      title: "Building your weakness fix plan…",
      sub: "Analysing the challenge and designing targeted drills",
    },
    tournament: {
      title: "Building your tournament plan…",
      sub: "Designing a week-by-week preparation timeline",
    },
    levelup: {
      title: "Mapping the level-up path…",
      sub: "Working out exactly what the breakthrough requires",
    },
    custom: {
      title: "Working on your plan…",
      sub: "Analysing the challenge and crafting targeted advice",
    },
  };
  const { title, sub } = labels[problemId];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex min-h-screen items-center justify-center px-4"
    >
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
        <div className="bg-power-orange/8 absolute -left-32 top-10 h-96 w-96 rounded-full blur-3xl" />
      </div>
      <div className="max-w-xs text-center">
        <div className="bg-power-orange/10 mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
          <Loader2 className="text-power-orange h-8 w-8 animate-spin" />
        </div>
        <h2 className="font-title mb-2 text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{sub}</p>
      </div>
    </motion.div>
  );
}

export function ResultsScreen({
  submission,
  problemId,
  onReset,
  dependent,
}: {
  submission: GuidanceSubmission;
  problemId: ProblemId;
  onReset: () => void;
  dependent?: any | null;
}) {
  const { user } = useAuthStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [traitsNudgeOpen, setTraitsNudgeOpen] = useState(false);

  const pt = PROBLEM_TYPES.find((p) => p.id === problemId) ?? PROBLEM_TYPES[3];

  const handleChatClick = () => {
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    if (shouldShowTraitsNudge(dependent)) {
      setTraitsNudgeOpen(true);
      return;
    }
    setChatOpen(true);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadGuidanceReportPdf(submission.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to download report");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="relative min-h-screen px-4 pb-10 pt-4 sm:px-6">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
        <div className="bg-power-orange/10 absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="pb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 shadow-sm backdrop-blur">
              <BrainCircuit className="text-power-orange h-3.5 w-3.5" />
              {pt.label}
            </div>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" />
              New query
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Here&apos;s your personalised plan — based on everything you told us.
          </p>
        </div>

        {/* Results */}
        <div className="rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm">
          <div className="p-4 sm:p-6">
            <ResultsView
              key={submission.id}
              submission={submission}
              actions={{
                onChatClick: handleChatClick,
                onDownloadPdf: handleDownloadPdf,
                downloadingPdf,
                waUrl: getGuidanceWhatsAppUrl(submission.id),
              }}
            />
          </div>
        </div>
      </div>

      {chatOpen && (
        <GuidanceChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          submission={submission}
        />
      )}

      <LoginRequiredModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        sport={submission.query.sport}
        redirectPath={`/guidance?submissionId=${submission.id}&openChat=1`}
      />

      {dependent && (
        <CompleteProfileNudge
          isOpen={traitsNudgeOpen}
          dependentId={dependent._id}
          dependentName={dependent.name ?? "Your child"}
          onProceed={() => {
            setTraitsNudgeOpen(false);
            setChatOpen(true);
          }}
        />
      )}
    </div>
  );
}
