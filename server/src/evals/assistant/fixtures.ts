/**
 * Stand-ins for what the assistant's tools return, so a run never reads a database.
 *
 * Everything here is invented: the experts are not real people and the dates are not real
 * events. What matters to the evaluation is the shape the model receives and how it uses
 * it, not whether the facts are true. Keeping them fixed also means a changed answer is a
 * change in the assistant, not in the data.
 */

import type { ParentContext } from "../../shared/services/parentContext";

/** The account block a known parent's prompt carries in a "knownParent" case. */
export const FIXTURE_PARENT_CONTEXT: ParentContext = {
  parent: { firstName: "Meera", city: "Pune" },
  children: [
    {
      firstName: "Aarav",
      age: 13,
      sports: ["Tennis"],
      yearsPlaying: 3,
      level: "intermediate",
      ambition: "competitive",
      state: "Maharashtra",
      ranking: { sport: "tennis", list: "Boys U-14", rank: 212 },
    },
  ],
  moreChildren: 0,
  plannedEvents: 2,
  upcomingSessions: 1,
};

const EXPERTS = [
  {
    name: "Asha Verma",
    city: "Bangalore",
    sports: ["Badminton"],
    sessionFee: 800,
    sessionMode: "ONLINE",
    rating: 4.8,
    reviewCount: 31,
  },
  {
    name: "Rohit Menon",
    city: "Pune",
    sports: ["Football", "Fitness"],
    sessionFee: 600,
    sessionMode: "ONLINE",
    rating: 4.6,
    reviewCount: 18,
  },
  {
    name: "Kavya Nair",
    city: "Mumbai",
    sports: ["Tennis"],
    sessionFee: 1200,
    sessionMode: "ONLINE",
    rating: 4.9,
    reviewCount: 44,
  },
];

const STAGES = [
  { stage: 1, name: "Exploring", ageRange: "5 to 8", coreQuestion: "Does my child enjoy it?" },
  {
    stage: 2,
    name: "Learning the game",
    ageRange: "8 to 10",
    coreQuestion: "Is the basic technique sound?",
  },
  {
    stage: 3,
    name: "First competition",
    ageRange: "10 to 12",
    coreQuestion: "Is my child ready to compete?",
  },
];

export function fixtureFor(tool: string, args: Record<string, unknown>): unknown {
  switch (tool) {
    case "search_experts": {
      const sport = String(args.sport ?? "").toLowerCase();
      const search = String(args.search ?? "").toLowerCase();
      const hits = EXPERTS.filter(
        (e) =>
          (!sport || e.sports.some((s) => s.toLowerCase() === sport)) &&
          (!search || `${e.city} ${e.name} ${e.sports.join(" ")}`.toLowerCase().includes(search))
      );
      // A narrow search that finds nobody would hide whether the model used the result, so
      // fall back to everyone: this evaluates the reply, not the search.
      const experts = hits.length > 0 ? hits : EXPERTS;
      return { totalMatches: experts.length, experts };
    }
    case "get_pathway_stage": {
      const sportName = String(args.sportSlug ?? "the sport");
      if (args.stage != null) {
        const stage = STAGES.find((s) => s.stage === Number(args.stage)) ?? STAGES[0]!;
        return {
          sportName,
          stage: {
            order: stage.stage,
            name: stage.name,
            ageRange: stage.ageRange,
            whatItMeans: "A stage for building the basics and a love of the game.",
            nextSteps: ["Keep sessions short and fun", "Try a first friendly match"],
          },
        };
      }
      return { sportName, intro: [], stages: STAGES };
    }
    case "get_upcoming_tournaments":
      return {
        personalised: false,
        note: "This is the general calendar, not filtered for any child's age group or rank. Say so, and mention that linking a ranking at /planner shows which events a child can actually enter.",
        tournaments: [
          {
            name: "District Junior Open",
            startDate: "2026-11-14",
            city: "Pune",
            ageGroups: ["Under-12", "Under-14"],
          },
          {
            name: "State Junior Championship",
            startDate: "2026-12-05",
            city: "Mumbai",
            ageGroups: ["Under-14"],
          },
        ],
      };
    case "get_child_ranking":
      return {
        linked: true,
        children: [
          {
            child: "Aarav",
            sport: "tennis",
            lists: [
              {
                list: "Boys U-14",
                rank: 212,
                points: 96,
                listPublished: "2026-10-12",
                movedUpPlaces: 9,
              },
            ],
          },
        ],
      };
    case "get_my_children":
      return {
        linked: true,
        children: [
          {
            child: "Aarav",
            age: 13,
            committedSport: "Tennis",
            sportsInFocus: ["Tennis"],
            consideringSports: ["Badminton", "Squash"],
            assessmentMatches: [
              { sport: "Tennis", fit: "Strong fit" },
              { sport: "Badminton", fit: "Good fit" },
            ],
            yearsPlaying: 3,
            level: "intermediate",
            ambition: "competitive",
            state: "Maharashtra",
          },
        ],
      };
    case "get_my_season_plan":
      return {
        linked: true,
        plans: [
          {
            child: "Aarav",
            sport: "tennis",
            goal: "points",
            datesBlocked: [{ from: "2026-12-01", to: "2026-12-15", label: "Board exams" }],
            tournaments: [
              { name: "AITA CS7 (Pune)", starts: "2026-11-14", status: "entered" },
              { name: "AITA CS6 (Mumbai)", starts: "2027-01-09", status: "shortlisted" },
            ],
          },
        ],
      };
    case "note_child_details":
      return {
        saved: true,
        created: true,
        noted: {
          child: String(args.childName ?? "Vikrant"),
          ...(args.age ? { age: String(args.age) } : {}),
          ...(Array.isArray(args.sports) && args.sports.length ? { sports: args.sports } : {}),
        },
        instruction:
          "Tell the parent in one short sentence what you noted, and that they can correct it. Do not read back anything that was not saved.",
      };
    case "create_profile_link":
      return {
        created: true,
        link: "https://powermysport.com/start?t=eyJoIjoiZXhhbXBsZSJ9.c2lnbmF0dXJl",
        daysValid: 7,
        instruction:
          "Send the link on its own line. Tell the parent it opens a page where they review these details, add each child's date of birth and create or sign in to their profile, that nothing is saved to a profile until they confirm there, and that the link works for a week.",
      };
    case "prepare_guidance_plan":
      return {
        ready: true,
        child: "Aarav",
        sport: "Tennis",
        age: 13,
        assumptions: ["a moderate budget"],
        instruction:
          "Tell the parent what you are about to make: a development plan for Aarav in Tennis, assuming a moderate budget (they can correct any of these). Say it takes about half a minute and is saved to their account. Ask them to reply YES to go ahead. Do NOT call confirm_pending_action until they have replied.",
      };
    case "prepare_season_plan_entry":
      return {
        ready: true,
        child: "Aarav",
        event: { name: "AITA CS7 (Pune)", starts: "2026-11-14", where: "Pune, Maharashtra" },
        caveats: [],
        instruction:
          "Tell the parent you are about to shortlist AITA CS7 (Pune) in Pune, Maharashtra, starting 2026-11-14, on Aarav's season plan. Say that this only shortlists it; entering is done on the website. Ask them to reply YES to go ahead. It is NOT added yet. Do NOT call confirm_pending_action until they have replied.",
      };
    case "confirm_pending_action":
      return {
        done: true,
        created: true,
        plan: {
          child: "Aarav",
          sport: "Tennis",
          madeOn: "2026-10-23",
          goal: { verdict: "Ambitious" },
          weeklyBlueprint: {
            trainingHours: "6 hours of structured training",
            freePlayHours: "2 hours of free play",
            restDays: "1 full rest day",
          },
          recommendedSports: ["Tennis"],
          burnoutRisk: { level: "low" },
          journey: [{ title: "Build the base", timeframe: "0 to 6 months" }],
        },
        assumptions: ["a moderate budget"],
        link: "https://powermysport.com/guidance",
        instruction:
          "The plan is made and saved to their account. Summarise it in a few short lines: the verdict on the goal, the weekly blueprint, the first phase or two, and the burnout note. Say the full plan, with its PDF, is saved in their plan history at the link, on its own line. Do not paste the whole plan.",
      };
    case "get_my_notes":
      return {
        children: [{ child: "Vikrant", age: "14", sports: ["Tennis"], goal: "state level" }],
        instruction: 'Read these back briefly. Say they can ask you to "forget" a child any time.',
      };
    case "forget_child_note":
      return {
        removed: args.everything === true ? "everything" : String(args.childName ?? "Vikrant"),
        instruction: "Tell the parent exactly what was removed and nothing else.",
      };
    case "get_my_guidance_plan":
      return {
        linked: true,
        plans: [
          {
            child: "Aarav",
            sport: "Tennis",
            madeOn: "2026-10-02",
            goal: { stated: "Play state level", verdict: "Ambitious" },
            weeklyBlueprint: {
              trainingHours: "6 hours of structured training",
              freePlayHours: "2 hours of free play",
              restDays: "1 full rest day",
            },
            recommendedSports: ["Tennis", "Badminton"],
            burnoutRisk: { level: "medium", message: "Keep one full rest day each week." },
            journey: [{ title: "Build the base", timeframe: "0 to 6 months" }],
          },
        ],
      };
    case "get_my_sessions":
      return {
        linked: true,
        upcoming: [
          {
            with: "Rohan",
            forChild: "Aarav",
            when: "28 Oct 2026, 6:00 PM",
            minutes: 45,
            mode: "online",
            status: "confirmed by the expert",
          },
        ],
        recent: [],
      };
    case "get_tournament_details":
      return {
        found: true,
        moreMatches: false,
        note: "Dates come from the federation's calendar and can change. Fees are in Indian rupees.",
        tournaments: [
          {
            name: "District Junior Open (Delhi)",
            sport: "tennis",
            starts: "2026-11-14",
            ends: "2026-11-20",
            city: "Delhi",
            state: "Delhi",
            venue: "Siri Fort Sports Complex",
            ladder: "Championship Series",
            ageGroups: ["Under-12", "Under-14"],
            entriesOpen: "2026-10-01",
            entriesClose: "2026-11-02",
            entriesCloseAt: "23:59",
            entriesClosed: false,
            withdrawalDeadline: "2026-11-09",
            feeSinglesRupees: 700,
            feeDoublesRupees: 900,
            tournamentPage: "https://powermysport.com/tournaments/district-junior-open-delhi",
            officialPage: "https://example.test/official/district-junior-open-delhi",
          },
        ],
      };
    case "request_team_followup": {
      const email = typeof args.email === "string" ? args.email : "";
      const agreed = args.parentAgreed === true;
      if (!agreed) return { sent: false, instruction: "Not sent. Ask for a clear yes first." };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return { sent: false, instruction: "Not sent. That email does not look right." };
      }
      return {
        sent: true,
        instruction:
          "Passed on. Tell the parent the team will reply to the email they gave, usually within 24 hours. Do not promise anything more.",
      };
    }
    default:
      return { error: `no fixture for ${tool}` };
  }
}
