// Chess pathway text, split into paragraphs and lists (see applyPathwayContentEdits.ts).
//
// Each entry is one field: `old` is the text exactly as it stood when this was
// reviewed (the write only happens if the database still holds it), and `next`
// is the same sentences laid out as paragraphs, lists and bold lead-ins.
//
// The words are the original's. What differs, and nothing else:
//   - a list's closing "and" is dropped where a bullet list makes it redundant
//     (four answers), and the four FIDE titles gain the numbers 1 to 4;
//   - em dashes, which the site does not use, became colons or parentheses.
// tests/pathwayContentEdits.test.ts checks every entry against those rules.

export interface ContentEdit {
  sportSlug: string;
  stageKey: string;
  kind: "overview" | "answer";
  /** The question the answer belongs to; the write is matched on it. */
  heading: string | null;
  /** "questions[1].answer", for people. */
  label: string;
  old: string;
  next: string;
}

export const CHESS_FORMAT_EDITS: ContentEdit[] = [
  {
    sportSlug: "chess",
    stageKey: "learn-and-develop",
    kind: "answer",
    label: "questions[1].answer",
    heading: "What should my child actually be learning?",
    old: "Four things. Tactics — forks, pins, skewers, discovered attacks; there is no shortcut here. Basic opening principles — not 15 moves of memorised theory, but why we develop pieces, control the centre and castle early. Fundamental endgames — king and pawn, and basic rook endings. And game analysis: reviewing your own games, even briefly, after each session. That last one is what most kids skip, and it is what separates the ones who keep improving from the ones who plateau.",
    next: "Four things:\n\n- **Tactics:** forks, pins, skewers, discovered attacks; there is no shortcut here.\n- **Basic opening principles:** not 15 moves of memorised theory, but why we develop pieces, control the centre and castle early.\n- **Fundamental endgames:** king and pawn, and basic rook endings.\n- **Game analysis:** reviewing your own games, even briefly, after each session.\n\nThat last one is what most kids skip, and it is what separates the ones who keep improving from the ones who plateau.",
  },
  {
    sportSlug: "chess",
    stageKey: "compete-and-assess",
    kind: "answer",
    label: "questions[0].answer",
    heading: "How do ratings work in India?",
    old: "There are two systems. AICF — the All India Chess Federation — gives national ratings, earned by playing in AICF-affiliated tournaments across India. FIDE gives international ratings on the Elo scale, earned in FIDE-rated events. Your child will typically earn an AICF rating first, then a FIDE rating once they play in qualifying events. Ratings go up when you beat higher-rated players and down when you lose to lower-rated ones. A new player starts unrated and gets a first rating after a minimum number of games.",
    next: "There are two systems:\n\n- **AICF** (the All India Chess Federation) gives national ratings, earned by playing in AICF-affiliated tournaments across India.\n- **FIDE** gives international ratings on the Elo scale, earned in FIDE-rated events.\n\nYour child will typically earn an AICF rating first, then a FIDE rating once they play in qualifying events.\n\nRatings go up when you beat higher-rated players and down when you lose to lower-rated ones. A new player starts unrated and gets a first rating after a minimum number of games.",
  },
  {
    sportSlug: "chess",
    stageKey: "compete-and-assess",
    kind: "answer",
    label: "questions[4].answer",
    heading: "What does an actual tournament look like?",
    old: "Most Indian chess tournaments run in Swiss format — seven to nine rounds over two to three days. Your child plays one game per round, typically with 60 to 90 minutes each on the clock plus a small increment per move. Results are reported to AICF and/or FIDE for rating calculations. It can be mentally exhausting; three days of intense concentration is a lot for a 10-year-old, and it's something you only really understand by experiencing it.",
    next: "Most Indian chess tournaments run in Swiss format: seven to nine rounds over two to three days. Your child plays one game per round, typically with 60 to 90 minutes each on the clock plus a small increment per move. Results are reported to AICF and/or FIDE for rating calculations.\n\nIt can be mentally exhausting; three days of intense concentration is a lot for a 10-year-old, and it's something you only really understand by experiencing it.",
  },
  {
    sportSlug: "chess",
    stageKey: "performance-and-decide",
    kind: "overview",
    label: "overview",
    heading: null,
    old: "This is the fork in the road. By now your child has played tournaments, has a rating, and has a real sense of where they stand in Indian junior chess. The question Stage 4 asks — and you have to answer honestly — is what chess is going to be for this child: a serious competitive pursuit with real training investment and potentially a career dimension, or a lifelong passion pursued at a comfortable level. Both are genuinely valuable outcomes. The mistake is refusing to answer the question and drifting without a decision.",
    next: "This is the fork in the road. By now your child has played tournaments, has a rating, and has a real sense of where they stand in Indian junior chess.\n\nThe question Stage 4 asks (and you have to answer honestly) is what chess is going to be for this child: a serious competitive pursuit with real training investment and potentially a career dimension, or a lifelong passion pursued at a comfortable level. Both are genuinely valuable outcomes.\n\nThe mistake is refusing to answer the question and drifting without a decision.",
  },
  {
    sportSlug: "chess",
    stageKey: "performance-and-decide",
    kind: "answer",
    label: "questions[0].answer",
    heading: "What titles exist in chess and how does a player earn them?",
    old: "FIDE awards titles in ascending order: Candidate Master (CM), FIDE Master (FM), International Master (IM) and Grandmaster (GM), with women's titles at each level. Each requires a minimum FIDE rating, and IM and GM additionally require a set of performance results called norms, achieved in FIDE-rated tournaments. AICF also awards the National Master (NM) title for reaching 2000 national rating. These titles are permanent once earned and are recognised globally.",
    next: "FIDE awards titles in ascending order, with women's titles at each level:\n\n1. Candidate Master (CM)\n2. FIDE Master (FM)\n3. International Master (IM)\n4. Grandmaster (GM)\n\nEach requires a minimum FIDE rating, and IM and GM additionally require a set of performance results called norms, achieved in FIDE-rated tournaments. AICF also awards the National Master (NM) title for reaching 2000 national rating.\n\nThese titles are permanent once earned and are recognised globally.",
  },
  {
    sportSlug: "chess",
    stageKey: "performance-and-decide",
    kind: "answer",
    label: "questions[2].answer",
    heading: "Can chess genuinely be a career?",
    old: "Yes, and increasingly so in India. The options are: professional player (requires GM or strong IM level, very competitive), full-time coaching (solid income, especially with an online presence — the most accessible chess career for most strong players), content creation on YouTube or streaming, working within the AICF or state federation ecosystem, and corporate chess where companies hire titled players. Since 2023, India's chess explosion after Gukesh, Praggnanandhaa and the Olympiad gold has created genuine new demand for qualified coaches and chess educators.",
    next: "Yes, and increasingly so in India. The options are:\n\n- **Professional player** (requires GM or strong IM level, very competitive)\n- **Full-time coaching** (solid income, especially with an online presence; the most accessible chess career for most strong players)\n- **Content creation** on YouTube or streaming\n- **Working within the AICF or state federation ecosystem**\n- **Corporate chess**, where companies hire titled players\n\nSince 2023, India's chess explosion after Gukesh, Praggnanandhaa and the Olympiad gold has created genuine new demand for qualified coaches and chess educators.",
  },
  {
    sportSlug: "chess",
    stageKey: "pathway",
    kind: "answer",
    label: "questions[1].answer",
    heading: "What exactly is a norm?",
    old: "A norm is a performance result in a FIDE-rated tournament where you've played against a field of sufficient average rating and title mix, and achieved a performance rating above a certain threshold. For an IM norm you need to perform at roughly 2450+ in an eligible event; for a GM norm, 2600+. Norms are event-specific — not every rated tournament qualifies. Your coach should be actively identifying norm-eligible events and building the calendar around them.",
    next: "A norm is a performance result in a FIDE-rated tournament where you've played against a field of sufficient average rating and title mix, and achieved a performance rating above a certain threshold.\n\nFor an IM norm you need to perform at roughly 2450+ in an eligible event; for a GM norm, 2600+. Norms are event-specific: not every rated tournament qualifies. Your coach should be actively identifying norm-eligible events and building the calendar around them.",
  },
  {
    sportSlug: "chess",
    stageKey: "pathway",
    kind: "answer",
    label: "questions[4].answer",
    heading: "How do we handle board exams alongside chess?",
    old: "This is genuinely one of the hardest parts of this stage. Class 11 and 12 coincide with peak competitive years for juniors, and the board exam pressure is real. Many serious players explore NIOS, the National Institute of Open Schooling, which gives more flexibility. AICF achievements can support college applications through sports quota, so discuss it with your family and school well in advance and plan it as a whole rather than managing the conflict tournament by tournament.",
    next: "This is genuinely one of the hardest parts of this stage. Class 11 and 12 coincide with peak competitive years for juniors, and the board exam pressure is real.\n\nMany serious players explore NIOS, the National Institute of Open Schooling, which gives more flexibility. AICF achievements can support college applications through sports quota, so discuss it with your family and school well in advance and plan it as a whole rather than managing the conflict tournament by tournament.",
  },
  {
    sportSlug: "chess",
    stageKey: "transition-and-beyond",
    kind: "answer",
    label: "questions[0].answer",
    heading: "Can chess actually be a full career in India?",
    old: "More than ever, yes. The routes are: professional player at IM or GM level with a real tournament circuit; full-time coaching, which is the most accessible chess career for the majority of strong players and has genuine earning potential especially online; content creation on YouTube and streaming, where Indian chess creators now have real audiences; working with AICF or state associations; and corporate chess, where companies sponsor titled players for events and promotion. India's chess ecosystem has grown substantially and continues to grow.",
    next: "More than ever, yes. The routes are:\n\n- **Professional player** at IM or GM level with a real tournament circuit\n- **Full-time coaching**, which is the most accessible chess career for the majority of strong players and has genuine earning potential especially online\n- **Content creation** on YouTube and streaming, where Indian chess creators now have real audiences\n- **Working with AICF or state associations**\n- **Corporate chess**, where companies sponsor titled players for events and promotion\n\nIndia's chess ecosystem has grown substantially and continues to grow.",
  },
  {
    sportSlug: "chess",
    stageKey: "transition-and-beyond",
    kind: "answer",
    label: "questions[1].answer",
    heading: "What kind of income does a chess career generate?",
    old: "This varies enormously, and it's worth being honest rather than quoting inflated numbers. A full-time chess coach with a solid online presence and academy affiliation can earn a structured, sustainable income. A titled IM or GM combining tournament earnings, coaching and endorsements can earn significantly more. The honest advice is to build multiple income streams within chess rather than depending on any single one.",
    next: "This varies enormously, and it's worth being honest rather than quoting inflated numbers.\n\nA full-time chess coach with a solid online presence and academy affiliation can earn a structured, sustainable income. A titled IM or GM combining tournament earnings, coaching and endorsements can earn significantly more.\n\nThe honest advice is to build multiple income streams within chess rather than depending on any single one.",
  },
];
