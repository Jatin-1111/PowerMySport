/**
 * Rupees as a parent reads them. Indian digit grouping (1,50,000), no decimals,
 * and a range written in words ("to") rather than with a dash, which this site
 * does not use in copy.
 */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatInr = (amount: number): string => INR.format(amount);

/** "₹14,000 to ₹22,000", or a single figure when low and high are the same. */
export function formatRange(low: number, high: number): string {
  return low === high ? formatInr(low) : `${formatInr(low)} to ${formatInr(high)}`;
}

/**
 * Whole rupees from what a person typed: "8,000", "8000", " 8000 ". Null for
 * blank, and NaN for anything that is not a plain amount, so a form can tell
 * "left empty" from "typed something wrong".
 */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}
