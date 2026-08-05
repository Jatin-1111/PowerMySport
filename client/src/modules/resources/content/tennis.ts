// ─── Tennis — authored parent guide ─────────────────────────────────────────
//
// Every figure here comes from the PowerMySport Tennis Pathway handbook. Nothing
// is inferred, and nothing is generated.
//
// Stage keys are `representativeRawLevel` — the level the archetype skeleton uses
// to identify a rendered stage. For the ranking archetype that is 1 (Foundation),
// 2 (First Ranking Points), 4 (National Ranking) and 5 (International Circuit),
// so the handbook's nine stages fold onto four rendered ones:
//
//   handbook 1 (Discover)                → `decide`, before any stage
//   handbook 2–3 (age 4–8, 8–10)         → level 1
//   handbook 4 (age 10–12)               → level 2
//   handbook 5–6 (age 12–14, 14–18)      → level 4
//   handbook 7–8 (career, professional)  → level 5
//   handbook 9 (beyond playing)          → `careers`, after the stages

import type { SportGuide } from "./types";

export const TENNIS_GUIDE: SportGuide = {
  sport: "Tennis",

  decide: {
    intro:
      "Before the pathway, the honest question. Tennis develops the whole child — fitness, resilience, decision-making, independence — because every point has to be solved alone, with nobody coaching from the sideline. It also asks a great deal: progress is gradual, competition is individual, and families invest real time and money. A child who genuinely enjoys it will outlast one who was pushed.",
    goodFit: [
      "Enjoys individual challenges rather than needing a team around them",
      "Likes learning new skills and is willing to practise the same thing repeatedly",
      "Has good coordination, or is keen to develop it",
      "Can cope with winning and losing on their own",
      "Enjoys movement and active play",
      "Shows curiosity, determination and patience",
    ],
    poorFit: [
      "Strongly prefers team environments",
      "Dislikes repetitive practice",
      "Has no interest in racquet sports",
      "Your family schedule makes regular practice impossible",
      "The child is only doing it because you want them to",
    ],
    enjoymentNote:
      "The single best predictor is enjoyment. A child who looks forward to practice will improve for years; a child who doesn't will stop, whatever their talent.",
    ages: [
      {
        age: "3–4 years",
        focus:
          "General movement, balance and coordination through play. No formal coaching needed.",
      },
      {
        age: "5–6 years",
        focus:
          "Introduction with modified equipment (red ball). Basic strokes and movement learned through games.",
      },
      {
        age: "7–8 years",
        focus: "Technical fundamentals, rallying, and awareness of the court.",
      },
      {
        age: "9–10 years",
        focus:
          "Refine technique, begin structured training, and start local competition.",
      },
      {
        age: "11–13 years",
        focus:
          "Consolidate technique, add physical conditioning, and compete regularly.",
      },
      {
        age: "14+ years",
        focus:
          "Specialise, develop tactically, and plan competition seriously.",
      },
    ],
    lateStart:
      "Starting after ten is completely fine for a lifetime of playing, and many do. It does make the very top of the international game progressively harder to reach — but that is one outcome out of several on this page, not the only one worth having.",
    physical: [
      "Good hand-eye coordination",
      "Quick reaction time",
      "Agility and efficient footwork",
      "Dynamic balance",
      "Flexibility and mobility",
      "Healthy growth and general fitness",
    ],
    heightNote:
      "There is no ideal tennis body, especially for a beginner. Height helps the serve but is not required in childhood — late growth is common, and speed, balance, strength and endurance all improve substantially with age-appropriate training. An early assessment should guide training, not cap expectations.",
    traits: [
      { trait: "Discipline", why: "Improvement needs consistency, not intensity." },
      { trait: "Resilience", why: "Tennis involves losing far more often than winning." },
      { trait: "Coachability", why: "Willingness to be corrected accelerates everything." },
      { trait: "Patience", why: "Progress arrives over years, not weeks." },
      { trait: "Problem-solving", why: "Players decide alone, mid-match, with no help." },
      { trait: "Self-motivation", why: "An individual sport puts it all on them." },
      { trait: "Emotional control", why: "Managing pressure is a skill that can be trained." },
      { trait: "Curiosity", why: "Openness to new technique and tactics keeps them growing." },
    ],
    costs: [
      { level: "Recreational beginner", annual: "₹30,000 – ₹80,000" },
      { level: "Club / intermediate", annual: "₹80,000 – ₹2,00,000" },
      { level: "Competitive, ranked", annual: "₹2,00,000 – ₹5,00,000" },
      { level: "National level", annual: "₹5,00,000 – ₹12,00,000" },
      { level: "International junior", annual: "₹15,00,000 – ₹30,00,000+" },
    ],
    costNote:
      "Indicative, and genuinely variable by city, academy, travel and how many tournaments you enter. Plan progressively — you do not need to buy everything at the start, and most families who stop do so for cost reasons rather than talent reasons.",
    expenses: [
      "Academy fees",
      "Private coaching",
      "Fitness training",
      "Tournament entry fees",
      "Travel and accommodation",
      "Equipment — racquets, shoes, strings, apparel",
      "Physiotherapy and recovery",
      "Nutrition",
      "Sports psychology, where it applies",
    ],
    recreational: [
      "Regular physical activity",
      "Skill development without pressure",
      "Social interaction",
      "Something they can play for life",
      "Flexible training that fits around school",
    ],
    competitive: [
      "Loves competing, not just playing",
      "Enjoys structured practice",
      "Will train consistently",
      "Thrives when challenged",
      "Wants to reach national or international level",
    ],
    switchNote:
      "You do not have to decide now, and the decision is not final. Plenty of children start recreationally and turn competitive once the interest and the ability arrive; plenty of competitive players later go back to playing for enjoyment. The pathway should follow the child.",
  },

  stages: {
    // ── Level 1 · Foundation (handbook stages 2 and 3, ages 4–10) ──
    1: {
      gear: {
        intro:
          "Modern tennis uses the ITF Tennis10s progression: modified balls and smaller courts matched to a child's size, so they can rally in week one instead of month six. Progress through the colours on skill, not birthday.",
        items: [
          {
            item: "Red ball — ages 5–8",
            guidance:
              "Larger, slower, lower-bouncing ball on a small court. Rallies are easy, which is the point: early success builds coordination, balance and basic strokes.",
          },
          {
            item: "Orange ball — ages 7–9",
            guidance:
              "Slightly faster, bigger court, more movement. Consistency, direction and simple point construction start here.",
          },
          {
            item: "Green ball — ages 9–10",
            guidance:
              "Behaves close to a standard ball on a nearly full court. The bridge to full-court tennis: real stroke mechanics, tactics and match play.",
          },
          {
            item: "Racquet size",
            guidance:
              "19–21 inches at 4–5 years, 21–23 at 6–8, 23–25 at 8–10, 25–26 at 10+ before adult frames. Lightweight and junior-specific. An oversized or heavy racquet teaches bad technique and raises injury risk.",
          },
          {
            item: "Shoes",
            guidance:
              "Tennis shoes, not running shoes. Running shoes are built for forward motion; tennis needs lateral stability, grip for sudden direction changes and support when stopping and pivoting. Worth buying properly once training is regular.",
          },
        ],
      },
      load: {
        intro:
          "Children between four and eight should not train like professional athletes. The aim at this age is enjoyment, movement quality and learning — not hours.",
        rows: [
          { age: "4–5 years", sessions: "1–2 a week", duration: "30–45 minutes" },
          { age: "5–6 years", sessions: "2 a week", duration: "45–60 minutes" },
          { age: "6–8 years", sessions: "2–3 a week", duration: "60 minutes" },
          {
            age: "7–8 years (keen players)",
            sessions: "3–4 a week",
            duration: "60–90 minutes",
          },
        ],
        note:
          "Keep other sports going — running, climbing, cycling, swimming, unstructured play. A broad movement base is what supports athletic development later, and specialising early is one of the most common ways families lose a child to burnout at twelve.",
      },
      parentRole: {
        before: [
          "Make sure they arrive rested and hydrated",
          "Bring the right equipment",
          "Encourage enthusiasm without adding pressure",
        ],
        during: [
          "Watch quietly where that's appropriate",
          "Don't coach from outside the court",
          "Trust the coach to run the session",
          "Let your child solve problems on their own",
        ],
        after: {
          instead: "Did you win?",
          ask: [
            "What was the most enjoyable part today?",
            "What new skill did you learn?",
            "What would you like to practise next time?",
          ],
        },
        avoid: [
          "Comparing your child with others",
          "Criticising mistakes straight after practice",
          "Expecting rapid improvement",
          "Changing coaches frequently",
          "Living your own sporting ambitions through them",
        ],
      },
      body: {
        fitness: [
          { area: "Speed", how: "Short sprints, reaction games, acceleration drills" },
          {
            area: "Agility",
            how: "Multi-directional movement, quick changes of direction, balance work",
          },
          {
            area: "Coordination",
            how: "Catching, throwing, hand-eye drills",
          },
          {
            area: "Flexibility",
            how: "Dynamic warm-ups, mobility work, stretching afterwards",
          },
          {
            area: "Endurance",
            how: "Comes naturally from practice, active games, swimming, cycling, running",
          },
        ],
        nutrition: [
          {
            when: "Every day",
            what:
              "Whole grains, fruit and vegetables, lean protein, dairy or an alternative, healthy fats, plenty of water. Habits matter more than sports diets at this age.",
          },
          {
            when: "1–2 hours before",
            what: "Something light and easily digestible.",
            examples: "Banana and yoghurt · peanut butter sandwich · oats with fruit",
          },
          {
            when: "During",
            what:
              "Water is enough under an hour. Longer than that, add water plus fresh fruit or a simple snack.",
          },
          {
            when: "After",
            what: "Protein to repair, carbohydrate to refuel, fluids to replace.",
            examples: "Milk and fruit · rice and dal · eggs on toast · chicken and vegetables",
          },
          {
            when: "Supplements",
            what:
              "Almost never needed at this age unless a qualified professional has recommended them. Meals, sleep and hydration first.",
          },
        ],
      },
      mistakes: [
        "Specialising in one sport too early",
        "Entering too many tournaments",
        "Focusing only on winning",
        "Neglecting general movement and athletic development",
        "Increasing training volume too quickly",
        "Rewarding results more than effort",
        "Comparing your child with their peers",
      ],
      checklist: [
        "Your child enjoys the game and looks forward to practice",
        "The academy focuses on long-term development, not early results",
        "The coach is genuinely experienced with young children",
        "Equipment is age-appropriate — ball colour, racquet length, shoes",
        "Technique is sound across the basic strokes",
        "They move confidently around the court",
        "They understand scoring and match etiquette",
        "Training is balanced against school and free play",
      ],
    },

    // ── Level 2 · First ranking points (handbook stage 4, ages 10–12) ──
    2: {
      gear: {
        intro:
          "Equipment should follow the player's development, not marketing. Frequent racquet changes are unnecessary and usually unhelpful.",
        items: [
          {
            item: "Racquets",
            guidance:
              "Move to larger junior frames, and start learning how weight and balance feel. Change models only on a coach's advice — and keep three or more match-ready frames once you're entering draws.",
          },
          {
            item: "Strings",
            guidance:
              "This is where string type, tension and durability start to matter. Change gradually and with an experienced coach or stringer, not by trial and error.",
          },
          {
            item: "Shoes",
            guidance:
              "Proper tennis shoes with good lateral stability and durable outsoles, replaced once traction goes. Worn-out shoes are a genuine injury risk.",
          },
          {
            item: "Tournament bag",
            guidance:
              "Spare grips and overgrips, water bottles, towels, skipping rope, resistance bands, basic first aid, sun protection for outdoor events.",
          },
        ],
      },
      load: {
        intro:
          "More tournaments do not mean faster improvement. Practice builds the player; competition only measures them.",
        practiceRatio:
          "70–80% training to 20–30% competition. In a typical month that's 18–22 practice sessions, 2–4 match days, and one or two tournaments.",
        note:
          "The healthy cycle is train → compete → review → improve → train again. Entering the next tournament before addressing what the last one exposed is how a season passes with no progress.",
      },
      planning: {
        intro:
          "One of the biggest mistakes families make is entering tournaments with no annual plan. Build a calendar that includes school exams, training blocks, conditioning phases, recovery periods, holidays and equipment replacement — then pick the tournaments that fit it.",
        calendar: [
          { period: "April–May", focus: "Technical development and fitness" },
          { period: "June–July", focus: "Local and regional tournaments" },
          { period: "August", focus: "Training block" },
          { period: "September–October", focus: "AITA tournaments" },
          { period: "November", focus: "Training and physical development" },
          { period: "December", focus: "Major competitions" },
          { period: "January", focus: "Recovery and skill refinement" },
          { period: "February–March", focus: "Tournament prep, balanced with school" },
        ],
      },
      ranking: {
        how: [
          "Points come from the tournament's category, the round reached, and match results",
          "Higher-category tournaments award more points for the same result",
          "Consistency over a season moves a ranking more than one good week",
        ],
        matters: [
          "Direct acceptance into tournaments instead of qualifying",
          "Better seedings",
          "Access to stronger opposition",
        ],
        doesNotMeasure: [
          "Long-term potential",
          "Technical quality",
          "Mental resilience",
          "Physical development",
          "Future success",
        ],
      },
      mistakes: [
        "Registering with AITA before the player is genuinely ready",
        "Measuring success only through ranking",
        "Entering every available tournament",
        "Travelling long distances for low-value events",
        "Choosing tournaments purely for points rather than for development",
      ],
      checklist: [
        "Registered with AITA, with age proof verified",
        "Competing in age-appropriate events rather than the biggest available draw",
        "An annual calendar exists and school exams are in it",
        "Training-to-competition balance is roughly 70/30",
        "Every tournament has a stated objective beyond winning",
      ],
    },

    // ── Level 4 · National ranking (handbook stages 5–6, ages 12–18) ──
    4: {
      load: {
        intro:
          "Physical preparation becomes a performance factor in its own right here — not bodybuilding, but building an athlete who can sustain long matches and long seasons.",
        note:
          "Strength (lower body, core, upper body), speed (first-step acceleration, court coverage, recovery), power (medicine ball, plyometrics, jump training) and endurance across consecutive tournament days. Always age-appropriate and supervised by someone qualified.",
      },
      body: {
        recovery: [
          "Quality sleep, hydration and balanced nutrition, every day",
          "Stretching, mobility work and active recovery",
          "After matches: cool down, rehydrate, recovery nutrition, treat niggles immediately",
          "Review a match only once the emotion has settled",
          "Build rest weeks, reduced-training phases, medical screening and physical reassessment into the year",
        ],
        supportTeam: [
          "Technical coach",
          "Strength and conditioning coach",
          "Physiotherapist",
          "Sports psychologist",
          "Nutritionist",
          "Tournament planner",
          "You — as the primary support person, not the coach",
        ],
      },
      planning: {
        intro:
          "Travel is constant from here, and planning the season in advance genuinely reduces cost. Budget for entry fees, travel, local transport, accommodation, meals, coaching and equipment replacement.",
        travelKit: [
          "Three or more match-ready racquets",
          "Fresh strings and grips",
          "Competition clothing",
          "Tennis shoes, plus a backup pair if possible",
          "Water bottles",
          "Nutrition and snacks",
          "Recovery kit — foam roller, resistance bands",
          "First-aid kit and any medication",
          "ID documents and tournament confirmations",
        ],
      },
      mistakes: [
        "Playing too many tournaments and training too little",
        "Chasing ranking points instead of player development",
        "Comparing rankings with other children",
        "Changing coaches frequently",
        "Ignoring recovery and sleep",
        "Neglecting academics",
        "Increasing tournament volume without increasing recovery",
        "Overspending without a structured annual budget",
        "Failing to plan financially for international competition",
      ],
      checklist: [
        "Understands the AITA tournament structure and where they sit in it",
        "Competing regularly at a level that stretches them without burying them",
        "A sustainable national ranking built on consistency",
        "A coach with a written long-term development plan",
        "An annual tournament, travel and recovery calendar",
        "Academics, training and rest genuinely in balance",
        "Reviews every tournament and adjusts training accordingly",
        "Mental-performance work under way, with professional support where appropriate",
      ],
    },

    // ── Level 5 · International circuit (handbook stages 7–8, ages 16+) ──
    5: {
      load: {
        intro:
          "By this point the decision is no longer only sporting. Only a small share of juniors compete full-time on the ATP or WTA Tour, but thousands use tennis to reach outstanding universities and careers — so success at this stage is measured by the quality of the options created, not by ranking alone.",
        note:
          "Four questions to answer honestly before committing to a professional route: is the player consistently succeeding at national and international junior level; do they genuinely enjoy the demands of elite competition; is there a capable coaching and support team; and is there a sustainable financial plan.",
      },
      planning: {
        intro:
          "Financial planning is the most overlooked part of elite tennis. Build an annual budget and review it — coaching, court fees, fitness, physiotherapy, nutrition, entry fees, domestic and international travel, accommodation, equipment, stringing and insurance.",
        travelKit: [
          "Family investment, planned rather than improvised",
          "Sponsorship and corporate partnerships",
          "State government support",
          "Federation assistance where available",
          "Scholarships",
          "Private benefactors",
        ],
      },
      mistakes: [
        "Treating professional tennis as the only successful outcome",
        "Leaving university planning until the final year of school",
        "Neglecting academic development",
        "Underestimating the financial commitment",
        "Focusing on ranking rather than on the opportunities the sport can open",
      ],
      checklist: [
        "Understands every post-junior route, not just the professional one",
        "Has honestly assessed whether professional tennis fits their goals and readiness",
        "Explored NCAA and university options well before the final school year",
        "Scholarship applications prepared where relevant",
        "A realistic financial plan for the chosen route",
        "Decisions made on long-term aspirations rather than last season's results",
      ],
    },
  },

  careers: {
    intro:
      "Very few players spend their whole lives competing, and that was always going to be true. The discipline, resilience and problem-solving tennis builds transfer directly into a growing industry — and most of these roles pay while you are still playing.",
    tracks: [
      {
        role: "Coaching",
        summary:
          "The most natural transition, and the largest employer in Indian tennis. You teach technique, tactics, physical preparation and sportsmanship to the next group.",
        ladder: [
          "Assistant coach",
          "Academy coach",
          "High-performance coach",
          "National coach",
          "International touring coach",
        ],
        credentials: [
          "AITA Coach Education Programmes",
          "ITF Coaching Certification",
          "PTR — Professional Tennis Registry",
          "GPTCA — Global Professional Tennis Coach Association",
        ],
      },
      {
        role: "Officiating",
        summary:
          "Professional tennis cannot run without trained officials. You apply the rules, manage matches, resolve disputes and keep players safe — and it travels internationally.",
        ladder: ["Line umpire", "Chair umpire", "Referee", "Tournament director"],
        credentials: ["AITA and ITF officiating programmes"],
      },
      {
        role: "Sports management",
        summary:
          "Tournament and event operations, player management, sponsorship and partnerships, marketing, fan engagement, facility management, federation administration. Sports knowledge plus business skills is an increasingly valued combination.",
      },
      {
        role: "Running an academy",
        summary:
          "Much more than coaching: programme design, development pathways, staff, finances, marketing, parent communication, tournament organisation, facilities and technology. Sporting excellence plus sound business practice.",
      },
      {
        role: "Sports science",
        summary:
          "One of the fastest-growing areas in elite sport — strength and conditioning, physiotherapy, sports psychology, nutrition, performance analysis and biomechanics.",
      },
      {
        role: "Media and commentary",
        summary:
          "Television commentary, match analysis, podcasting, digital content, journalism, broadcasting. Communication and storytelling matter as much as technical knowledge.",
      },
      {
        role: "Entrepreneurship",
        summary:
          "Academies, sports technology, performance analytics, wearables, equipment retail, tournament software, athlete management, nutrition, recovery and rehabilitation services.",
      },
    ],
    emerging: [
      "AI-powered performance analysis",
      "Sports data analytics",
      "Athlete management platforms",
      "Digital coaching and online education",
      "Sports technology product development",
      "Fan engagement platforms",
      "Sustainability and facility design",
      "Sports law and governance",
    ],
    skills: [
      "Discipline and consistency",
      "Resilience after losing",
      "Independent problem-solving under pressure",
      "Emotional control",
      "Long-term planning",
      "Self-motivation",
    ],
  },
};
