/**
 * Short, attributed quotes shown one-per-day in the Questions hero.
 *
 * Only quotes with a well-established attribution belong here — a misattributed
 * line on a page about trustworthy answers is worse than no quote at all. Keep
 * each one short (a single line) so the panel never needs to scroll.
 */
export type DailyQuote = {
  text: string;
  author: string;
};

export const DAILY_QUOTES: DailyQuote[] = [
  {
    text: "Hard work beats talent when talent doesn't work hard.",
    author: "Tim Notke",
  },
  {
    text: "You miss 100% of the shots you don't take.",
    author: "Wayne Gretzky",
  },
  {
    text: "It's not whether you get knocked down; it's whether you get up.",
    author: "Vince Lombardi",
  },
  {
    text: "Champions keep playing until they get it right.",
    author: "Billie Jean King",
  },
  {
    text: "The more difficult the victory, the greater the happiness in winning.",
    author: "Pelé",
  },
  {
    text: "Do not let what you cannot do interfere with what you can do.",
    author: "John Wooden",
  },
  {
    text: "It's what you learn after you know it all that counts.",
    author: "John Wooden",
  },
  {
    text: "I can accept failure. I can't accept not trying.",
    author: "Michael Jordan",
  },
  {
    text: "Talent wins games, but teamwork wins championships.",
    author: "Michael Jordan",
  },
  {
    text: "Age is no barrier. It's a limitation you put on your mind.",
    author: "Jackie Joyner-Kersee",
  },
  {
    text: "Persistence can change failure into extraordinary achievement.",
    author: "Matt Biondi",
  },
  {
    text: "Set your goals high, and don't stop till you get there.",
    author: "Bo Jackson",
  },
  {
    text: "The only way to prove that you're a good sport is to lose.",
    author: "Ernie Banks",
  },
  {
    text: "You have to dream before your dreams can come true.",
    author: "A. P. J. Abdul Kalam",
  },
];

/**
 * India has a single, DST-free offset (UTC+05:30), so the IST calendar day is
 * just the UTC epoch shifted forward by 5h30m and floored to whole days. Doing
 * it arithmetically — rather than through a locale string — means the server
 * and the browser derive the same day number from the same instant, so the
 * first paint and the hydrated render never disagree.
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function istDayNumber(nowMs: number): number {
  return Math.floor((nowMs + IST_OFFSET_MS) / DAY_MS);
}

/** Milliseconds from `nowMs` until the next IST midnight. */
export function msUntilNextIstMidnight(nowMs: number): number {
  const elapsedToday = (nowMs + IST_OFFSET_MS) % DAY_MS;
  return DAY_MS - elapsedToday;
}

export function quoteForDay(nowMs: number): DailyQuote {
  const index = istDayNumber(nowMs) % DAILY_QUOTES.length;
  return DAILY_QUOTES[index]!;
}

/** "21 Aug 2026" for the IST calendar day containing `nowMs`. */
export function istDateLabel(nowMs: number): string {
  return new Date(nowMs).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}
