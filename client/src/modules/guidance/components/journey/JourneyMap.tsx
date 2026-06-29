"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sprout,
  Dumbbell,
  Brain,
  Crosshair,
  TrendingUp,
  Award,
  CheckCircle2,
  Zap,
  Flag,
  Rocket,
  Trophy,
  Wallet,
  MapPin,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LUXE_EASE } from "../../constants";
import type { JourneyPhase, GoalAssessment } from "../../types";
import { Phase3D } from "./Phase3D";
import { LineReveal } from "./LineReveal";
import { ProgressRing } from "./ProgressRing";
import { AmbientStars } from "./AmbientStars";
import { CelebrationBurst } from "./CelebrationBurst";
import { GoalAssessmentCard } from "../shared/GoalAssessmentCard";

export function JourneyMap({
  phases,
  submissionId,
  goal,
  goalDetail,
  assessment,
  sport,
}: {
  phases: JourneyPhase[];
  submissionId: string;
  goal: string;
  goalDetail?: string;
  assessment?: GoalAssessment;
  sport?: string;
}) {
  const storageKey = `pms-journey-${submissionId}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [celebrate, setCelebrate] = useState(false);
  const [xpPops, setXpPops] = useState<number[]>([]);

  const NODE_ICONS = [Sprout, Dumbbell, Brain, Crosshair, TrendingUp, Award];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(new Set<string>(JSON.parse(raw)));
      else setDone(new Set());
    } catch {
      setDone(new Set());
    }
  }, [storageKey]);

  const allKeys: string[] = [];
  phases.forEach((p, pi) =>
    p.milestones.forEach((_, mi) => allKeys.push(`${pi}:${mi}`)),
  );
  const total = allKeys.length;
  const completed = allKeys.filter((k) => done.has(k)).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  const phaseDone = (pi: number) =>
    phases[pi].milestones.length > 0 &&
    phases[pi].milestones.every((_, mi) => done.has(`${pi}:${mi}`));
  const currentPhase = phases.findIndex((_, pi) => !phaseDone(pi));

  const toggle = (key: string) => {
    const next = new Set(done);
    const adding = !next.has(key);
    if (adding) next.add(key);
    else next.delete(key);
    setDone(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
    if (adding) {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setXpPops((p) => [...p, id]);
      setTimeout(() => setXpPops((p) => p.filter((x) => x !== id)), 900);
    }
    if (adding && total > 0 && allKeys.filter((k) => next.has(k)).length === total) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1600);
    }
  };

  const completedPhases = phases.filter((_, pi) => phaseDone(pi)).length;
  const currentDisplay = currentPhase === -1 ? phases.length : currentPhase + 1;
  const headline =
    percent === 100
      ? "Mission complete — incredible work! 🎉"
      : percent === 0
        ? "Your mission starts now"
        : `Phase ${currentDisplay} of ${phases.length} — keep climbing`;

  return (
    <div className="space-y-5">
      {/* ── Cinematic mission banner ── */}
      <motion.div
        initial={{ opacity: 0, rotateX: 26, y: 50, z: -200, filter: "blur(12px)" }}
        animate={{ opacity: 1, rotateX: 0, y: 0, z: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.15, ease: LUXE_EASE }}
        style={{
          transformPerspective: 1300,
          transformOrigin: "center top",
          willChange: "transform, filter, opacity",
        }}
        className="relative overflow-hidden rounded-3xl p-px shadow-[0_24px_60px_-24px_rgba(233,115,22,0.5)]"
      >
        {/* slowly rotating gradient-light rim */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-[120%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(233,115,22,0.85)_40deg,transparent_130deg,transparent_220deg,rgba(52,211,153,0.7)_260deg,transparent_340deg)]"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 9, ease: "linear" }}
        />
        <div className="relative overflow-hidden rounded-[23px] bg-gradient-to-br from-slate-900 via-slate-900 to-[#3a1d05] p-5 text-white sm:p-6">
        <AmbientStars />
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-power-orange/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
        {celebrate && <CelebrationBurst />}

        <div className="relative z-10 flex items-center gap-5">
          <div className="relative">
            <ProgressRing percent={percent} dark />
            <AnimatePresence>
              {xpPops.map((id) => (
                <motion.span
                  key={id}
                  initial={{ opacity: 0, y: 0, scale: 0.6 }}
                  animate={{ opacity: 1, y: -30, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-xs font-black text-emerald-300"
                >
                  +10 XP
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-power-orange">
                Mission Roadmap
              </p>
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <Zap className="h-3 w-3" /> {completed * 10} XP
              </span>
            </div>
            <h3 className="font-title text-xl font-bold leading-tight">{headline}</h3>
            <p className="mt-0.5 text-xs text-white/60">
              <Flag className="mr-1 inline h-3 w-3 text-emerald-400" />
              Destination: <span className="font-semibold text-white/90">{goal}</span>
            </p>
            {/* phase pips */}
            <div className="mt-3 flex gap-1.5">
              {phases.map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className={`h-1.5 flex-1 origin-left rounded-full ${
                    i < completedPhases
                      ? "bg-emerald-400"
                      : i === currentPhase
                        ? "bg-power-orange"
                        : "bg-white/15"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        {/* premium sheen sweep */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          initial={{ x: "-160%" }}
          animate={{ x: "160%" }}
          transition={{ repeat: Infinity, duration: 3.6, repeatDelay: 4, ease: "easeInOut" }}
        />
        </div>
      </motion.div>

      {/* ── Honest goal verdict + benchmark ── */}
      {assessment && <GoalAssessmentCard a={assessment} />}

      {/* ── Timeline ── */}
      <div className="relative">
        {/* spine track */}
        <div className="absolute left-[22px] top-6 bottom-6 w-1 rounded-full bg-slate-100" />
        {/* spine fill + traveling shimmer */}
        <motion.div
          className="absolute left-[22px] top-6 w-1 overflow-hidden rounded-full bg-gradient-to-b from-power-orange to-emerald-400"
          initial={{ height: 0 }}
          animate={{ height: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ maxHeight: "calc(100% - 48px)" }}
        >
          <motion.div
            className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-white/80 to-transparent"
            animate={{ y: ["-40px", "260px"] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Start node */}
        <div className="relative flex items-center gap-4 pb-6">
          <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-power-orange to-orange-500 text-white shadow-[0_8px_20px_-6px_rgba(233,115,22,0.6)]">
            <Rocket className="h-5 w-5" />
            <motion.span
              className="absolute inset-0 rounded-2xl ring-2 ring-power-orange/40"
              animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            />
          </div>
          <div>
            <p className="font-bold text-slate-800">Today — the starting line</p>
            <p className="text-xs text-slate-500">
              Tap milestones as you complete them to earn XP
            </p>
          </div>
        </div>

        {/* Phases */}
        {phases.map((p, pi) => {
          const complete = phaseDone(pi);
          const isCurrent = pi === currentPhase;
          const NodeIcon = NODE_ICONS[pi % NODE_ICONS.length]!;
          return (
            <Phase3D key={pi} className="relative pb-6 pl-16">
              {/* node */}
              <div
                className={`absolute left-0 top-0 z-10 flex h-12 w-12 items-center justify-center rounded-2xl border-2 shadow-md ${
                  complete
                    ? "border-emerald-500 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                    : isCurrent
                      ? "border-power-orange bg-gradient-to-br from-power-orange to-orange-500 text-white"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {complete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <NodeIcon className="h-5 w-5" />
                )}
                {isCurrent && (
                  <>
                    <span className="absolute inset-0 rounded-2xl ring-4 ring-power-orange/25 animate-pulse" />
                    <motion.div
                      className="absolute -top-7 left-0 flex w-12 justify-center"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                    >
                      <span className="rounded-full bg-power-orange px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow-md">
                        You
                      </span>
                    </motion.div>
                  </>
                )}
              </div>

              <div
                className={`rounded-2xl border bg-white p-4 transition-shadow duration-300 hover:shadow-[0_26px_55px_-20px_rgba(15,23,42,0.32)] ${
                  isCurrent
                    ? "border-power-orange/40 shadow-md"
                    : complete
                      ? "border-emerald-200"
                      : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {p.timeframe}
                  </span>
                  {p.estimatedCost && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <Wallet className="h-3 w-3" />
                      {p.estimatedCost}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="rounded-full bg-power-orange/10 px-2 py-0.5 text-[10px] font-bold text-power-orange">
                      In progress
                    </span>
                  )}
                  {complete && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                      Cleared
                    </span>
                  )}
                </div>
                <LineReveal
                  text={p.title}
                  delay={0.12}
                  className="font-title font-bold text-slate-900"
                />
                <p className="mt-0.5 mb-3 text-xs text-slate-500">{p.focus}</p>

                <ul className="space-y-1.5">
                  {p.milestones.map((m, mi) => {
                    const key = `${pi}:${mi}`;
                    const checked = done.has(key);
                    return (
                      <li key={mi}>
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="group flex w-full items-start gap-2.5 text-left"
                        >
                          <motion.span
                            whileTap={{ scale: 0.8 }}
                            animate={checked ? { scale: [1, 1.25, 1] } : {}}
                            transition={{ duration: 0.3 }}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                              checked
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300 group-hover:border-power-orange"
                            }`}
                          >
                            {checked && <CheckCircle2 className="h-3.5 w-3.5" />}
                          </motion.span>
                          <span
                            className={`text-xs leading-relaxed ${
                              checked
                                ? "text-slate-400 line-through"
                                : "text-slate-700"
                            }`}
                          >
                            {m}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                  <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <p className="text-[11px] text-emerald-800">
                    <span className="font-bold">Reward:</span> {p.outcome}
                  </p>
                </div>

                {/* Bridge link to roadmap */}
                {p.pathwayLevel && sport && (
                  <Link
                    href={`/roadmap?sport=${encodeURIComponent(sport)}&level=${p.pathwayLevel}`}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-power-orange hover:underline"
                  >
                    <MapPin className="h-3 w-3" />
                    View Level {p.pathwayLevel} details
                  </Link>
                )}
              </div>
            </Phase3D>
          );
        })}

        {/* Goal node */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: LUXE_EASE, delay: 0.2 }}
          className="relative flex items-center gap-4"
        >
          <div
            className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md ${
              percent === 100
                ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                : "bg-slate-800"
            }`}
          >
            <Flag className="h-5 w-5" />
            {percent === 100 && (
              <span className="absolute inset-0 rounded-2xl ring-4 ring-emerald-400/30 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800">
              {percent === 100 ? "🏆 Goal reached: " : "Goal: "}
              {goal}
            </p>
            {goalDetail && (
              <p className="line-clamp-2 max-w-md text-xs text-slate-500">
                {goalDetail}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
