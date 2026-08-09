// ─── Authored sport guide ───────────────────────────────────────────────────
//
// Hand-written, sport-specific content that the generated pathway has no fields
// for. The API's `PathwayLevel` answers "what is this tier and how do you enter
// it"; a parent's actual first questions are "is this even right for my child",
// "what racquet size", "how many sessions a week", "what do I say after a
// session", "what if they don't make it" — none of which live in a pathway model.
//
// Authored rather than generated, for the same reason the pathway graphs are:
// this is the content a parent will act on, and a racquet length or a nutrition
// window that a language model invented is worse than nothing. Every figure here
// traces to the PowerMySport Tennis Pathway handbook.
//
// A sport with no guide simply renders the generated sections, exactly as before.

export interface AgeFocus {
  age: string;
  focus: string;
}

export interface Trait {
  trait: string;
  why: string;
}

export interface CostTier {
  level: string;
  annual: string;
}

export interface GearItem {
  item: string;
  guidance: string;
}

export interface LoadRow {
  age: string;
  sessions: string;
  duration: string;
}

export interface CalendarRow {
  period: string;
  focus: string;
}

export interface NutritionWindow {
  when: string;
  what: string;
  examples?: string;
}

/**
 * The four skill families a player builds. Kept apart because parents reliably
 * hear "skills" as strokes alone, and the tactical and mental columns are the
 * ones that decide matches later.
 */
export interface SkillFamilies {
  technical: string[];
  tactical: string[];
  physical: string[];
  mental: string[];
}

export interface CareerTrack {
  role: string;
  summary: string;
  /** The progression within that career, if it has a recognised one. */
  ladder?: string[];
  /** Certifications or credentials that open it. */
  credentials?: string[];
}

/** Everything authored for one rendered stage, keyed by its representative level. */
export interface StageExtras {
  /** Equipment appropriate to this stage — sizes, balls, shoes, kit. */
  gear?: { intro?: string; items: GearItem[] };
  /** How much training, and how it should be split against competition. */
  load?: { intro?: string; rows?: LoadRow[]; note?: string; practiceRatio?: string };
  /** What the parent should do, and stop doing. */
  parentRole?: {
    before?: string[];
    during?: string[];
    after?: { instead: string; ask: string[] };
    avoid?: string[];
  };
  /**
   * What the child is learning to DO with the racquet, and how they get to the
   * ball. Separate from `body`: that is conditioning, this is the sport itself.
   * The most-searched thing on the page and previously the only major handbook
   * section with nowhere to live.
   */
  technique?: {
    intro?: string;
    /** The strokes being built or refined at this stage. */
    strokes?: string[];
    /** Beyond hitting it — grips, contact point, spin, depth control. */
    refinements?: string[];
    /** Reading the point rather than just returning the ball. */
    matchAwareness?: string[];
    /** Movement is a skill, and coaches rate it above stroke production. */
    footwork?: { movement?: string[]; drills?: string[]; note?: string };
  };
  /** What tends to go wrong physically here, and what prevents it. */
  injuries?: { intro?: string; common: string[]; prevention: string[]; note?: string };
  /**
   * How to judge the place, as distinct from the coach. Parents are told to pick
   * a good coach and left to work out what a good academy looks like — and the
   * environment is what decides whether a five-year-old comes back next week.
   */
  academy?: {
    intro?: string;
    criteria: { what: string; why: string }[];
    /** What to look for when watching a session before signing anything. */
    observe?: string[];
    /** Questions worth asking before paying. */
    ask?: string[];
    note?: string;
  };
  /** Fitness, nutrition and recovery appropriate to the age. */
  body?: {
    fitness?: { area: string; how: string }[];
    nutrition?: NutritionWindow[];
    recovery?: string[];
    supportTeam?: string[];
    /**
     * Mental skills training. Named separately from `supportTeam` because
     * families read a psychologist as something you call when a child is
     * struggling, and by this stage it is ordinary performance work.
     */
    mind?: {
      intro?: string;
      builds: string[];
      whenToSeek?: string[];
      note?: string;
    };
  };
  /** Season planning: the annual calendar, and what to pack. */
  planning?: { intro?: string; calendar?: CalendarRow[]; travelKit?: string[] };
  /** How the ranking actually works, and what it doesn't tell you. */
  ranking?: { how: string[]; matters: string[]; doesNotMeasure: string[] };
  /** The errors families make at this specific stage. */
  mistakes?: string[];
  /** What "ready to move on" looks like. */
  checklist?: string[];
}

export interface SportGuide {
  sport: string;
  /** Everything a family needs before they commit — the "should we?" question. */
  decide: {
    intro: string;
    goodFit: string[];
    poorFit: string[];
    enjoymentNote: string;
    ages: AgeFocus[];
    lateStart: string;
    physical: string[];
    heightNote: string;
    /** What the sport actually asks a player to learn, over years. */
    skills?: SkillFamilies;
    skillsNote?: string;
    traits: Trait[];
    costs: CostTier[];
    costNote: string;
    expenses: string[];
    recreational: string[];
    competitive: string[];
    switchNote: string;
  };
  /** Keyed by the stage's `representativeRawLevel`. */
  stages: Record<number, StageExtras>;
  /** What a life in the sport looks like for the players who don't turn pro. */
  careers: { intro: string; tracks: CareerTrack[]; emerging: string[]; skills: string[] };
}
