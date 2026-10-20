import { listActiveExperts } from "../../client/services/ExpertsService";
import { PathwayGuide } from "../models/PathwayGuide";
import {
  loadPlannerChatContext,
  PLANNER_CHAT_RULES,
} from "../../client/services/PlannerChatContext";
import { getUpcomingEditions } from "./tournamentEditionQueries";

/**
 * Who is asking, when that is known. Absent for a channel that has no account
 * behind it (a WhatsApp number is not a user id), and a tool must then answer
 * from public data alone.
 */
export interface ChatToolContext {
  userId?: string;
}

export interface ChatToolDefinition {
  name: string;
  /** For the model: when to call this tool. */
  description: string;
  /**
   * For the assistant's own system prompt and for "what can you do": one plain phrase saying
   * what the tool lets it do for a parent. The prompt's tools section is built from these, so
   * a tool added here is described to the model, and to a parent who asks, with no second
   * place to remember.
   */
  summary: string;
  /** A question a parent might ask that should make the model reach for this tool. */
  example: string;
  /** Anything the model must remember about this tool's results, such as where to point next. */
  promptNote?: string;
  parametersJsonSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context?: ChatToolContext) => Promise<unknown>;
}

// ─── search_experts ────────────────────────────────────────────────────────────

const searchExpertsTool: ChatToolDefinition = {
  name: "search_experts",
  summary:
    "find verified sports experts for one-to-one consultations by sport and city, with their fee per session and rating",
  example: "find me a badminton coach in Bangalore",
  promptNote:
    "Its results are 1:1 expert consultations, not regular coaching: point to /experts for more, never to /booking. A parent who asks for a coach is not asking for a consultation: tell them plainly that regular coaching is coming soon, then offer an expert consultation as the closest option for now.",
  description:
    "Search PowerMySport's verified sports experts by sport and/or free-text (city, expertise, style). Experts give one-to-one consultations (guidance sessions, online or in person); they are NOT coaches for regular training, and regular coaching on PowerMySport is coming soon. Returns up to 5 matches with fee per session, rating, and city. Use when a parent asks for an expert or consultation, or asks for a coach: in that case say first that regular coaching is coming soon, then offer these as the closest option for now.",
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

// ─── get_pathway_stage ─────────────────────────────────────────────────────────

const getPathwayStageTool: ChatToolDefinition = {
  name: "get_pathway_stage",
  summary:
    "explain a sport's development pathway, from an overview of every stage to one stage in full",
  example: "what does stage 3 of the football pathway involve",
  description:
    "Look up a sport's parent-facing pathway — either an overview of every stage, or one stage in full (what it means, the questions parents ask, what to watch for, the decisions it forces, and the recommended next steps). Use when a parent asks about a sport's pathway, its stages, or what a stage of development involves.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      sportSlug: {
        type: "string",
        description: "URL slug for the sport, e.g. 'tennis', 'badminton'.",
      },
      stage: {
        type: "number",
        description:
          "Stage number to focus on (1 = the earliest stage). Omit for an overview of every stage.",
      },
    },
    required: ["sportSlug"],
  },
  execute: async (args) => {
    const sportSlug = String(args.sportSlug || "").toLowerCase();
    const pathway = await PathwayGuide.findOne({
      sportSlug,
      status: "published",
    }).lean();
    if (!pathway) {
      return { error: `No published pathway found for sport slug "${sportSlug}"` };
    }

    const stages = [...(pathway.stages ?? [])].sort((a, b) => a.order - b.order);

    if (args.stage != null) {
      const stage = stages.find((s) => s.order === Number(args.stage));
      if (!stage) {
        return { error: `No stage ${args.stage} found for ${pathway.sportName}` };
      }
      return { sportName: pathway.sportName, stage };
    }

    return {
      sportName: pathway.sportName,
      intro: pathway.sportIntro ?? [],
      stages: stages.map((s) => ({
        stage: s.order,
        name: s.name,
        ageRange: s.ageRange,
        coreQuestion: s.coreQuestion,
      })),
    };
  },
};

// ─── get_upcoming_tournaments ───────────────────────────────────────────────────

const getUpcomingTournamentsTool: ChatToolDefinition = {
  name: "get_upcoming_tournaments",
  summary:
    "list upcoming tournaments for a sport, and for a signed-in parent with a linked ranking, the ones their own child can enter",
  example: "when's the next state tournament",
  description:
    "Get upcoming tournament dates for a sport from the platform's tournament calendar. Use when a parent asks about tournament dates, competitions, or what's coming up next for a sport. For a signed-in parent with a linked ranking this returns the events THEIR CHILD can enter, judged by the same rules as the planner page, so prefer it over any general list.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      sportSlug: { type: "string", description: "URL slug for the sport, e.g. 'badminton'." },
      childName: {
        type: "string",
        description:
          "First name of the child, when the parent names one. Omit to cover every child with a linked ranking.",
      },
    },
    required: ["sportSlug"],
  },
  execute: async (args, context) => {
    const sportSlug = String(args.sportSlug || "");

    // The personal answer first. It is the same output the planner page renders,
    // so the chat cannot recommend an event the page shows as closed.
    if (context?.userId) {
      const childName = typeof args.childName === "string" ? args.childName : undefined;
      const personal = await loadPlannerChatContext(context.userId, sportSlug, childName).catch(
        () => null
      );
      if (personal) {
        return {
          personalised: true,
          children: personal,
          rules: PLANNER_CHAT_RULES,
        };
      }
    }

    const upcoming = await getUpcomingEditions(sportSlug, 5);
    if (upcoming.length === 0) {
      return { message: "No upcoming tournaments found in the calendar for this sport." };
    }
    return {
      // Said to the model so it can say it to the parent: this list is not
      // judged against anyone's age or rank.
      personalised: false,
      note: "This is the general calendar, not filtered for any child's age group or rank. Say so, and mention that linking a ranking at /planner shows which events a child can actually enter.",
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
  getPathwayStageTool,
  getUpcomingTournamentsTool,
];
