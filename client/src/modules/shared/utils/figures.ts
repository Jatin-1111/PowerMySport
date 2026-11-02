export const formatRupees = (amount: number): string =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Change against last month, as a signed percentage. Null when last month had
 * nothing to compare with, because "up infinity percent" says nothing.
 */
export const monthTrend = (
  thisMonth: number,
  lastMonth: number
): { value: number; positive: boolean } | null => {
  if (lastMonth <= 0) return null;
  return {
    value: ((thisMonth - lastMonth) / lastMonth) * 100,
    positive: thisMonth >= lastMonth,
  };
};
