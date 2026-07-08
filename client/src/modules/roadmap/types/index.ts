export type ProgressState = {
  currentLevel: number; // 1-5, 0 = not set
  completedSteps: Record<number, boolean[]>; // level -> step index -> done
};

export const DEFAULT_PROGRESS: ProgressState = {
  currentLevel: 0,
  completedSteps: {},
};
