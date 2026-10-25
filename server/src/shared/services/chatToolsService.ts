import { log as __rootLog } from "../../utils/logger";
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
import { getGuidancePlans, getSessionsOverview } from "./parentAccountLookups";
import { planToolEnabled, prepareGuidancePlan } from "./whatsappGuidancePlan";
import { confirmPendingAction } from "./whatsappPendingAction";
import { getExpertDetailsForChat, expertProfileUrl } from "./whatsappExperts";
import { prepareSeasonEntry } from "./whatsappSeasonPlan";
import { createProfileLink } from "./whatsappHandoff";
import {
  childNamesOnAccount,
  cleanFirstName,
  forgetAllNotes,
  forgetChild,
  getNotes,
  presentChild,
  saveChildNote,
} from "./whatsappNotes";
import { markFollowUpRequested, requestFollowUp, updateEnquiry } from "./whatsappEnquiries";
import { followUpReply } from "./whatsappInteractive";
import { getChildrenDetail, getSeasonPlans } from "./parentContext";
import { findEditionsForChat, getUpcomingEditions } from "./tournamentEditionQueries";

const log = __rootLog.child("chatTools");

/**
 * Who is asking, when that is known. Absent for a channel that has no account
 * behind it (a WhatsApp number is not a user id), and a tool must then answer
 * from public data alone.
 */
export interface ChatToolContext {
  userId?: string;
  /**
   * Keyed hash of the WhatsApp number in this chat, set by the WhatsApp service from the
   * webhook. A tool that keeps notes uses this and never a value the model supplies, so a
   * model (or a message that talks it into it) cannot read or write another number's notes.
   */
  phoneHash?: string;
  /**
   * What the parent actually sent in this turn, set by the WhatsApp service. A tool that must
   * not act on the model's say-so (making a plan, which costs model calls) checks this instead.
   */
  userMessage?: string;
  /**
   * Things a tool wants done AFTER the reply is sent, set by the WhatsApp service and read back by
   * it. A tool cannot send a message itself, so it leaves a request here. Absent on the website.
   */
  outbound?: { nextSteps?: boolean };
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
    "Its results are 1:1 expert consultations, not regular coaching: point to https://powermysport.com/experts for more, never to /booking. A parent who asks for a coach is not asking for a consultation: tell them plainly that regular coaching is coming soon, then offer an expert consultation as the closest option for now. Give the profileUrl of any expert the parent shows interest in, on its own line; for fuller detail and open times use get_expert_details. Booking and payment are on the website: you cannot book.",
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
        sessionMinutes: e.sessionDurationMinutes,
        sessionMode: e.sessionMode,
        languages: e.languages,
        rating: e.rating,
        reviewCount: e.reviewCount,
        // Where the parent opens the expert and books. Booking and payment are on the website.
        profileUrl: expertProfileUrl(e.id),
      })),
    };
  },
};

const getExpertDetailsTool: ChatToolDefinition = {
  name: "get_expert_details",
  summary:
    "tell a parent more about one expert (what they help with, fee per session, languages, next open times) and give the link to book",
  example: "tell me more about Asha Verma and how do I book her",
  promptNote:
    "Give the expert's profile link on its own line: booking and payment happen on the website, and you cannot book, hold a slot or take a payment. Open times are open now but not held. These are one-to-one consultations, not regular coaching.",
  description:
    "Look up one expert's public listing: their bio, expertise, fee per session in rupees, session length, online or in person, languages, city, rating and the next open times in Indian time, with the profile link where the parent books. Pass the expert's name as the parent said it, or the id from an earlier search. Use when a parent asks about a specific expert, their availability or how to book. If several experts match it returns them for you to ask which. It cannot book anything.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      expert: {
        type: "string",
        description: "The expert's name as the parent said it, or an id from search_experts.",
      },
      sport: { type: "string", description: "Sport to narrow a name search, only if known." },
    },
    required: ["expert"],
  },
  execute: async (args) => getExpertDetailsForChat(args),
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

// ─── get_my_children / get_my_season_plan ───────────────────────────────────────

const NOT_LINKED = {
  linked: false,
  reason: "number_not_linked",
  instruction:
    "This WhatsApp number is not tied to a PowerMySport account, so nothing about a child can be read. Say that plainly (not that it is private), and that signing in at https://powermysport.com shows their children and plans.",
} as const;

const NAME_NOT_ON_ACCOUNT =
  "No child with that name is on this account. Say who is, by first name, and ask whether they mean one of them.";

const childNameParam = {
  type: "string",
  description:
    "First name of the child, when the parent names one. Omit to cover every child on the account.",
} as const;

const getMyChildrenTool: ChatToolDefinition = {
  name: "get_my_children",
  summary:
    "tell a signed-in parent what their account holds about each child: age, the sport chosen or being considered, how the assessment scored sports, experience and goals",
  example: "which sport did the assessment suggest for my daughter",
  promptNote:
    "Quote only what the result holds. A child with no assessment has empty matches: say they have not taken it and point to https://powermysport.com/assessment/discover, never guess a fit.",
  description:
    "Read the parent's own children from their PowerMySport account: age, the sport they chose, the sports in focus or being considered, the top sports the assessment scored for them and how well each fits, years playing, experience level, ambition, weekly hours and state. Use when the parent asks about their child's profile, what the assessment suggested, or what you already know about the child. First names only; there is no surname, date of birth or contact detail.",
  parametersJsonSchema: { type: "object", properties: { childName: childNameParam } },
  execute: async (args, context) => {
    if (!context?.userId) return NOT_LINKED;
    const result = await getChildrenDetail(
      context.userId,
      typeof args.childName === "string" ? args.childName : undefined
    );
    if (!result.found) {
      return {
        linked: true,
        childrenOnAccount: result.childrenOnAccount,
        instruction: NAME_NOT_ON_ACCOUNT,
      };
    }
    if (result.items.length === 0) {
      return {
        linked: true,
        children: [],
        instruction:
          "No child has been added to this account yet. Say so, and that adding one at https://powermysport.com/dashboard lets you help with their sport.",
      };
    }
    return { linked: true, children: result.items };
  },
};

const getMySeasonPlanTool: ChatToolDefinition = {
  name: "get_my_season_plan",
  summary:
    "show a signed-in parent the tournaments on their child's season plan, with dates, status, their goal and blocked dates",
  example: "what is on my son's season plan",
  promptNote:
    "Costs are not returned: for what a season will cost, send the parent to https://powermysport.com/planner. A parent with no plan has not started one: say so and point there.",
  description:
    "Read the season plans the parent built on the PowerMySport planner: for each child and sport, the tournaments they shortlisted, entered or played, soonest first, plus the plan's goal (points, experience or home) and any dates they blocked, such as exams. Use when a parent asks what is on their plan, what they have already entered, or which dates are blocked. For events the child can still enter, use get_upcoming_tournaments instead.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      childName: childNameParam,
      sportSlug: {
        type: "string",
        description: "URL slug for the sport, e.g. 'tennis'. Omit for all.",
      },
    },
  },
  execute: async (args, context) => {
    if (!context?.userId) return NOT_LINKED;
    const sportSlug =
      typeof args.sportSlug === "string" && args.sportSlug.trim()
        ? args.sportSlug.trim().toLowerCase()
        : undefined;
    const result = await getSeasonPlans(context.userId, {
      ...(typeof args.childName === "string" ? { childName: args.childName } : {}),
      ...(sportSlug ? { sportSlug } : {}),
    });
    if (!result.found) {
      return {
        linked: true,
        childrenOnAccount: result.childrenOnAccount,
        instruction: NAME_NOT_ON_ACCOUNT,
      };
    }
    if (result.items.length === 0) {
      return {
        linked: true,
        plans: [],
        instruction:
          "There is no season plan yet. Say so, and that they can start one at https://powermysport.com/planner.",
      };
    }
    return { linked: true, plans: result.items };
  },
};

// ─── get_my_guidance_plan / get_my_sessions ─────────────────────────────────────

const getMyGuidancePlanTool: ChatToolDefinition = {
  name: "get_my_guidance_plan",
  summary:
    "read back the AI development plan a parent already generated for their child: goal verdict, weekly blueprint, journey phases and recommended sports",
  example: "what was the plan you made for my son",
  promptNote:
    "This is the plan the parent already has, written by an AI on the guidance page. Quote it, do not rewrite it, and give its cost lines as the plan's estimates. For a new or updated plan, point to https://powermysport.com/guidance. A child with no plan has not made one yet: say so.",
  description:
    "Read the parent's most recent AI development plan for each child: the goal and the verdict on it, the weekly training blueprint, the journey phases, recommended sports, burnout risk and the plan's own cost estimates. Use when a parent asks what their plan says, what the weekly blueprint was, or what was recommended. It returns only plans already made; to make a new one use prepare_guidance_plan, or the parent can use https://powermysport.com/guidance.",
  parametersJsonSchema: { type: "object", properties: { childName: childNameParam } },
  execute: async (args, context) => {
    if (!context?.userId) return NOT_LINKED;
    const result = await getGuidancePlans(
      context.userId,
      typeof args.childName === "string" ? args.childName : undefined
    );
    if (!result.found) {
      return {
        linked: true,
        childrenOnAccount: result.childrenOnAccount,
        instruction: NAME_NOT_ON_ACCOUNT,
      };
    }
    if (result.items.length === 0) {
      return {
        linked: true,
        plans: [],
        instruction: planToolEnabled()
          ? "No AI plan has been made yet. Say so, and offer to make one here: use prepare_guidance_plan, which asks for anything still missing and then for a YES. They can also make one at https://powermysport.com/guidance."
          : "No AI plan has been made yet. Say so, and that they can make one at https://powermysport.com/guidance.",
      };
    }
    return { linked: true, plans: result.items };
  },
};

const getMySessionsTool: ChatToolDefinition = {
  name: "get_my_sessions",
  summary:
    "tell a signed-in parent about their booked expert consultations: who with, for which child, when, online or in person, and whether the expert has confirmed",
  example: "when is my next expert session",
  promptNote:
    "Times are Indian time. The meeting link, address and payment details are not returned: for those, send the parent to their dashboard at https://powermysport.com/dashboard. An expert who has not confirmed yet has not accepted the time, so say it is not confirmed.",
  description:
    "Read the parent's own expert consultations: upcoming sessions soonest first and the last few that ended or were cancelled, each with the expert's first name, the child it is for, the date and time in Indian time, the length, online or in person, and whether the expert has confirmed. Use when a parent asks about their booked sessions, when the next one is, or whether an expert accepted. These are one-to-one consultations, not regular coaching.",
  parametersJsonSchema: { type: "object", properties: {} },
  execute: async (_args, context) => {
    if (!context?.userId) return NOT_LINKED;
    const overview = await getSessionsOverview(context.userId);
    if (overview.upcoming.length === 0 && overview.recent.length === 0) {
      return {
        linked: true,
        upcoming: [],
        recent: [],
        instruction:
          "No expert session has been booked on this account. Say so, and that they can find an expert at https://powermysport.com/experts.",
      };
    }
    return { linked: true, ...overview };
  },
};

// ─── note_child_details / get_my_notes / forget_child_note ──────────────────────

const NOTES_NO_CHAT = {
  saved: false,
  reason: "no_chat",
  instruction: "Notes are only kept in a WhatsApp chat. Do not offer to remember anything here.",
} as const;

/**
 * Why notes cannot be used in this conversation, or null when they can. A number with an
 * account may keep notes too: they are never written to the account, only carried to it by the
 * link, which the parent confirms while signed in on the website.
 */
const notesUnavailable = (context?: ChatToolContext) => (context?.phoneHash ? null : NOTES_NO_CHAT);

const noteChildDetailsTool: ChatToolDefinition = {
  name: "note_child_details",
  summary:
    "remember the basics a new parent tells you about their child (first name, age, sport, level, goal, state) so they never have to repeat them, here or on the website",
  example: "my son Vikrant is 14 and plays tennis",
  promptNote:
    "Call it only when the parent has clearly said something about a child, never to guess. Then say in one short sentence what you noted and invite a correction. Never ask for a surname, date of birth, school or anything medical, and never save those.",
  description:
    "Save what the parent just told you about one child who is not yet on their PowerMySport profile (a parent with no account, or a child the account does not list). It is kept as a note, never added to the profile directly; the parent adds it from a link. Pass the child's FIRST name and only the facts the parent actually stated: age in years, the sports, a level (such as beginner, intermediate or advanced), a goal in their words, and the Indian state they live in. Calling it again for the same first name updates that child and keeps what was not mentioned. Pass the full current list of sports each time. Do not pass a surname, date of birth, school or medical detail. Up to four children can be noted.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      childName: { type: "string", description: "The child's first name, as the parent said it." },
      age: { type: "number", description: "Age in years, only if stated." },
      sports: {
        type: "array",
        items: { type: "string" },
        description: "Every sport the parent named for this child (at most three).",
      },
      level: {
        type: "string",
        description: "How experienced the child is, in a word or two, only if stated.",
      },
      goal: { type: "string", description: "What the parent wants for the child, in their words." },
      state: { type: "string", description: "The Indian state they live in, only if stated." },
    },
    required: ["childName"],
  },
  execute: async (args, context) => {
    const blocked = notesUnavailable(context);
    if (blocked) return blocked;
    // A child the account already lists needs no note. Checked here, not left to the prompt, so
    // a link never carries a child the parent already has.
    if (context!.userId) {
      const name = cleanFirstName(args.childName);
      if (name && (await childNamesOnAccount(context!.userId)).has(name.toLowerCase())) {
        return {
          saved: false,
          reason: "already_on_account",
          instruction: `${name} is already on this parent's profile, so there is nothing to note. Say so. To read what the profile holds, use get_my_children.`,
        };
      }
    }
    const result = await saveChildNote(context!.phoneHash!, {
      childName: String(args.childName ?? ""),
      age: args.age,
      sports: args.sports,
      level: args.level,
      goal: args.goal,
      state: args.state,
    });
    if (!result.saved) {
      return {
        saved: false,
        reason: result.reason,
        instruction:
          result.reason === "no_name"
            ? "Not saved. Ask for the child's first name."
            : "Not saved: only four children can be noted for one number. Say so, and that the others can be added when they create their profile on https://powermysport.com.",
      };
    }
    return {
      saved: true,
      created: result.created,
      noted: presentChild(result.child),
      instruction:
        "Tell the parent in one short sentence what you noted, and that they can correct it. Do not read back anything that was not saved.",
    };
  },
};

const createProfileLinkTool: ChatToolDefinition = {
  name: "create_profile_link",
  summary:
    "send a new parent a one-time link that carries what they told you about their child onto their PowerMySport profile, so they do not repeat it",
  example: "yes, send me the link to save this on my profile",
  promptNote:
    "Call it only after the parent says yes to saving their details on a profile. Send the link on its own line, say nothing is saved to a profile until they confirm on the website, and that the link works for a week. Never call it for a parent who has nothing noted.",
  description:
    "Make a one-time link, valid for seven days, that opens the PowerMySport website with the details noted in this chat ready to review and add to a new profile. Call it only when the parent has agreed. It returns the link to send. A newer link replaces the older one. If nothing has been noted yet it says so; note the child first.",
  parametersJsonSchema: { type: "object", properties: {} },
  execute: async (_args, context) => {
    const blocked = notesUnavailable(context);
    if (blocked) return blocked;
    const result = await createProfileLink(context!.phoneHash!);
    if (!result.created) {
      return {
        created: false,
        reason: result.reason,
        instruction:
          "Nothing has been noted yet, so there is nothing to carry over. Ask about their child first, and offer the link once you have a name, an age and a sport.",
      };
    }
    return {
      created: true,
      link: result.url,
      daysValid: result.days,
      instruction:
        "Send the link on its own line. Tell the parent it opens a page where they review these details, add each child's date of birth and create or sign in to their profile, that nothing is saved to a profile until they confirm there, and that the link works for a week.",
    };
  },
};

const getMyNotesTool: ChatToolDefinition = {
  name: "get_my_notes",
  summary: "show a parent what you have noted about their children so far",
  example: "what do you remember about my son",
  description:
    "Read back what has been noted about this parent's children in this WhatsApp chat. Use when the parent asks what you remember or know about their child or children. It returns only what the parent told you.",
  parametersJsonSchema: { type: "object", properties: {} },
  execute: async (_args, context) => {
    const blocked = notesUnavailable(context);
    if (blocked) return blocked;
    const children = (await getNotes(context!.phoneHash!)).map((child) => presentChild(child));
    if (children.length === 0) {
      return {
        children: [],
        instruction:
          "Nothing has been noted yet. Say so, and that if they tell you about their child you will remember the basics.",
      };
    }
    return {
      children,
      instruction: 'Read these back briefly. Say they can ask you to "forget" a child any time.',
    };
  },
};

const forgetChildNoteTool: ChatToolDefinition = {
  name: "forget_child_note",
  summary: "remove what you noted about one child, or everything, when the parent asks",
  example: "forget Vikrant",
  promptNote:
    "Call it only on a clear request to forget or remove. Removing is permanent, so say exactly what was removed.",
  description:
    "Delete what was noted about one child (pass childName) or about all children (pass everything true). Call it only when the parent clearly asks to forget, remove or delete. If they ask to stop everything and delete the chat, that is a separate instruction (STOP) that they send themselves.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      childName: { type: "string", description: "First name of the child to forget." },
      everything: {
        type: "boolean",
        description: "True only when the parent asked to forget every child.",
      },
    },
  },
  execute: async (args, context) => {
    const blocked = notesUnavailable(context);
    if (blocked) return blocked;
    const phoneHash = context!.phoneHash!;
    if (args.everything === true) {
      const removed = await forgetAllNotes(phoneHash);
      return {
        removed: removed > 0 ? "everything" : "nothing",
        instruction:
          removed > 0
            ? "Tell the parent everything you had noted is deleted."
            : "Nothing had been noted. Say so.",
      };
    }
    const name = typeof args.childName === "string" ? args.childName : "";
    if (!name.trim()) {
      return { removed: "nothing", instruction: "Ask which child they want removed." };
    }
    const removed = await forgetChild(phoneHash, name);
    return removed > 0
      ? { removed: name, instruction: `Tell the parent you have removed ${name} and nothing else.` }
      : {
          removed: "nothing",
          instruction: "No child by that name was noted. Say so, and offer to show what you have.",
        };
  },
};

// ─── prepare_guidance_plan / confirm_pending_action ─────────────────────────────

const prepareGuidancePlanTool: ChatToolDefinition = {
  name: "prepare_guidance_plan",
  summary:
    "set up a personalised development plan for a child from their profile, asking only for what is missing, before making it",
  example: "can you make a development plan for my son",
  promptNote:
    "This only prepares: it makes nothing and costs nothing. Ask the parent one question at a time, say back what you will make and what you assumed, and ask them to reply YES. Never say a plan is made until confirm_pending_action says created.",
  description:
    "Start making an AI development plan (training blueprint, journey phases, goal verdict, burnout check) for one of the parent's children. It fills the request from the child's profile and tells you what is still missing: ask the parent ONE of those questions, then call this again with the answer in the matching field. When nothing is missing it saves the request and tells you to ask the parent to reply YES. Pass childName when they name a child. It never makes the plan itself: confirm_pending_action does, after the parent says yes.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      childName: { type: "string", description: "First name of the child, when named." },
      sport: { type: "string", description: "The sport, only if the parent named it." },
      gender: { type: "string", description: "'boy' or 'girl', only if the parent said." },
      ambition: {
        type: "string",
        description: "'fun', 'competitive', 'national' or 'career', only if the parent said.",
      },
      experienceLevel: {
        type: "string",
        description: "'beginner', 'intermediate' or 'competitive', only if the parent said.",
      },
      weeklyHours: { type: "number", description: "Hours a week they train, only if stated." },
      question: {
        type: "string",
        description: "What the parent wants the plan to help with, in their words.",
      },
      skipOptionalQuestions: {
        type: "boolean",
        description: "True only when the parent said to skip the optional questions.",
      },
    },
  },
  execute: async (args, context) => prepareGuidancePlan(context, args),
};

const prepareSeasonPlanEntryTool: ChatToolDefinition = {
  name: "prepare_season_plan_entry",
  summary:
    "set up putting a tournament on a child's season plan, checking it against what the child can enter, before adding it",
  example: "add the Pune tournament to my son's season plan",
  promptNote:
    "This only prepares: it adds nothing. Say back which event and any caveats it returns, say it only shortlists (entering is done on the website), and ask the parent to reply YES. Never say it is added until confirm_pending_action says done.",
  description:
    "Start adding an upcoming tournament to one of the parent's children's season plans. Pass the tournament's name or place as the parent said it, and childName when they name a child. It finds the one event (or tells you to ask which of up to three), refuses an event the child cannot enter or that is already on the plan, and notes anything to check, such as playing up or no linked ranking. When it is ready it saves what it would do and tells you to ask the parent to reply YES. It only ever shortlists; it never marks an event entered. It never adds anything itself: confirm_pending_action does, after the parent says yes.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      tournament: {
        type: "string",
        description:
          "The tournament's name or place as the parent said it, or its slug when you are passing back the one they chose.",
      },
      childName: { type: "string", description: "First name of the child, when named." },
      note: {
        type: "string",
        description: "A short note for the entry, only if the parent asked for one.",
      },
    },
    required: ["tournament"],
  },
  execute: async (args, context) => prepareSeasonEntry(context, args),
};

const confirmPendingActionTool: ChatToolDefinition = {
  name: "confirm_pending_action",
  summary: "carry out what you set up for the parent, once they have replied YES",
  example: "yes, go ahead",
  promptNote:
    "Call it only in your reply to the parent's YES, never in the same reply that set the action up. If it says the message was not a clear yes, ask again and do nothing. Say what was done in a few short lines; never claim anything was done until it says so.",
  description:
    "Do the action that a prepare tool (prepare_guidance_plan or prepare_season_plan_entry) set up and the parent has since agreed to. Call it only after the parent has replied with a clear yes to your question. It checks their message itself and refuses otherwise, so do not call it to find out. What it does depends on what was set up: for a development plan it makes and saves the plan (about half a minute, using the daily plan allowance) and returns a short summary and the link to the full plan; for a season-plan entry it shortlists the tournament and returns the link to the planner. Only one action waits at a time.",
  parametersJsonSchema: { type: "object", properties: {} },
  execute: async (_args, context) => confirmPendingAction(context),
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
    // The enquiry record is for the pilot review: it must never undo a request that was sent.
    let reference: string | undefined;
    if (context?.phoneHash) {
      try {
        reference = await markFollowUpRequested(context.phoneHash, context.userMessage ?? "", {
          summary: args.summary,
          ticketId: result.ticketId,
        });
      } catch (error) {
        log.error("could not record the follow-up on the enquiry", error);
      }
    }
    return {
      sent: true,
      ...(reference ? { reference } : {}),
      instruction: `Passed on. Tell the parent the team will reply to the email they gave, usually within 24 hours.${
        reference ? ` Give them the reference ${reference} to quote.` : ""
      } Do not promise anything more.`,
    };
  },
};

// ─── record_enquiry ─────────────────────────────────────────────────────────────

const recordEnquiryTool: ChatToolDefinition = {
  name: "record_enquiry",
  summary:
    "keep a short record of what this parent is asking about, for the PowerMySport team's review (never shown to the parent)",
  example: "my daughter is 11 and wants to start badminton",
  promptNote:
    "Call it quietly, without telling the parent, whenever they give or change the child's age, sport or level, say what they want, ask for coaches, tournaments, an expert or the team, say thanks or that it did not help, or say they are done. Pass only what they actually said. It returns nothing to read out, so carry on with your answer.",
  description:
    "Record, for the team's review of the WhatsApp pilot, what this parent is asking about on the current topic. Pass only facts the parent stated: the child's age in years, the sport, a level in a word or two, what they want in a short phrase, which kinds of help they asked for (coach, tournaments, expert, team, other), whether the answer helped (helpful or not_helpful) and closed true when they say they are done. Fields you leave out keep their value. It is not shown to the parent and needs no mention.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      childAge: { type: "number", description: "The child's age in years, only if stated." },
      sport: { type: "string", description: "The sport, in one or two words." },
      level: { type: "string", description: "The child's level, only if stated." },
      objective: {
        type: "string",
        description: "What the parent wants, in a short phrase of their words.",
      },
      assistance: {
        type: "array",
        items: { type: "string", enum: ["coach", "tournaments", "expert", "team", "other"] },
        description: "Kinds of help the parent asked for.",
      },
      feedback: {
        type: "string",
        enum: ["helpful", "not_helpful"],
        description: "Only if the parent said whether the answer helped.",
      },
      closed: { type: "boolean", description: "True only when the parent says they are done." },
    },
  },
  execute: async (args, context) => {
    if (!context?.phoneHash) return { recorded: false };
    try {
      await updateEnquiry(context.phoneHash, context.userMessage ?? "", {
        childAge: args.childAge,
        sport: args.sport,
        level: args.level,
        objective: args.objective,
        assistance: args.assistance,
        feedback: args.feedback,
        closed: args.closed,
      });
      return { recorded: true, instruction: "Done. Say nothing about it and carry on." };
    } catch (error) {
      log.error("could not record the enquiry", error);
      return { recorded: false, instruction: "Not recorded. Say nothing about it and carry on." };
    }
  },
};

// ─── offer_next_steps ───────────────────────────────────────────────────────────

const offerNextStepsTool: ChatToolDefinition = {
  name: "offer_next_steps",
  summary:
    "show the parent a tappable list of next steps (find a coach, explore tournaments, speak to an expert, ask more, or finish) under your answer",
  example: "which sport should my 9 year old start with?",
  promptNote:
    "Call it once, after you have given personalised guidance about their child, never for a greeting, a plain lookup, a thank you, or when your answer ends in a question you need answered first. The list appears under your answer on its own, so do not list or describe those options yourself and do not ask whether they want help with the next step.",
  description:
    "Ask the WhatsApp service to show the parent a tappable list of next steps right after your answer: help finding a coach or academy, exploring tournaments, speaking to an expert, asking another question, or finishing. Call it in the same turn as the guidance it follows. It sends nothing itself and returns nothing to read out.",
  parametersJsonSchema: { type: "object", properties: {} },
  execute: async (_args, context) => {
    if (!context?.outbound) return { shown: false };
    context.outbound.nextSteps = true;
    return {
      shown: true,
      instruction:
        "The list will appear under your answer. Do not mention or list the options. End your answer naturally.",
    };
  },
};

// ─── request_whatsapp_followup ──────────────────────────────────────────────────

const requestWhatsappFollowupTool: ChatToolDefinition = {
  name: "request_whatsapp_followup",
  summary:
    "ask the PowerMySport team to get back to the parent here on WhatsApp, for a person to talk to or for help you cannot give from this chat, once the parent has agreed",
  example: "can someone from your team talk to me about academies",
  promptNote:
    "When the parent wants to talk to a person, or wants help you cannot give here, first ask in one short sentence whether they would like the team to get back to them here on WhatsApp, and wait for a clear yes. Never ask for an email address, a phone number or any other detail, and never call it on a vague request. When it works, tell them the team will get back to them here on WhatsApp and give the reference. Do not promise a time.",
  description:
    "Ask the PowerMySport team to follow up with this parent on this WhatsApp chat. Call it ONLY after the parent has clearly agreed to have the team get back to them here. kind is what they need: coach (a coach or academy), expert (an expert consultation), tournaments, team (a person to talk to) or other. summary says what they want in one or two plain sentences, in English, without any medical, ID or payment details. It cannot be undone and it reaches a real person. Asking again for the same help on the same topic changes nothing and returns the same reference.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["coach", "expert", "tournaments", "team", "other"],
        description: "What kind of help the parent wants from the team.",
      },
      summary: {
        type: "string",
        description:
          "What the parent wants help with, in one or two plain sentences, in English, without medical, ID or payment details.",
      },
      parentAgreed: {
        type: "boolean",
        description:
          "True only if the parent has clearly said yes to having the team get back to them on WhatsApp. False or omitted otherwise.",
      },
    },
    required: ["kind", "summary", "parentAgreed"],
  },
  execute: async (args, context) => {
    if (!context?.phoneHash) {
      return {
        sent: false,
        instruction:
          "This is not available here. Give https://powermysport.com/contact so they can reach the team.",
      };
    }
    // A model decides when to call this, so the agreement is checked here and not trusted to it.
    if (args.parentAgreed !== true) {
      return {
        sent: false,
        instruction:
          "Not sent. Ask whether they would like the team to get back to them here on WhatsApp and wait for a clear yes, then call again with parentAgreed true.",
      };
    }
    const kinds = ["coach", "expert", "tournaments", "team", "other"] as const;
    const kind = kinds.find((k) => k === args.kind) ?? "team";
    try {
      const result = await requestFollowUp(context.phoneHash, context.userMessage ?? "", {
        kind,
        summary: args.summary,
      });
      return {
        sent: true,
        reference: result.reference,
        alreadyRequested: result.alreadyRequested,
        instruction: `${
          result.alreadyRequested ? "It was already with the team. " : "Passed on. "
        }Tell the parent the team will get back to them here on WhatsApp, and give the reference ${
          result.reference
        } to quote. Do not promise a time or anything more.`,
      };
    } catch (error) {
      log.error("could not record the WhatsApp follow-up", error);
      return {
        sent: false,
        instruction:
          "It could not be passed on just now. Say so, and give https://powermysport.com/contact.",
      };
    }
  },
};

// ─── Per-persona tool sets ──────────────────────────────────────────────────────

export const ASSISTANT_CHAT_TOOLS: ChatToolDefinition[] = [
  searchExpertsTool,
  getExpertDetailsTool,
  getPathwayStageTool,
  getUpcomingTournamentsTool,
  getChildRankingTool,
  getMyChildrenTool,
  getMySeasonPlanTool,
  getMyGuidancePlanTool,
  getMySessionsTool,
  prepareGuidancePlanTool,
  prepareSeasonPlanEntryTool,
  confirmPendingActionTool,
  noteChildDetailsTool,
  createProfileLinkTool,
  getMyNotesTool,
  forgetChildNoteTool,
  getTournamentDetailsTool,
  requestTeamFollowupTool,
  recordEnquiryTool,
  offerNextStepsTool,
  requestWhatsappFollowupTool,
];

/** Only meaningful on WhatsApp: they act on a chat the website does not have. */
const WHATSAPP_ONLY_TOOLS = new Set([
  "record_enquiry",
  "offer_next_steps",
  "request_whatsapp_followup",
]);

/**
 * The website asks for an email address to hand a question to the team; WhatsApp already has the
 * parent's number and asks for nothing. Each channel is shown only its own way, so the model never
 * has two ways to do the same thing.
 */
export const WEB_CHAT_TOOLS: ChatToolDefinition[] = ASSISTANT_CHAT_TOOLS.filter(
  (tool) => !WHATSAPP_ONLY_TOOLS.has(tool.name)
);
export const WHATSAPP_CHAT_TOOLS: ChatToolDefinition[] = ASSISTANT_CHAT_TOOLS.filter(
  (tool) => tool.name !== "request_team_followup"
);
