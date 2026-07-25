"use client";

import {
  ARCHETYPE_META,
  MacroLevel,
  resolveArchetypeCopy,
} from "@/modules/sports/config/macroLevels";
import { Archetype } from "@/modules/sports/config/sportArchetypes";
import { Info } from "lucide-react";

import { FederationStepper } from "./FederationStepper";
import { RankingStepper } from "./RankingStepper";
import { RatingStepper } from "./RatingStepper";
import { StandardStepper } from "./StandardStepper";

// ─── Archetype dispatcher ───────────────────────────────────────────────────
//
// One skeleton per archetype: the same 5 raw pathway levels render inside
// whichever visual structure matches how the sport actually progresses.

interface ArchetypeStepperProps {
  archetype: Archetype;
  unit?: "time" | "score";
  stages: MacroLevel[];
  activeIdx: number;
  onSelect: (i: number) => void;
  currentLevel: number;
  personaName?: string;
  goalRawLevel?: number;
}

const STEPPERS: Record<
  Archetype,
  typeof FederationStepper | typeof StandardStepper
> = {
  federation: FederationStepper,
  ranking: RankingStepper,
  rating: RatingStepper,
  standard: StandardStepper,
};

export function ArchetypeStepper({
  archetype,
  unit,
  stages,
  activeIdx,
  onSelect,
  currentLevel,
  personaName,
  goalRawLevel,
}: ArchetypeStepperProps) {
  const meta = ARCHETYPE_META[archetype];
  const Stepper = STEPPERS[archetype];

  return (
    <div>
      {/* How-you-advance strip — names the journey structure for the parent */}
      <div className="flex items-start gap-2.5 border-b border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-500">
          <span className="font-bold text-slate-700">{meta.label}: </span>
          {resolveArchetypeCopy(meta.howYouAdvance, unit)}
        </p>
      </div>

      <Stepper
        stages={stages}
        activeIdx={activeIdx}
        onSelect={onSelect}
        currentLevel={currentLevel}
        unit={unit}
        personaName={personaName}
        goalRawLevel={goalRawLevel}
      />
    </div>
  );
}
