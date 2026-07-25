"use client";

import { MacroLevel, StepperPalette } from "@/modules/sports/config/macroLevels";

// ─── Shared "is here" / "Goal" stage chips ──────────────────────────────────
//
// All four skeleton steppers pin the same two facts on a stage: where the
// child stands today (filled chip) and where the family said they're aiming
// (outlined chip). Kept in one place so the pins read identically across
// archetypes. When a stage is both, only "is here" renders — the goal flag
// is meaningless once you're standing on it.

export function stageStatus(
  stage: MacroLevel,
  currentLevel: number,
  goalRawLevel?: number,
): { isCurrent: boolean; isGoal: boolean } {
  const isCurrent = stage.rawLevels.some((l) => l.level === currentLevel);
  const isGoal =
    !isCurrent &&
    goalRawLevel !== undefined &&
    stage.rawLevels.some((l) => l.level === goalRawLevel);
  return { isCurrent, isGoal };
}

export function StageChips({
  isCurrent,
  isGoal,
  personaName,
  palette,
  compact = false,
}: {
  isCurrent: boolean;
  isGoal: boolean;
  personaName?: string;
  palette: StepperPalette;
  compact?: boolean;
}) {
  if (!isCurrent && !isGoal) return null;
  const pad = compact ? "px-1.5 py-0.5" : "px-2 py-0.5";

  if (isCurrent) {
    return (
      <span
        className={`text-[9px] font-bold ${pad} rounded-full whitespace-nowrap`}
        style={{ background: palette.ring, color: palette.dark }}
      >
        {personaName ? `${personaName} is here` : "Your level"}
      </span>
    );
  }
  return (
    <span
      className={`text-[9px] font-bold ${pad} rounded-full whitespace-nowrap border bg-white`}
      style={{ borderColor: palette.hex, color: palette.hex }}
    >
      {personaName ? `${personaName}’s goal` : "Your goal"}
    </span>
  );
}
