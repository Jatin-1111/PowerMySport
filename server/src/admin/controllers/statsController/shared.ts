export type AdminUserRole = "Player" | "Coach" | "VenueLister" | "EXPERT" | "Parent";

export type FunnelSource = "WEB" | "MOBILE" | "SERVER";

const USER_ROLE_SET: ReadonlySet<AdminUserRole> = new Set([
  "Player",
  "Coach",
  "VenueLister",
  "EXPERT",
  "Parent",
]);

export const FUNNEL_SOURCE_SET: ReadonlySet<FunnelSource> = new Set(["WEB", "MOBILE", "SERVER"]);

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export const getRoleFromQuery = (value: unknown): AdminUserRole | null => {
  if (typeof value !== "string") return null;
  return USER_ROLE_SET.has(value as AdminUserRole) ? (value as AdminUserRole) : null;
};

export const getStartOfCurrentMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const getTwentyFourHoursAgo = (): Date => {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
};

const getMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getMonthLabel = (date: Date): string => {
  return MONTH_FORMATTER.format(date);
};

const getDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayLabel = (date: Date): string => {
  return DAY_FORMATTER.format(date);
};

export const buildMonthSeries = (months: number): Array<{ key: string; label: string }> => {
  const series: Array<{ key: string; label: string }> = [];
  const current = new Date();
  current.setDate(1);
  current.setHours(0, 0, 0, 0);

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    series.push({ key: getMonthKey(date), label: getMonthLabel(date) });
  }

  return series;
};

export const buildDaySeries = (days: number): Array<{ key: string; label: string }> => {
  const series: Array<{ key: string; label: string }> = [];
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    series.push({ key: getDayKey(date), label: getDayLabel(date) });
  }

  return series;
};
