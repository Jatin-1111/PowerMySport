import { listActiveExperts } from "../../client/services/ExpertsService";
import {
  createHandoffTicket,
  type HandoffRefusal,
} from "../../client/services/SupportHandoffService";
import { PathwayGuide } from "../models/PathwayGuide";
import {
  loadPlannerChatContext,
  PLANNER_CHAT_RULES,
} from "../../client/services/PlannerChatContext";
import { RankingClaimService } from "../../client/services/RankingClaimService";
import { findEditionsForChat, getUpcomingEditions } from "./tournamentEditionQueries";

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

    // Only events a parent can still enter: a list of closed ones answers "what should we
    // play" with something they can no longer do.
    // A known parent whose ranking is already linked must not be told to link one: the
    // personal list is simply not switched on (PLANNER_CHAT), so send them to the page.
    const rankingAlreadyLinked = context?.userId
      ? (await RankingClaimService.list(context.userId).catch(() => [])).some(
          (claim) => claim.sportSlug === sportSlug && claim.standings.length > 0
        )
      : false;
    const upcoming = await getUpcomingEditions(sportSlug, 5, { openEntriesOnly: true });
    if (upcoming.length === 0) {
      return {
        message:
          "No tournaments with entries still open were found in the calendar for this sport. Say so plainly; do not list events whose entries have closed.",
      };
    }
    return {
      // Said to the model so it can say it to the parent: this list is not
      // judged against anyone's age or rank.
      personalised: false,
      note: rankingAlreadyLinked
        ? "This is the general calendar, not filtered for the child's age group or rank. Say so. The parent's ranking is already linked, so do not ask them to link one: send them to https://powermysport.com/planner, which shows which events their child can actually enter."
        : "This is the general calendar, not filtered for any child's age group or rank. Say so, and mention that linking a ranking at /planner shows which events a child can actually enter.",
      tournaments: upcoming.map((t) => ({
        name: t.name,
        startDate: t.startDate,
        city: t.city,
        ageGroups: t.ageGroups,
        entriesClose: dateOnly(t.registrationDeadlineDate) ?? "not published",
      })),
    };
  },
};

// ─── get_child_ranking ──────────────────────────────────────────────────────────

const getChildRankingTool: ChatToolDefinition = {
  name: "get_child_ranking",
  summary:
    "tell a signed-in parent their child's current ranking, points and movement in each list the child is ranked in",
  example: "what is my son's ranking",
  promptNote:
    "Quote the rank with its list and the date the list was published, and say which way it moved. A child who is not ranked yet, or whose ranking is not linked, is not an error: say that, and point to https://powermysport.com/planner to link a ranking. Never repeat a registration number or date of birth.",
  description:
    "Look up the current ranking of the parent's own child from the ranking linked to their PowerMySport account: the rank and points in each list they appear in, the list's publication date and how far they moved since the last list. Use whenever a parent asks about their child's ranking, rank, points or whether they moved up. Works only for a parent whose account is known; otherwise it says so.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      childName: {
        type: "string",
        description:
          "First name of the child, when the parent names one. Omit to cover every child with a linked ranking.",
      },
      sportSlug: {
        type: "string",
        description: "URL slug for the sport when it is known, e.g. 'tennis'. Omit to cover all.",
      },
    },
  },
  execute: async (args, context) => {
    if (!context?.userId) {
      return {
        linked: false,
        reason: "number_not_linked",
        instruction:
          "This WhatsApp number is not tied to a PowerMySport account, so no ranking can be read. Say that plainly (not that it is private), and that signing in at https://powermysport.com/planner shows and links a child's ranking.",
      };
    }

    const wanted = typeof args.childName === "string" ? args.childName.trim().toLowerCase() : "";
    const sport = typeof args.sportSlug === "string" ? args.sportSlug.trim().toLowerCase() : "";
    const claims = (await RankingClaimService.list(context.userId)).filter(
      (claim) =>
        (!sport || claim.sportSlug === sport) &&
        (!wanted || (claim.dependentName ?? "").toLowerCase().startsWith(wanted))
    );

    if (claims.length === 0 && wanted) {
      // A name the parent said, or an old message carried over, that is not on the account:
      // show who is, rather than reporting that nothing is linked.
      const onAccount = await RankingClaimService.list(context.userId);
      if (onAccount.length > 0) {
        return {
          linked: false,
          reason: "child_not_on_account",
          childrenOnAccount: onAccount.map((claim) => ({
            child: (claim.dependentName ?? "").split(/\s+/)[0] || "a child",
            sport: claim.sportSlug,
          })),
          instruction:
            "No child with that name has a linked ranking on this account. Say who does, by first name, and ask whether they mean one of them. Do not say that no ranking is linked at all.",
        };
      }
    }

    if (claims.length === 0) {
      return {
        linked: false,
        reason: "no_ranking_linked",
        instruction:
          "No ranking is linked for that child yet. Say so, and that linking one at https://powermysport.com/planner shows the rank and the tournaments the child can enter.",
      };
    }

    // First name, lists, ranks and dates only. The registration number and birth year are
    // on the claim and are left out on purpose: nothing here is something a parent
    // would not expect the assistant to say, and nothing that identifies the child to a stranger.
    return {
      linked: true,
      children: claims.slice(0, 3).map((claim) => ({
        child: (claim.dependentName ?? "").split(/\s+/)[0] || "Your child",
        sport: claim.sportSlug,
        lists:
          claim.standings.length === 0
            ? "not in any current list (dropped off or not ranked yet)"
            : claim.standings.map((s) => ({
                list: `${s.category} ${s.subcategory}`,
                rank: s.rank,
                points: s.totalPoints,
                listPublished: dateOnly(s.asOnDate),
                movedUpPlaces: s.rankDelta,
              })),
      })),
    };
  },
};

// ─── get_tournament_details ─────────────────────────────────────────────────────

const CHAT_SITE = "https://powermysport.com";

/** The calendar date alone, which is what a parent reads: 2026-11-14, not a timestamp. */
const dateOnly = (value: Date | undefined): string | undefined =>
  value ? new Date(value).toISOString().slice(0, 10) : undefined;

const getTournamentDetailsTool: ChatToolDefinition = {
  name: "get_tournament_details",
  summary: "look up one tournament's dates, venue, entry deadline, fees and official page",
  example: "when do entries close for the Delhi tournament",
  promptNote:
    "Say plainly when an entry deadline has already passed, and give fees in rupees with the unit. These dates come from the federation's calendar, so tell the parent to confirm on the official page before they travel or pay.",
  description:
    "Look up a specific upcoming or ongoing tournament by its name or place: dates, venue, age groups, when entries open and close (and whether they already have), the withdrawal deadline, the entry fee and the official page. Use when a parent asks about one named tournament, an entry deadline, a fee or a venue. For a list of what is coming up in a sport, use get_upcoming_tournaments instead.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "The tournament's name or place as the parent said it, e.g. 'Delhi', 'State Junior Championship', 'CS7 Pune'.",
      },
      sportSlug: {
        type: "string",
        description: "URL slug for the sport when it is known, e.g. 'tennis'. Omit if not.",
      },
    },
    required: ["query"],
  },
  execute: async (args) => {
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 120) : "";
    if (!query) return { error: "Ask the parent which tournament they mean." };

    const { editions, more } = await findEditionsForChat({
      query,
      ...(typeof args.sportSlug === "string" && args.sportSlug
        ? { sportSlug: args.sportSlug }
        : {}),
    });
    if (editions.length === 0) {
      return {
        found: false,
        message:
          "No upcoming or ongoing tournament matches that. Say so, and ask for the city or the full name, or point to https://powermysport.com/tournaments.",
      };
    }

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    return {
      found: true,
      moreMatches: more,
      note: "Dates come from the federation's calendar and can change. Fees are in Indian rupees.",
      tournaments: editions.map((e) => {
        const closes = e.registrationDeadlineDate
          ? new Date(e.registrationDeadlineDate)
          : undefined;
        return {
          name: e.name,
          officialName: e.officialName,
          sport: e.sportSlug,
          starts: dateOnly(e.startDate),
          ends: dateOnly(e.endDate),
          city: e.city,
          state: e.state,
          venue: e.venue,
          ladder: e.ladder ?? e.level,
          ageGroups: e.ageGroups,
          surface: e.surface,
          entriesOpen: dateOnly(e.entryOpensDate),
          entriesClose: dateOnly(e.registrationDeadlineDate),
          entriesCloseAt: e.deadlineTimes?.entryCloses,
          // Compared as calendar dates: a deadline "on the 12th" is still live all day on the 12th.
          entriesClosed: closes ? closes.getTime() < startOfToday.getTime() : undefined,
          withdrawalDeadline: dateOnly(e.withdrawalDeadlineDate),
          feeSinglesRupees: e.feeSingles,
          feeDoublesRupees: e.feeDoubles,
          tournamentPage: e.slug ? `${CHAT_SITE}/tournaments/${e.slug}` : undefined,
          officialPage: e.detailUrl,
          lastCheckedOnCalendar: dateOnly(e.lastCheckedAt),
        };
      }),
    };
  },
};

// ─── request_team_followup ──────────────────────────────────────────────────────

const HANDOFF_REFUSALS: Record<HandoffRefusal, string> = {
  not_agreed:
    "Not sent. Ask the parent whether they want their question passed to the team and wait for a clear yes, then call again with parentAgreed true.",
  missing_name: "Not sent. Ask the parent for their name.",
  invalid_email:
    "Not sent. That email address does not look right. Ask the parent to check it and send it again.",
  missing_summary:
    "Not sent. Say back to the parent what you will pass on, and call again with it.",
  already_sent:
    "Already passed on. The team has this parent's request from the last hour. Tell them it is with the team and they will be emailed; do not send another.",
};

const requestTeamFollowupTool: ChatToolDefinition = {
  name: "request_team_followup",
  summary:
    "pass a parent's question to the PowerMySport team, who reply by email, once the parent has agreed",
  example: "I would like to talk to someone from your team",
  promptNote:
    "Before calling it, ask the parent for their name and an email address, say the team will reply by email, and wait for a clear yes. Never call it on a vague request, never invent a name or an email, and ask for nothing else: no medical details, ID numbers, payment details or passwords. When it works, tell the parent the team will email them, usually within 24 hours.",
  description:
    "Create a request for the PowerMySport team to follow up by email. Call it ONLY after the parent has given their name and an email address and has clearly agreed to have their question passed on. It cannot be undone and it contacts a real person. If the parent only wants the contact details, give https://powermysport.com/contact instead of calling this.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The parent's name, as they gave it." },
      email: { type: "string", description: "The email address the parent gave for the reply." },
      summary: {
        type: "string",
        description:
          "What the parent wants help with, in one to three plain sentences, in English, without any medical, ID or payment details.",
      },
      parentAgreed: {
        type: "boolean",
        description:
          "True only if the parent has clearly said yes to having their question passed to the team at this email. False or omitted otherwise.",
      },
    },
    required: ["name", "email", "summary", "parentAgreed"],
  },
  execute: async (args, context) => {
    const result = await createHandoffTicket({
      name: args.name,
      email: args.email,
      summary: args.summary,
      parentAgreed: args.parentAgreed,
      userId: context?.userId,
    });
    if (!result.ok) return { sent: false, instruction: HANDOFF_REFUSALS[result.reason] };
    return {
      sent: true,
      instruction:
        "Passed on. Tell the parent the team will reply to the email they gave, usually within 24 hours. Do not promise anything more.",
    };
  },
};

// ─── Per-persona tool sets ──────────────────────────────────────────────────────

export const ASSISTANT_CHAT_TOOLS: ChatToolDefinition[] = [
  searchExpertsTool,
  getPathwayStageTool,
  getUpcomingTournamentsTool,
  getChildRankingTool,
  getTournamentDetailsTool,
  requestTeamFollowupTool,
];
