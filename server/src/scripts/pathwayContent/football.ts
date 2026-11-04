/**
 * Football pathway content. Seeded by `seedSportPathways.ts`.
 *
 * Same writing rules as the Cricket file: short sentences, plain words, no
 * dashes used as punctuation. Tournament names are the ones parents hear
 * about. The AIFF and state associations change age groups and formats from
 * season to season, so a football coach should read this once before it goes
 * live.
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

export const FOOTBALL_GUIDE: PathwayGuideInput = {
  formatVersion: PATHWAY_FORMAT_VERSION,
  sport: { slug: "football", name: "Football" },
  intro: {
    eyebrow: "Football pathway · for parents",
    headline: "Understand. Question. Observe. Decide. Act.",
    description:
      "Six stages, each answering five things: where you are, what you are probably worried about, what to watch for, what you may have to choose, and what to do now.",
  },
  sportIntro: [
    "Football is the most played sport in the world, and in India it is huge in places like Kerala, West Bengal, Goa, Manipur and Mizoram. Elsewhere it is growing fast, with more clubs, more leagues and more academies than ever.",
    "It is a running game, so it builds stamina, balance and quick thinking. It is also a team game, so children learn to share, to listen and to lose together.",
    "The path runs from a kick-about with friends to school and district teams, club academies, state teams and, for a few, professional clubs and the national side. Most players find a level that suits them. Football also leads to coaching, refereeing and many jobs around the game.",
  ],
  stages: [
    // ── 1 ──────────────────────────────────────────────────────────────────
    {
      key: "discover-football",
      name: "Discover Football",
      ageRange: "~5-8",
      coreQuestion: "Should my child try football?",
      overview:
        "Your child has started kicking a ball, or you are thinking about it. At this age the only job is to see if they enjoy it and want to keep going. Do not think about trials, clubs or ranks yet. Running, playing with a ball and having fun with friends is the whole plan.",
      questions: [
        {
          question: "Is football right for my child?",
          answer:
            "Most children enjoy running after a ball. Some are quick, some are shy, some tire fast. All of that is normal. At this age, wanting to play matters more than being good at it.",
        },
        {
          question: "What age should my child start?",
          answer:
            "Five to seven is a good time to begin in a small group. Younger children can kick a ball around at home. Starting at 8 does not put a child behind, as long as they enjoy it.",
        },
        {
          question: "What should the first 3 to 6 months look like?",
          answer:
            "Simple games with the ball at the feet. Dribbling, kicking, stopping the ball and running. Small games with few players on a small pitch. Skip long drills and long matches for now.",
        },
        {
          question: "How often should my child play?",
          answer:
            "Two sessions a week of 45 to 60 minutes is enough. Add free play with friends if your child asks for it. A child who plays a little every week is better off than one who plays hard for a month and then quits.",
        },
        {
          question: "What equipment do we need?",
          answer:
            "A size 3 or size 4 ball for this age, comfortable shorts and a t-shirt, and a pair of football shoes or sports shoes that fit well. Shin guards are a good idea once matches begin. Do not buy expensive boots yet. They grow out of them quickly.",
        },
        {
          question: "What should I expect from a coach?",
          answer:
            "A coach who is warm and plays games with the children. Every child should have a ball at their feet for most of the session. Be careful with sessions where children stand in long lines or run laps for most of the time.",
        },
        {
          question: "Can my child play other sports too?",
          answer:
            "Yes, and it helps. Swimming, cricket, badminton and athletics all build things a footballer needs. Trying many sports at this age is a good thing.",
        },
      ],
      signals: [
        {
          title: "Wants to play",
          detail:
            "Does your child pick up the ball without being told? Do they ask when the next session is?",
        },
        {
          title: "Comfortable with the ball",
          detail:
            "Does the ball stay near their feet, even if it is messy? That comes with time and play.",
        },
        {
          title: "Enjoys playing with others",
          detail:
            "Football is a team game. Watch if your child likes passing, sharing and being part of a group.",
        },
        {
          title: "Handles a knock or a loss",
          detail:
            "Falls, missed shots and lost games are normal. See if your child gets up and goes back in.",
        },
        {
          title: "Plays outside coaching",
          detail: "Kicking a ball on the terrace or in the park is the best sign of all.",
        },
      ],
      decisions: [
        {
          title: "Which coach or academy?",
          detail:
            "Pick one close to home with a flat, safe ground. Watch a full session before paying for a term.",
        },
        {
          title: "Coached or just play?",
          detail:
            "For the first few months, play with friends plus one or two coached sessions a week is enough.",
        },
        {
          title: "Should football be the only sport?",
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
          when: "Enjoying football",
          action: "Ask the coach what your child is good at and what to work on next.",
        },
        {
          when: "Unsure",
          action: "Talk to an expert or to a parent whose child is a year or two ahead.",
        },
        {
          when: "Not enjoying it",
          action: "Find out why. It may be the group, not the sport. If not, try another sport.",
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
        "Football becomes a regular habit. Your child learns to control the ball, pass with both feet, move without the ball and play in small teams. The job now is a good base and a healthy body. Results and league tables matter very little at this age.",
      questions: [
        {
          question: "Is the coach teaching the basics well?",
          answer:
            "Look for ball control, passing, dribbling and simple team play. A good coach lets the children play a lot, and corrects a few things at a time. Ask your child what they practised this week. If they can tell you, the teaching is working.",
        },
        {
          question: "Should my child play one position now?",
          answer:
            "No. Let them play in different places on the pitch, in defence, midfield and attack. Children change a lot between 9 and 14. A goalkeeper may become a striker, and a striker may become a defender.",
        },
        {
          question: "Should my child use both feet?",
          answer:
            "Yes. Ask the coach to work on the weaker foot from the start. It is much easier to learn now than at 16, and it makes a big difference later.",
        },
        {
          question: "How many sessions a week is right?",
          answer:
            "Two or three sessions a week plus a match on the weekend is enough for most children. Keep at least one full rest day. School comes first.",
        },
        {
          question: "What about surface and injuries?",
          answer:
            "Hard, uneven or stony grounds cause many injuries. Look for a flat, safe surface, and good shoes. Children who grow fast can get knee or heel pain. If the pain keeps coming back, rest and show a doctor.",
        },
        {
          question: "Should my child play school or club matches?",
          answer:
            "Yes, a few. Small-sided games, such as 5 or 7 a side, give every child more touches than a full 11 a side game. Pick events where every child gets to play.",
        },
        {
          question: "Is turf football the same as playing on a full ground?",
          answer:
            "No. Small turf grounds are easy to find in cities and children get a lot of touches, but the game is faster, the space is tiny and there is little running off the ball. Playing only on turf can leave a child lost on a full pitch. Try to give your child regular games on a proper ground too, as they grow.",
        },
        {
          question: "What about heading the ball?",
          answer:
            "Young children should not head a ball again and again, and a wet heavy ball is worse. Ask the coach to keep heading practice light and rare before about 12, and to teach the right way. If a child gets a knock to the head and feels dizzy or sick, stop play and see a doctor.",
        },
        {
          question: "What is my job as a parent?",
          answer:
            "Get your child there on time, feed them well, and let the coach coach. Do not shout instructions from the sideline, argue with the referee or compare your child with others. After a match, give them some time before you talk about it, and start with something they did well. Children who feel watched and judged stop enjoying the game.",
        },
      ],
      signals: [
        {
          title: "Better touch on the ball",
          detail:
            "Compare how your child controls the ball now to six months ago. You do not need to be an expert to see the change.",
        },
        {
          title: "Using both feet",
          detail: "Is the weaker foot getting more comfortable? That is a good sign.",
        },
        {
          title: "Understands the game",
          detail:
            "Does your child look up, find space and pass to a team mate, or just run with the ball?",
        },
        {
          title: "Enjoyment",
          detail:
            "If the smile is gone, something needs to change. It could be the load, the coach or the group.",
        },
        {
          title: "Body coping well",
          detail: "Watch for repeated pain in knees, heels or hips. Do not push through it.",
        },
      ],
      decisions: [
        {
          title: "Is this academy still right?",
          detail:
            "Check if the coaching, the group size and the ground suit your child now. Switching is fine if the answer is no.",
        },
        {
          title: "How much football?",
          detail: "More is not always better. Keep your child fresh and interested.",
        },
        {
          title: "Football for fun or to compete?",
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
            "Add a few friendly matches and ask the coach about your district or state league.",
        },
        {
          when: "Stuck for months",
          action: "Review the coach, the group and the workload before blaming your child.",
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
        "Matches now count. Your child plays school, district and club leagues, and may go for trials at club academies and state teams. This is the stage where parents see how many children are in the race. The aim is to learn where your child stands and whether they still love the game.",
      questions: [
        {
          question: "Which competitions should my child play?",
          answer:
            "Start with school and district leagues. School events such as the Subroto Cup are well known. Many clubs and the AIFF also run youth leagues for age groups like Under 13, Under 15 and Under 17. Ask the coach which events give real game time.",
        },
        {
          question: "How do state teams and club academies pick players?",
          answer:
            "State associations hold trials and camps for age-group teams. Professional clubs run their own trials for their academies. Dates and age limits change every year, so ask your district football association early in the season.",
        },
        {
          question: "How do we know if my child is good enough?",
          answer:
            "Do not go only by goals. Ask the coach how your child compares with others in the district, how they read the game and how they behave when the team is losing. One honest opinion from a coach outside your own academy helps.",
        },
        {
          question: "What if my child is not selected?",
          answer:
            "It happens to most children, including many who later play well. Ask for feedback, work on one or two things and try again next season. Many players grow late.",
        },
        {
          question: "Does my child need to be registered with anyone?",
          answer:
            "Usually yes. District and state leagues need players to be registered with the district or state football association, often through a club. Your coach or club can tell you what your state needs. Do this early, because missing a deadline can cost a season.",
        },
        {
          question: "Are all trials real?",
          answer:
            "No. Many parents lose money to open trials that charge a high fee and select nobody, or to academies that claim a link with a famous club. Before you pay, ask who runs the trial, which league or club it is for, and where past selected players are now. Real club trials are usually free or cost very little. No academy can guarantee a place.",
        },
        {
          question: "Does my child's birth month matter?",
          answer:
            "Yes, more than most parents think. In any age group, children born early in the year are bigger and stronger than those born late, and coaches often pick the bigger ones. A smaller child can be just as talented and catch up later. If your child is young for the group, be patient and keep going. Early picking is not a sign of final success, and missing it is not a sign of failure.",
        },
        {
          question: "What if my child is a girl?",
          answer:
            "Girls' football has grown, with state girls' teams, a national women's league and national age-group teams. There are still far fewer girls' academies and teams, so many girls play with boys into their early teens. Ask your state association which girls' age groups it runs, and look for a coach who takes girls as seriously as boys.",
        },
        {
          question: "What does it cost?",
          answer:
            "Fees, boots, travel and tournament costs add up. Set a yearly amount you are comfortable with. Be careful with anyone who promises a trial or a place for a fee. No academy can guarantee selection into a club or state team.",
        },
        {
          question: "Do we need to keep age records in order?",
          answer:
            "Yes. Age matters for every age-group event, and age can be checked. Keep the birth certificate, school records and ID details matching.",
        },
      ],
      signals: [
        {
          title: "Match time and match behaviour",
          detail:
            "How many matches did your child play this season? How do they act after a mistake or a loss?",
        },
        {
          title: "Decisions on the ball",
          detail:
            "Does your child pass at the right time, find space and look up? This matters more than tricks.",
        },
        {
          title: "Pace, strength and stamina",
          detail:
            "Compare with others in the same age group. Remember that some children grow early and some late.",
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
            "If your child has outgrown the coach or the competition, look for a stronger set-up. Visit it and talk to its parents first.",
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
          action:
            "Find out the dates for district and state trials and youth leagues in your area.",
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
      primaryAction: { label: "Talk to a football expert", href: "/booking?tab=experts" },
      helpLinks: HELP_LINKS,
    },

    // ── 4 ──────────────────────────────────────────────────────────────────
    {
      key: "performance-and-decide",
      name: "Performance & Decide",
      ageRange: "~13-16",
      coreQuestion: "How far can my child take football?",
      overview:
        "Training becomes more planned. Fitness, a main position, a recovery plan and school exams all need space in the same week. Club academy places and state teams are the big goals for strong players. This is also the stage to be honest about what level is likely.",
      questions: [
        {
          question: "Should my child settle on one position now?",
          answer:
            "Slowly, yes. By 14 or 15 most players have a main position. Keep the other skills sharp. A defender who can pass well, or a striker who can defend, is more useful to any team.",
        },
        {
          question: "What does serious fitness work look like?",
          answer:
            "Running, speed work, strength work with proper guidance, stretching and rest. A teenager should not lift heavy weights without a trained person watching. Ask for a plan made for teenagers, not a copy of what senior players do.",
        },
        {
          question: "How do we avoid injuries?",
          answer:
            "Warm up properly, sleep well, eat well and rest between hard sessions. During fast growth, cut the load, because knees, heels and backs are at risk. Treat pain early and do not play through it.",
        },
        {
          question: "How do we manage Class 10 and Class 12?",
          answer:
            "Plan ahead. Pick your exam years and keep football lighter before boards. Many good players manage both, but it takes a plan and a coach who supports it.",
        },
        {
          question: "Is a big club academy the answer?",
          answer:
            "Not always. A club academy gives good coaching and match time, but places are limited and many children are released each year. A good coach in your own town can do more than a famous name where your child sits on the bench. Ask how much game time players get and where past players ended up. It is also worth asking if the academy is accredited by the AIFF.",
        },
        {
          question: "Do we need extra help, like a trainer or a mental coach?",
          answer:
            "Only if there is a clear need. A good fitness trainer helps most players. A sports psychologist helps if your child struggles with nerves or confidence. Do not buy a full support team before the basics are in place.",
        },
        {
          question: "What about diet and supplements?",
          answer:
            "Good home food, enough water and enough sleep are what a teenager needs. Do not give protein powders or other supplements without a doctor's advice. Some products contain banned substances, and players can be tested even at younger levels.",
        },
        {
          question: "What if my child is released from an academy?",
          answer:
            "It happens to most players who reach this level, and it hurts. Give your child time, and do not blame them or the coach in front of them. Ask for honest feedback. Many released players do well later at another club, because they grew or improved. Keep playing and keep the door open.",
        },
      ],
      signals: [
        {
          title: "Steady growth in performance",
          detail:
            "Look at the last two or three seasons together, not one match. Is your child moving up in the age group or staying where they were?",
        },
        {
          title: "Called for camps and trials",
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
            "Can they play well in a big game, and bounce back after a bad day? This often separates players at this level.",
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
          title: "Is this level of football right for my child?",
          detail:
            "Think about what your child wants, what the coach sees and what your family can support. All three need to line up.",
        },
        {
          title: "Which level is realistic?",
          detail:
            "State teams, club academies, university football, a sports quota job and the national side are very different goals. Ask the coach what each would need.",
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
            "Ask the coach for a full honest review: skills, game sense, fitness and attitude.",
        },
        {
          when: "Step 2",
          action:
            "Make a 12 month plan for training and matches, with Class 10 or 12 exams marked first.",
        },
        { when: "Step 3", action: "Set up a fitness and recovery plan with a qualified person." },
        {
          when: "Step 4",
          action:
            "Find the trial dates for club academies and state teams, and what each asks for.",
        },
        {
          when: "Step 5",
          action:
            "Start talking with your child about what comes after school, early and without pressure.",
        },
      ],
      primaryAction: { label: "Get a serious-football review", href: "/booking?tab=experts" },
      helpLinks: HELP_LINKS,
    },

    // ── 5 ──────────────────────────────────────────────────────────────────
    {
      key: "pathway",
      name: "Pathway",
      ageRange: "~15-18",
      coreQuestion: "What is the right path after school?",
      overview:
        "Your child is now close to the senior game. The main routes are club teams in the national leagues, state teams and the Santosh Trophy, university football, jobs through sports quota and, for the very few, the national side. Most players will not play professionally. A good plan has more than one door.",
      questions: [
        {
          question: "How does a player move from youth football to the top?",
          answer:
            "Most strong players come through a club academy or a state team. Clubs in the top leagues have youth teams and reserve sides. Good performances there, and at the AIFF youth leagues and state events, get a player noticed by senior coaches and by the India age-group teams. Women's football has its own league and national team, and the number of clubs is growing.",
        },
        {
          question: "How realistic is playing professionally?",
          answer:
            "Very few get there. Many children play youth football and a small number sign a professional contract. Salaries in the lower divisions are modest. This is no reason to stop. It is a reason to keep studies and a second plan going.",
        },
        {
          question: "What about college and university football?",
          answer:
            "Many universities run football teams and play inter-university events. A good college team keeps a player match fit while they study. Ask about it before choosing a college, because some are much better than others.",
        },
        {
          question: "Can football help get a job?",
          answer:
            "Yes. Banks, railways, public sector companies, the armed forces and other employers recruit players on a sports quota. State or university level players are often considered. Many colleges also keep seats for sportspersons, and they usually ask for certificates from recognised state or national events, so keep every certificate and score sheet. The rules differ by employer and college, so check what each one asks for.",
        },
        {
          question: "Should my child go abroad?",
          answer:
            "A few players get trials or college places in other countries. It costs money, the competition is fierce and a trial does not mean a contract. Look at it as an extra, not a shortcut. Be very careful with agents and tour companies that sell paid trials with foreign clubs. This is a common way for families to lose a lot of money. Check the club yourself and never pay a large fee up front.",
        },
        {
          question: "How do we keep studies on track?",
          answer:
            "Choose a college and course that allow time for training and matches. Open or distance courses suit some players. Avoid dropping out of studies for football unless there is a clear offer and a back-up plan.",
        },
      ],
      signals: [
        {
          title: "Level in youth competitions",
          detail:
            "Is your child one of the better players in the district and getting noticed at state level? Be honest about both.",
        },
        {
          title: "Called to club or state squads",
          detail: "Repeated calls matter more than one lucky trial.",
        },
        {
          title: "Fitness and injury record",
          detail:
            "Senior football is faster and harder. A player who keeps getting injured needs a plan before moving up.",
        },
        {
          title: "Academic position",
          detail:
            "Boards, entrance exams and college options all need time. See where your child stands.",
        },
        {
          title: "What your child wants",
          detail:
            "Some want a football career at any cost, some want a good life with football in it. Both are fine. Know which one it is.",
        },
        {
          title: "What your family can support",
          detail: "Money, time and travel are real limits. Talk about them early.",
        },
      ],
      decisions: [
        {
          title: "Try for a club contract, or choose college football?",
          detail:
            "These can go together for some players. Ask the coach and the college what is possible.",
        },
        {
          title: "Which college and course?",
          detail:
            "Look at football facilities, how the college treats sportspersons and the course you actually want.",
        },
        {
          title: "Stay in this city or move?",
          detail:
            "A move to a stronger football centre can help, but it is hard on a teenager. Visit first and talk to families there.",
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
            "Sit down with your child and the coach and list the options: club, state team, college, quota job, other.",
        },
        {
          when: "Step 2",
          action:
            "Check which colleges and employers in your area take footballers, and what they ask for.",
        },
        {
          when: "Step 3",
          action:
            "Keep a clean record of matches, goals, certificates and match videos in one place.",
        },
        {
          when: "Step 4",
          action:
            "Plan the next 12 to 24 months around boards, entrance exams and the football season.",
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
      coreQuestion: "What can football do for me next?",
      overview:
        "Whether the player signs for a club or not, football does not have to end. Some play at club, corporate or university level. Some move into coaching, refereeing, fitness, analysis, sports management or media. Others keep playing for fun and build a career in something else.",
      questions: [
        {
          question: "Can I keep playing?",
          answer:
            "Yes. Local leagues, corporate tournaments, university teams and weekend football all let you keep playing at a good level for many years.",
        },
        {
          question: "What jobs are there in football?",
          answer:
            "Coaching, refereeing, fitness training, physiotherapy, video analysis, scouting, club administration, commentary, journalism and running an academy. Some need a qualification. The AIFF runs licence courses for coaches and referees.",
        },
        {
          question: "How do I become a coach?",
          answer:
            "Most coaches start by helping at an academy or school and studying for a coaching licence. A playing record helps, but good teaching matters more. Begin early, even part time.",
        },
        {
          question: "What if I did not make it as a player?",
          answer:
            "You still know the game, the people and the discipline. Many former players do well as coaches, scouts, analysts and business owners. Not making the team is common and is not a failure.",
        },
        {
          question: "What if an injury ends my playing?",
          answer:
            "It is one of the hardest things in sport, and it happens to good players, especially after knee injuries. Give yourself time, and do not decide your future in the first month. Many injured players stay in the game as coaches, scouts, analysts or physios, and some find that their knowledge of the body and the game is worth a lot. Talk to someone you trust.",
        },
        {
          question: "How do I move on well?",
          answer:
            "Plan before the playing stops. Finish your degree, pick up a skill outside football, and keep in touch with coaches and team mates. The sooner you start, the easier the change.",
        },
      ],
      signals: [
        {
          title: "Still want to play",
          detail: "If yes, find a club or league and keep fit. If no, that is also a clear answer.",
        },
        {
          title: "Skills beyond football",
          detail: "A degree, a certificate or a trade gives you choices.",
        },
        {
          title: "People who know you",
          detail: "Coaches, team mates and officials can open doors if you keep in touch.",
        },
        {
          title: "Money you can count on",
          detail:
            "Football income is uneven. Know how you will cover your costs while you build the next step.",
        },
      ],
      decisions: [
        {
          title: "Keep playing, and where?",
          detail:
            "Club, corporate, university or just weekends. Each takes a different amount of time.",
        },
        {
          title: "Work in football or outside it?",
          detail: "You can do both at the start. See which you enjoy more.",
        },
        {
          title: "What course or licence do I need?",
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
      primaryAction: { label: "Explore careers in football", href: "/booking?tab=experts" },
      helpLinks: HELP_LINKS,
    },
  ],
};
