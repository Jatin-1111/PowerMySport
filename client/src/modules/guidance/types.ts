// ─── Guidance Module Types ────────────────────────────────────────────────────

export type GuidanceFormState = {
  child_age: number;
  child_gender: "male" | "female";
  current_fitness_level: "Low" | "Moderate" | "High";
  personality_tags: string[];
  primary_objective: "Recreational" | "Fitness" | "Compete" | "Elite";
  weekly_time_commitment: number;
  budget_tier: "Budget" | "Moderate" | "Premium";
  parent_specific_question: string;
  sport: string;
  location: string;
  current_pathway_level?: number;
  /** How long the child has already been playing this sport, in years (0 = brand new) */
  years_playing?: number;
  /** Optional short bio the parent writes about themselves */
  parent_bio?: string;
  /** Sports the parent follows, played, or is most interested in */
  parent_sport_interest?: string[];
  /** How long the parent has been involved or interested in sport, in years (0 = just starting) */
  parent_involvement_years?: number;
  // Wizard assessment signals — populated from child profile when available
  wizard_build?: "lean" | "average" | "stocky";
  wizard_height?: "short" | "average" | "tall";
  wizard_energy_type?: "explosive" | "endurance";
  wizard_motor_type?: "gross" | "fine";
  wizard_visual_tracking?: "strong" | "moderate" | "weak";
  wizard_team_individual?: number;
  wizard_competitive_response?: "fired-up" | "calm" | "discouraged";
  wizard_focus_style?: "bursts" | "sustained";
  wizard_decision_style?: "react" | "strategic";
  wizard_pressure_response?: "thrives" | "manages" | "avoids";
  wizard_repetition_tolerance?: "high" | "low";
  wizard_contact_comfort?: "loves" | "neutral" | "avoids";
  wizard_environment?: "outdoor" | "indoor" | "no-preference";
  wizard_water_comfort?: "comfortable" | "neutral" | "uncomfortable";
  wizard_eyesight?: "sharp" | "corrected" | "limited";
  wizard_agility?: "high" | "moderate" | "low";
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
  gender?: "MALE" | "FEMALE" | "OTHER";
  sportsFocus: string[];
  skillLevel?: string;
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
  // Wizard fields
  heightCm?: number;
  weightKg?: number;
  build?: "lean" | "average" | "stocky";
  heightCategory?: "short" | "average" | "tall";
  energyType?: "explosive" | "endurance";
  motorType?: "gross" | "fine";
  visualTracking?: "strong" | "moderate" | "weak";
  teamIndividual?: number;
  competitiveResponse?: "fired-up" | "calm" | "discouraged";
  focusStyle?: "bursts" | "sustained";
  decisionStyle?: "react" | "strategic";
  pressureResponse?: "thrives" | "manages" | "avoids";
  repetitionTolerance?: "high" | "low";
  contactComfort?: "loves" | "neutral" | "avoids";
  environment?: "outdoor" | "indoor" | "no-preference";
  waterComfort?: "comfortable" | "neutral" | "uncomfortable";
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  ambition?: "fun" | "competitive" | "national" | "professional";
  eyesight?: "sharp" | "corrected" | "limited";
  agility?: "high" | "moderate" | "low";
  weeklyHoursCategory?: "1-3" | "4-7" | "8-12" | "13-plus";
  wizardCity?: string;
  sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
  wizardCompletedAt?: string;
};
