/**
 * Cricket pathway content. Seeded by `seedSportPathways.ts`.
 *
 * Plain words on purpose: short sentences, no jargon, no dashes used as
 * punctuation. A parent who has never watched a junior trial should be able to
 * read every line without help.
 *
 * Rules and tournament names here are the ones a parent will hear about. The
 * BCCI and state associations change age limits and formats from season to
 * season, so a cricket coach should read this once before it goes live.
 */

import {
  PATHWAY_FORMAT_VERSION,
  type PathwayGuideInput,
} from "../../shared/validation/pathwayGuideFormat";

const HELP_LINKS = [
  { label: "Find academy", href: "/booking?tab=academies" },
  { label: "Find coach", href: "/booking?tab=coaches" },
  { label: "Book expert", href: "/booking?tab=experts" },
  { label: "Equipment", href: "/shop" },
  { label: "Assessment", href: "/guidance" },
];

const SITUATIONAL_LEAD = "Your situation decides the step. Pick the line that describes you today.";
const ORDERED_LEAD = "The steps for this stage, in the order they are worth doing.";

export const CRICKET_GUIDE: PathwayGuideInput = {
  formatVersion: PATHWAY_FORMAT_VERSION,
  sport: { slug: "cricket", name: "Cricket" },
  intro: {
    eyebrow: "Cricket pathway · for parents",
    headline: "Understand. Question. Observe. Decide. Act.",
    description:
      "Six stages, each answering five things: where you are, what you are probably worried about, what to watch for, what you may have to choose, and what to do now.",
  },
  sportIntro: [
    "Cricket is the most followed sport in India, and almost every child has played it in a gully, a society compound or a school ground. That also means it is crowded. Thousands of children play at every age, and only a small number reach state teams.",
    "It is a team game, but a lot of it is one child against the ball. Batting, bowling and fielding each ask for different things, so a child who does not enjoy one part may love another.",
    "The path runs from a first bat in the park to district matches, state age-group teams, and for a few, the national side. Most players find their level somewhere along the way. Cricket also leads to coaching, umpiring, jobs in sports quota and many other roles, so a child who stays with the game is rarely left with nothing.",
  ],
  stages: [
    // ── 1 ──────────────────────────────────────────────────────────────────
    {
      key: "discover-cricket",
      name: "Discover Cricket",
      ageRange: "~5-8",
      coreQuestion: "Should my child try cricket?",
      overview:
        "Your child has just started playing, or you are thinking about it. The only job at this age is to find out if they enjoy the game enough to keep coming back. Do not think about trials, ranks or big academies yet. Throwing, catching, hitting and running around with friends is the whole plan.",
      questions: [
        {
          question: "Is cricket right for my child?",
          answer:
            "Most children enjoy hitting a ball and running. Some love batting, some love bowling, some just love being with friends. All of these are fine. At this age, a child who wants to play every evening matters more than a child who looks naturally talented.",
        },
        {
          question: "What age should my child start?",
          answer:
            "Six to eight is a good time for a proper start. Younger children can play too, but keep it short and fun. Starting at 8 instead of 5 does not put a child behind.",
        },
        {
          question: "What should the first 3 to 6 months look like?",
          answer:
            "Learn to throw and catch, hold a bat, hit a soft ball and run between the wickets. Play short games with a tennis ball or a soft ball. Skip hard-ball cricket and long net sessions for now.",
        },
        {
          question: "How often should my child play?",
          answer:
            "Two or three sessions a week of about an hour is plenty. Add free play in the evening if your child wants it. Regular and light works better than daily and tiring.",
        },
        {
          question: "What equipment do we need?",
          answer:
            "A bat of the right size, a soft ball and a pair of comfortable shoes. Pads, gloves and a helmet are needed only when your child starts facing a hard ball. A bat that is too big or heavy spoils the way a child hits, so size matters more than brand.",
        },
        {
          question: "What should I expect from a coach?",
          answer:
            "A good coach at this age keeps every child busy, makes games out of drills and is kind about mistakes. Be careful with batches where 30 children wait in one line and each gets three balls. Your child should be touching the ball most of the time.",
        },
        {
          question: "Can my child play other sports too?",
          answer:
            "Yes, and it helps. Running, swimming and football all build the speed and balance cricket needs later. Nothing is lost by trying more than one thing at this age.",
        },
      ],
      signals: [
        {
          title: "Wants to go back",
          detail:
            "Does your child ask when the next session is? That is the best sign at this age, better than any shot they play.",
        },
        {
          title: "Likes the ball",
          detail:
            "Watch if they enjoy throwing, catching and hitting even when nobody is teaching them.",
        },
        {
          title: "Can wait for a turn",
          detail:
            "Cricket has a lot of waiting. A child who stays interested while others bat is ready for team practice.",
        },
        {
          title: "Handles getting out",
          detail:
            "Getting out early or dropping a catch will happen often. See if your child bounces back or goes quiet for the day.",
        },
        {
          title: "Plays outside of coaching",
          detail: "Games in the park, on the terrace or with cousins show real interest.",
        },
      ],
      decisions: [
        {
          title: "Which coach or academy?",
          detail:
            "Pick one close to home so the trip does not become the hard part. Watch a full session before you pay for a term.",
        },
        {
          title: "Coaching batch or just play?",
          detail:
            "For the first few months, regular play with friends plus one or two coached sessions a week is enough.",
        },
        {
          title: "Should cricket be the only sport?",
          detail: "Not yet. Let your child try a few things and see what they keep asking for.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        {
          when: "Not started",
          action: "Visit 2 or 3 trial sessions near you and watch how the coach treats the kids.",
        },
        {
          when: "Just started",
          action: "Give it 3 to 6 months. Notice if your child still looks forward to it.",
        },
        {
          when: "Enjoying cricket",
          action: "Ask the coach what your child is good at and what to work on next.",
        },
        {
          when: "Unsure",
          action: "Talk to an expert or to another parent whose child is a year or two ahead.",
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
        "Cricket becomes a regular habit. Your child learns a proper grip, stance and bowling action, tries different roles and slowly moves to the leather ball. The job now is a good base and a safe body. Results and scorecards matter very little.",
      questions: [
        {
          question: "Is the coach teaching the basics well?",
          answer:
            "Look for a straight bat, a balanced stance, a clean bowling action and good catching. A coach who teaches these patiently is worth more than one who gets quick results. Ask your child what they learned this week. If they can tell you, the teaching is working.",
        },
        {
          question: "Should my child pick batting or bowling now?",
          answer:
            "No. Let them bat, bowl and field all through this stage. Roles often change as children grow. A slow bowler at 10 may be a batter at 14. Wicketkeeping is also worth a try.",
        },
        {
          question: "When should my child move to the leather ball?",
          answer:
            "Many children start between 10 and 12. Ask the coach to use a lighter or softer ball first, and make sure your child has a helmet with a grill, pads, gloves and an abdominal guard (the box). Wicketkeepers and close fielders need the helmet too. The move should feel slow and safe. A frightened child will pick up bad habits.",
        },
        {
          question: "How much should my child bowl?",
          answer:
            "Not too much. Young bowlers who bowl long spells day after day can hurt their back and shoulders. Ask the coach to keep a count of overs per week and give rest days. This matters most for fast bowlers.",
        },
        {
          question: "How many sessions a week is right?",
          answer:
            "Three or four sessions a week is enough for most children at this age. Add a match on weekends. Keep at least one full rest day, and keep school first.",
        },
        {
          question: "Should my child play school or club matches?",
          answer:
            "Yes, a few. Matches teach things nets cannot. Many academies give children a lot of net practice and very few real matches. A child who bats in nets five days a week but plays one match a month is not learning the game. Pick friendly or school matches where every child gets to bat and bowl, not only the strong ones.",
        },
        {
          question: "Can a bowling action be a problem?",
          answer:
            "Yes. Bowlers with a bent arm or an unusual action can be reported in age-group cricket, and a faulty action is also hard on the back and shoulder. Ask the coach to check your child's action early, while it is easy to fix. Do not leave it until 15.",
        },
        {
          question: "What is my job as a parent?",
          answer:
            "Get your child there on time, feed them well, and let the coach coach. Do not shout instructions from the boundary or compare your child with others. After a match, give them an hour before you talk about it, and start with something they did well. Children who feel watched and judged stop enjoying the game.",
        },
      ],
      signals: [
        {
          title: "Basics getting cleaner",
          detail:
            "Compare how your child holds the bat, catches and bowls now to six months ago. You do not need to be an expert to see the change.",
        },
        {
          title: "Confidence with the ball",
          detail:
            "Is your child scared of the hard ball, or getting more comfortable each month? Fear that does not fade needs a coach's attention.",
        },
        {
          title: "Enjoyment",
          detail:
            "If the smile is gone, something needs to change. It could be the load, the coach or the batch.",
        },
        {
          title: "Body coping well",
          detail:
            "Watch for repeated pain in the back, shoulder, knee or heel. Do not push through it. Rest and show a doctor if it stays.",
        },
        {
          title: "Coach and batch quality",
          detail:
            "Does your child get enough balls to face and bowl? Does the coach know every child's name and what each one is working on?",
        },
      ],
      decisions: [
        {
          title: "Is this academy still right?",
          detail:
            "Check if the coaching, the batch size and the ground suit your child now. Switching is fine if the answer is no.",
        },
        {
          title: "When to start leather ball?",
          detail:
            "Wait until your child is physically and mentally ready, and the coach agrees. There is no prize for starting early.",
        },
        {
          title: "Cricket for fun or cricket to compete?",
          detail:
            "Both are fine. Decide by what your child wants, not by what the neighbour's child is doing.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        { when: "Going well", action: "Keep going. Check progress with the coach every 3 months." },
        {
          when: "Keen and improving",
          action:
            "Add a few friendly matches and ask the coach about the district age-group set-up.",
        },
        {
          when: "Stuck for months",
          action: "Review the coach, the batch and the workload before blaming your child.",
        },
        {
          when: "Complaining of pain",
          action:
            "Stop bowling for a week or two and have it checked. Do not wait for it to get worse.",
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
        "Matches now count. Your child plays district leagues and tournaments, and may go for state age-group trials. This is the stage where parents start to see how many children are in the race. The aim is to learn where your child stands and whether they still love the game.",
      questions: [
        {
          question: "Which matches should my child play?",
          answer:
            "Start with school and local league matches, then district tournaments. A match where your child bats, bowls and fields is worth more than a bigger match where they sit on the bench. Ask the coach which events give real game time.",
        },
        {
          question: "How do state age-group trials work?",
          answer:
            "Each state association picks teams for its age groups. The national tournaments run by the BCCI start at Under 16, so Under 14 and Under 15 selection is mostly a state matter and varies a lot. Selection usually starts at district level, then goes to camps and state squads. Dates and rules differ by state, so ask your district or state association early in the season.",
        },
        {
          question: "Does my child need to be registered with anyone?",
          answer:
            "Usually yes. Most district leagues need your child to play for a club registered with the district association, and some states ask players to register with the state association. Your coach or club can tell you what your state needs. Do this early, because missing a registration deadline can cost a whole season.",
        },
        {
          question: "Is selection really fair?",
          answer:
            "Mostly it depends on performance, but parents should know that politics and favours exist in some places. You cannot control that. You can play for a club that gets regular matches in the district league, keep scores and records, turn up to every trial, and speak to the association yourself rather than through a middleman. Walk away from anyone who asks for money to get your child selected.",
        },
        {
          question: "What if my child is a girl?",
          answer:
            "Girls' cricket has grown fast. Most states now run girls' age-group teams, and there is a clear path to the state and national women's sides. There are still fewer girls' teams and academies than boys', so many girls play with boys until their early teens. Ask your state association what girls' age groups it runs, and look for a coach who treats girls as seriously as boys.",
        },
        {
          question: "Is there such a thing as too many matches?",
          answer:
            "Yes. Summer camps, school matches, club matches and tournaments can pile up with no rest, especially in the heat. Plan a break each year, drink plenty of water, and watch for tiredness and small injuries. A fresh child plays better than a tired one with a long scorecard.",
        },
        {
          question: "How do we know if my child is good enough?",
          answer:
            "Do not go only by runs and wickets. Ask the coach how your child compares with others in the district, how they play against faster bowling, and how they behave in a close game. One honest opinion from a coach outside your own academy helps.",
        },
        {
          question: "What if my child is not selected?",
          answer:
            "It happens to most children, including many who later play for the state. Ask for feedback, work on one or two things and try again next season. Many players grow late.",
        },
        {
          question: "Do we need to keep age records in order?",
          answer:
            "Yes. Age matters for every age-group event, and the BCCI can check age with a bone test at some levels. Keep the birth certificate, school records and Aadhaar details matching.",
        },
        {
          question: "How much should we spend?",
          answer:
            "Fees, kit, travel and tournament costs add up quickly. Set a yearly amount you are comfortable with. Be careful with anyone who promises selection for a fee. No coach or academy can guarantee a place in a state team.",
        },
      ],
      signals: [
        {
          title: "Match time and match behaviour",
          detail:
            "How many matches did your child play this season? How do they act when the team is losing or when they get out cheaply?",
        },
        {
          title: "Quality, not only numbers",
          detail:
            "A 30 against good bowlers can say more than a 100 against weak ones. Ask the coach to tell you which is which.",
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
            "Pick events where your child gets to play several matches. Avoid travelling far for one game.",
        },
        {
          title: "Is it time to get more serious?",
          detail:
            "Only if your child wants it as much as you do, and the coach sees real promise. More training should be a choice, not a push.",
        },
        {
          title: "Is this academy enough?",
          detail:
            "If your child has outgrown the coach or the competition, look for a stronger set-up, but visit it and talk to its parents first.",
        },
        {
          title: "How do we balance school?",
          detail:
            "Plan match weeks around exams. Missing a lot of school at this age rarely pays off.",
        },
      ],
      nextStepLead: ORDERED_LEAD,
      nextSteps: [
        {
          when: "Step 1",
          action: "Find out the dates for district and state age-group trials in your area.",
        },
        { when: "Step 2", action: "Sort out age and ID papers so they match everywhere." },
        {
          when: "Step 3",
          action: "Plan a year of matches with the coach, with school exams marked first.",
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
      primaryAction: { label: "Talk to a cricket expert", href: "/booking?tab=experts" },
      helpLinks: HELP_LINKS,
    },

    // ── 4 ──────────────────────────────────────────────────────────────────
    {
      key: "performance-and-decide",
      name: "Performance & Decide",
      ageRange: "~13-16",
      coreQuestion: "How far can my child take cricket?",
      overview:
        "Training becomes more planned. Fitness, bowling load, mental strength and school exams all need space in the same week. State Under 16 trials and tournaments such as the Vijay Merchant Trophy are the big goals for strong players. This is also the stage to be honest about what level is likely.",
      questions: [
        {
          question: "Should my child focus on one skill now?",
          answer:
            "Slowly, yes. By 14 or 15 most players have a main role, such as opening batter, spinner or fast bowler. Keep fielding and fitness strong either way. An all-rounder still has to be good at one thing first.",
        },
        {
          question: "What does serious fitness work look like?",
          answer:
            "Running, strength work with the right guidance, stretching and rest. A child should not lift heavy weights without a trained person watching. Ask for a plan made for teenagers, not a copy of what senior players do.",
        },
        {
          question: "How do we protect a fast bowler?",
          answer:
            "Count the overs across school, club and academy, not just one team. Make sure there are rest days between spells. Growth spurts raise the risk of back injury, so cut the load when your child grows fast.",
        },
        {
          question: "How do we manage Class 10 and Class 12?",
          answer:
            "Plan ahead. Pick your exam years and keep cricket lighter in the weeks before boards. Many good players balance both, but it takes a plan and a coach who supports it.",
        },
        {
          question: "Do we need extra help, like a trainer or a mental coach?",
          answer:
            "Only if there is a clear need. A good fitness trainer helps most players. A sports psychologist helps if your child struggles with nerves or confidence. Do not buy a full support team before the basics are in place.",
        },
        {
          question: "Should we change schools for cricket?",
          answer:
            "Be careful. Some schools have strong teams and offer sports scholarships, and that can help. But a move that makes studies harder or takes your child away from friends and family is a big step. Ask the school what it really offers: ground time, coaching, matches and flexibility around exams.",
        },
        {
          question: "What about diet and supplements?",
          answer:
            "Good home food, enough water and enough sleep are what a teenager needs. Do not give protein powders or other supplements without a doctor's advice. Some products contain banned substances, and players can be tested even at younger levels. Be wary of coaches or shops who push them.",
        },
        {
          question: "Is a big city academy the answer?",
          answer:
            "Not always. A great coach in a smaller town can do more than a famous name with 60 children per batch. Look at how much attention your child gets and where past players ended up.",
        },
      ],
      signals: [
        {
          title: "Steady growth in performance",
          detail:
            "Look at the last two or three seasons together, not one match. Is your child moving up in the age group or staying where they were?",
        },
        {
          title: "Selected or called for camps",
          detail:
            "Even a call to a district or state camp is a good sign. Missing it is not the end, but it tells you where you stand.",
        },
        {
          title: "Fitness and body",
          detail:
            "Is your child getting stronger and faster, and recovering well? Frequent injuries mean the load is too high or the plan is wrong.",
        },
        {
          title: "Mind under pressure",
          detail:
            "Can they play well when the match is tight, and recover from a bad day? This often separates players at this level.",
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
          title: "Is this level of cricket right for my child?",
          detail:
            "Think about what your child wants, what the coach sees and what your family can support. All three need to line up.",
        },
        {
          title: "Which level is realistic?",
          detail:
            "State teams, university cricket, a sports quota job and the national side are very different goals. Ask the coach what each would need.",
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
            "Ask the coach for a full honest review: batting, bowling, fielding, fitness and attitude.",
        },
        {
          when: "Step 2",
          action:
            "Make a 12 month plan for training and matches, with Class 10 or 12 exams marked first.",
        },
        {
          when: "Step 3",
          action: "Set up a fitness plan and a bowling load plan with a qualified person.",
        },
        {
          when: "Step 4",
          action: "Find the state Under 16 and Under 19 trial dates and what is asked at each.",
        },
        {
          when: "Step 5",
          action:
            "Start talking with your child about what comes after school, early and without pressure.",
        },
      ],
      primaryAction: { label: "Get a serious-cricket review", href: "/booking?tab=experts" },
      helpLinks: HELP_LINKS,
    },

    // ── 5 ──────────────────────────────────────────────────────────────────
    {
      key: "pathway",
      name: "Pathway",
      ageRange: "~15-18",
      coreQuestion: "What is the right path after school?",
      overview:
        "Your child is now close to the senior game. The main routes are state Under 19 teams and then the state senior side, university cricket, jobs through sports quota and, for the very few, the Indian team. Most players will not reach the top level. A good plan has more than one door.",
      questions: [
        {
          question: "How does a player move from age-group cricket to the top?",
          answer:
            "Most go through state age-group teams, such as Under 16 and Under 19, then state senior and Ranji Trophy squads. From there, strong performers are noticed by IPL teams and the national selectors. The Indian Under 19 team is picked from the best age-group players across states. Women's cricket has its own state and national age-group ladder, and the pathway to the WPL and the national side is growing.",
        },
        {
          question: "How realistic is playing for India?",
          answer:
            "Very few players get there. Thousands play age-group cricket in every state, and only a small number are picked for the state senior team each year. This is no reason to stop. It is a reason to keep studies and a second plan going.",
        },
        {
          question: "What about college and university cricket?",
          answer:
            "Many universities run cricket teams and play inter-university events. A good college team keeps a player in match shape while they study. Ask about it before choosing a college, because some are much better than others.",
        },
        {
          question: "Can cricket help get a job?",
          answer:
            "Yes. Banks, railways, public sector companies and other employers recruit players on a sports quota. State or university level players are often considered. Many colleges also keep seats for sportspersons, and they usually ask for certificates from recognised state or national events, so keep every certificate and score sheet. The rules differ by employer and college, so check what each one asks for.",
        },
        {
          question: "Should my child play abroad?",
          answer:
            "Some players play club cricket in England, Australia or the US, and a few get college places there. It can be a good experience, but it costs money and does not lead to the Indian team on its own. Look at it as an extra, not a shortcut.",
        },
        {
          question: "How do we keep studies on track?",
          answer:
            "Choose a college and course that allow time for training and matches. Open or distance courses suit some players. Avoid dropping out of studies for cricket unless there is a clear offer and a back-up plan.",
        },
      ],
      signals: [
        {
          title: "Performance in age-group cricket",
          detail:
            "Is your child among the better players in the district, and getting noticed at state level? Be honest about both.",
        },
        {
          title: "Called to state camps and squads",
          detail: "Repeated calls matter more than one lucky selection.",
        },
        {
          title: "Fitness and injury record",
          detail:
            "Senior cricket is physically harder. A player who keeps getting injured needs a plan before moving up.",
        },
        {
          title: "Academic position",
          detail:
            "Boards, entrance exams and college options all need time. See where your child stands.",
        },
        {
          title: "What your child wants",
          detail:
            "Some want a cricket career at any cost, some want a good life with cricket in it. Both are fine. Know which one it is.",
        },
        {
          title: "What your family can support",
          detail: "Money, time and travel are real limits. Talk about them early.",
        },
      ],
      decisions: [
        {
          title: "Try for the senior state team, or choose college cricket?",
          detail:
            "These can go together for some players. Ask the coach and the college what is possible.",
        },
        {
          title: "Which college and course?",
          detail:
            "Look at cricket facilities, how the college treats sportspersons and the course you actually want.",
        },
        {
          title: "Stay in this city or move?",
          detail:
            "A move to a stronger cricket centre can help, but it is hard on a teenager. Visit first and talk to families there.",
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
            "Sit down with your child and the coach and list the options: state senior, college, quota job, other.",
        },
        {
          when: "Step 2",
          action:
            "Check which colleges and employers in your area take cricketers, and what they ask for.",
        },
        {
          when: "Step 3",
          action: "Keep a clean record of matches, scores and certificates in one folder.",
        },
        {
          when: "Step 4",
          action:
            "Plan the next 12 to 24 months around boards, entrance exams and the cricket season.",
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
      coreQuestion: "What can cricket do for me next?",
      overview:
        "Whether the player reaches the state team or not, cricket does not have to end. Some play at club, corporate or university level. Some move into coaching, umpiring, scoring, fitness, analysis, sports management or media. Others keep playing for fun and build a career in something else.",
      questions: [
        {
          question: "Can I keep playing?",
          answer:
            "Yes. Club leagues, corporate tournaments, university teams and weekend cricket all let you keep playing at a good level for many years.",
        },
        {
          question: "What jobs are there in cricket?",
          answer:
            "Coaching, umpiring, scoring, fitness training, physiotherapy, video analysis, groundsmanship, commentary, journalism, academy running and sports management. Some need a qualification. The BCCI runs courses for coaches, umpires and scorers.",
        },
        {
          question: "How do I become a coach?",
          answer:
            "Most coaches start by helping at an academy or school and studying for a coaching certificate. A playing record helps, but good teaching matters more. Begin early, even part time.",
        },
        {
          question: "What if I did not make it as a player?",
          answer:
            "You still know the game, the people and the discipline. Many ex-players do well as coaches, analysts, agents and business owners. Not making the team is common and is not a failure.",
        },
        {
          question: "What if an injury ends my playing?",
          answer:
            "It is one of the hardest things in sport, and it happens to good players. Give yourself time, and do not decide your future in the first month. Many injured players stay in the game as coaches, analysts or physios, and some find that their knowledge of the body and the game is worth a lot. Talk to someone you trust.",
        },
        {
          question: "How do I move on well?",
          answer:
            "Plan before the playing stops. Finish your degree, pick up a skill outside cricket, and keep in touch with coaches and teammates. The sooner you start, the easier the change.",
        },
      ],
      signals: [
        {
          title: "Still want to play",
          detail: "If yes, find a club or league and keep fit. If no, that is also a clear answer.",
        },
        {
          title: "Skills beyond cricket",
          detail: "A degree, a certificate or a trade gives you choices.",
        },
        {
          title: "People who know you",
          detail: "Coaches, teammates and officials can open doors if you keep in touch.",
        },
        {
          title: "Money you can count on",
          detail:
            "Cricket income is uneven. Know how you will cover your costs while you build the next step.",
        },
      ],
      decisions: [
        {
          title: "Keep playing, and where?",
          detail:
            "Club, corporate, university or just weekends. Each takes a different amount of time.",
        },
        {
          title: "Work in cricket or outside it?",
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
      primaryAction: { label: "Explore careers in cricket", href: "/booking?tab=experts" },
      helpLinks: HELP_LINKS,
    },
  ],
};
