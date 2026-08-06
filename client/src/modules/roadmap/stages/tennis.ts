// ─── Tennis — the handbook's nine stages ────────────────────────────────────
//
// The PowerMySport Tennis Pathway handbook is written in nine stages. The
// resource guide folds them onto the four the ranking archetype renders (see the
// mapping in `resources/content/tennis.ts`); this file unfolds them, because
// stepping through nine named stages is how a parent was always meant to read it.
//
// SOURCES, and nothing else: the authored pathway graph (`graph/maps/tennis.ts`)
// for ages, standards, costs, funding and the gate on every transition; the
// authored guide (`resources/content/tennis.ts`) for gear, training load, the
// parent's job, the mistakes and the checklists. Where a stage wants more than
// those carry, it links to the full guide rather than inventing a figure.

import type { StageGuide } from "./types";

export const TENNIS_STAGE_GUIDE: StageGuide = {
  sport: "Tennis",
  resourceSlug: "tennis",
  stages: [
    // ── 1 ──────────────────────────────────────────────────────────────────
    {
      id: "discover",
      title: "Discover Tennis",
      ageRange: "3 – 8 Years",
      listNote: "Explore if tennis is right for your child",
      // Not a restatement of the line above it: the stage list already says
      // "explore if tennis is right for your child", and the panel repeating it
      // word for word wasted the one line that can add something.
      subtitle: "The honest question, before you spend anything on it.",
      goal: "Help your child explore tennis through fun, movement and basic skill exposure.",
      atAGlance: [
        "Ideal age to start",
        "Skills needed",
        "Physical attributes",
        "Personality traits",
        "Cost of playing tennis",
        "Recreational vs competitive tennis",
      ],
      tabs: [
        {
          id: "overview",
          blocks: [
            {
              kind: "prose",
              text: "Before the pathway, the honest question. Tennis develops the whole child — fitness, resilience, decision-making, independence — because every point has to be solved alone, with nobody coaching from the sideline.",
            },
            {
              kind: "prose",
              text: "It also asks a great deal: progress is gradual, competition is individual, and families invest real time and money. A child who genuinely enjoys it will outlast one who was pushed.",
            },
            {
              kind: "callout",
              tone: "goal",
              title: "The one thing that predicts everything",
              text: "The single best predictor is enjoyment. A child who looks forward to practice will improve for years; a child who doesn't will stop, whatever their talent.",
            },
          ],
        },
        {
          id: "topics",
          blocks: [
            {
              kind: "pairs",
              title: "What to work on, by age",
              rows: [
                { label: "3–4 years", value: "General movement, balance and coordination through play. No formal coaching needed." },
                { label: "5–6 years", value: "Introduction with modified equipment (red ball). Basic strokes and movement learned through games." },
                { label: "7–8 years", value: "Technical fundamentals, rallying, and awareness of the court." },
                { label: "9–10 years", value: "Refine technique, begin structured training, and start local competition." },
                { label: "11–13 years", value: "Consolidate technique, add physical conditioning, and compete regularly." },
                { label: "14+ years", value: "Specialise, develop tactically, and plan competition seriously." },
              ],
            },
            {
              kind: "list",
              title: "Physical attributes that help",
              tone: "check",
              items: [
                "Good hand-eye coordination",
                "Quick reaction time",
                "Agility and efficient footwork",
                "Dynamic balance",
                "Flexibility and mobility",
              ],
            },
            {
              // Only the traits the "signs it fits" list doesn't already imply.
              // Discipline, resilience and patience were saying the same thing
              // twice on one screen, in different words.
              kind: "pairs",
              title: "Temperament that carries a player",
              rows: [
                { label: "Coachability", value: "Willingness to be corrected accelerates everything." },
                { label: "Problem-solving", value: "Players decide alone, mid-match, with no help." },
                { label: "Emotional control", value: "Managing pressure is a skill that can be trained." },
              ],
            },
          ],
        },
        {
          id: "expect",
          blocks: [
            {
              kind: "prose",
              text: "Starting after ten is completely fine for a lifetime of playing, and many do. It does make the very top of the international game progressively harder to reach — but that is one outcome out of several on this pathway, not the only one worth having.",
            },
            {
              kind: "prose",
              text: "There is no ideal tennis body, especially for a beginner. Height helps the serve but is not required in childhood — late growth is common, and speed, balance, strength and endurance all improve substantially with age-appropriate training. An early assessment should guide training, not cap expectations.",
            },
          ],
        },
        {
          id: "tips",
          blocks: [
            {
              kind: "list",
              title: "Signs tennis fits",
              tone: "check",
              items: [
                "Enjoys individual challenges rather than needing a team around them",
                "Likes learning new skills and is willing to practise the same thing repeatedly",
                "Has good coordination, or is keen to develop it",
                "Can cope with winning and losing on their own",
                "Enjoys movement and active play",
                "Shows curiosity, determination and patience",
              ],
            },
            {
              kind: "list",
              title: "Signs it doesn't",
              tone: "cross",
              items: [
                "Strongly prefers team environments",
                "Dislikes repetitive practice",
                "Has no interest in racquet sports",
                "Your family schedule makes regular practice impossible",
                "The child is only doing it because you want them to",
              ],
            },
            {
              kind: "prose",
              text: "You do not have to decide between recreational and competitive now, and the decision is not final. Plenty of children start recreationally and turn competitive once the interest and the ability arrive; plenty of competitive players later go back to playing for enjoyment. The pathway should follow the child.",
            },
          ],
        },
        {
          id: "resources",
          blocks: [
            {
              kind: "pairs",
              title: "What it costs a year, by level",
              rows: [
                { label: "Recreational beginner", value: "₹30,000 – ₹80,000" },
                { label: "Club / intermediate", value: "₹80,000 – ₹2,00,000" },
                { label: "Competitive, ranked", value: "₹2,00,000 – ₹5,00,000" },
                { label: "National level", value: "₹5,00,000 – ₹12,00,000" },
                { label: "International junior", value: "₹15,00,000 – ₹30,00,000+" },
              ],
            },
            {
              kind: "callout",
              tone: "money",
              title: "Read these as ranges, not quotes",
              text: "Genuinely variable by city, academy, travel and how many tournaments you enter. Plan progressively — you do not need to buy everything at the start, and most families who stop do so for cost reasons rather than talent reasons.",
            },
            // The line-by-line breakdown of what that money buys — academy fees,
            // stringing, physio, nutrition — lives in the full guide. Repeating
            // it here only pads a stage whose job is the yes/no decision.
          ],
        },
      ],
    },

    // ── 2 ──────────────────────────────────────────────────────────────────
    {
      id: "getting-started",
      title: "Getting Started",
      ageLabel: "4–8",
      ageRange: "4 – 8 Years",
      listNote: "Learn the basics and build a strong start",
      subtitle: "Coaching on a smaller court, with a slower ball and first rallies.",
      goal: "Rally in week one, not month six — and build the coordination everything later rests on.",
      rawLevel: 1,
      atAGlance: [
        "Finding a coach",
        "Red and orange ball stages",
        "Racquet size by age",
        "How much training is enough",
        "Your job as a parent",
        "Everyday nutrition",
      ],
      tabs: [
        {
          id: "overview",
          blocks: [
            {
              kind: "prose",
              text: "The ITF Tennis10s ball stages exist so a child can rally in week one instead of month six. Two or three sessions a week is the whole job at this age — adding hours here is what produces children who quit at twelve.",
            },
            {
              kind: "pairs",
              title: "The numbers here",
              rows: [
                { label: "Standard", value: "Unrated" },
                { label: "Cost a year", value: "₹30k–80k" },
                { label: "Time here", value: "2–3 years" },
                { label: "To get started", value: "Nothing — just show up" },
              ],
            },
            // No "Goal of this stage" callout here: the reader already renders
            // one from the stage's `goal`, and two of them stacked said the same
            // thing twice in a row.
          ],
        },
        {
          id: "topics",
          blocks: [
            {
              kind: "prose",
              text: "Modern tennis uses the ITF Tennis10s progression: modified balls and smaller courts matched to a child's size. Progress through the colours on skill, not birthday.",
            },
            {
              kind: "pairs",
              title: "Equipment that fits the child",
              rows: [
                { label: "Red ball · 5–8", value: "Larger, slower, lower-bouncing ball on a small court. Rallies are easy, which is the point: early success builds coordination, balance and basic strokes." },
                { label: "Orange ball · 7–9", value: "Slightly faster, bigger court, more movement. Consistency, direction and simple point construction start here." },
                { label: "Racquet size", value: "19–21 inches at 4–5 years, 21–23 at 6–8, 23–25 at 8–10. An oversized or heavy racquet teaches bad technique and raises injury risk." },
                { label: "Shoes", value: "Tennis shoes, not running shoes — tennis needs lateral stability and grip for sudden direction changes." },
              ],
            },
            {
              kind: "pairs",
              title: "How much training is enough",
              rows: [
                { label: "4–5 years", value: "1–2 sessions a week · 30–45 minutes" },
                { label: "5–6 years", value: "2 a week · 45–60 minutes" },
                { label: "6–8 years", value: "2–3 a week · 60 minutes" },
                { label: "7–8, keen players", value: "3–4 a week · 60–90 minutes" },
              ],
            },
          ],
        },
        {
          id: "expect",
          blocks: [
            {
              kind: "prose",
              text: "Children between four and eight should not train like professional athletes. Keep other sports going — running, climbing, cycling, swimming, unstructured play. A broad movement base is what supports athletic development later, and specialising early is one of the most common ways families lose a child to burnout at twelve.",
            },
            {
              kind: "list",
              title: "What the body is actually building",
              items: [
                "Speed — short sprints, reaction games, acceleration drills",
                "Agility — multi-directional movement, quick changes of direction",
                "Coordination — catching, throwing, hand-eye drills",
                "Flexibility — dynamic warm-ups, mobility work",
                "Endurance — comes naturally from practice and active play",
              ],
            },
            {
              kind: "callout",
              tone: "goal",
              title: "Moving up to the green ball",
              text: "Nothing administrative — the coach decides. Readiness is rallying consistently on the orange court. Progression here is by skill, not by birthday.",
            },
          ],
        },
        {
          id: "tips",
          blocks: [
            {
              kind: "list",
              title: "Before practice",
              tone: "check",
              items: [
                "Make sure they arrive rested and hydrated",
                "Bring the right equipment",
                "Encourage enthusiasm without adding pressure",
              ],
            },
            {
              kind: "list",
              title: "During practice",
              tone: "check",
              items: [
                "Watch quietly where that's appropriate",
                "Don't coach from outside the court",
                "Trust the coach to run the session",
                "Let your child solve problems on their own",
              ],
            },
            {
              kind: "callout",
              tone: "goal",
              title: "Afterwards, instead of “Did you win?”",
              text: "What was the most enjoyable part today? · What new skill did you learn? · What would you like to practise next time?",
            },
            {
              // One negative list, not two. This was split across "What to
              // avoid" here and "Common mistakes at this stage" under Resources,
              // which between them told a parent twice not to compare their
              // child with other children.
              kind: "list",
              title: "What to avoid",
              tone: "cross",
              items: [
                "Comparing your child with others",
                "Criticising mistakes straight after practice",
                "Expecting rapid improvement",
                "Living your own sporting ambitions through them",
                "Specialising in one sport too early",
                "Entering too many tournaments",
                "Focusing only on winning",
                "Increasing training volume too quickly",
                "Rewarding results more than effort",
              ],
            },
          ],
        },
        {
          id: "resources",
          blocks: [
            {
              kind: "list",
              title: "Before you move on, check",
              tone: "check",
              items: [
                "Your child enjoys the game and looks forward to practice",
                "The academy focuses on long-term development, not early results",
                "The coach is genuinely experienced with young children",
                "Equipment is age-appropriate — ball colour, racquet length, shoes",
                "Technique is sound across the basic strokes",
                "They move confidently around the court",
                "Training is balanced against school and free play",
              ],
            },
          ],
        },
      ],
    },

    // ── 3 ──────────────────────────────────────────────────────────────────
    {
      id: "foundation",
      title: "Foundation",
      ageLabel: "8–10",
      ageRange: "8 – 10 Years",
      listNote: "Develop skills and build confidence",
      subtitle: "Green ball and full court — technique, footwork and first real matches.",
      goal: "Build the technical habits a player keeps for good, and learn to compete with nothing riding on it.",
      rawLevel: 1,
      atAGlance: [
        "Green ball and full court",
        "School and SGFI tennis",
        "Choosing the right racquet",
        "Registering with AITA",
        "When competition should start",
        "The shortcut that traps families",
      ],
      tabs: [
        {
          id: "overview",
          blocks: [
            {
              kind: "prose",
              text: "The technical habits built here are the ones a player keeps for good. Club, school and district events belong at this stage — school and SGFI tennis is the cheapest match practice in India, and it teaches scoring, nerves and losing with no ranking riding on any of it.",
            },
            {
              kind: "pairs",
              title: "The numbers here",
              rows: [
                { label: "Standard", value: "UTR 1–3" },
                { label: "Cost a year", value: "₹80k–2L" },
                { label: "Time here", value: "1–2 years" },
              ],
            },
          ],
        },
        {
          id: "topics",
          blocks: [
            {
              kind: "pairs",
              title: "Equipment at this stage",
              rows: [
                { label: "Green ball · 9–10", value: "Behaves close to a standard ball on a nearly full court. The bridge to full-court tennis: real stroke mechanics, tactics and match play." },
                { label: "Racquet size", value: "23–25 inches at 8–10, 25–26 at 10+ before adult frames. Lightweight and junior-specific." },
                { label: "Shoes", value: "Proper tennis shoes, replaced once traction goes. Worn-out shoes are a genuine injury risk." },
              ],
            },
            {
              kind: "callout",
              tone: "goal",
              title: "Registering with AITA",
              text: "The rule: AITA membership and verified age proof. U-10 is the youngest category and opens at age 7. Ready when they can serve, rally and score a match unaided — and handle losing one. Roughly UTR 3. Most families register between 9 and 11.",
            },
          ],
        },
        {
          id: "expect",
          blocks: [
            {
              kind: "prose",
              text: "This is the stage where the pathway stops being one road. Ranked tennis opens from here, and so does the temptation to skip it.",
            },
            {
              kind: "callout",
              tone: "warn",
              title: "Open entry is not the same as being ready",
              text: "Entry to the bottom rung of professional tennis needs an IPIN and an entry fee — barely a gate. The players in that draw sit around UTR 13; a child on a full court for the first time is around UTR 2. You can enter, and you will barely be stopped, but the realistic result is a first-round loss for zero ranking points, repeated at roughly ₹2–4 lakh a year in travel and entries. The gate in tennis is competitive, not administrative.",
            },
          ],
        },
        {
          id: "tips",
          blocks: [
            {
              kind: "list",
              title: "What helps most here",
              tone: "check",
              items: [
                "Use school and SGFI events for cheap, low-stakes match practice",
                "Let progression through ball colours follow skill, not age",
                "Change racquet models on a coach's advice, not marketing",
                "Keep a second sport going through this stage",
              ],
            },
            {
              kind: "list",
              title: "What to avoid",
              tone: "cross",
              items: [
                "Registering with AITA before the player is genuinely ready",
                "Treating the first ranked event as a verdict on their ability",
                "Chasing a draw that is two levels above them",
              ],
            },
          ],
        },
        {
          id: "resources",
          blocks: [
            {
              kind: "list",
              title: "Ready for ranked tennis when",
              tone: "check",
              items: [
                "They can serve, rally and score a match unaided",
                "They can handle losing one",
                "Technique holds up on a full court",
                "Roughly UTR 3",
                "AITA membership and age proof are in order",
              ],
            },
          ],
        },
      ],
    },

    // ── 4 ──────────────────────────────────────────────────────────────────
    {
      id: "competitive",
      title: "Competitive",
      ageLabel: "10–12",
      ageRange: "7 – 12 Years",
      listNote: "Begin structured competition",
      subtitle: "AITA Talent Series — U-10 and U-12, and your first ranking points.",
      goal: "Enter ranked tennis with a plan, and learn what a ranking does and doesn't measure.",
      rawLevel: 2,
      atAGlance: [
        "How AITA ranking points work",
        "Building an annual calendar",
        "Training-to-competition ratio",
        "Academy scholarships",
        "Choosing which tournaments to enter",
        "What a ranking doesn't measure",
      ],
      tabs: [
        {
          id: "overview",
          blocks: [
            {
              kind: "prose",
              text: "The real entry point to ranked tennis in India. U-10 is the youngest official AITA category and opens at age 7, though most families register between 9 and 11. Roughly 1 in 5 go further.",
            },
            {
              kind: "pairs",
              title: "The numbers here",
              rows: [
                { label: "Standard", value: "First AITA ranking" },
                { label: "Cost a year", value: "₹1.5L–3L" },
                { label: "Time here", value: "1–2 years" },
              ],
            },
            {
              kind: "callout",
              tone: "money",
              title: "Money that becomes available here",
              text: "Academy scholarships — RoundGlass, MS Star, IMG and similar — are awarded on the academy's own trials from around this stage, and can waive coaching or residential fees outright.",
            },
          ],
        },
        {
          id: "topics",
          blocks: [
            {
              kind: "list",
              title: "How ranking points work",
              items: [
                "Points come from the tournament's category, the round reached, and match results",
                "Higher-category tournaments award more points for the same result",
                "Consistency over a season moves a ranking more than one good week",
              ],
            },
            {
              kind: "list",
              title: "What a ranking gets you",
              tone: "check",
              items: [
                "Direct acceptance into tournaments instead of qualifying",
                "Better seedings",
                "Access to stronger opposition",
              ],
            },
            {
              kind: "list",
              title: "What it does not measure",
              tone: "cross",
              items: [
                "Long-term potential",
                "Technical quality",
                "Mental resilience",
                "Physical development",
                "Future success",
              ],
            },
          ],
        },
        {
          id: "expect",
          blocks: [
            {
              kind: "prose",
              text: "More tournaments do not mean faster improvement. Practice builds the player; competition only measures them. The healthy cycle is train → compete → review → improve → train again. Entering the next tournament before addressing what the last one exposed is how a season passes with no progress.",
            },
            {
              kind: "callout",
              tone: "goal",
              title: "The ratio that works",
              text: "70–80% training to 20–30% competition. In a typical month that's 18–22 practice sessions, 2–4 match days, and one or two tournaments.",
            },
            {
              kind: "pairs",
              title: "A year that actually works",
              rows: [
                { label: "April–May", value: "Technical development and fitness" },
                { label: "June–July", value: "Local and regional tournaments" },
                { label: "August", value: "Training block" },
                { label: "September–October", value: "AITA tournaments" },
                { label: "November", value: "Training and physical development" },
                { label: "December", value: "Major competitions" },
                { label: "January", value: "Recovery and skill refinement" },
                { label: "February–March", value: "Tournament prep, balanced with school" },
              ],
            },
          ],
        },
        {
          id: "tips",
          blocks: [
            {
              kind: "prose",
              text: "One of the biggest mistakes families make is entering tournaments with no annual plan. Build a calendar that includes school exams, training blocks, conditioning phases, recovery periods, holidays and equipment replacement — then pick the tournaments that fit it.",
            },
            {
              kind: "list",
              title: "What to avoid",
              tone: "cross",
              items: [
                "Measuring success only through ranking",
                "Entering every available tournament",
                "Travelling long distances for low-value events",
                "Choosing tournaments purely for points rather than for development",
              ],
            },
          ],
        },
        {
          id: "resources",
          blocks: [
            {
              kind: "list",
              title: "Before you move on, check",
              tone: "check",
              items: [
                "Registered with AITA, with age proof verified",
                "Competing in age-appropriate events rather than the biggest available draw",
                "An annual calendar exists and school exams are in it",
                "Training-to-competition balance is roughly 70/30",
                "Every tournament has a stated objective beyond winning",
              ],
            },
            {
              kind: "list",
              title: "What to carry to a tournament",
              items: [
                "Three or more match-ready frames once you're entering draws",
                "Spare grips and overgrips, water bottles, towels",
                "Skipping rope, resistance bands",
                "Basic first aid, sun protection for outdoor events",
              ],
            },
          ],
        },
      ],
    },

    // ── 5 ──────────────────────────────────────────────────────────────────
    {
      id: "national-pathway",
      title: "National Pathway",
      ageLabel: "12–14",
      ageRange: "12 – 16 Years",
      listNote: "Compete nationally and climb rankings",
      subtitle: "AITA Championship Series — U-14 and U-16, and a national ranking.",
      goal: "Build a national ranking that holds up, and secure the funding before the costs arrive.",
      rawLevel: 3,
      atAGlance: [
        "Khelo India Athlete Scheme",
        "Reaching the India top 100",
        "The university quota route",
        "The fast track to ITF juniors",
        "Physical preparation as a factor",
        "Why most families stop here",
      ],
      tabs: [
        {
          id: "overview",
          blocks: [
            {
              kind: "prose",
              text: "Travel becomes constant here. This is where most families stop for cost reasons rather than talent reasons — which is exactly why the funding below is worth chasing before the costs arrive.",
            },
            {
              kind: "pairs",
              title: "The numbers here",
              rows: [
                { label: "Standard", value: "UTR 6–9" },
                { label: "Cost a year", value: "₹3L–6L" },
                { label: "Time here", value: "2–3 years" },
              ],
            },
            {
              kind: "callout",
              tone: "money",
              title: "Khelo India Athlete Scheme",
              text: "Selection typically happens around this level — reported at roughly ₹6 lakh a year covering training, equipment, diet and education for as long as the athlete stays in the scheme.",
            },
          ],
        },
        {
          id: "topics",
          blocks: [
            {
              kind: "callout",
              tone: "goal",
              title: "Carrying on up: reach the India top 100",
              text: "Ready when they hold an AITA age-group ranking inside the top 100. Typically 2–3 years at this stage.",
            },
            {
              kind: "callout",
              tone: "goal",
              title: "Side route: an AITA ranking earns a university seat",
              text: "A documented AITA age-group ranking is usually enough for an Indian university sports quota seat. You do not need to have played internationally.",
            },
            {
              kind: "callout",
              tone: "warn",
              title: "Fast track: skipping nationals for ITF juniors",
              text: "Genuinely strong juniors only. Any one of these opens it: AITA top 10 in India at U-14 · UTR 9 or above · two main-draw wins at an ITF J30. Saves roughly two years — and is not a route around the work.",
            },
          ],
        },
        {
          id: "expect",
          blocks: [
            {
              kind: "prose",
              text: "Physical preparation becomes a performance factor in its own right here — not bodybuilding, but building an athlete who can sustain long matches and long seasons.",
            },
            {
              kind: "prose",
              text: "Strength (lower body, core, upper body), speed (first-step acceleration, court coverage, recovery), power (medicine ball, plyometrics, jump training) and endurance across consecutive tournament days. Always age-appropriate and supervised by someone qualified.",
            },
          ],
        },
        {
          id: "tips",
          blocks: [
            {
              kind: "list",
              title: "What to avoid",
              tone: "cross",
              items: [
                "Playing too many tournaments and training too little",
                "Chasing ranking points instead of player development",
                "Comparing rankings with other children",
                "Changing coaches frequently",
                "Ignoring recovery and sleep",
                "Neglecting academics",
                "Overspending without a structured annual budget",
              ],
            },
          ],
        },
        {
          id: "resources",
          blocks: [
            {
              kind: "list",
              title: "Before you move on, check",
              tone: "check",
              items: [
                "Understands the AITA tournament structure and where they sit in it",
                "Competing regularly at a level that stretches them without burying them",
                "A sustainable national ranking built on consistency",
                "A coach with a written long-term development plan",
                "An annual tournament, travel and recovery calendar",
                "Academics, training and rest genuinely in balance",
              ],
            },
          ],
        },
      ],
    },

    // ── 6 ──────────────────────────────────────────────────────────────────
    {
      id: "high-performance",
      title: "High Performance",
      ageLabel: "14–18",
      ageRange: "14 – 18 Years",
      listNote: "Train like a professional and go international",
      subtitle: "AITA Super Series, Nationals, and the ITF junior circuit.",
      goal: "Turn a national record into international entry — with the funding and support team to sustain it.",
      rawLevel: 4,
      atAGlance: [
        "Top 20 in India for the age group",
        "ITF Juniors — J30 to J500",
        "The support team you need",
        "Recovery as a discipline",
        "The biggest cost jump on the pathway",
        "Asian Tennis Federation events",
      ],
      tabs: [
        {
          id: "overview",
          blocks: [
            {
              kind: "prose",
              text: "A few hundred children in the country are here in any age group. Reaching this rung is already enough to open a university seat or a coaching career, whatever happens next.",
            },
            {
              kind: "pairs",
              title: "The two rungs at this stage",
              rows: [
                { label: "AITA Super Series & Nationals", value: "Top 20 in India for the age group · UTR 9–11 · ₹5L–12L a year" },
                { label: "ITF Juniors J30 → J500", value: "A world junior ranking · UTR 10–13 · ₹15L–30L a year" },
              ],
            },
            {
              kind: "callout",
              tone: "money",
              title: "Where funding stops being optional",
              text: "The ITF junior circuit is the biggest cost jump on the pathway. Khelo India, an academy scholarship and a sponsor usually have to run together to make a season viable. A national ranking is also the track record corporate CSR and private sponsors want before they commit.",
            },
          ],
        },
        {
          id: "topics",
          blocks: [
            {
              kind: "callout",
              tone: "goal",
              title: "How ITF entry opens",
              text: "The rule: AITA nomination for ITF events. Ready when they are top 20 in India in the age group.",
            },
            {
              kind: "list",
              title: "The support team",
              items: [
                "Technical coach",
                "Strength and conditioning coach",
                "Physiotherapist",
                "Sports psychologist",
                "Nutritionist",
                "Tournament planner",
                "You — as the primary support person, not the coach",
              ],
            },
          ],
        },
        {
          id: "expect",
          blocks: [
            {
              kind: "prose",
              text: "International travel every few weeks. Asian Tennis Federation events are the cheaper way in: the same international experience for a fraction of the airfare.",
            },
            {
              kind: "list",
              title: "Recovery is part of the training, not a break from it",
              tone: "check",
              items: [
                "Quality sleep, hydration and balanced nutrition, every day",
                "Stretching, mobility work and active recovery",
                "After matches: cool down, rehydrate, recovery nutrition, treat niggles immediately",
                "Review a match only once the emotion has settled",
                "Build rest weeks, reduced-training phases and medical screening into the year",
              ],
            },
          ],
        },
        {
          id: "tips",
          blocks: [
            {
              kind: "prose",
              text: "Travel is constant from here, and planning the season in advance genuinely reduces cost. Budget for entry fees, travel, local transport, accommodation, meals, coaching and equipment replacement.",
            },
            {
              kind: "list",
              title: "What to avoid",
              tone: "cross",
              items: [
                "Increasing tournament volume without increasing recovery",
                "Failing to plan financially for international competition",
                "Neglecting academics while the international season runs",
              ],
            },
          ],
        },
        {
          id: "resources",
          blocks: [
            {
              kind: "list",
              title: "Travel kit for an international season",
              items: [
                "Three or more match-ready racquets",
                "Fresh strings and grips",
                "Competition clothing",
                "Tennis shoes, plus a backup pair if possible",
                "Nutrition and snacks",
                "Recovery kit — foam roller, resistance bands",
                "First-aid kit and any medication",
                "ID documents and tournament confirmations",
              ],
            },
            {
              kind: "list",
              title: "Before you move on, check",
              tone: "check",
              items: [
                "Reviews every tournament and adjusts training accordingly",
                "Mental-performance work under way, with professional support where appropriate",
                "A realistic annual budget for an international season",
              ],
            },
          ],
        },
      ],
    },

    // ── 7 ──────────────────────────────────────────────────────────────────
    {
      id: "career-decisions",
      title: "Career Decisions",
      ageLabel: "16–18",
      ageRange: "16 – 19 Years",
      listNote: "Choose your path: College or Pro",
      subtitle: "The fork — a funded university place, or a professional season.",
      goal: "Choose on long-term aspirations rather than last season's results, and explore college well before the final school year.",
      rawLevel: 5,
      atAGlance: [
        "US College — NCAA D1 and D2",
        "Indian university sports quota",
        "NCAA academic eligibility",
        "Four questions before turning pro",
        "Why college is the best risk-adjusted route",
        "Planning the decision early",
      ],
      tabs: [
        {
          id: "overview",
          blocks: [
            {
              kind: "prose",
              text: "By this point the decision is no longer only sporting. Only a small share of juniors compete full-time on the ATP or WTA Tour, but thousands use tennis to reach outstanding universities and careers — so success at this stage is measured by the quality of the options created, not by ranking alone.",
            },
            {
              kind: "callout",
              tone: "goal",
              title: "Four questions to answer honestly before committing to a professional route",
              text: "Is the player consistently succeeding at national and international junior level? Do they genuinely enjoy the demands of elite competition? Is there a capable coaching and support team? And is there a sustainable financial plan?",
            },
          ],
        },
        {
          id: "topics",
          blocks: [
            {
              kind: "pairs",
              title: "The two university routes",
              rows: [
                { label: "US College — NCAA D1/D2", value: "A funded degree on a tennis team. UTR 10–13 for D1. Often fully funded — the scholarship IS the funding." },
                { label: "Indian university quota", value: "A seat on your AITA ranking. Reduced or waived fees, a hostel place and a flexible academic schedule for tournament weeks." },
              ],
            },
            {
              kind: "callout",
              tone: "goal",
              title: "How NCAA recruiting works",
              text: "The rule: NCAA academic eligibility plus SAT/TOEFL. Ready when UTR 10+ for D2, 12+ for a strong D1. Coaches recruit on UTR, ITF and AITA ranking together with school grades and English proficiency.",
            },
          ],
        },
        {
          id: "expect",
          blocks: [
            {
              kind: "prose",
              text: "More than 1,000 US universities field tennis programmes across NCAA D1/D2/D3, NAIA and junior colleges, and an athletic award can cover fees and living costs outright. It is the best risk-adjusted route in this sport, and the one Indian parents hear about last.",
            },
            {
              kind: "prose",
              text: "The Indian quota route is quieter and cheaper: an AITA age-group ranking is usually enough, and you do not need to have played internationally. The rules differ by university — confirm each one's own quota rules before you apply.",
            },
          ],
        },
        {
          id: "tips",
          blocks: [
            {
              kind: "list",
              title: "What to avoid",
              tone: "cross",
              items: [
                "Treating professional tennis as the only successful outcome",
                "Leaving university planning until the final year of school",
                "Neglecting academic development",
                "Underestimating the financial commitment",
                "Focusing on ranking rather than on the opportunities the sport can open",
              ],
            },
          ],
        },
        {
          id: "resources",
          blocks: [
            {
              kind: "list",
              title: "Before you decide, check",
              tone: "check",
              items: [
                "Understands every post-junior route, not just the professional one",
                "Has honestly assessed whether professional tennis fits their goals and readiness",
                "Explored NCAA and university options well before the final school year",
                "Scholarship applications prepared where relevant",
                "A realistic financial plan for the chosen route",
                "Decisions made on long-term aspirations rather than last season's results",
              ],
            },
          ],
        },
      ],
    },

    // ── 8 ──────────────────────────────────────────────────────────────────
    {
      id: "professional",
      title: "Professional Tennis",
      ageLabel: "17+",
      ageRange: "17+ Years",
      listNote: "Life on the tour and building a career",
      subtitle: "ITF World Tour, Challengers, and the top of the game.",
      goal: "Understand what a professional season actually costs, and where the money comes from.",
      rawLevel: 5,
      atAGlance: [
        "ITF World Tour M15 / W15",
        "ATP Challenger and WTA 125",
        "The world top 100",
        "TOPS and sponsorship",
        "What a season costs",
        "The age most players actually peak",
      ],
      tabs: [
        {
          id: "overview",
          blocks: [
            {
              kind: "pairs",
              title: "The three rungs of a professional career",
              rows: [
                { label: "ITF World Tour M15/W15 · 17+", value: "Your first professional ranking point. UTR 13+ · ₹20L–35L a year." },
                { label: "ATP Challenger / WTA 125 · 20+", value: "The working professional circuit. UTR 14–15.5 · ₹30L–50L a year, part prize-funded." },
                { label: "ATP / WTA Tour · 23+", value: "Top 100 in the world. UTR 16 · prize money and sponsorship fund it." },
              ],
            },
            {
              kind: "callout",
              tone: "warn",
              title: "Open to anyone who pays. Winnable by almost nobody.",
              text: "That gap is the whole point of this pathway — and the ITF World Tour is the START of a professional career, not the end of the climb.",
            },
          ],
        },
        {
          id: "topics",
          blocks: [
            {
              kind: "prose",
              text: "ATP Challenger level is where most Indian professionals actually spend their careers. Draws are full of former tour players and rising internationals, and a top-400 ranking is a real achievement rather than a rung you pass through.",
            },
            {
              kind: "callout",
              tone: "goal",
              title: "Getting from ITF to Challenger",
              text: "The rule: an ATP/WTA ranking high enough for the qualifying draw. Ready when winning M15 and M25 main draws consistently — roughly a top-700 ranking. Typically 2–4 years.",
            },
          ],
        },
        {
          id: "expect",
          blocks: [
            {
              kind: "prose",
              text: "A handful of Indians have ever held a top-100 singles ranking; doubles has been far kinder. And most players inside the top 100 are 24–25, not teenagers — which may be the single most useful fact on this pathway.",
            },
            {
              kind: "prose",
              text: "Prize money starts to contribute at Challenger level but rarely covers a full season. TOPS support and sponsorship carry most Indian players through these years.",
            },
          ],
        },
        {
          id: "tips",
          blocks: [
            {
              kind: "prose",
              text: "Financial planning is the most overlooked part of elite tennis. Build an annual budget and review it — coaching, court fees, fitness, physiotherapy, nutrition, entry fees, domestic and international travel, accommodation, equipment, stringing and insurance.",
            },
          ],
        },
        {
          id: "resources",
          blocks: [
            {
              kind: "list",
              title: "Where the money comes from",
              items: [
                "Family investment, planned rather than improvised",
                "TOPS — the Target Olympic Podium Scheme, for elite seniors with genuine international medal potential",
                "Sponsorship and corporate partnerships",
                "State government support",
                "Federation assistance where available",
                "Scholarships",
                "Private benefactors",
              ],
            },
          ],
        },
      ],
    },

    // ── 9 ──────────────────────────────────────────────────────────────────
    {
      id: "beyond-playing",
      title: "Beyond Playing",
      ageLabel: "18+",
      ageRange: "18+ Years",
      listNote: "Explore opportunities off the court",
      subtitle: "Careers in tennis — most of which pay while you are still playing.",
      goal: "Turn years in the sport into a career in it, whatever happened on court.",
      atAGlance: [
        "Coaching certifications and ladder",
        "Officiating routes",
        "Sports management",
        "Running an academy",
        "Sports science",
        "Where the new jobs are",
      ],
      tabs: [
        {
          id: "overview",
          blocks: [
            {
              kind: "prose",
              text: "Very few players spend their whole lives competing, and that was always going to be true. The discipline, resilience and problem-solving tennis builds transfer directly into a growing industry — and most of these roles pay while you are still playing.",
            },
            {
              kind: "callout",
              tone: "goal",
              title: "You can start earlier than you think",
              text: "A playing record plus a coaching certification is enough to begin. Coaching and officiating both take you around the world on somebody else's budget.",
            },
          ],
        },
        {
          id: "topics",
          blocks: [
            {
              kind: "pairs",
              title: "The routes that exist",
              rows: [
                { label: "Coaching", value: "The largest employer in Indian tennis. Assistant → academy → high performance → national → international touring coach." },
                { label: "Officiating", value: "Line umpire → chair umpire → referee → tournament director. Applies the rules, manages matches, and travels internationally." },
                { label: "Sports management", value: "Tournament operations, player management, sponsorship, marketing, facility management, federation administration." },
                { label: "Running an academy", value: "Programme design, staff, finances, marketing, parent communication, facilities. Sporting excellence plus sound business practice." },
                { label: "Sports science", value: "Strength and conditioning, physiotherapy, sports psychology, nutrition, performance analysis and biomechanics." },
                { label: "Media and commentary", value: "Commentary, match analysis, podcasting, digital content, journalism, broadcasting." },
              ],
            },
          ],
        },
        {
          id: "expect",
          blocks: [
            {
              kind: "list",
              title: "Where the new jobs are",
              items: [
                "AI-powered performance analysis",
                "Sports data analytics",
                "Athlete management platforms",
                "Digital coaching and online education",
                "Sports technology product development",
                "Sports law and governance",
              ],
            },
          ],
        },
        {
          id: "tips",
          blocks: [
            {
              kind: "list",
              title: "What the sport gives them regardless",
              tone: "check",
              items: [
                "Discipline and consistency",
                "Resilience after losing",
                "Independent problem-solving under pressure",
                "Emotional control",
                "Long-term planning",
                "Self-motivation",
              ],
            },
          ],
        },
        {
          id: "resources",
          blocks: [
            {
              kind: "list",
              title: "Coaching certifications",
              items: [
                "AITA Coach Education Programmes",
                "ITF Coaching Certification",
                "PTR — Professional Tennis Registry",
                "GPTCA — Global Professional Tennis Coach Association",
              ],
            },
            {
              kind: "list",
              title: "Officiating",
              items: ["AITA and ITF officiating programmes"],
            },
          ],
        },
      ],
    },
  ],
};
