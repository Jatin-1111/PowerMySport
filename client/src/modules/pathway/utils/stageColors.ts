/**
 * The colour of a stage marker, shared by the picker and the reader.
 *
 * There used to be nine, cycled, so each stage had its own hue. That made a journey
 * through one sport a run of green, orange, violet, blue and pink, none of which
 * means anything: a stage is told apart by its number and name. One ink colour
 * carries the white number at well over 4.5:1 and leaves the page a single accent.
 */
const STAGE_INK = "#1c1b1a";

export const colorFor = (_index: number): string => STAGE_INK;

/** The unfilled part of a progress bar: the hairline colour. */
export const STAGE_TRACK = "#e1dcd3";
