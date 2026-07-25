import { MacroLevel } from "@/modules/sports/config/macroLevels";

/** Common contract for the four archetype stepper skeletons. */
export interface StepperProps {
  stages: MacroLevel[];
  activeIdx: number;
  onSelect: (i: number) => void;
  /** Raw level (1–5) the family marked as "where we are now". */
  currentLevel: number;
  /** Qualifying unit for "standard" sports — flavours wording only. */
  unit?: "time" | "score";
  /** Child's first name — turns the "Your level" pin into "Aarav is here". */
  personaName?: string;
  /** Raw level (1–5) the family set as the ambition — pins a "Goal" chip. */
  goalRawLevel?: number;
}
