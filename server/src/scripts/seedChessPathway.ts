/**
 * Seed the Chess pathway from the contributed parent's guide.
 *
 *   npx tsx -r dotenv/config src/scripts/seedChessPathway.ts            # draft
 *   npx tsx -r dotenv/config src/scripts/seedChessPathway.ts --publish  # live
 *
 * Draft by default, like the Tennis seed and for the same reason: publishing
 * puts six stages in front of parents, and that should be a deliberate act
 * rather than a side effect of running a script.
 *
 * Idempotent — upserts on sportSlug and rewrites the stages, so correcting this
 * file and re-running republishes the correction. That also means re-running it
 * DISCARDS prose edits made in the CMS since the last run.
 *
 * ── Where this deviates from the source document ──
 *
 * The content is "Chess pathway in India — A parent's guide", contributed by
 * Lalit Akhade of ChessMates Academy. Three deliberate departures from it:
 *
 *  1. FIDE Master is stated here as rating-only (2300). The source says "2300
 *     plus one norm", which is wrong — FIDE requires norms for IM and GM, not
 *     for CM or FM. A parent planning a norm campaign off the original wording
 *     would waste a season, so the correct rule is seeded and the contributor
 *     should confirm before this is published.
 *  2. The source names "MSSA" as Maharashtra's chess association. MSSA is the
 *     Mumbai Schools Sports Association; the state chess body is a different
 *     organisation. Rather than assert an unverified replacement, the state
 *     association is referred to generically throughout.
 *  3. Stage 1's "which coach or academy" decision pitched the contributor's own
 *     academy by name, and the document closes with a personal mobile number.
 *     Both are dropped: the credit lives in the guide's `contributor` byline,
 *     which renders on every stage and routes a parent through our own booking
 *     flow rather than to a phone number we would be publishing on their behalf.
 *
 * Everything else is the contributor's own words, lightly trimmed to fit the
 * five-bucket format.
 */

import mongoose from "mongoose";

import { PathwayGuide } from "../shared/models/PathwayGuide";
import {
  PATHWAY_FORMAT_VERSION,
  parsePathwayGuide,
  type PathwayGuideInput,
} from "../shared/validation/pathwayGuideFormat";

// The same chips on every stage, as with Tennis — the help a parent can reach
// for does not change with their child's age.
//
// No tournament chip and no equipment chip. The AICF calendar is reached from
// the federation band further down the same page, and a first chess set is a
// few hundred rupees from anywhere; sending a parent to /shop for one would be
// the pathway's only piece of advice that exists to sell something.
const HELP_LINKS = [
  { label: "Find academy", href: "/booking?tab=academies" },
  { label: "Find coach", href: "/booking?tab=coaches" },
  { label: "Book expert", href: "/booking?tab=experts" },
  { label: "Assessment", href: "/guidance" },
];

const SITUATIONAL_LEAD = "Your situation decides the step. Pick the line that describes you today.";

const GUIDE: PathwayGuideInput = {
  formatVersion: PATHWAY_FORMAT_VERSION,
  sport: { slug: "chess", name: "Chess" },
  intro: {
    eyebrow: "Chess pathway · for parents",
    headline: "Understand. Question. Observe. Decide. Act.",
    description:
      "Six stages, each answering five things: where you are, what you are probably worried about, what to watch for, what you may have to choose, and what to do now.",
  },
  sportIntro: [
    "Chess is one of the very few sports where India genuinely competes at the top of the world. Viswanathan Anand became World Champion five times, and Praggnanandhaa, Gukesh and Vaishali grew up in Indian cities, going to school and dealing with exams, and became world-class players in between.",
    "It is a two-player strategy game recognised by the International Olympic Committee and governed globally by FIDE. Beyond the official language, it teaches a child to think under pressure, handle losing with grace, and make decisions independently.",
    "The pathway runs from a first encounter with the pieces to national championships, FIDE-rated international events and, for a few, a professional career. Most children find a level somewhere in between, and that is completely fine.",
    "Chess also works alongside other sports. The focus, pattern recognition and emotional regulation it builds carry straight onto the tennis court or the football field.",
  ],
  contributor: {
    name: "Lalit Akhade",
    organisation: "ChessMates Academy",
    url: "https://chessmates.in",
    blurb:
      "Chess player and coach, teaching children aged 5 to 14 online and in person. Contributed this pathway in partnership with PowerMySport.",
    // His coach profile on the platform. The byline above renders with or
    // without this; the link only adds the photo, the verified badge and the
    // booking button, and the API drops all three if he ever stops being
    // bookable — see `pathwayContributorService`.
    //
    // NOTE: this id exists in the PRODUCTION database. Against dev it resolves
    // to nothing and the card falls back to the plain byline, which is the
    // intended degradation rather than a broken seed.
    profile: { type: "coach", id: "6a93c246021963df9a516dc4" },
  },
  stages: [
    // ── 1 ──────────────────────────────────────────────────────────────────
    {
      key: "discover-chess",
      name: "Discover Chess",
      ageRange: "~5–8",
      coreQuestion: "Should my child try chess?",
      overview:
        "Your child has just been introduced to chess, or you are thinking about introducing them. Nothing more is expected at this point. The only real job at this stage is to find out whether the child enjoys the game enough to want to keep playing. Don't think about ratings, tournaments, or coaches with fancy credentials yet.",
      questions: [
        {
          question: "Is chess suitable for my child?",
          answer:
            "Almost any child can enjoy chess at a basic level. The ones who tend to go further like puzzles, enjoy thinking before acting, and don't mind sitting still for 20–30 minutes. But even restless kids can fall in love with chess — the game has a way of pulling you in once you start seeing the patterns. At this age, curiosity matters far more than talent.",
        },
        {
          question: "At what age can my child start?",
          answer:
            "Children as young as 4 can learn, and plenty who start at 9 go on to become strong players. The sweet spot for most is 6 to 8 — old enough to remember the rules, young enough that habits form easily. Starting at 7 or 8 rather than 5 genuinely does not matter at this stage.",
        },
        {
          question: "What should the first 3 to 6 months look like?",
          answer:
            "Simple. Learn how each piece moves. Play lots of short games at home — even 10-minute games are fine. Introduce basic checkmate patterns like back-rank mates or simple two-piece mates. Don't worry about openings or strategy. The goal is to make the child comfortable with the board and enjoy the process.",
        },
        {
          question: "How often should my child play?",
          answer:
            "Two or three times a week, 30 to 45 minutes each time. Consistency beats intensity at this stage. A child who plays three times a week every week for six months will develop far better than one who plays every day for a month and then loses interest.",
        },
        {
          question: "What equipment do we need?",
          answer:
            "A basic wooden or plastic chess set — nothing expensive, a few hundred rupees is fine. A chess clock is completely optional at this point. The more useful tool is a free account on Chess.com Kids or Lichess, which have excellent puzzle exercises designed for children. Don't spend a lot of money until you know your child wants to continue.",
        },
        {
          question: "What should I expect from a coach?",
          answer:
            "At this stage, credentials matter less than personality. You want someone patient and warm who knows how to make chess fun for young children — stories about the pieces, mini-games, lots of encouragement. An unrated but experienced beginner coach can be better than a high-rated player who doesn't know how to work with kids.",
        },
        {
          question: "Can my child play other sports too?",
          answer:
            "Absolutely, and it's worth encouraging. Chess at this age doesn't need exclusivity and sits comfortably alongside any sport or activity. Children who play other sports often bring great physical discipline into their chess.",
        },
      ],
      signals: [
        {
          title: "Does the child want to come back?",
          detail:
            "That's the main one. If they're asking when the next session is, you're in good shape.",
        },
        {
          title: "Are they starting to spot patterns?",
          detail:
            "Even simple things — noticing that a piece is under attack, remembering where a piece can move without being told. Pattern recognition is the core of chess and it starts developing early.",
        },
        {
          title: "Do they accept losing without falling apart?",
          detail:
            "Chess is a sport where you lose regularly — even the world's best players lose. A child who can take a loss, reset, and try again has the right temperament for chess, and honestly for competitive sport in general.",
        },
        {
          title: "Are they interested outside sessions?",
          detail:
            "Setting up the board on their own, asking family members to play, trying puzzles on the app — these are excellent signs.",
        },
      ],
      decisions: [
        {
          title: "Which coach or academy?",
          detail:
            "Don't overthink this at Stage 1. Find someone your child likes and feels comfortable with, who teaches this age group regularly and makes the first months enjoyable rather than pressured.",
        },
        {
          title: "Online or offline?",
          detail:
            "Both work. Online is more flexible and gives access to better coaches regardless of where you live. Offline group classes are great for the social energy — kids enjoy playing against other kids in the room. Many families use both, and that's worth doing if you can.",
        },
        {
          title: "When do we start competing?",
          detail:
            "Not yet. Don't rush this. Competition has its place but Stage 1 is not it. Let the child build real comfort with the game first.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        {
          when: "Not started yet",
          action:
            "Find two or three trial options and let the child try a class or two before committing.",
        },
        {
          when: "Just started",
          action:
            "Give it a solid 3 to 6 months of regular sessions before drawing any conclusions.",
        },
        {
          when: "Enjoying it",
          action:
            "Talk to the coach about what a simple development plan looks like going forward.",
        },
        {
          when: "Not sure if it's clicking",
          action: "Speak to an experienced chess parent or coach rather than deciding on your own.",
        },
        {
          when: "Child clearly not enjoying it",
          action:
            "Don't force it. Chess will always be there. Try again in a year if interest resurfaces.",
        },
      ],
      primaryAction: { label: "Find a chess coach", href: "/booking?tab=coaches" },
      helpLinks: HELP_LINKS,
    },

    // ── 2 ──────────────────────────────────────────────────────────────────
    {
      key: "learn-and-develop",
      name: "Learn & Develop",
      ageRange: "~8–12",
      coreQuestion: "How do we build a real chess foundation?",
      overview:
        "Your child knows the rules and enjoys the game. Now the real work begins. This is the most important stage in a chess player's development — more than any other, what happens between 8 and 12 determines the ceiling. The focus shifts from just playing to actually studying: tactics, basic strategy, fundamental endgames, and the habit of analysing games after they're played.",
      questions: [
        {
          question: "How many hours a week does my child need?",
          answer:
            "Three to five hours a week, spread across coaching sessions, independent puzzle work and online games, is a healthy range for this age. More is fine if the child is asking for it; less is fine if academics or other activities are competing for time. Don't count hours, watch engagement — a child genuinely absorbed for three hours a week improves faster than one going through the motions for six.",
        },
        {
          question: "What should my child actually be learning?",
          answer:
            "Four things. Tactics — forks, pins, skewers, discovered attacks; there is no shortcut here. Basic opening principles — not 15 moves of memorised theory, but why we develop pieces, control the centre and castle early. Fundamental endgames — king and pawn, and basic rook endings. And game analysis: reviewing your own games, even briefly, after each session. That last one is what most kids skip, and it is what separates the ones who keep improving from the ones who plateau.",
        },
        {
          question: "Should my child join a chess club?",
          answer:
            "If there's one available, yes. Playing regularly against peers in a club environment is irreplaceable. The social side matters too, and kids push each other in ways coaches can't.",
        },
        {
          question: "What kind of coach do I need now?",
          answer:
            "At this stage the coach's rating and experience start to matter more. Look for someone rated at least 1800 FIDE or equivalent, with specific experience coaching children in this age group. Ask them how they structure a lesson. A good coach at Stage 2 doesn't just play games with your child — they teach tactics systematically, review games together, and track progress.",
        },
        {
          question: "Does online coaching actually work?",
          answer:
            "Yes, very well, especially combined with platforms like Chess.com or Lichess. Most of India's strongest junior players today train primarily online. The advantage is access to quality coaches regardless of your city; the disadvantage is losing some in-person social energy. For pure chess development, online is completely effective.",
        },
        {
          question: "What rating should my child aim for?",
          answer:
            "Be careful about setting rating targets at this stage — it creates the wrong pressure. As a rough reference, a child training consistently with good coaching would typically reach somewhere around 800 to 1200 FIDE by the end of this stage; on Chess.com rapid that might look like 1000 to 1500. Ratings at this age fluctuate a lot and are much less meaningful than the quality of the child's actual understanding.",
        },
      ],
      signals: [
        {
          title: "Tactical sharpness",
          detail:
            "Can the child solve two or three move puzzles reliably? This is the clearest sign that real chess development is happening.",
        },
        {
          title: "The analysis habit",
          detail:
            'Does the child review games after playing? Even five minutes of going back through a game asking "where did I go wrong?" is enormously valuable. If this habit forms early, the child will keep improving for years.',
        },
        {
          title: "Genuine competitive curiosity",
          detail:
            "Starting to ask about ratings, about other players, about tournaments — this is healthy and encouraging.",
        },
        {
          title: "Resilience when losing",
          detail:
            "At this stage kids start to care about results. A child who can lose a tough game, compose themselves and come back focused for the next one has something special.",
        },
        {
          title: "A real coach relationship",
          detail:
            "The coach should be setting goals, tracking progress and giving honest feedback. If sessions feel like casual games with no structure, it's worth a conversation about what the child is actually working on.",
        },
      ],
      decisions: [
        {
          title: "Should we increase training?",
          detail:
            "If the child is motivated and genuinely enjoying the progress, gradually moving toward five hours a week is fine. Just don't force extra sessions. Burnout at this stage is real and it derails promising young players regularly.",
        },
        {
          title: "Chess.com or Lichess?",
          detail:
            "Both. Chess.com has the largest community, excellent structured lessons and a safe kid-friendly environment. Lichess is free, integrates directly with the Stockfish engine for analysis, and has no subscription. Use Chess.com for daily puzzles and games, Lichess for analysis.",
        },
        {
          title: "When is the right time for the first rated tournament?",
          detail:
            "When the child can play a complete game confidently, understands special rules like castling and en passant, and — this part matters — is actually excited about competing rather than anxious. For most children that window opens between 9 and 11. Stage 3 covers this in detail.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        { when: "No coach yet", action: "Find a rated coach and start structured weekly lessons." },
        {
          when: "Doing puzzles but no coaching",
          action: "Add at least one weekly coached session.",
        },
        {
          when: "Training regularly",
          action: "Ask your coach for a clear curriculum with milestones you can track.",
        },
        {
          when: "Progress seems to have stalled",
          action:
            "Look honestly at the training quality — tactics and game analysis are usually what's missing.",
        },
        { when: "Ready to compete", action: "See Stage 3 — Compete & Assess." },
      ],
      primaryAction: { label: "Find a rated coach", href: "/booking?tab=coaches" },
      helpLinks: HELP_LINKS,
    },

    // ── 3 ──────────────────────────────────────────────────────────────────
    {
      key: "compete-and-assess",
      name: "Compete & Assess",
      ageRange: "~10–14",
      coreQuestion: "First tournaments, first rating — where do we actually stand?",
      overview:
        "This is where it gets real. Your child enters formal competition, earns their first official rating, and for the first time you get a clear, honest picture of where they stand relative to other children who are also taking chess seriously. It can be humbling. It can also be thrilling. This stage is less about winning and more about building tournament habits and understanding what serious chess actually looks like.",
      questions: [
        {
          question: "How do ratings work in India?",
          answer:
            "There are two systems. AICF — the All India Chess Federation — gives national ratings, earned by playing in AICF-affiliated tournaments across India. FIDE gives international ratings on the Elo scale, earned in FIDE-rated events. Your child will typically earn an AICF rating first, then a FIDE rating once they play in qualifying events. Ratings go up when you beat higher-rated players and down when you lose to lower-rated ones. A new player starts unrated and gets a first rating after a minimum number of games.",
        },
        {
          question: "What's a reasonable rating expectation in the first year?",
          answer:
            "For a 10 to 12 year old training regularly, reaching 1000 to 1200 AICF in the first year of rated play is realistic. But don't fixate on the number. Children rated 900 often have far better chess understanding than kids rated 1300 who have simply played more events. The rating finds its level over time.",
        },
        {
          question: "Which tournaments should we start with?",
          answer:
            "Start local and small. School-level tournaments are ideal — familiar faces, short travel, low pressure. District-level events are the next step. AICF and the state associations run age-category tournaments from Under-7 upward, and these are the formal competitive ladder. Don't jump straight to nationals: build district results first, then state, then national.",
        },
        {
          question: "How often should we travel for tournaments?",
          answer:
            "One to two tournaments a quarter is plenty when starting out. As your child progresses and develops the tournament habit, that naturally increases. Don't overload the calendar in year one — each tournament should feel like an event, not a chore.",
        },
        {
          question: "What does an actual tournament look like?",
          answer:
            "Most Indian chess tournaments run in Swiss format — seven to nine rounds over two to three days. Your child plays one game per round, typically with 60 to 90 minutes each on the clock plus a small increment per move. Results are reported to AICF and/or FIDE for rating calculations. It can be mentally exhausting; three days of intense concentration is a lot for a 10-year-old, and it's something you only really understand by experiencing it.",
        },
        {
          question: "How do we balance chess with school?",
          answer:
            "This is the question I get most at this stage, and the honest answer is that it's manageable. Most tournaments happen on weekends or during school breaks, and a child putting in five to seven hours of chess practice a week can absolutely maintain normal academics. Where it gets challenging is the inter-state and national level, where travel increases — that's a Stage 4 conversation.",
        },
      ],
      signals: [
        {
          title: "Tournament habits",
          detail:
            "Does the child prepare before an event, even briefly? Do they manage time on the clock without rushing or over-thinking? Do they review games after each round? These habits define a competitive chess player, and they take time to form.",
        },
        {
          title: "Rating direction",
          detail:
            "It doesn't need to shoot up, but it should generally trend upward across successive events. If it's flat or dropping despite regular training, that's a signal to look at the coaching quality, not to panic.",
        },
        {
          title: "Emotional regulation in a real competitive setting",
          detail:
            "There's a big difference between losing a practice game at home and losing in round five when you needed a win. A child who can compose themselves and play round six well after a bad loss has something most adults never develop.",
        },
        {
          title: "Whether they actually want this",
          detail:
            "Self-motivation is the most reliable predictor of long-term success in chess. A child who asks to go to the next tournament, who studies on their own, who talks about chess because they love it — that's worth more than any rating number.",
        },
      ],
      decisions: [
        {
          title: "Is it time to upgrade the coach?",
          detail:
            "If your child is showing real competitive interest and results are improving, yes — moving to a stronger coach, perhaps rated 2000+ FIDE or a titled player, will make a real difference now. Coaching quality starts to matter more as the stakes increase.",
        },
        {
          title: "State focus or national?",
          detail:
            "Stay state-focused at this stage. Build a consistent state ranking before thinking about nationals. Rushing to national events too early is a waste of money and can be discouraging.",
        },
        {
          title: "AICF registration",
          detail:
            "If you haven't done this yet, do it now. Your state chess association handles it, and it's required for any rated tournament in India. FIDE registration comes naturally when you play in FIDE-rated events — the organiser typically manages this for first-time participants.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        {
          when: "Haven't entered a tournament yet",
          action: "Register for the nearest school or district-level rated event.",
        },
        {
          when: "Just finished your first tournament",
          action: "Sit with the coach and go through every game, wins included.",
        },
        {
          when: "Rating is improving",
          action:
            "Set a clear target with the coach and plan the next 3 months of events and training.",
        },
        {
          when: "Results are inconsistent",
          action:
            "Look at time management on the clock and pre-tournament preparation — both are common weak points.",
        },
        {
          when: "Motivation seems to be dipping",
          action: "Have an honest conversation; the pressure may need adjusting.",
        },
      ],
      primaryAction: { label: "See the AICF calendar", href: "/federations/aicf?tab=calendar" },
      helpLinks: HELP_LINKS,
    },

    // ── 4 ──────────────────────────────────────────────────────────────────
    {
      key: "performance-and-decide",
      name: "Performance & Decide",
      ageRange: "~13–16",
      coreQuestion: "Is chess a serious pursuit for this child, or a lifelong passion?",
      overview:
        "This is the fork in the road. By now your child has played tournaments, has a rating, and has a real sense of where they stand in Indian junior chess. The question Stage 4 asks — and you have to answer honestly — is what chess is going to be for this child: a serious competitive pursuit with real training investment and potentially a career dimension, or a lifelong passion pursued at a comfortable level. Both are genuinely valuable outcomes. The mistake is refusing to answer the question and drifting without a decision.",
      questions: [
        {
          question: "What titles exist in chess and how does a player earn them?",
          answer:
            "FIDE awards titles in ascending order: Candidate Master (CM), FIDE Master (FM), International Master (IM) and Grandmaster (GM), with women's titles at each level. Each requires a minimum FIDE rating, and IM and GM additionally require a set of performance results called norms, achieved in FIDE-rated tournaments. AICF also awards the National Master (NM) title for reaching 2000 national rating. These titles are permanent once earned and are recognised globally.",
        },
        {
          question: "What ratings are needed for each title?",
          answer:
            "CM requires 2200 FIDE and FM requires 2300 — both on rating alone, with no norms. IM needs 2400 plus three IM norms. GM, the highest, needs 2500 plus three GM norms. For context: a player rated 1800 FIDE is already comfortably in the top 5% of rated players in India, and reaching 2000 is a serious achievement that only a small number of dedicated players ever manage.",
        },
        {
          question: "Can chess genuinely be a career?",
          answer:
            "Yes, and increasingly so in India. The options are: professional player (requires GM or strong IM level, very competitive), full-time coaching (solid income, especially with an online presence — the most accessible chess career for most strong players), content creation on YouTube or streaming, working within the AICF or state federation ecosystem, and corporate chess where companies hire titled players. Since 2023, India's chess explosion after Gukesh, Praggnanandhaa and the Olympiad gold has created genuine new demand for qualified coaches and chess educators.",
        },
        {
          question: "Does chess help with college admissions?",
          answer:
            "Yes. AICF-rated players with strong results can access sports quota admissions at many Indian universities. International achievements — FIDE titles, representing India at the Olympiad or World Youth — carry real weight, especially for applications abroad. If your child is aiming for a US university, college chess is surprisingly active there and some schools offer scholarships.",
        },
        {
          question: "How much time does serious training actually require?",
          answer:
            "Honestly, 15 to 25 hours a week for a player aiming at titles. That includes coached sessions, independent study with databases and engines, online games and tournament preparation. It's a significant commitment that needs honest academic planning alongside it.",
        },
      ],
      signals: [
        {
          title: "Does the child choose chess on their own?",
          detail:
            "The clearest signal of serious potential at this stage is a child who opens the chess database or does puzzles not because the coach told them to but because they want to. Intrinsic motivation at this age is hard to fake, and it's what sustains through the difficult stretches.",
        },
        {
          title: "Where is the rating?",
          detail:
            "A player training seriously through Stage 3 and into Stage 4 should be approaching 1600 to 1800 FIDE. This range indicates genuine competitive viability. Below 1400 despite regular training suggests something in the training itself needs examining.",
        },
        {
          title: "Tournament results at state or national level",
          detail:
            "Consistent top-10 finishes in age-category nationals, or competitive performances in open rated events, are the benchmarks. One good tournament means little — consistency across events is what matters.",
        },
        {
          title: "Long-game stamina",
          detail:
            "Can your child sustain focus and sharp calculation over a three to five hour game? This is a genuine physical and mental capacity. It develops with experience and is a real differentiator at the higher levels.",
        },
      ],
      decisions: [
        {
          title: "Serious track or recreational?",
          detail:
            "Make this decision consciously and without guilt either way. The serious path means real investment — a strong coach, regular tournaments including travel, reduced flexibility in academics. The recreational path means chess stays a lifelong enriching activity alongside whatever else your child does. Both are excellent outcomes, and the recreational choice is rarely the wrong one.",
        },
        {
          title: "Which coach for serious training?",
          detail:
            "A titled coach — FM, IM or GM — with a track record of developing competitive juniors. The coaching relationship at this stage is intensive, long-term, and has a direct impact on results.",
        },
        {
          title: "Academic planning",
          detail:
            "If pursuing the serious path, have an early conversation with your child's school about flexibility around tournament periods. Some families explore NIOS or other open-schooling options during peak competitive years in Class 10 to 12.",
        },
        {
          title: "Tournament budget",
          detail:
            "National and international events involve real costs — travel, accommodation, entry fees, coaching time. Plan a realistic annual chess budget. State associations do offer some financial support to top-ranked juniors, and it's worth asking.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        {
          when: "Rating below 1400",
          action: "Focus on training quality before title aspirations make sense.",
        },
        {
          when: "Rating 1400 to 1800",
          action:
            "You're on the serious path — upgrade to a titled coach and commit to a structured tournament calendar.",
        },
        {
          when: "Rating 1800 and above",
          action: "Start thinking about FM, and work with your coach on a clear title roadmap.",
        },
        {
          when: "Decided to stay recreational",
          action: "Keep playing, join a club, and enjoy the game at whatever level feels right.",
        },
        {
          when: "Still undecided",
          action: "Take one more year of serious training; the results will tell you what to do.",
        },
      ],
      primaryAction: { label: "Find a titled coach", href: "/booking?tab=coaches" },
      helpLinks: HELP_LINKS,
    },

    // ── 5 ──────────────────────────────────────────────────────────────────
    {
      key: "pathway",
      name: "Pathway",
      ageRange: "~15–18",
      coreQuestion: "Titles, norms and national representation — how do we execute?",
      overview:
        "Your child has made the call: chess is serious. Every training decision now has a direct competitive purpose. The goal at this stage is FIDE rating progression, title norms, performance at national junior championships, and potentially representing India at the Asian Youth or World Youth Chess Championships. There's no more exploring happening — this is execution.",
      questions: [
        {
          question: "How does India select players for international events?",
          answer:
            "AICF selects players for international events — Asian Youth, World Youth, the Olympiad — primarily on FIDE rating and national championship results. Selection criteria vary by event and can change year to year. Check the AICF website and stay in contact with your state association, who will typically communicate selection announcements.",
        },
        {
          question: "What exactly is a norm?",
          answer:
            "A norm is a performance result in a FIDE-rated tournament where you've played against a field of sufficient average rating and title mix, and achieved a performance rating above a certain threshold. For an IM norm you need to perform at roughly 2450+ in an eligible event; for a GM norm, 2600+. Norms are event-specific — not every rated tournament qualifies. Your coach should be actively identifying norm-eligible events and building the calendar around them.",
        },
        {
          question: "Which tournaments should we prioritise?",
          answer:
            "The National Junior Championship (Under-19) is the flagship domestic event and the one that matters most for national ranking and selection. Beyond that: strong state opens, national open rated events, and when the budget allows, international events abroad — particularly in Europe, where the norm tournament ecosystem is densest. Your coach should be building an annual calendar around these.",
        },
        {
          question: "Do we need engines and databases now?",
          answer:
            "Yes. At this level computer-assisted study is standard. Stockfish and Leela Chess Zero for game analysis, ChessBase or Lichess databases for opening preparation. Most serious players at this stage do a significant portion of their preparation independently using these tools, with the coach guiding the overall direction and reviewing the work.",
        },
        {
          question: "How do we handle board exams alongside chess?",
          answer:
            "This is genuinely one of the hardest parts of this stage. Class 11 and 12 coincide with peak competitive years for juniors, and the board exam pressure is real. Many serious players explore NIOS, the National Institute of Open Schooling, which gives more flexibility. AICF achievements can support college applications through sports quota, so discuss it with your family and school well in advance and plan it as a whole rather than managing the conflict tournament by tournament.",
        },
      ],
      signals: [
        {
          title: "Rating heading toward 2000 and beyond",
          detail:
            "Consistent gains across events, not just one good tournament. If the rating is stagnant over 6 to 8 events, something in the training or tournament selection needs to change.",
        },
        {
          title: "Near-norm performances",
          detail:
            "Even falling just short of a norm is useful data — it tells you the level is close and helps refine tournament selection. Track performance ratings in every event.",
        },
        {
          title: "Opening preparation depth",
          detail:
            "At this stage your child should have a well-prepared, coach-guided repertoire for both White and Black — not just general principles but actual theory worked out to a meaningful depth.",
        },
        {
          title: "Physical and mental endurance",
          detail:
            "Multi-day national and international tournaments are physically demanding. Sleep, nutrition and regular exercise genuinely matter at this level — players lose crucial games in the final rounds simply from exhaustion.",
        },
      ],
      decisions: [
        {
          title: "International travel for norms",
          detail:
            "Earning GM and IM norms often requires playing in stronger events outside India, particularly in Europe. Budget for one to two international trips per year if the title is the goal. Some Indian open tournaments do qualify for norms, but the options are more limited domestically.",
        },
        {
          title: "Coaching upgrade",
          detail:
            "A GM coach or former national player is the appropriate standard for this stage. Some players also work with specialist opening coaches for specific preparation, particularly ahead of important events.",
        },
        {
          title: "College planning",
          detail:
            "Research this early — universities with sports quota provisions, IITs and NITs that recognise chess, and US college chess programs. Your FIDE profile and AICF ranking are the credentials that matter here.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        {
          when: "Rating below 1800",
          action: "Rebuild the foundation; norm tournaments aren't productive yet.",
        },
        {
          when: "Rating 1800 to 2100",
          action:
            "Target the CM or FM title and build norm-event experience at strong domestic opens.",
        },
        {
          when: "Rating 2100 to 2300",
          action: "Focus on IM norms; identify eligible tournaments with your coach.",
        },
        {
          when: "Rating 2300 and above",
          action: "The GM norm hunt is the priority — plan international events.",
        },
        {
          when: "Considering stepping back",
          action: "Completely valid. Chess will remain a lifelong asset whatever you decide.",
        },
      ],
      primaryAction: { label: "See the AICF calendar", href: "/federations/aicf?tab=calendar" },
      helpLinks: HELP_LINKS,
    },

    // ── 6 ──────────────────────────────────────────────────────────────────
    {
      key: "transition-and-beyond",
      name: "Transition & Beyond",
      ageRange: "18+",
      coreQuestion: "What comes next?",
      overview:
        "Your child is now an adult making their own chess decisions. This stage covers everything — finishing the title chase, building a coaching career, college chess, and for many, transitioning to being a lifelong player who loves the game without the pressure of competitive performance. Every path out of Stage 5 is a good one, as long as chess still has a place in the person's life.",
      questions: [
        {
          question: "Can chess actually be a full career in India?",
          answer:
            "More than ever, yes. The routes are: professional player at IM or GM level with a real tournament circuit; full-time coaching, which is the most accessible chess career for the majority of strong players and has genuine earning potential especially online; content creation on YouTube and streaming, where Indian chess creators now have real audiences; working with AICF or state associations; and corporate chess, where companies sponsor titled players for events and promotion. India's chess ecosystem has grown substantially and continues to grow.",
        },
        {
          question: "What kind of income does a chess career generate?",
          answer:
            "This varies enormously, and it's worth being honest rather than quoting inflated numbers. A full-time chess coach with a solid online presence and academy affiliation can earn a structured, sustainable income. A titled IM or GM combining tournament earnings, coaching and endorsements can earn significantly more. The honest advice is to build multiple income streams within chess rather than depending on any single one.",
        },
        {
          question: "Is college chess worth pursuing?",
          answer:
            "Absolutely. Inter-university chess through the AIU is active and competitive, and college chess keeps competitive sharpness while building a community. For players interested in studying abroad, US university chess is worth exploring — several American colleges actively recruit and provide scholarships for strong rated players.",
        },
        {
          question: "What if my child wants to stop competing but keep playing?",
          answer:
            "This is a completely healthy and normal outcome. Club chess, online games, coaching younger players, community tournaments — chess doesn't have a retirement age. Former state-level players who now coach 8-year-olds on weekends are often more passionate about the game than they ever were while competing. That's not a failure. That's chess working exactly as it should.",
        },
      ],
      signals: [
        {
          title: "A clear sense of what chess means going forward",
          detail:
            "Not necessarily a plan, but clarity — does the person know what role chess plays in their adult life?",
        },
        {
          title: "Financial sustainability if pursuing chess professionally",
          detail:
            "Is there a real income model taking shape — students, content, tournament earnings — or is the plan vague?",
        },
        {
          title: "Connection to a chess community",
          detail:
            "Strong players at this stage have a network — coaches, peers, students — that keeps them connected to the game in a meaningful way.",
        },
        {
          title: "Still enjoying it",
          detail:
            "That's the only metric that really matters. If the answer is yes, no outcome here is a failure.",
        },
      ],
      decisions: [],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        { when: "Still chasing a title", action: "Stay focused — your coach knows the plan." },
        {
          when: "Transitioning to coaching",
          action: "Start building a student base now, even informally; reputation takes time.",
        },
        {
          when: "Going to college",
          action: "Join the chess team and stay active in inter-university events.",
        },
        {
          when: "Moving to recreational play",
          action: "Find a club or online community and play for the love of it.",
        },
        {
          when: "Building a chess career",
          action:
            "Define your income model early and start building your personal brand alongside it.",
        },
      ],
      primaryAction: { label: "Explore coaching on PowerMySport", href: "/booking?tab=coaches" },
      helpLinks: HELP_LINKS,
    },
  ],
};

async function main(): Promise<void> {
  const publish = process.argv.includes("--publish");
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGO_URI (or MONGODB_URI) before running this.");

  // Validated before the connection is opened: a content mistake should fail as
  // a list of pathed errors, not as a half-written document.
  const parsed = parsePathwayGuide(GUIDE);
  if (!parsed.ok) {
    console.error("The Chess guide does not match the format:");
    for (const error of parsed.errors) console.error(`  ${error}`);
    process.exitCode = 1;
    return;
  }
  const guide = parsed.guide;

  await mongoose.connect(uri);
  try {
    const saved = await PathwayGuide.findOneAndUpdate(
      { sportSlug: guide.sport.slug },
      {
        $set: {
          sportSlug: guide.sport.slug,
          sportName: guide.sport.name,
          formatVersion: guide.formatVersion,
          intro: guide.intro,
          sportIntro: guide.sportIntro,
          ...(guide.contributor ? { contributor: guide.contributor } : {}),
          stages: guide.stages.map((stage, index) => ({
            ...stage,
            order: index + 1,
          })),
          status: publish ? "published" : "draft",
          publishedAt: publish ? new Date() : null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    console.log(
      `Seeded ${saved?.sportName} — ${saved?.stages?.length} stages, status "${saved?.status}".`
    );
    if (!publish) {
      console.log("Saved as a DRAFT: it is not visible to parents.");
      console.log("Re-run with --publish, or publish it from Admin → Content → Pathways.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
