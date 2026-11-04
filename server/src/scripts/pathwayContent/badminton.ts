/**
 * Badminton pathway content. Seeded by `seedSportPathways.ts`.
 *
 * Same writing rules as the Cricket file: short sentences, plain words, no
 * dashes used as punctuation. Age groups and tournament names are the ones
 * parents hear about. The BAI and state associations change formats and
 * ranking rules from season to season, so a badminton coach should read this
 * once before it goes live.
 */

import {
  PATHWAY_FORMAT_VERSION,
  type PathwayGuideInput,
} from "../../shared/validation/pathwayGuideFormat";

// Same chip set as Tennis. The BAI calendar is a real federation page, so it is
// the one place a parent can see dated tournaments.
const BADMINTON_CALENDAR = "/federations/bai?tab=calendar";

const HELP_LINKS = [
  { label: "Find academy", href: "/booking?tab=academies" },
  { label: "Find coach", href: "/booking?tab=coaches" },
  { label: "Book expert", href: "/booking?tab=experts" },
  { label: "Equipment", href: "/shop" },
  { label: "Assessment", href: "/guidance" },
];

const SITUATIONAL_LEAD = "Your situation decides the step. Pick the line that describes you today.";
const ORDERED_LEAD = "The steps for this stage, in the order they are worth doing.";

export const BADMINTON_GUIDE: PathwayGuideInput = {
  formatVersion: PATHWAY_FORMAT_VERSION,
  sport: { slug: "badminton", name: "Badminton" },
  intro: {
    eyebrow: "Badminton pathway · for parents",
    headline: "Understand. Question. Observe. Decide. Act.",
    description:
      "Six stages, each answering five things: where you are, what you are probably worried about, what to watch for, what you may have to choose, and what to do now.",
  },
  sportIntro: [
    "Badminton is one of the sports where India has done very well on the world stage. Many Indian players have won medals at the Olympics, the World Championships and the Commonwealth Games, and many of them started in ordinary halls in ordinary cities.",
    "It is one of the fastest racquet sports. It builds quick feet, good balance, strong legs and sharp thinking. It can be played alone or in doubles, and it can be enjoyed for life.",
    "The path runs from a first game in the park to district and state tournaments, national ranking events, international junior events and, for a few, the national team. Most players find a level that suits them. Badminton also leads to coaching, umpiring and many other roles around the game.",
  ],
  stages: [
    // ── 1 ──────────────────────────────────────────────────────────────────
    {
      key: "discover-badminton",
      name: "Discover Badminton",
      ageRange: "~5-8",
      coreQuestion: "Should my child try badminton?",
      overview:
        "Your child has started to play, or you are thinking about it. At this age the only job is to see if they enjoy it and want to keep going. Do not think about ranks, tournaments or famous academies yet. Hitting the shuttle, moving around the court and having fun is the whole plan.",
      questions: [
        {
          question: "Is badminton right for my child?",
          answer:
            "Most children enjoy hitting a shuttle. Some are quick, some are shy, some get tired fast. All of that is normal. At this age, wanting to play matters more than being good at it.",
        },
        {
          question: "What age should my child start?",
          answer:
            "Six to eight is a good time to start in a group. Younger children can play at home with a light racquet. Starting at 8 instead of 5 does not put a child behind.",
        },
        {
          question: "What should the first 3 to 6 months look like?",
          answer:
            "Learn how to hold the racquet, hit the shuttle over the net and move around the court. Play short, simple games. Skip long drills and early tournaments.",
        },
        {
          question: "How often should my child play?",
          answer:
            "Two or three sessions a week of about an hour is enough. Add free play at home if your child asks. A child who plays a little each week does better than one who plays hard for a month and quits.",
        },
        {
          question: "What equipment do we need?",
          answer:
            "A light junior racquet, a few feather or nylon shuttles and a pair of indoor court shoes. Court shoes matter because running shoes slip on a hall floor and can cause a twisted ankle. Do not buy a costly racquet yet. Children outgrow them. Shuttles and court rent are the real running cost, so ask the academy what is included before you pay.",
        },
        {
          question: "What should I expect from a coach?",
          answer:
            "A coach who is patient and makes games out of drills. Your child should be hitting the shuttle for most of the session. Be careful with batches where 20 children share one court and each gets a few minutes.",
        },
        {
          question: "Can my child play other sports too?",
          answer:
            "Yes, and it helps. Swimming, cricket, football and athletics all build speed and balance. Trying more than one sport at this age is a good thing.",
        },
      ],
      signals: [
        {
          title: "Wants to play",
          detail:
            "Does your child ask to go to the court? Do they pick up a racquet at home without being told?",
        },
        {
          title: "Likes hitting the shuttle",
          detail:
            "Watch if they enjoy it even when the shuttle goes everywhere. Control comes later.",
        },
        {
          title: "Quick on the feet",
          detail:
            "Moving, jumping and changing direction are what badminton is made of. See if your child enjoys them.",
        },
        {
          title: "Handles mistakes and losses",
          detail:
            "Missing the shuttle will happen often. See if your child laughs and tries again or goes quiet.",
        },
        {
          title: "Plays outside coaching",
          detail: "A game in the building, the terrace or the park is the best sign of all.",
        },
      ],
      decisions: [
        {
          title: "Which coach or academy?",
          detail:
            "Pick one close to home so the trip does not become the hard part. Watch a full session before you pay for a term.",
        },
        {
          title: "Coached or just play?",
          detail:
            "For the first few months, play with family plus one or two coached sessions a week is enough.",
        },
        {
          title: "Should badminton be the only sport?",
          detail: "Not yet. Let your child try a few things and see what they keep asking for.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        {
          when: "Not started",
          action:
            "Visit 2 or 3 trial sessions near you and watch how the coach treats the children.",
        },
        {
          when: "Just started",
          action: "Give it 3 to 6 months. Notice if your child still looks forward to it.",
        },
        {
          when: "Enjoying badminton",
          action: "Ask the coach what your child is good at and what to work on next.",
        },
        {
          when: "Unsure",
          action: "Talk to an expert or to a parent whose child is a year or two ahead.",
        },
        {
          when: "Not enjoying it",
          action: "Find out why. It may be the batch, not the sport. If not, try another sport.",
        },
      ],
      primaryAction: { label: "Find trial sessions near you", href: "/booking?tab=academies" },
      helpLinks: HELP_LINKS,
    },

    // ── 2 ──────────────────────────────────────────────────────────────────
    {
      key: "learn-and-develop",
      name: "Learn & Develop",
      ageRange: "~8-12",
      coreQuestion: "Is my child learning the basics the right way?",
      overview:
        "Badminton becomes a regular habit. Your child learns a proper grip, footwork, the main strokes and how to play a simple rally. The job now is a good base and a healthy body. Results matter very little at this age.",
      questions: [
        {
          question: "Is the coach teaching the basics well?",
          answer:
            "Look for a relaxed grip, good footwork and clean strokes. A coach who spends time on footwork is worth more than one who teaches fancy shots. Ask your child what they practised this week. If they can tell you, the teaching is working.",
        },
        {
          question: "Why does everyone talk about footwork?",
          answer:
            "In badminton the feet get you to the shuttle on time. A child with good footwork can reach more shots and hits them with less strain. Bad footwork picked up now is hard to fix at 14.",
        },
        {
          question: "Should my child play singles or doubles?",
          answer:
            "Both. Singles builds stamina and court cover. Doubles builds speed, teamwork and quick reactions. Many players find out which one suits them only around 12 to 14.",
        },
        {
          question: "How many sessions a week is right?",
          answer:
            "Three or four sessions a week of 60 to 90 minutes is enough for most children. Keep at least one full rest day. School comes first.",
        },
        {
          question: "What about injuries?",
          answer:
            "Ankles, knees, shoulders and wrists take the most strain. Warm up before every session, wear proper court shoes and stop if something hurts. If the pain keeps coming back, rest and show a doctor.",
        },
        {
          question: "When should my child play a tournament?",
          answer:
            "When they enjoy matches and know the basic rules. A few friendly or district events are enough at first. Do not rush into state level events just to say it was done.",
        },
        {
          question: "Does the racquet really matter?",
          answer:
            "A little. A racquet that is too heavy or has too big a grip strains the wrist and shoulder. Strings pulled too tight hurt the arm and are wrong for a child. Ask the coach or a good stringer for a light racquet and a low string tension, and replace it as your child grows.",
        },
        {
          question: "Is it normal to train twice a day at this age?",
          answer:
            "Not at 8 to 12. Some academies run early morning and evening sessions even for young children, and parents feel they will fall behind if they do not join. A child's body and mind need rest, and many children who train too much too early get hurt or lose interest by 14. Fewer, better sessions are the safer choice.",
        },
        {
          question: "What is my job as a parent?",
          answer:
            "Get your child there on time, feed them well, and let the coach coach. Do not call out instructions from the gallery or compare your child with others. After a match, give them some time before you talk about it, and start with something they did well. Children who feel watched and judged stop enjoying the game.",
        },
      ],
      signals: [
        {
          title: "Cleaner strokes",
          detail:
            "Compare how your child hits the shuttle now to six months ago. You do not need to be an expert to see the change.",
        },
        {
          title: "Better footwork",
          detail:
            "Does your child reach the shuttle on time and recover to the centre? This is the best sign of real progress.",
        },
        {
          title: "Understands the game",
          detail: "Does your child start to place shots, or just hit it back and hope?",
        },
        {
          title: "Enjoyment",
          detail:
            "If the smile is gone, something needs to change. It could be the load, the coach or the batch.",
        },
        {
          title: "Body coping well",
          detail: "Watch for repeated pain in ankles, knees or shoulders. Do not push through it.",
        },
      ],
      decisions: [
        {
          title: "Is this academy still right?",
          detail:
            "Check if the coaching, the number of children per court and the hall suit your child now. Switching is fine if the answer is no.",
        },
        {
          title: "How much badminton?",
          detail: "More is not always better. Keep your child fresh and interested.",
        },
        {
          title: "Badminton for fun or to compete?",
          detail:
            "Both are fine. Decide by what your child wants, not by what the neighbour's child is doing.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        { when: "Going well", action: "Keep going. Check progress with the coach every 3 months." },
        {
          when: "Keen and improving",
          action: "Add a few friendly matches and ask the coach about your district association.",
        },
        {
          when: "Stuck for months",
          action: "Review the coach, the batch and the workload before blaming your child.",
        },
        {
          when: "Complaining of pain",
          action: "Rest for a week or two and have it checked. Do not wait for it to get worse.",
        },
      ],
      primaryAction: { label: "Review the academy and coach", href: "/booking?tab=academies" },
      helpLinks: HELP_LINKS,
    },

    // ── 3 ──────────────────────────────────────────────────────────────────
    {
      key: "compete-and-assess",
      name: "Compete & Assess",
      ageRange: "~10-14",
      coreQuestion: "Where does my child really stand?",
      overview:
        "Matches now count. Your child plays district and state tournaments in age groups such as Under 13 and Under 15 (some states also run Under 11), and starts to earn ranking points. This is the stage where parents see how many children are in the race. The aim is to learn where your child stands and whether they still love the game.",
      questions: [
        {
          question: "How do I enter tournaments?",
          answer:
            "Competitive players register through their state badminton association and get a BAI ID before they can play national ranking events. Your coach or academy usually helps with this. Start with district and state events and move up from there.",
        },
        {
          question: "How do ranking points work?",
          answer:
            "Players earn points by winning matches in ranking tournaments. Bigger events give more points. Rankings are kept by age group, so a child moves into a new list each time they move up an age group. A good ranking helps with seeding and entry into bigger events.",
        },
        {
          question: "Which tournaments should my child play?",
          answer:
            "Start with district and state events, then national ranking tournaments in your age group. Choose events where your child plays several matches, not just one. Ask the coach which ones suit your child's level.",
        },
        {
          question: "How do we know if my child is good enough?",
          answer:
            "Do not go only by wins. Ask the coach how your child compares with others in the state, how they play against stronger players and how they behave in a close match. One honest opinion from a coach outside your own academy helps.",
        },
        {
          question: "What if my child keeps losing?",
          answer:
            "Almost every player goes through it. Losing to better players is how a child learns. Look at whether games are getting closer and whether your child is trying new things. If the fun is gone, talk about it.",
        },
        {
          question: "What does a tournament day look like?",
          answer:
            "Long. Matches start early and your child may wait for hours between games, so pack water, light food, a spare shirt, spare racquet and a charged phone for the schedule. Matches can run late, and a player who loses early may have a free day, so plan travel with some give. Keep your child warm and loose between matches. Coaches usually speak to the players only between games, so stay calm in the stands.",
        },
        {
          question: "How are state teams and national events picked?",
          answer:
            "Entry to most ranking tournaments is open to registered players, with seeding based on ranking. Some bigger events, such as the inter-state team events, need selection by your state association, usually through trials or ranking. Ask your state association how it picks its teams, and when.",
        },
        {
          question: "Are all camps and 'ranking' offers real?",
          answer:
            "No. Be careful with camps that promise ranking points, selection or a national trial for a fee. Ranking points come from playing recognised tournaments, not from paying anyone. Before you pay for a camp or an academy, ask who runs it, where past players are now and what exactly is included.",
        },
        {
          question: "What if my child is a girl?",
          answer:
            "Badminton is one of the sports where Indian women have led the way, and girls play in the same age-group events as boys. Many academies have fewer girls, so finding sparring partners of the same level can be harder. Ask the academy how it will arrange practice partners, and look for a coach who takes girls as seriously as boys.",
        },
        {
          question: "What does it cost?",
          answer:
            "Racquets, shuttles, court fees, travel and entry fees add up fast. Set a yearly amount you are comfortable with. Be careful with anyone who promises results or ranking for a fee. No academy can guarantee success.",
        },
        {
          question: "Do we need to keep age records in order?",
          answer:
            "Yes. Age matters for every age-group event, and age can be checked. Keep the birth certificate, school records and ID details matching.",
        },
      ],
      signals: [
        {
          title: "Results and quality of wins",
          detail:
            "A close loss to a top player can say more than an easy win. Ask the coach to tell you which is which.",
        },
        {
          title: "Ranking over a few events",
          detail: "Look at how the ranking changes across a season, not just one tournament.",
        },
        {
          title: "Coping with pressure",
          detail:
            "Some children play better in a big match, some freeze. Both can improve, but you should know which one yours is.",
        },
        {
          title: "Still enjoying it",
          detail:
            "A child who dreads practice at 12 is unlikely to still be playing at 18. Take this seriously.",
        },
        {
          title: "Coach's honest view",
          detail:
            "Ask what your child is good at, what is missing and what the next level looks like.",
        },
      ],
      decisions: [
        {
          title: "Which tournaments are worth the cost?",
          detail:
            "Pick events where your child plays several matches. Avoid long trips for one game.",
        },
        {
          title: "Is it time to get more serious?",
          detail:
            "Only if your child wants it as much as you do, and the coach sees real promise. More training should be a choice, not a push.",
        },
        {
          title: "Is this academy enough?",
          detail:
            "If your child has outgrown the coach or the sparring, look for a stronger set-up. Visit it and talk to its parents first.",
        },
        {
          title: "How do we balance school?",
          detail:
            "Plan tournament weeks around exams. Missing a lot of school at this age rarely pays off.",
        },
      ],
      nextStepLead: ORDERED_LEAD,
      nextSteps: [
        {
          when: "Step 1",
          action:
            "Register with your state association and get a BAI ID if your child will play ranking events.",
        },
        { when: "Step 2", action: "Sort out age and ID papers so they match everywhere." },
        {
          when: "Step 3",
          action: "Plan a year of tournaments with the coach, with school exams marked first.",
        },
        {
          when: "Step 4",
          action: "Keep a simple note of matches played, what went well and what to fix.",
        },
        {
          when: "Step 5",
          action:
            "After the season, sit down with your child and the coach and decide the next step together.",
        },
      ],
      primaryAction: { label: "See the tournament calendar", href: BADMINTON_CALENDAR },
      helpLinks: HELP_LINKS,
    },

    // ── 4 ──────────────────────────────────────────────────────────────────
    {
      key: "performance-and-decide",
      name: "Performance & Decide",
      ageRange: "~13-16",
      coreQuestion: "How far can my child take badminton?",
      overview:
        "Training becomes more planned. Fitness, a main event, recovery and school exams all need space in the same week. National ranking tournaments and the junior international circuit are the big goals for strong players. This is also the stage to be honest about what level is likely.",
      questions: [
        {
          question: "Should my child pick singles or doubles now?",
          answer:
            "Slowly, yes. By 14 or 15 most players lean towards one. Many still play both. Keep the other skills sharp, because it makes the main event stronger.",
        },
        {
          question: "What does serious fitness work look like?",
          answer:
            "Footwork drills, speed work, jumping, strength work with proper guidance, stretching and rest. A teenager should not lift heavy weights without a trained person watching. Ask for a plan made for teenagers, not a copy of what senior players do.",
        },
        {
          question: "How do we avoid injuries?",
          answer:
            "Warm up properly, sleep well, eat well and rest between hard sessions. During fast growth, cut the load, because knees, ankles and backs are at risk. Treat pain early and do not play through it.",
        },
        {
          question: "What is the junior international circuit?",
          answer:
            "The world federation, the BWF, runs junior events across the world, including the Asia and World Junior Championships. Players are chosen by national ranking and performance. Most children will not reach this level, but strong players should know it exists and what it takes.",
        },
        {
          question: "What about diet and supplements?",
          answer:
            "Good home food, enough water and enough sleep are what a teenager needs. Do not give protein powders or other supplements without a doctor's advice. Some products contain banned substances, and players can be tested even at younger levels.",
        },
        {
          question: "What if my child hits a plateau or loses interest?",
          answer:
            "It is common around 14 to 16. First check the load: too much training, too little rest and too many tournaments cause most dips. Talk to your child without pressure. A short break often brings back the interest. If it does not, listen. It is better to move to recreational play happily than to push on unhappily.",
        },
        {
          question: "How do we manage Class 10 and Class 12?",
          answer:
            "Plan ahead. Pick your exam years and keep badminton lighter before boards. Many good players manage both, but it takes a plan and a coach who supports it.",
        },
        {
          question: "Is a big city academy the answer?",
          answer:
            "Not always. Some of the best known academies are in Hyderabad and Bengaluru, and they can give strong sparring and coaching. But they are costly, move your child away from home and take only a few players. If your child would live in a hostel, check the supervision, food, safety and how schooling is handled. A good coach nearer home can do more than a famous name where your child gets little court time. Visit and talk to parents before deciding.",
        },
      ],
      signals: [
        {
          title: "Steady growth in ranking and results",
          detail:
            "Look at the last two or three seasons together, not one tournament. Is your child moving up the age group list or staying where they were?",
        },
        {
          title: "Close matches against stronger players",
          detail: "Even losses can show progress if the score gap is shrinking.",
        },
        {
          title: "Fitness and body",
          detail:
            "Is your child getting faster and stronger, and recovering well? Frequent injuries mean the load is too high or the plan is wrong.",
        },
        {
          title: "Mind under pressure",
          detail:
            "Can they play well in a tight game, and bounce back after a bad day? This often separates players at this level.",
        },
        {
          title: "Marks and energy for school",
          detail: "If studies are suffering and sleep is gone, the plan needs to change.",
        },
        {
          title: "Their own drive",
          detail:
            "Does your child push themselves to practise, or do you have to push them? This tells you a lot.",
        },
      ],
      decisions: [
        {
          title: "Is this level of badminton right for my child?",
          detail:
            "Think about what your child wants, what the coach sees and what your family can support. All three need to line up.",
        },
        {
          title: "Which level is realistic?",
          detail:
            "State ranking, national ranking, junior international events, university badminton, a sports quota job and the national team are very different goals. Ask the coach what each would need.",
        },
        {
          title: "Is it time to change academy or coach?",
          detail:
            "If your child has stopped learning, speak to the coach first. If nothing changes, look elsewhere.",
        },
        {
          title: "How much should we invest?",
          detail:
            "Set a yearly limit and a point where you review. Do not keep spending out of fear that stopping would waste what is already spent.",
        },
      ],
      nextStepLead: ORDERED_LEAD,
      nextSteps: [
        {
          when: "Step 1",
          action:
            "Ask the coach for a full honest review: strokes, footwork, fitness and attitude.",
        },
        {
          when: "Step 2",
          action:
            "Make a 12 month plan for training and tournaments, with Class 10 or 12 exams marked first.",
        },
        { when: "Step 3", action: "Set up a fitness and recovery plan with a qualified person." },
        {
          when: "Step 4",
          action: "Map the national ranking events and what ranking each one needs.",
        },
        {
          when: "Step 5",
          action:
            "Start talking with your child about what comes after school, early and without pressure.",
        },
      ],
      primaryAction: { label: "Get a serious-badminton review", href: "/booking?tab=experts" },
      helpLinks: HELP_LINKS,
    },

    // ── 5 ──────────────────────────────────────────────────────────────────
    {
      key: "pathway",
      name: "Pathway",
      ageRange: "~15-18",
      coreQuestion: "What is the right path after school?",
      overview:
        "Your child is now close to the senior game. The main routes are senior national ranking events, the Indian junior and senior teams, university badminton, jobs through sports quota and, for the very few, a place on the world tour. Most players will not play professionally. A good plan has more than one door.",
      questions: [
        {
          question: "How does a player move from junior badminton to the top?",
          answer:
            "Most strong players do well in junior national ranking events, then move up to the senior circuit and national camps. Players picked for the Indian team play in events such as the Thomas and Uber Cups, the Asian Games and the Commonwealth Games. Good results in India and in junior international events help get noticed by selectors.",
        },
        {
          question: "How realistic is playing for India?",
          answer:
            "Very few get there. Thousands of children play in every age group and only a few make the national squad. This is no reason to stop. It is a reason to keep studies and a second plan going.",
        },
        {
          question: "What about college and university badminton?",
          answer:
            "Many universities run badminton teams and play inter-university events. A good college team keeps a player in match shape while they study. Ask about it before choosing a college, because some are much better than others.",
        },
        {
          question: "Can badminton help get a job?",
          answer:
            "Yes. Banks, railways, public sector companies, the armed forces and other employers recruit players on a sports quota. State and national level players are often considered. Many colleges also keep seats for sportspersons, and they usually ask for certificates from recognised state or national events, so keep every certificate and result sheet. The rules differ by employer and college, so check what each one asks for.",
        },
        {
          question: "What does the international circuit cost?",
          answer:
            "A lot. Flights, hotels, entry fees, a coach and physio on tour all add up, and prize money at lower events often does not cover it. Most players need support from an employer, a sponsor or a scheme to keep going. Ask the coach what a year on tour would really cost before you plan around it.",
        },
        {
          question: "Are there government schemes that help?",
          answer:
            "Some programmes, such as Khelo India, give support to promising young players. The rules and the number of places change, so check the current details on the official sites or ask your state association.",
        },
        {
          question: "How do we keep studies on track?",
          answer:
            "Choose a college and course that allow time for training and tournaments. Open or distance courses suit some players. Avoid dropping out of studies for badminton unless there is a clear offer and a back-up plan.",
        },
      ],
      signals: [
        {
          title: "Level in national junior events",
          detail:
            "Is your child among the better players in the state and getting noticed nationally? Be honest about both.",
        },
        {
          title: "Called to camps",
          detail: "Repeated calls matter more than one lucky result.",
        },
        {
          title: "Fitness and injury record",
          detail:
            "Senior badminton is faster and harder. A player who keeps getting injured needs a plan before moving up.",
        },
        {
          title: "Academic position",
          detail:
            "Boards, entrance exams and college options all need time. See where your child stands.",
        },
        {
          title: "What your child wants",
          detail:
            "Some want a badminton career at any cost, some want a good life with badminton in it. Both are fine. Know which one it is.",
        },
        {
          title: "What your family can support",
          detail: "Money, time and travel are real limits. Talk about them early.",
        },
      ],
      decisions: [
        {
          title: "Try for the senior circuit, or choose college badminton?",
          detail:
            "These can go together for some players. Ask the coach and the college what is possible.",
        },
        {
          title: "Which college and course?",
          detail:
            "Look at badminton facilities, how the college treats sportspersons and the course you actually want.",
        },
        {
          title: "Stay in this city or move?",
          detail:
            "A move to a stronger badminton centre can help, but it is hard on a teenager. Visit first and talk to families there.",
        },
        {
          title: "What is the back-up plan?",
          detail: "Have one, and write it down. A plan B is what lets your child play freely.",
        },
      ],
      nextStepLead: ORDERED_LEAD,
      nextSteps: [
        {
          when: "Step 1",
          action:
            "Sit down with your child and the coach and list the options: senior circuit, national team, college, quota job, other.",
        },
        {
          when: "Step 2",
          action:
            "Check which colleges and employers in your area take badminton players, and what they ask for.",
        },
        {
          when: "Step 3",
          action: "Keep a clean record of results, ranking and certificates in one folder.",
        },
        {
          when: "Step 4",
          action:
            "Plan the next 12 to 24 months around boards, entrance exams and the tournament season.",
        },
        {
          when: "Step 5",
          action: "Agree on a date to review the plan, and be ready to change it.",
        },
      ],
      primaryAction: { label: "Start a pathway assessment", href: "/guidance" },
      helpLinks: HELP_LINKS,
    },

    // ── 6 ──────────────────────────────────────────────────────────────────
    {
      key: "transition-and-beyond",
      name: "Transition & Beyond",
      ageRange: "18+",
      coreQuestion: "What can badminton do for me next?",
      overview:
        "Whether the player reaches the national team or not, badminton does not have to end. Some play at club, corporate or university level. Some move into coaching, umpiring, fitness, sports science, sports management or media. Others keep playing for fun and build a career in something else.",
      questions: [
        {
          question: "Can I keep playing?",
          answer:
            "Yes. Club leagues, corporate tournaments, university teams and veteran events all let you keep playing at a good level for many years. Badminton is one of the few sports you can play well into your 50s.",
        },
        {
          question: "What jobs are there in badminton?",
          answer:
            "Coaching, umpiring, fitness training, physiotherapy, video analysis, running an academy or a court, equipment and retail, commentary and journalism. Some need a qualification. The BWF and BAI run courses for coaches and officials.",
        },
        {
          question: "How do I become a coach?",
          answer:
            "Most coaches start by helping at an academy or school and studying for a coaching certificate. A playing record helps, but good teaching matters more. Begin early, even part time.",
        },
        {
          question: "What if I did not make it as a player?",
          answer:
            "You still know the game, the people and the discipline. Many former players do well as coaches, analysts and business owners. Not making the team is common and is not a failure.",
        },
        {
          question: "What if an injury ends my playing?",
          answer:
            "It is one of the hardest things in sport, and it happens to good players, especially after knee, ankle or shoulder injuries. Give yourself time, and do not decide your future in the first month. Many injured players stay in the game as coaches, analysts or physios, and some find that their knowledge of the body and the game is worth a lot. Talk to someone you trust.",
        },
        {
          question: "How do I move on well?",
          answer:
            "Plan before the playing stops. Finish your degree, pick up a skill outside badminton, and keep in touch with coaches and team mates. The sooner you start, the easier the change.",
        },
      ],
      signals: [
        {
          title: "Still want to play",
          detail: "If yes, find a club or league and keep fit. If no, that is also a clear answer.",
        },
        {
          title: "Skills beyond badminton",
          detail: "A degree, a certificate or a trade gives you choices.",
        },
        {
          title: "People who know you",
          detail: "Coaches, team mates and officials can open doors if you keep in touch.",
        },
        {
          title: "Money you can count on",
          detail:
            "Badminton income is uneven. Know how you will cover your costs while you build the next step.",
        },
      ],
      decisions: [
        {
          title: "Keep playing, and where?",
          detail:
            "Club, corporate, university or just weekends. Each takes a different amount of time.",
        },
        {
          title: "Work in badminton or outside it?",
          detail: "You can do both at the start. See which you enjoy more.",
        },
        {
          title: "What course or certificate do I need?",
          detail: "Check what the job asks for before you pay for a course.",
        },
      ],
      nextStepLead: ORDERED_LEAD,
      nextSteps: [
        { when: "Step 1", action: "Decide if you want to keep playing, and at what level." },
        {
          when: "Step 2",
          action: "Pick one or two roles in the game that interest you and learn what they need.",
        },
        { when: "Step 3", action: "Talk to someone already doing that job." },
        {
          when: "Step 4",
          action: "Make a plan for the next 2 to 3 years, with study and income included.",
        },
      ],
      primaryAction: { label: "Explore careers in badminton", href: "/booking?tab=experts" },
      helpLinks: HELP_LINKS,
    },
  ],
};
