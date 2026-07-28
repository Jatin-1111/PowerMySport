import { listActiveExperts } from "../../client/services/ExpertsService";
import { SportPathway, type PathwayLevel } from "../models/SportPathway";
import { getUpcomingEditions } from "./tournamentCalendarService";

export interface ChatToolDefinition {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

// ─── search_experts ────────────────────────────────────────────────────────────

const searchExpertsTool: ChatToolDefinition = {
  name: "search_experts",
  description:
    "Search PowerMySport's verified expert coaches by sport and/or free-text (city, expertise, style). Returns up to 5 matches with fee, rating, and city. Use whenever a parent asks to find, recommend, or check the availability of a coach or expert.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      sport: {
        type: "string",
        description: "Exact sport name to filter by, e.g. 'Badminton', 'Football'.",
      },
      search: {
        type: "string",
        description:
          "Free-text search across city, name, bio, and expertise, e.g. 'Bangalore' or 'anxious beginners'.",
      },
    },
  },
  execute: async (args) => {
    const result = await listActiveExperts({
      sport: typeof args.sport === "string" ? args.sport : undefined,
      search: typeof args.search === "string" ? args.search : undefined,
      limit: 5,
    });
    return {
      totalMatches: result.pagination.total,
      experts: result.data.map((e) => ({
        name: e.name,
        city: e.city,
        sports: e.sports,
        sessionFee: e.sessionFee,
        sessionMode: e.sessionMode,
        rating: e.rating,
        reviewCount: e.reviewCount,
      })),
    };
  },
};

// ─── get_pathway_level ─────────────────────────────────────────────────────────

const getPathwayLevelTool: ChatToolDefinition = {
  name: "get_pathway_level",
  description:
    "Look up a sport's development pathway — either an overview of all levels or the details of one specific level (what it means, key focus, age range, competitions). Use when a parent asks about a sport's roadmap, levels, or what a stage of development involves.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      sportSlug: {
        type: "string",
        description: "URL slug for the sport, e.g. 'badminton', 'football'.",
      },
      level: {
        type: "number",
        description: "Level number to focus on (1 = beginner). Omit for an overview of all levels.",
      },
    },
    required: ["sportSlug"],
  },
  execute: async (args) => {
    const sportSlug = String(args.sportSlug || "");
    const pathway = await SportPathway.findOne({ sportSlug }).lean();
    if (!pathway) return { error: `No pathway found for sport slug "${sportSlug}"` };

    if (args.level != null) {
      const level = pathway.levels.find((l: PathwayLevel) => l.level === Number(args.level));
      if (!level) {
        return { error: `No level ${args.level} found for ${pathway.sportName}` };
      }
      return { sportName: pathway.sportName, level };
    }

    return {
      sportName: pathway.sportName,
      overview: pathway.overview,
      levels: pathway.levels.map((l: PathwayLevel) => ({
        level: l.level,
        label: l.label,
        title: l.title,
        keyFocus: l.keyFocus,
      })),
    };
  },
};

// ─── get_upcoming_tournaments ───────────────────────────────────────────────────

const getUpcomingTournamentsTool: ChatToolDefinition = {
  name: "get_upcoming_tournaments",
  description:
    "Get upcoming tournament dates for a sport from the platform's tournament calendar. Use when a parent asks about tournament dates, competitions, or what's coming up next for a sport.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      sportSlug: { type: "string", description: "URL slug for the sport, e.g. 'badminton'." },
    },
    required: ["sportSlug"],
  },
  execute: async (args) => {
    const sportSlug = String(args.sportSlug || "");
    const upcoming = await getUpcomingEditions(sportSlug, 5);
    if (upcoming.length === 0) {
      return { message: "No upcoming tournaments found in the calendar for this sport." };
    }
    return {
      tournaments: upcoming.map((t) => ({
        name: t.name,
        startDate: t.startDate,
        city: t.city,
        ageGroups: t.ageGroups,
      })),
    };
  },
};

// ─── Per-persona tool sets ──────────────────────────────────────────────────────

export const ASSISTANT_CHAT_TOOLS: ChatToolDefinition[] = [
  searchExpertsTool,
  getPathwayLevelTool,
  getUpcomingTournamentsTool,
];
