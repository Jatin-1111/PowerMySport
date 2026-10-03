/**
 * One colour per stage position, shared by the picker and the reader so a stage
 * keeps its identity across the two pages. Cycled, because a sport is free to
 * have more stages than tennis does.
 *
 * Every shade is a Tailwind 700 step because each one carries a white stage
 * number. The 600 steps this used before measured as low as 3.1:1 under white
 * text; the 700s all clear 4.5:1.
 */
const STAGE_COLORS = [
  "#15803d", // green-700
  "#c2410c", // orange-700
  "#b45309", // amber-700
  "#6d28d9", // violet-700
  "#1d4ed8", // blue-700
  "#0f766e", // teal-700
  "#be185d", // pink-700
  "#0e7490", // cyan-700
  "#4d7c0f", // lime-700
];

export const colorFor = (index: number) => STAGE_COLORS[index % STAGE_COLORS.length] as string;
