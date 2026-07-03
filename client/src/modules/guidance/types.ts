// ─── Guidance Module Types ────────────────────────────────────────────────────

export type GuidanceFormState = {
  child_age: number;
  child_gender: "male" | "female";
  current_fitness_level: "Low" | "Moderate" | "High";
  personality_tags: string[];
  primary_objective: "Recreational" | "Health" | "Social" | "Competitive";
  weekly_time_commitment: number;
  budget_tier: "Budget" | "Moderate" | "Premium";
  parent_specific_question: string;
  sport: string;
  location: string;
  current_pathway_level?: number;
  /** How long the child has already been playing this sport, in years (0 = brand new) */
  years_playing?: number;
};

export type BurnoutRisk = {
  level: "low" | "medium" | "high";
  message: string;
  recommendations: string[];
};

export type GuidanceResponse = {
  profileAnalysis: string;
  idealCoachingStyle: string;
  weeklyBlueprint: {
    trainingHours: string;
    freePlayHours: string;
    restDays: string;
  };
  recommendedPlatformActions: string;
  recommendedSports?: string[];
  mentalSkillsRoadmap?: {
    currentFocus: string;
    skills: Array<{ skill: string; howToDevelop: string }>;
  };
  talentIdentifiers?: string[];
  multiSportAdvisory?: string;
  journeyPhases?: JourneyPhase[];
  goalAssessment?: GoalAssessment;
  costBreakdown?: CostBreakdown;
  burnoutRisk?: BurnoutRisk;
};

export type JourneyPhase = {
  title: string;
  timeframe: string;
  focus: string;
  milestones: string[];
  outcome: string;
  estimatedCost?: string;
  pathwayLevel?: number; // 1-5, ascending from entry tier to elite/global tier — actual tier names are sport-specific (see /roadmap)
};

export type GoalAssessment = {
  statedGoal: string;
  verdict: "On Track" | "Achievable" | "Ambitious" | "Long-Term";
  rationale: string;
  benchmark: string;
};

export type CostBreakdown = {
  monthlyCoaching: string;
  equipment: string;
  tournaments: string;
  summary: string;
};

export type GuidanceSubmission = {
  id: string;
  query: GuidanceFormState;
  response: GuidanceResponse;
  createdAt: string;
  updatedAt: string;
};

export type PlayerProfile = {
  _id: string;
  type: "SELF" | "DEPENDENT";
  name: string;
  age?: number;
  dob?: string;
  sportsFocus: string[];
  skillLevel?: string;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Health" | "Social" | "Competitive";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
};
