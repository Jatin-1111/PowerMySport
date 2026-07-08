/**
 * Seed the 40 curated top-federation tournaments (4 per supported sport).
 * Run once: npx ts-node src/scripts/seedCuratedTournaments.ts
 * Re-running is safe — uses upsert on { sportSlug, name }.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Tournament } from "../shared/models/Tournament";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";

const CURATED: Omit<
  InstanceType<typeof Tournament>,
  keyof mongoose.Document
>[] = [
  // ─── CRICKET (BCCI) ──────────────────────────────────────────────────────
  {
    sportSlug: "cricket",
    slug: "ipl",
    name: "Indian Premier League (IPL)",
    level: "International",
    description:
      "The world's richest T20 franchise cricket league, organised by BCCI. Eight to ten city-based franchises compete in a round-robin followed by knockout playoffs every April–May. IPL contracts are the pinnacle of domestic cricketing ambition for Indian players.",
    ageGroup: "Open (18+)",
    typicalDates: "March–May each year",
    registrationDeadline: "Player retention and IPL Auction — December of the preceding year",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Board of Control for Cricket in India",
      acronym: "BCCI",
      website: "https://www.bcci.tv",
      type: "private",
      about:
        "BCCI is the national governing body for cricket in India, founded in 1928. It is the world's richest cricket board and administers all domestic and international cricket in India including Ranji Trophy, IPL, Duleep Trophy, and India's participation in ICC events.",
    },
    participationGuide: [
      "Build a strong domestic record in Ranji Trophy or other BCCI tournaments",
      "Attract the attention of franchise scouts and coaches through consistent performances",
      "Register with your State Cricket Association (SCA) to be eligible for BCCI selection pools",
      "Go through the IPL Auction process — franchises bid for uncapped and capped players",
      "Sign the franchise contract and participate in pre-season training camps",
    ],
    qualificationPath:
      "District cricket → Vijay Merchant Trophy (U-16) → Cooch Behar Trophy (U-19) → Vinoo Mankad Trophy (U-25) → Ranji Trophy → IPL Auction",
    circuitContext:
      "The BCCI domestic ladder has six distinct rungs. A child starts with district/school cricket, earns state selection for the Vijay Merchant Trophy (U-16 inter-zonal), then the Cooch Behar Trophy (U-19 inter-zonal) — the most famous junior event, attended by selectors who shortlist the India U-19 World Cup squad. After turning 19, the next tier is the Vinoo Mankad Trophy (U-25) and then the Ranji Trophy, India's premier first-class championship. Elite Ranji performers advance to the Duleep Trophy (India A/Zone teams) and Irani Cup, which directly precede national team selection. The IPL auction is the apex: franchises bid for players based primarily on their Ranji and India record. Only players with years of consistent domestic performance realistically enter the auction — there is no shortcut through the BCCI ladder.",
    format: "Round-robin league followed by knockout semifinals and final",
    prestige: "flagship",
    prizePool: "₹20 Cr+ total prize purse; winner franchise receives ₹20 Cr",
    registrationUrl: "https://www.bcci.tv/cricket-events/ipl",
    sourceUrls: ["https://www.iplt20.com", "https://www.bcci.tv"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "cricket",
    slug: "ranji-trophy",
    name: "Ranji Trophy",
    level: "National",
    description:
      "India's premier domestic first-class cricket championship, contested by state and regional teams. Named after Ranjitsinhji, it has been played since 1934 and is the primary path from club cricket to the Indian national team.",
    ageGroup: "Open (18+)",
    typicalDates: "October–March (first half of the cricket season)",
    registrationDeadline: "Player registration with State Cricket Association by September",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Board of Control for Cricket in India",
      acronym: "BCCI",
      website: "https://www.bcci.tv",
      type: "private",
      about:
        "BCCI is the national governing body for cricket in India, founded in 1928. It is the world's richest cricket board and administers all domestic and international cricket in India.",
    },
    participationGuide: [
      "Register with your State Cricket Association (SCA) and play district and zonal cricket",
      "Perform consistently in Under-23 and Under-25 state tournaments",
      "Get selected into your state's Ranji Trophy squad through the SCA's annual trials",
      "Attend pre-season training camps organised by your SCA",
      "Play in the group-stage matches and aim for the knockout rounds",
    ],
    qualificationPath:
      "District cricket → Vijay Merchant Trophy (U-16) → Cooch Behar Trophy (U-19) → Vinoo Mankad Trophy (U-25) → State senior trials → Ranji Trophy squad",
    circuitContext:
      "The Ranji Trophy is the apex of the BCCI state-cricket pyramid. The full ladder: school/district cricket → Vijay Merchant Trophy (U-16 inter-zonal) → Cooch Behar Trophy (U-19 inter-zonal) → Vinoo Mankad Trophy (U-25) → Ranji Trophy senior squad. Players who impress in Ranji are promoted to the Duleep Trophy (zonal teams that mirror India A) and the Irani Cup (Ranji champions vs Rest of India). Duleep and Irani performances are what national selectors watch before naming India Test and ODI squads. Most India international caps have come from players who performed consistently in Ranji Trophy for 3–5 seasons before the IPL auction brings franchise contracts.",
    format: "Group stage (5-day matches) followed by knockout quarterfinals, semis, and final",
    prestige: "flagship",
    prizePool: "₹1 Cr for the winning team; BCCI match fees for players",
    registrationUrl: "https://www.bcci.tv",
    sourceUrls: ["https://www.bcci.tv/domestic/ranji-trophy"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "cricket",
    slug: "vijay-merchant-trophy",
    name: "Vijay Merchant Trophy",
    level: "National",
    description:
      "BCCI's prestigious Under-16 inter-zonal cricket championship. Named after batting legend Vijay Merchant, it is the first major national platform for young cricketers and a direct feeder into the U-19 system.",
    ageGroup: "Under-16",
    typicalDates: "November–January",
    registrationDeadline: "Selection trials in September–October through State Cricket Associations",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Board of Control for Cricket in India",
      acronym: "BCCI",
      website: "https://www.bcci.tv",
      type: "private",
      about:
        "BCCI is the national governing body for cricket in India, founded in 1928.",
    },
    participationGuide: [
      "Play in your school and district age-group cricket tournaments",
      "Register with your State Cricket Association's junior program",
      "Attend the U-16 state trials conducted by your SCA (typically August–September)",
      "If selected, join the state U-16 squad training camp",
      "Represent your zone (North/South/East/West/Central) in the national tournament",
    ],
    qualificationPath:
      "School/district cricket → State U-16 trials → State U-16 squad → Zonal selection → Vijay Merchant Trophy",
    circuitContext:
      "The Vijay Merchant Trophy is the second rung in the BCCI age-group ladder. The full progression: school/district cricket → State U-16 trials (conducted by each SCA) → inter-zonal Vijay Merchant Trophy → Cooch Behar Trophy (U-19) → Vinoo Mankad Trophy (U-25) → Ranji Trophy → India senior team. Players identified here are placed in the BCCI's U-19 vision list and prioritised for the following Cooch Behar Trophy cycle. For a 14–15 year old, performing well here is the clearest signal to BCCI selectors that the child belongs in the long-term development funnel. BCCI conducts U-16 state trials through all 30 State Cricket Associations — the pathway starts at the district level, not at any national-level event.",
    format: "Zonal round-robin followed by a knockout final",
    prestige: "developmental",
    prizePool: "BCCI match fees and certificates",
    registrationUrl: "https://www.bcci.tv",
    sourceUrls: ["https://www.bcci.tv/domestic/vijay-merchant-trophy"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "cricket",
    slug: "cooch-behar-trophy",
    name: "Cooch Behar Trophy",
    level: "National",
    description:
      "BCCI's Under-19 inter-zonal cricket championship, one of the most prestigious junior tournaments in India. Many current Indian internationals (Virat Kohli, Rohit Sharma) played in this tournament. It is the primary gateway to the India U-19 World Cup squad.",
    ageGroup: "Under-19",
    typicalDates: "October–December",
    registrationDeadline: "U-19 state trials in August–September through State Cricket Associations",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Board of Control for Cricket in India",
      acronym: "BCCI",
      website: "https://www.bcci.tv",
      type: "private",
      about:
        "BCCI is the national governing body for cricket in India, founded in 1928.",
    },
    participationGuide: [
      "Play state-level cricket in the U-16 and U-19 categories",
      "Register with your State Cricket Association and attend U-19 trials",
      "Get selected into your state's U-19 squad (selected players are grouped into zones)",
      "Participate in the zonal round-robin matches (5-day format)",
      "Top teams advance to the national knockout stage",
    ],
    qualificationPath:
      "District U-19 cricket → Vijay Merchant Trophy (U-16) → State U-19 trials → Zonal squad → Cooch Behar Trophy",
    circuitContext:
      "The Cooch Behar Trophy is the most important tournament in the BCCI junior system. The ladder: school/district cricket → Vijay Merchant Trophy (U-16) → state U-19 trials → Cooch Behar Trophy (U-19 inter-zonal). BCCI selectors formally sit at every Cooch Behar match. Players who perform here are shortlisted for the India U-19 camp and, from there, the India U-19 World Cup squad. After the U-19 stage, players enter the Vinoo Mankad Trophy (U-25) circuit before joining the Ranji Trophy senior squad. The Cooch Behar Trophy has produced Virat Kohli (captain of India's 2008 U-19 World Cup winning team), Rohit Sharma, and dozens of current India internationals — performing here is a career-defining moment in any cricketer's development.",
    format: "Zonal group stage + knockout semifinals and final (4-day matches)",
    prestige: "developmental",
    prizePool: "BCCI match fees; performance bonuses",
    registrationUrl: "https://www.bcci.tv",
    sourceUrls: ["https://www.bcci.tv/domestic/cooch-behar-trophy"],
    lastScrapedAt: new Date(),
  },

  // ─── TENNIS (AITA) ────────────────────────────────────────────────────────
  {
    sportSlug: "tennis",
    slug: "fenesta-open-national-championship",
    name: "Fenesta Open National Championship",
    level: "National",
    description:
      "India's premier national tennis championship, sanctioned by AITA and recognised as an ITF tournament. It attracts India's top-ranked men's and women's players and is used as a form guide for Davis Cup and Billie Jean King Cup selections.",
    ageGroup: "Open (18+)",
    typicalDates: "October–November in New Delhi",
    registrationDeadline: "Online AITA entry — typically 4 weeks before the tournament",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Tennis Association",
      acronym: "AITA",
      website: "https://www.aitatennis.com",
      type: "private",
      about:
        "AITA is the national governing body for tennis in India, founded in 1920. It is affiliated with ITF (International Tennis Federation) and organises all national and international tennis tournaments in India, including ranking events, Davis Cup, and Billie Jean King Cup campaigns.",
    },
    participationGuide: [
      "Hold a valid AITA membership and ranking (open to all ranked players)",
      "Monitor the AITA official calendar at aitatennis.com for the entry opening date",
      "Submit your entry online through the AITA tournament registration portal",
      "Confirm your entry fee payment within the specified deadline",
      "Report to the tournament venue for the draw ceremony and compete",
    ],
    qualificationPath:
      "AITA City Series (CS) → AITA National Series (NS) → AITA Super Series (SS) → Fenesta Open National Championship",
    circuitContext:
      "AITA organises a tiered domestic ranking circuit that every aspiring Indian tennis player must climb. The four tiers are: Team Series (TS) — team-format competitions at grassroots level; City Series (CS) — city-level individual events, the most accessible entry point for beginners building their first AITA ranking; National Series (NS) — national-level events offering significantly more ranking points; Super Series (SS) — the premium national tier with the highest ranking points, competitive with India's top-100 players. Junior players have parallel circuits: Junior City Series, Junior National Series, and Junior Super Series. Ranking points from all these events accumulate into a player's AITA national ranking, which controls direct acceptance into higher-tier events and national team consideration. The Fenesta Open is the apex of the domestic circuit — it is also an ITF-sanctioned event, meaning results count toward ITF world ranking points, bridging the domestic and international circuits.",
    format: "Single elimination (main draw + qualifying rounds)",
    prestige: "flagship",
    prizePool: "₹15 lakh+ total prize money (varies by edition)",
    registrationUrl: "https://www.aitatennis.com",
    sourceUrls: ["https://www.aitatennis.com/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "tennis",
    slug: "aita-national-ranking-tournament",
    name: "AITA National Ranking Tournament (Senior)",
    level: "National",
    description:
      "A series of national ranking tournaments organised by AITA throughout the year for senior men and women. Points earned determine national rankings, which influence Davis Cup and Billie Jean King Cup selections. AITA conducts these events across four tiers — Super Series (SS), National Series (NS), City Series (CS), and Team Series (TS) — catering to every competitive level from beginner to elite.",
    ageGroup: "Open (18+)",
    typicalDates: "Year-round (schedule published on AITA website each January)",
    registrationDeadline: "Per tournament — typically 3 weeks before each event",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Tennis Association",
      acronym: "AITA",
      website: "https://www.aitatennis.com",
      type: "private",
      about:
        "AITA is the national governing body for tennis in India, founded in 1920.",
    },
    participationGuide: [
      "Obtain an AITA membership (annual registration, available on aitatennis.com)",
      "Check the AITA tournament calendar for upcoming ranking events in your region — start with City Series (CS) if your child is new to the circuit",
      "Register for the tournament through the AITA online portal before the entry deadline",
      "Pay the entry fee and confirm your spot",
      "Travel to the venue and compete — points are automatically updated to your national ranking",
    ],
    qualificationPath:
      "AITA membership → City Series (CS) → National Series (NS) → Super Series (SS) → Fenesta Open / Davis Cup / Billie Jean King Cup",
    circuitContext:
      "The AITA National Ranking Circuit is the backbone of Indian tennis, operating across four distinct tiers. Team Series (TS): team-format competitions, good for beginners learning structured match-play. City Series (CS): individual events at city level — the correct starting point for any player new to the AITA circuit, held dozens of times per year across India. National Series (NS): national-level events with significantly higher ranking points and stronger field. Super Series (SS): the premium tier — highest-ranked national events, attracting India's top players. Points from CS, NS, and SS events accumulate to build a player's AITA national ranking. This ranking determines direct acceptance into higher-tier events and is the primary criterion for Davis Cup and Billie Jean King Cup squad consideration. For juniors, AITA runs a parallel Junior Circuit (Junior CS, Junior NS, Junior SS) that leads to the AITA Junior National Championship. A child cannot jump from beginner directly to SS — ranking must be built systematically through CS and NS events first.",
    format: "Single elimination with qualifying rounds for lower-ranked players",
    prestige: "ranking",
    registrationUrl: "https://www.aitatennis.com/tournaments",
    sourceUrls: ["https://www.aitatennis.com"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "tennis",
    slug: "aita-junior-national-championship",
    name: "AITA Junior National Championship",
    level: "National",
    description:
      "India's most prestigious junior tennis championship, featuring U-12, U-14, U-16, and U-18 age categories for boys and girls. Organised annually by AITA, it is the definitive benchmark for junior talent in India and the gateway to international ITF junior events.",
    ageGroup: "Under-18 (separate categories: U-12, U-14, U-16, U-18)",
    typicalDates: "December–January",
    registrationDeadline: "State association nomination deadline — typically November",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Tennis Association",
      acronym: "AITA",
      website: "https://www.aitatennis.com",
      type: "private",
      about:
        "AITA is the national governing body for tennis in India, founded in 1920.",
    },
    participationGuide: [
      "Join your State Tennis Association (STA) and participate in state-level junior tournaments",
      "Build AITA junior ranking through the Junior City Series (CS), Junior National Series (NS), and Junior Super Series (SS)",
      "Your STA nominates or you qualify directly based on AITA junior national ranking",
      "Register through your state association's official nomination process",
      "Compete in the age-group draw for your category at the national venue",
    ],
    qualificationPath:
      "Junior City Series (CS) → Junior National Series (NS) → Junior Super Series (SS) → AITA Junior National Ranking → Junior National Championship",
    circuitContext:
      "AITA's junior circuit mirrors the senior ranking system with four tiers. Junior City Series (CS): city-level events for beginners and club-level players — the ideal starting point for any junior new to competitive tennis. Junior National Series (NS): national-level events for established state-level juniors. Junior Super Series (SS): the premium junior tier, attracting the top junior players in the country. Ranking points from multiple Junior CS, NS, and SS events across the year determine a player's AITA junior national ranking — the primary criterion for direct acceptance into the Junior National Championship. After the Junior National, top U-18 performers gain AITA's backing to enter ITF Junior events globally (ITF J60, J100, J250 grade tournaments). AITA uses Junior National performance for selecting India juniors for Asia-Pacific Junior Team Championships and ITF Junior Davis Cup / Junior Fed Cup campaigns.",
    format: "Single elimination by age group",
    prestige: "flagship",
    registrationUrl: "https://www.aitatennis.com",
    sourceUrls: ["https://www.aitatennis.com/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "tennis",
    slug: "syed-modi-india-international-tennis",
    name: "ITF India Open",
    level: "International",
    description:
      "An ITF-sanctioned international tennis tournament held in India, providing Indian players the opportunity to earn ITF world ranking points on home soil. It is part of the ITF World Tennis Tour circuit and attracts players from across Asia and beyond.",
    ageGroup: "Open (18+)",
    typicalDates: "Varies — typically January or September",
    registrationDeadline: "ITF tournament entry system — 4 weeks before the event",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Tennis Association",
      acronym: "AITA",
      website: "https://www.aitatennis.com",
      type: "private",
      about:
        "AITA is the national governing body for tennis in India, affiliated with the International Tennis Federation (ITF).",
    },
    participationGuide: [
      "Hold an active ITF player ID (register at itftennis.com)",
      "Check the ITF tournament calendar for India Open entry opening",
      "Submit entry through the ITF tournament entry system before the deadline",
      "Confirm acceptance into the main draw or qualifying rounds",
      "Compete and accumulate ITF world ranking points",
    ],
    qualificationPath:
      "AITA domestic ranking (CS/NS/SS circuit) → Fenesta Open (domestic apex) → ITF World Tennis Tour events in Asia → ITF India Open",
    circuitContext:
      "The ITF India Open sits above the domestic AITA circuit. Two separate ranking systems run in Indian tennis: AITA national ranking (built through CS/NS/SS domestic events) for national team consideration, and ITF world ranking (built through ITF World Tennis Tour events internationally) for international circuit entry. Indian players typically build their domestic AITA ranking first, then begin targeting ITF World Tennis Tour events in India and Asia to build ITF world ranking. The international ladder above this event: ITF World Tennis Tour → ATP/WTA Challenger → ATP/WTA main tour. A strong ITF world ranking (top 300–400) unlocks Challenger entry; top 100 ITF = ATP/WTA main tour direct acceptance. This event on Indian soil allows Indian players to earn ITF points without the travel cost of competing abroad.",
    format: "Single elimination with qualifying",
    prestige: "ranking",
    registrationUrl: "https://www.itftennis.com",
    sourceUrls: ["https://www.itftennis.com", "https://www.aitatennis.com"],
    lastScrapedAt: new Date(),
  },

  // ─── CHESS (AICF) ─────────────────────────────────────────────────────────
  {
    sportSlug: "chess",
    slug: "national-chess-championship-senior",
    name: "National Chess Championship (Senior)",
    level: "National",
    description:
      "India's premier chess championship for seniors, organised annually by the All India Chess Federation (AICF). It determines the national champion and contributes to FIDE rating calculations. Top performers are considered for international team selections.",
    ageGroup: "Open (18+)",
    typicalDates: "December–January",
    registrationDeadline: "AICF state federation nomination — approximately 6 weeks before",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Chess Federation",
      acronym: "AICF",
      website: "https://www.aicf.in",
      type: "private",
      about:
        "AICF is the national governing body for chess in India, founded in 1951 and affiliated with FIDE (the World Chess Federation). India has produced world champions (Viswanathan Anand) and multiple Grand Masters. AICF organises national championships, rating tournaments, and India's participation in Chess Olympiad.",
    },
    participationGuide: [
      "Hold an AICF membership and a valid FIDE ID (register at aicf.in)",
      "Participate in state-level championships to earn your state's nomination",
      "Your State Chess Association nominates eligible players (based on rating or state championship results)",
      "Complete the entry form with payment through the AICF portal",
      "Compete in the round-robin or Swiss system format",
    ],
    qualificationPath:
      "Club/school chess → AICF-rated district/state events → State Championship → State federation nomination → National Senior Championship",
    circuitContext:
      "AICF's competitive ladder is built on FIDE rating — the globally recognised numerical system. The pathway: unrated beginner → AICF/FIDE rated club or school events → district tournaments → State Championship → state nomination → National Championship. Key FIDE rating milestones: 2000 = National Master (NM) title; 2200 + 3 IM norms = International Master (IM); 2500 + 3 GM norms = Grandmaster (GM). India currently has 80+ Grandmasters. The National Senior Championship is the event AICF selectors watch to name players for the Chess Olympiad team and FIDE World Team Championship. Winning the National title essentially guarantees inclusion in India's Olympiad team selection discussion.",
    format: "Swiss system (9–13 rounds) or Round Robin for top players",
    prestige: "flagship",
    prizePool: "₹5 lakh+ total; champion receives national title and international team consideration",
    registrationUrl: "https://www.aicf.in",
    sourceUrls: ["https://www.aicf.in/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "chess",
    slug: "national-youth-chess-championship",
    name: "National Youth Chess Championship",
    level: "National",
    description:
      "AICF's annual youth chess championship featuring U-7 through U-19 age categories. Top finishers represent India at the Asian Youth Chess Championship and World Youth Chess Championship. It is the most important junior chess event in India.",
    ageGroup: "Under-19 (separate categories from U-7 to U-19)",
    typicalDates: "May–June (coinciding with school holidays)",
    registrationDeadline: "State federation nomination — April",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Chess Federation",
      acronym: "AICF",
      website: "https://www.aicf.in",
      type: "private",
      about:
        "AICF is the national governing body for chess in India, affiliated with FIDE.",
    },
    participationGuide: [
      "Register with your State Chess Association and participate in state-level age-group tournaments",
      "Win or qualify through your state championship for the national age category",
      "Your state federation submits nominations to AICF with required documents",
      "Pay the entry fee and travel to the national tournament venue",
      "Compete in the Swiss system format — top 2-3 finishers qualify for Asia/World Youth",
    ],
    qualificationPath:
      "School/club chess → AICF-rated events → State Youth Championship → State nomination → National Youth Championship → Asian/World Youth Championship",
    circuitContext:
      "AICF's youth chess ladder spans ten separate age categories (U-7, U-9, U-11, U-13, U-15, U-17, U-19 for boys and girls). The pathway for each: school/club rated events → AICF-rated district events → State Youth Championship → state nomination → National Youth Championship. Top 2–3 finishers in each category represent India at the Asian Youth Chess Championship (AYCF) and FIDE World Youth Chess Championship. Performing well internationally at youth level is critical — most of India's current 80+ Grandmasters achieved their first international norm while representing India at the World Youth. Building a FIDE rating early (even at U-7 level through rated school events) gives a child a measurable international track record that accelerates future selections and scholarship opportunities.",
    format: "Swiss system (9 rounds per age group)",
    prestige: "developmental",
    prizePool: "Medals, certificates, and international team selection",
    registrationUrl: "https://www.aicf.in",
    sourceUrls: ["https://www.aicf.in/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "chess",
    slug: "tata-steel-chess-india",
    name: "Tata Steel Chess India",
    level: "International",
    description:
      "A prestigious international rapid and blitz chess tournament held in Kolkata, attracting world-class players including multiple World Champions. Part of the Grand Chess Tour, it is the highest-profile international chess event on Indian soil and significantly raises the visibility of chess in India.",
    ageGroup: "Open (elite invitational, 18+)",
    typicalDates: "November",
    registrationDeadline: "Invitational only — top players are directly invited",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Chess Federation",
      acronym: "AICF",
      website: "https://www.aicf.in",
      type: "private",
      about:
        "AICF is the national governing body for chess in India. Tata Steel Chess India is co-organised with Tata Steel as the title sponsor.",
    },
    participationGuide: [
      "This is an invitational event — players must achieve an elite FIDE rating (2700+)",
      "Indian players are invited based on top national ranking and FIDE rating",
      "Contact AICF or the organising committee for wildcard spots (very limited)",
      "Watch and study this event to understand elite-level play — it is the gold standard for aspiring Indian GMs",
    ],
    qualificationPath:
      "AICF-rated events → National Championship → FIDE Grandmaster title (2500+) → FIDE rating of 2700+ → AICF or organiser invitation",
    circuitContext:
      "Tata Steel Chess India is an invitation-only elite event — the destination that top Indian players aspire to, not a step in the developmental ladder. The path here takes 10–15 years: FIDE-rated school events → state championship → National Championship → earning IM norms (2200 FIDE + 3 norms) → earning GM norms (2500 FIDE + 3 norms) → reaching an elite FIDE rating of 2600–2700. India currently has D. Gukesh (reigning World Champion), R. Praggnanandhaa, Arjun Erigaisi, and Koneru Humpy competing at this level. For parents of young players, this event serves as an inspirational benchmark — watching and analysing these games with your child is one of the most effective development tools available for understanding world-class chess thinking.",
    format: "Double round-robin (rapid + blitz)",
    prestige: "flagship",
    prizePool: "USD 1,50,000+ total prize",
    registrationUrl: "https://www.aicf.in",
    sourceUrls: ["https://www.aicf.in", "https://grandchesstour.org"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "chess",
    slug: "national-sub-junior-chess-championship",
    name: "National Sub-Junior Chess Championship",
    level: "National",
    description:
      "AICF's national championship for players under 15, featuring U-9, U-11, U-13, and U-15 categories. It is the first major national stage for young chess players and directly feeds into the National Youth Championship pipeline.",
    ageGroup: "Under-15 (separate categories: U-9, U-11, U-13, U-15)",
    typicalDates: "December",
    registrationDeadline: "State federation nomination — November",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Chess Federation",
      acronym: "AICF",
      website: "https://www.aicf.in",
      type: "private",
      about:
        "AICF is the national governing body for chess in India, affiliated with FIDE.",
    },
    participationGuide: [
      "Participate in school and district chess tournaments to gain experience",
      "Join your State Chess Association's junior training program",
      "Qualify through the state sub-junior championship for your age category",
      "Get nominated by your state federation before the AICF deadline",
      "Compete in the 9-round Swiss system at the national venue",
    ],
    qualificationPath:
      "School chess → AICF-rated district events → State Sub-Junior Championship → State nomination → National Sub-Junior Championship → National Youth Championship",
    circuitContext:
      "The National Sub-Junior Championship is the first major AICF national event in the pipeline. The full junior ladder: unrated school player → AICF/FIDE rated club events (children can get rated from age 5+) → district sub-junior tournaments → State Sub-Junior Championship (U-9, U-11, U-13, U-15) → National Sub-Junior Championship → National Youth Championship (U-7 to U-19) → Asian Youth → World Youth Championship. Earning a FIDE rating as early as possible is critical — even U-7 players can participate in FIDE-rated events through AICF. A child who starts collecting rated games at U-9 has a significant measurable advantage in future selections over a child who enters the rated circuit at U-15. Top Sub-Junior National performers are identified by AICF for state-supported coaching and training camps.",
    format: "Swiss system (9 rounds per age group)",
    prestige: "developmental",
    registrationUrl: "https://www.aicf.in",
    sourceUrls: ["https://www.aicf.in/tournaments"],
    lastScrapedAt: new Date(),
  },

  // ─── FOOTBALL (AIFF) ──────────────────────────────────────────────────────
  {
    sportSlug: "football",
    slug: "indian-super-league",
    name: "Indian Super League (ISL)",
    level: "National",
    description:
      "India's top-tier professional football league, featuring 13 city-based clubs. Launched in 2013, it is now the primary competitive platform for professional footballers in India and is affiliated with AFC (Asian Football Confederation). ISL champions qualify for the AFC Champions League.",
    ageGroup: "Open (18+, professional)",
    typicalDates: "September–May",
    registrationDeadline: "Club-based contracts and AIFF transfer window (June–September)",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Football Federation",
      acronym: "AIFF",
      website: "https://www.the-aiff.com",
      type: "private",
      about:
        "AIFF is the national governing body for football in India, founded in 1937 and affiliated with FIFA and AFC. It organises the Indian Super League, I-League, Santosh Trophy, and national team competitions. India is a member of the South Asian Football Federation (SAFF).",
    },
    participationGuide: [
      "Build a strong grassroots record through AIFF-affiliated academies and the I-League system",
      "Get noticed by ISL club scouts during domestic tournaments and training camps",
      "Sign an academy contract with an ISL club (most clubs have U-18 and U-21 academies)",
      "Progress through the club's age-group teams into the senior squad",
      "Gain professional status through an AIFF-registered contract",
    ],
    qualificationPath:
      "AIFF Grassroots → State U-13/U-15/U-17 Championships → I-League 2 → I-League → ISL senior squad",
    circuitContext:
      "AIFF's professional football pyramid has four distinct levels: AIFF Grassroots Programs (U-12, U-14, school/club level) → State U-13/U-15/U-17 National Championships → I-League 2 (second professional division) → I-League (first professional division) → ISL (premier franchise league, highest prestige and income). ISL clubs each have U-18 and U-21 academies serving as the primary entry point into the professional system. Players who excel in AIFF National Championships (U-13/U-15/U-17) are scouted by ISL academies. A parallel route exists through the Hero Junior League (HJL) and AIFF-SAI residential academies at Goa and Bengaluru. The ISL is the apex — only players with professional club contracts at ISL or I-League clubs can participate.",
    format: "Round-robin league (home & away) followed by playoffs and final",
    prestige: "flagship",
    prizePool: "₹40 Cr+ total prize; ISL Champions Trophy",
    registrationUrl: "https://www.indiansuperleague.com",
    sourceUrls: ["https://www.indiansuperleague.com", "https://www.the-aiff.com"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "football",
    slug: "santosh-trophy",
    name: "Santosh Trophy",
    level: "National",
    description:
      "India's oldest and most prestigious inter-state football championship, first played in 1941. Organised by AIFF, it features state teams competing in regional qualifying rounds before the national final. Many Indian international players have represented their states in this tournament.",
    ageGroup: "Open (18+, state teams)",
    typicalDates: "January–March",
    registrationDeadline: "State Football Association registration — November",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Football Federation",
      acronym: "AIFF",
      website: "https://www.the-aiff.com",
      type: "private",
      about:
        "AIFF is the national governing body for football in India, founded in 1937.",
    },
    participationGuide: [
      "Register with your State Football Association (SFA) and play in state league/district tournaments",
      "Perform consistently in the state league to get noticed by state team selectors",
      "Attend state team trials organised by your SFA before the tournament",
      "If selected, train with the state squad and participate in the regional qualifying round",
      "Top teams from each region advance to the national final round",
    ],
    qualificationPath:
      "District football → State league → State team trials → Regional qualifying → Santosh Trophy National Final",
    circuitContext:
      "The Santosh Trophy is the senior state-representative championship — a parallel route to the I-League/ISL club pathway for players who represent their state rather than a club. The full ladder: AIFF Grassroots / district football → state league (conducted by State Football Association) → state team trials → Santosh Trophy regional qualifying → national final. ISL and I-League scouts attend Santosh Trophy matches to identify talent outside the club academy system — performing well here is one of the few pathways for players from smaller football states (Northeast India, smaller metros) to secure professional club contracts. India's national team historically had many Santosh Trophy veterans before the ISL professionalised the structure.",
    format: "Regional group stage followed by national knockout semifinals and final",
    prestige: "flagship",
    registrationUrl: "https://www.the-aiff.com",
    sourceUrls: ["https://www.the-aiff.com/tournaments/santosh-trophy"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "football",
    slug: "durand-cup",
    name: "Durand Cup",
    level: "National",
    description:
      "Asia's oldest football tournament, first held in 1888 in Shimla. Now a modern club competition featuring ISL teams, I-League clubs, and service teams, it is held annually in Kolkata. Winning the Durand Cup is one of the highest honours in Indian club football.",
    ageGroup: "Open (18+, club teams)",
    typicalDates: "August–September",
    registrationDeadline: "Club entry — June/July (via AIFF and organising committee)",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Football Federation",
      acronym: "AIFF",
      website: "https://www.the-aiff.com",
      type: "hybrid",
      about:
        "The Durand Cup is organised jointly by the Durand Football Tournament Society and AIFF. It is the world's third-oldest football tournament after the FA Cup and Scottish Cup.",
    },
    participationGuide: [
      "Play for a club competing in ISL, I-League, or recognised state leagues",
      "Clubs receive invitations or apply for entry through the Durand Football Tournament Society",
      "Player registration follows AIFF transfer window and club contract rules",
      "Compete in the group stage (held in multiple cities) followed by knockout rounds in Kolkata",
    ],
    qualificationPath:
      "Club contract (ISL/I-League/Service team) → Club entry into Durand Cup",
    circuitContext:
      "The Durand Cup is a club-based knockout competition running alongside the I-League and ISL in the AIFF calendar. As Asia's oldest tournament, it provides additional competitive exposure for ISL and I-League clubs. It uniquely includes service teams (Indian Army, Navy, Air Force) — offering an alternative professional pathway for players who join the armed forces. For young players, the Durand Cup is aspirational: a professional club contract with an ISL or I-League club is the prerequisite. The full club ladder: AIFF Grassroots → ISL/I-League academy (U-18/U-21) → senior club contract → I-League → ISL → Durand Cup and AFC international competition.",
    format: "Group stage followed by knockout quarterfinals, semis, and final",
    prestige: "flagship",
    prizePool: "Durand Cup Trophy + significant prize money",
    registrationUrl: "https://www.durandcup.in",
    sourceUrls: ["https://www.durandcup.in", "https://www.the-aiff.com"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "football",
    slug: "aiff-u17-youth-cup",
    name: "AIFF Sub-Junior & Junior National Football Championship",
    level: "National",
    description:
      "AIFF's national age-group football championships covering U-13, U-15, and U-17 categories for state teams. These are the primary development pathways that feed into the India U-17 and U-20 national teams for FIFA World Cup qualifying campaigns.",
    ageGroup: "Under-17 (separate U-13, U-15, U-17 categories)",
    typicalDates: "October–December",
    registrationDeadline: "State Football Association entry — September",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "All India Football Federation",
      acronym: "AIFF",
      website: "https://www.the-aiff.com",
      type: "private",
      about:
        "AIFF is the national governing body for football in India, founded in 1937.",
    },
    participationGuide: [
      "Enroll in an AIFF-affiliated academy or play for your school/club in AIFF Grassroots programs",
      "Participate in state-level U-13/U-15/U-17 tournaments",
      "Attend state team trials run by your State Football Association",
      "If selected, join the state squad and compete in the zonal qualifying round",
      "Top state teams advance to the national final",
    ],
    qualificationPath:
      "AIFF Grassroots/academy → District U-13/U-15/U-17 → State team trials → Zonal qualifying → AIFF National Championship → India U-17/U-20 national team",
    circuitContext:
      "AIFF's age-group national championships are the formal entry point into the development pyramid. The ladder: AIFF Grassroots Programs (U-12, U-14, school-level) → State U-13/U-15/U-17 Championships → AIFF National Championship. AIFF selectors formally observe all National Championship matches to identify players for the India U-17 national team — the squad that represents India in AFC U-17 Asian Cup qualifying and, in hosting years, the FIFA U-17 World Cup. Players selected into the India U-17 camp are placed in the AIFF/SAI residential academy at Goa or Bengaluru, receiving full-time professional coaching. From U-17 national level, the ladder continues to U-20 and then the senior national team and I-League professional career.",
    format: "Zonal group stage + national knockout",
    prestige: "developmental",
    registrationUrl: "https://www.the-aiff.com",
    sourceUrls: ["https://www.the-aiff.com/tournaments"],
    lastScrapedAt: new Date(),
  },

  // ─── BASKETBALL (BFI) ────────────────────────────────────────────────────
  {
    sportSlug: "basketball",
    slug: "national-basketball-championship",
    name: "Senior National Basketball Championship",
    level: "National",
    description:
      "Basketball Federation of India's annual national championship for senior men's and women's state teams. It is the highest domestic basketball competition and the primary selection platform for the Indian national basketball team for FIBA Asia tournaments and Asian Games.",
    ageGroup: "Open (18+)",
    typicalDates: "November–December",
    registrationDeadline: "State Basketball Association entry — October",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Basketball Federation of India",
      acronym: "BFI",
      website: "https://www.basketballfederationindia.org",
      type: "private",
      about:
        "BFI is the national governing body for basketball in India, affiliated with FIBA (International Basketball Federation). It organises national championships across age groups, 3×3 basketball, and India's participation in FIBA Asia Cup and Olympic qualifiers.",
    },
    participationGuide: [
      "Register with your State Basketball Association (SBA) and play in the state league",
      "Perform consistently to get selected into your state's senior squad",
      "Your SBA submits an entry to BFI before the registration deadline",
      "Travel to the tournament venue and compete in the group stage and knockout rounds",
      "Top performers are observed by BFI national team selectors",
    ],
    qualificationPath:
      "School/district basketball → State U-14/U-16/U-18 Championships → State Senior Championship → Senior National Basketball Championship",
    circuitContext:
      "BFI's domestic basketball pyramid runs across five levels: school/CBSE basketball → district association → State U-14 Championship → State U-16 Championship → State U-18 Championship → State Senior Championship → Senior National Basketball Championship. The Senior National Championship is the primary national team selection event — BFI selectors observe every match and use results to name players for the FIBA Asia Cup, South Asian Games, Commonwealth Games, and Asian Games squads. BFI also runs a separate 3×3 Basketball League (3BL) with its own city-stop circuit leading to national finals and FIBA 3×3 World Tour qualifying — a genuinely distinct Olympic pathway from 5×5 basketball.",
    format: "Round-robin group stage followed by knockout semifinals and final",
    prestige: "flagship",
    registrationUrl: "https://www.basketballfederationindia.org",
    sourceUrls: ["https://www.basketballfederationindia.org"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "basketball",
    slug: "u18-national-basketball-championship",
    name: "U-18 National Basketball Championship",
    level: "National",
    description:
      "BFI's annual Under-18 national championship for state teams, the key development tournament feeding the India U-18 international program. Players who impress here are fast-tracked to the senior national team pipeline.",
    ageGroup: "Under-18",
    typicalDates: "August–September",
    registrationDeadline: "State Basketball Association entry — July",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Basketball Federation of India",
      acronym: "BFI",
      website: "https://www.basketballfederationindia.org",
      type: "private",
      about:
        "BFI is the national governing body for basketball in India, affiliated with FIBA.",
    },
    participationGuide: [
      "Join a BFI-affiliated basketball academy or your school team",
      "Participate in district and state-level U-18 tournaments",
      "Attend state team trials and get selected into the U-18 state squad",
      "Your SBA registers the team with BFI and sends you to the national event",
    ],
    qualificationPath:
      "School/district basketball → State U-14 Championship → State U-16 Championship → State U-18 Championship → U-18 National Championship",
    circuitContext:
      "BFI's youth development ladder: school/CBSE basketball → district tournaments → State U-14 Championship → State U-16 Championship → State U-18 Championship → National U-18 Championship. Top performers at the National U-18 Championship enter BFI's national U-18 training camp and are considered for India U-18 representation in the FIBA Asian U-18 Championship. This is the most critical bridge from youth basketball to senior national consideration — players who impress here are directly observed by BFI's national senior team selectors and placed in the senior talent pool. From U-18, the progression continues to Senior National Championship → national team → professional leagues and FIBA international events.",
    format: "Group stage + knockout",
    prestige: "developmental",
    registrationUrl: "https://www.basketballfederationindia.org",
    sourceUrls: ["https://www.basketballfederationindia.org"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "basketball",
    slug: "3bl-3x3-basketball-league",
    name: "3BL — 3×3 Basketball League",
    level: "National",
    description:
      "India's official 3×3 basketball league, organised under BFI and endorsed by FIBA. 3×3 basketball became an Olympic discipline at Tokyo 2020. The 3BL is the primary pathway for players aiming for the FIBA 3×3 World Tour and eventual Olympic qualification.",
    ageGroup: "Open (18+)",
    typicalDates: "March–October (multiple stops across India)",
    registrationDeadline: "Team registration through BFI per tournament stop",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Basketball Federation of India",
      acronym: "BFI",
      website: "https://www.basketballfederationindia.org",
      type: "private",
      about:
        "BFI is the national governing body for basketball in India, affiliated with FIBA.",
    },
    participationGuide: [
      "Form a team of 3 players + 1 substitute (all FIBA-registered)",
      "Register your team for a 3BL city stop through the BFI 3×3 portal",
      "Compete in the pool stage and knockout rounds at the city stop",
      "Accumulate ranking points across multiple stops to qualify for the National Finals",
    ],
    qualificationPath:
      "Open team registration → 3BL city stop events → Ranking points accumulation → 3BL National Finals → FIBA 3×3 Asia/World Tour qualifying",
    circuitContext:
      "3×3 basketball has an entirely separate competitive circuit from 5×5 basketball under BFI. The 3BL ladder: open team registration (3 players + 1 substitute) → 3BL city stop events held at multiple Indian cities throughout the year → accumulate city-stop ranking points → 3BL National Finals for top-ranked teams → FIBA 3×3 Asia/World Tour qualifying representation. 3×3 became an Olympic discipline at Tokyo 2020, making this a legitimate route to Olympic qualification. FIBA 3×3 is team-based — India fields a 4-player team per gender, ranked by the FIBA 3×3 Federation Ranking. BFI also runs 3×3 events at national-level multi-sport meets for U-18 athletes, giving junior players exposure to this Olympic discipline.",
    format: "Pool stage + knockout at each city stop; season finals for top teams",
    prestige: "ranking",
    registrationUrl: "https://www.basketballfederationindia.org",
    sourceUrls: ["https://www.basketballfederationindia.org", "https://www.fiba.basketball/3x3"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "basketball",
    slug: "khelo-india-basketball",
    name: "Khelo India Youth Games (Basketball)",
    level: "National",
    description:
      "Basketball competition at the Government of India's Khelo India Youth Games — the country's biggest multi-sport event for under-18 athletes. Conducted by the Ministry of Youth Affairs and Sports, it provides national exposure and financial support to top performers.",
    ageGroup: "Under-18",
    typicalDates: "January–February (varies by host state each year)",
    registrationDeadline: "State Sports Authority nomination — November/December",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Ministry of Youth Affairs & Sports (via Sports Authority of India)",
      acronym: "SAI",
      website: "https://kheloindia.gov.in",
      type: "govt",
      about:
        "Khelo India is a flagship Government of India initiative to revive India's sports culture. Administered by SAI (Sports Authority of India), it covers 26+ disciplines and provides annual scholarships of ₹5 lakh to medal-winning athletes for 8 years.",
    },
    participationGuide: [
      "Participate in your state's Khelo India selection trials (conducted by State Sports Authority)",
      "Get selected into your state's Khelo India U-18 basketball squad",
      "Your state submits the squad to SAI with required eligibility documents",
      "Travel to the host state and compete in the multi-sport event alongside athletes from all disciplines",
      "Medal winners receive automatic consideration for the Khelo India Scholarship (₹5 lakh/year)",
    ],
    qualificationPath:
      "State sports authority trials → Khelo India U-18 state squad → Khelo India Youth Games → Khelo India Scholarship → SAI NCOE training program",
    circuitContext:
      "Khelo India Basketball is a government-run parallel pathway alongside BFI's national championship circuit. The two are not mutually exclusive — a serious U-18 player should pursue both. The Khelo India ladder: state sports authority selection trials (open to all U-18 players) → state Khelo India basketball squad → Khelo India Youth Games national competition → Khelo India Scholarship (₹5 lakh/year × 8 years for medalists). Unlike BFI's SBA-based pathway, Khelo India selects through State Sports Authority trials — making it accessible to players from non-metropolitan areas who may not be connected to the BFI state association network. Medal winners are automatically admitted into SAI's National Centre of Excellence (NCOE) basketball programs, which provide professional coaching and a direct pathway into BFI's senior national circuit.",
    format: "Group stage + knockout",
    prestige: "developmental",
    prizePool: "₹5 lakh/year scholarship for 8 years for gold/silver/bronze medalists",
    registrationUrl: "https://kheloindia.gov.in",
    sourceUrls: ["https://kheloindia.gov.in"],
    lastScrapedAt: new Date(),
  },

  // ─── HOCKEY (HOCKEY INDIA) ───────────────────────────────────────────────
  {
    sportSlug: "hockey",
    slug: "hockey-india-league",
    name: "Hockey India League (HIL)",
    level: "National",
    description:
      "India's premier franchise-based field hockey league, organised by Hockey India. Featuring international and domestic players on city-based franchises, the HIL is the highest profile domestic hockey competition and is used as a platform for national team selections.",
    ageGroup: "Open (18+)",
    typicalDates: "January–March",
    registrationDeadline: "Player auction and team contracts — November/December",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Hockey India",
      acronym: "HI",
      website: "https://www.hockeyindia.org",
      type: "private",
      about:
        "Hockey India is the national governing body for field hockey in India, affiliated with FIH (International Hockey Federation). India is an 8-time Olympic gold medalist in hockey. Hockey India administers domestic leagues, national championships, and India's international schedule including FIH Pro League and Champions Trophy.",
    },
    participationGuide: [
      "Build domestic performance through Hockey India's National Championship and Sub-Junior/Junior tournaments",
      "Get included in the Hockey India Elite/High-Performance program",
      "Attract franchise scouts through consistent state and national team performances",
      "Get picked at the HIL Auction (franchises bid for players based on national ranking and performance)",
      "Sign a franchise contract and attend pre-league training camps",
    ],
    qualificationPath:
      "School/SAI academy → Sub-Junior Nationals (U-18) → Junior Nationals (U-21) → Senior Nationals (Dhyan Chand Trophy) → Hockey India High-Performance Program → National team → HIL Auction",
    circuitContext:
      "Hockey India's domestic pyramid is structured across four age-group tiers. The full ladder: school/SAI centre → State Sub-Junior team (Hockey India Sub-Junior National Championship, U-18) → State Junior team (Hockey India Junior National Championship, U-21) → State Senior team (Senior National Championship / Dhyan Chand Trophy) → Hockey India High-Performance Program (residential training in Bengaluru/Bhopal) → Senior national team → Hockey India League (HIL) franchise auction. The HIL is the apex — only players with a strong state-level national championship record and Hockey India recognition are bid for. Unlike cricket's IPL, the HIL includes both Indian and international players, meaning Indian players compete directly alongside world-class talent from Netherlands, Australia, Belgium, and Germany.",
    format: "Round-robin league followed by playoffs and final",
    prestige: "flagship",
    registrationUrl: "https://www.hockeyindia.org",
    sourceUrls: ["https://www.hockeyindia.org/hockey-india-league"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "hockey",
    slug: "senior-national-hockey-championship",
    name: "Senior National Hockey Championship (Dhyan Chand Trophy)",
    level: "National",
    description:
      "Hockey India's annual senior national championship for state teams, contested for the Dhyan Chand Trophy — named after India's greatest hockey player and Olympic gold medalist. It is the primary platform for senior domestic hockey and the main selection event for the national team.",
    ageGroup: "Open (18+, state teams)",
    typicalDates: "November–December",
    registrationDeadline: "State Hockey Association entry — October",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Hockey India",
      acronym: "HI",
      website: "https://www.hockeyindia.org",
      type: "private",
      about:
        "Hockey India is the national governing body for field hockey in India, affiliated with FIH.",
    },
    participationGuide: [
      "Play for your district or club in state-level hockey leagues",
      "Attend the annual senior state team trials run by your State Hockey Association",
      "Get selected into the state squad and complete the registration process",
      "Travel to the tournament venue and compete in the group stage and knockouts",
    ],
    qualificationPath:
      "State hockey league → Sub-Junior Nationals → Junior Nationals (U-21) → State senior team trials → Dhyan Chand Trophy → Hockey India High-Performance Program",
    circuitContext:
      "The Dhyan Chand Trophy is the most important event in Hockey India's national team selection calendar. The pyramid: school/district hockey → State Sub-Junior squad (Sub-Junior Nationals, U-18) → State Junior squad (Junior Nationals, U-21) → State Senior squad (Dhyan Chand Trophy). Hockey India national selectors are formally present at every Dhyan Chand Trophy match. Players who excel here are invited to Hockey India's senior High-Performance Program residential camp in Bengaluru or Bhopal — the direct precursor to national team selection. India's Olympic squads (including the Paris 2024 Bronze medal team) are drawn almost entirely from players who performed consistently at the Dhyan Chand Trophy. After national team, the Hockey India League franchise auction is the next destination.",
    format: "Group stage + knockout semifinals and final",
    prestige: "flagship",
    registrationUrl: "https://www.hockeyindia.org",
    sourceUrls: ["https://www.hockeyindia.org/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "hockey",
    slug: "junior-national-hockey-championship",
    name: "Hockey India Junior National Championship (U-21)",
    level: "National",
    description:
      "Hockey India's national championship for players under 21. It is the key selection tournament for the India U-21 team, which competes in FIH Junior Hockey World Cup qualifying. Top performers move into the Hockey India Senior High-Performance program.",
    ageGroup: "Under-21",
    typicalDates: "August–September",
    registrationDeadline: "State Hockey Association entry — July",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Hockey India",
      acronym: "HI",
      website: "https://www.hockeyindia.org",
      type: "private",
      about:
        "Hockey India is the national governing body for field hockey in India, affiliated with FIH.",
    },
    participationGuide: [
      "Participate in Hockey India's Sub-Junior (U-18) program at your state",
      "Attend U-21 state team trials conducted by your State Hockey Association",
      "Get selected into the state U-21 squad",
      "Compete in the national championship — top performers are observed by Hockey India national selectors",
    ],
    qualificationPath:
      "School/district hockey → Sub-Junior National Championship (U-18) → U-21 state team trials → Junior National Championship (U-21) → India U-21 national team → Senior National Championship",
    circuitContext:
      "The Hockey India Junior National Championship (U-21) is the second rung from the top in Hockey India's domestic pyramid. The age-group ladder: Sub-Junior National Championship (U-18) → Junior National Championship (U-21) → Senior National Championship (Dhyan Chand Trophy). Hockey India selectors use the U-21 National Championship specifically to name the India U-21 squad for the FIH Junior Hockey World Cup qualifying and FIH Men's/Women's Junior World Cup. Players selected into the India U-21 camp join Hockey India's junior high-performance program at the SAI centre in Bengaluru. From U-21, the transition to the Senior National Championship typically takes 1–2 years — making the Junior Nationals the most critical gateway into professional hockey.",
    format: "Group stage + knockout",
    prestige: "developmental",
    registrationUrl: "https://www.hockeyindia.org",
    sourceUrls: ["https://www.hockeyindia.org/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "hockey",
    slug: "sub-junior-national-hockey-championship",
    name: "Hockey India Sub-Junior National Championship (U-18)",
    level: "National",
    description:
      "Hockey India's national championship for players under 18. The first major national hockey stage for young players, it feeds directly into the U-21 national pipeline. India's recent Olympic squads have included multiple players who starred at this level.",
    ageGroup: "Under-18",
    typicalDates: "April–May",
    registrationDeadline: "State Hockey Association entry — March",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Hockey India",
      acronym: "HI",
      website: "https://www.hockeyindia.org",
      type: "private",
      about:
        "Hockey India is the national governing body for field hockey in India, affiliated with FIH.",
    },
    participationGuide: [
      "Join a Hockey India affiliated academy or school hockey team",
      "Participate in district and state U-18 hockey tournaments",
      "Attend the Sub-Junior state team trials",
      "Get selected into the state U-18 squad and compete at the national tournament",
    ],
    qualificationPath:
      "School/SAI academy → District U-18 hockey → State Sub-Junior trials → Sub-Junior National Championship (U-18) → Junior National Championship (U-21)",
    circuitContext:
      "The Sub-Junior National Championship is the first formal Hockey India national stage and the entry point into the professional development pyramid. The ladder: school/SAI-centre hockey → district hockey → State Sub-Junior trials → Sub-Junior National Championship (U-18) → Junior National Championship (U-21) → Senior National Championship (Dhyan Chand Trophy) → Hockey India High-Performance Program → national team. Hockey India actively scouts at the Sub-Junior Nationals to identify players for the junior residential program. Several players from India's Paris 2024 Olympic Bronze medal squad were first identified nationally at U-18 Sub-Junior level — performing well at 15–17 years of age sets the foundation for everything that follows in a hockey career.",
    format: "Group stage + knockout",
    prestige: "developmental",
    registrationUrl: "https://www.hockeyindia.org",
    sourceUrls: ["https://www.hockeyindia.org/tournaments"],
    lastScrapedAt: new Date(),
  },

  // ─── TABLE TENNIS (TTFI) ─────────────────────────────────────────────────
  {
    sportSlug: "table-tennis",
    slug: "senior-national-table-tennis-championship",
    name: "Senior National Table Tennis Championship",
    level: "National",
    description:
      "The premier national table tennis event in India, organised annually by TTFI. It features men's and women's singles, doubles, and team events. Top performers are selected for India's Commonwealth Games, Asian Games, and World Championship teams.",
    ageGroup: "Open (18+)",
    typicalDates: "December–January",
    registrationDeadline: "State Table Tennis Association entry — November",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Table Tennis Federation of India",
      acronym: "TTFI",
      website: "https://www.ttfi.org",
      type: "private",
      about:
        "TTFI is the national governing body for table tennis in India, affiliated with ITTF (International Table Tennis Federation). India has produced world-class players and TTFI organises national championships, ranking series, and India's international calendar including Commonwealth Games and Asian Games preparation.",
    },
    participationGuide: [
      "Register with your State Table Tennis Association (STTA) and build your state ranking",
      "Participate in TTFI National Ranking Tournaments (NRT) throughout the year to accumulate national ranking points",
      "Your STTA nominates you based on state championship results or national ranking",
      "Complete TTFI registration and confirm your entry before the deadline",
      "Compete in team event first, then individual events at the national venue",
    ],
    qualificationPath:
      "STTA state membership → TTFI National Ranking Tournaments (NRT series) → National ranking accumulation → STTA nomination → Senior National Championship",
    circuitContext:
      "TTFI's competitive structure is anchored by the National Ranking Tournament (NRT) series — 5 to 7 events per year held at different cities across India. The NRT series IS the ranking circuit: every serious competitive TT player must participate in multiple NRT events to build their TTFI national ranking. The ladder: STTA state membership + TTFI player ID → Junior NRT (parallel circuit for U-12/U-15/U-18) or Senior NRT → accumulate ranking points across multiple NRTs throughout the year → National Ranking determines seeding and direct entry at the National Championship. National ranking is also the primary criterion for TTFI's selection of players for Commonwealth Games, Asian Games, and World Championship trial pools. Junior and senior NRT series run simultaneously.",
    format: "Team event (round-robin) + individual singles and doubles (elimination)",
    prestige: "flagship",
    registrationUrl: "https://www.ttfi.org",
    sourceUrls: ["https://www.ttfi.org/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "table-tennis",
    slug: "junior-national-table-tennis-championship",
    name: "Junior National Table Tennis Championship",
    level: "National",
    description:
      "TTFI's annual national championship for players under 18, featuring separate U-12, U-15, and U-18 categories. The primary pathway to the India U-18 international team and World Cadet/Junior TT Championships.",
    ageGroup: "Under-18 (U-12, U-15, U-18 categories)",
    typicalDates: "October–November",
    registrationDeadline: "STTA nomination — September",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Table Tennis Federation of India",
      acronym: "TTFI",
      website: "https://www.ttfi.org",
      type: "private",
      about:
        "TTFI is the national governing body for table tennis in India, affiliated with ITTF.",
    },
    participationGuide: [
      "Join an ITTF-registered table tennis academy or school TT program",
      "Participate in district and state junior championships for your age group",
      "Accumulate TTFI junior ranking points through the Junior NRT series",
      "Your state association nominates you based on ranking or state championship result",
      "Compete in individual and team events at the national venue",
    ],
    qualificationPath:
      "School/club TT → STTA state circuit → Junior NRT series → Junior national ranking → STTA nomination → Junior National Championship → India junior international team",
    circuitContext:
      "TTFI's junior circuit mirrors the senior NRT structure. The Junior NRT series runs throughout the year with separate events for U-12, U-15, and U-18 players. The junior ladder: school/club TT → STTA state membership → TTFI Junior NRT events (building junior national ranking) → STTA nomination based on state championship or junior ranking → Junior National Championship. Top 2–3 finishers at the Junior National in U-15 and U-18 categories qualify for India's team at the ITTF World Cadet Challenge (U-15) and World Junior Table Tennis Championships (U-18). Performing well at the Junior Nationals is the primary criterion for TTFI's selection of players for the Commonwealth Youth Games (U-18). After Junior National, players transition into the Senior NRT circuit while still competing at U-18 level.",
    format: "Team + individual elimination by age group",
    prestige: "developmental",
    registrationUrl: "https://www.ttfi.org",
    sourceUrls: ["https://www.ttfi.org/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "table-tennis",
    slug: "ttfi-national-ranking-tournament",
    name: "TTFI National Ranking Tournament",
    level: "National",
    description:
      "A series of ranking tournaments conducted by TTFI throughout the year. Points earned determine national rankings for senior and junior players. Multiple editions are held annually across India, making these the most accessible national-level TT competitions.",
    ageGroup: "Open (separate Senior and Junior categories)",
    typicalDates: "Year-round (5–7 editions per year)",
    registrationDeadline: "Per tournament — 3 weeks before each event, via STTA",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Table Tennis Federation of India",
      acronym: "TTFI",
      website: "https://www.ttfi.org",
      type: "private",
      about:
        "TTFI is the national governing body for table tennis in India, affiliated with ITTF.",
    },
    participationGuide: [
      "Register with your State Table Tennis Association (STTA) and get a TTFI player ID",
      "Check the TTFI tournament calendar for the next national ranking event near you",
      "Submit your entry through your STTA or directly on the TTFI portal",
      "Travel to the venue, confirm your seeding in the draw, and compete",
      "Points are automatically added to your TTFI national ranking after the event",
    ],
    qualificationPath:
      "STTA membership + TTFI player ID → Junior or Senior NRT participation → Ranking points accumulate → National Championship entry seeding",
    circuitContext:
      "The TTFI NRT series is the backbone of Indian competitive table tennis — there is no other pathway to build a TTFI national ranking. NRT participation is mandatory for any player seeking National Championship entry or national team consideration. The NRT circuit runs 5–7 times per year across different host cities. Senior and Junior NRT events run in parallel: a U-18 player can participate in both Junior NRTs (building junior national ranking) and Senior NRTs (building senior national ranking). Ranking points are updated within 14 days of each NRT. The year's accumulated NRT ranking determines: (1) direct acceptance or seeding at the National Championship, (2) eligibility for national team selection for Commonwealth Games, Asian Games, and ITTF events, and (3) wildcard allocations for ITTF-sanctioned international events in India.",
    format: "Single elimination with qualifying rounds",
    prestige: "ranking",
    registrationUrl: "https://www.ttfi.org",
    sourceUrls: ["https://www.ttfi.org/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "table-tennis",
    slug: "khelo-india-table-tennis",
    name: "Khelo India Youth Games (Table Tennis)",
    level: "National",
    description:
      "Table Tennis competition at the Government of India's prestigious Khelo India Youth Games, India's biggest multi-sport event for under-18 athletes. Medal-winning athletes receive annual scholarships of ₹5 lakh for 8 years.",
    ageGroup: "Under-18",
    typicalDates: "January–February (varies by host state)",
    registrationDeadline: "State Sports Authority nomination — November/December",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Ministry of Youth Affairs & Sports / SAI",
      acronym: "SAI",
      website: "https://kheloindia.gov.in",
      type: "govt",
      about:
        "Khelo India is a flagship Government of India program to identify and develop sporting talent. Administered by Sports Authority of India (SAI), it provides multi-year scholarships to medal-winning athletes.",
    },
    participationGuide: [
      "Participate in state-level Khelo India selection trials (conducted by State Sports Authority)",
      "Get selected into your state's Khelo India U-18 TT squad",
      "Your state submits the squad with eligibility documents to SAI",
      "Compete at the national multi-sport venue alongside athletes from all over India",
      "Medal winners receive ₹5 lakh/year scholarship for 8 years",
    ],
    qualificationPath:
      "State sports authority trials → Khelo India U-18 TT squad → Khelo India Youth Games → Khelo India Scholarship → SAI NCOE training",
    circuitContext:
      "Khelo India Table Tennis is a government-run parallel pathway that complements the TTFI NRT-based circuit. A serious junior TT player should pursue both simultaneously. The Khelo India ladder: state sports authority selection trials → state squad → Khelo India Youth Games → Khelo India Scholarship (₹5 lakh/year × 8 years for medalists). Critically, Khelo India selects via State Sports Authority trials — not the TTFI STTA system — making it accessible to players who haven't yet built a TTFI national ranking. Medal winners are admitted into SAI's National Centre of Excellence (NCOE) for table tennis, where they train professionally and are introduced to the TTFI Senior NRT circuit. This dual pathway means talented junior players from underrepresented regions can access national coaching and financial support simultaneously.",
    format: "Group stage + individual and team knockout events",
    prestige: "developmental",
    prizePool: "₹5 lakh/year scholarship for 8 years for medalists",
    registrationUrl: "https://kheloindia.gov.in",
    sourceUrls: ["https://kheloindia.gov.in"],
    lastScrapedAt: new Date(),
  },

  // ─── SWIMMING (SFI) ──────────────────────────────────────────────────────
  {
    sportSlug: "swimming",
    slug: "senior-national-aquatic-championship",
    name: "Senior National Aquatic Championship",
    level: "National",
    description:
      "India's premier swimming championship, organised annually by the Swimming Federation of India (SFI). Featuring all Olympic swimming strokes and distances, it determines national champions and sets qualifying times for international events including Asian Games and Commonwealth Games.",
    ageGroup: "Open (18+)",
    typicalDates: "September–October",
    registrationDeadline: "State Aquatic Association entry — August",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Swimming Federation of India",
      acronym: "SFI",
      website: "https://swimmingindia.org",
      type: "private",
      about:
        "SFI is the national governing body for aquatic sports in India, affiliated with FINA (World Aquatics). It governs swimming, water polo, diving, and artistic swimming. India has produced Asian Games gold medalists and Commonwealth Games champions in swimming.",
    },
    participationGuide: [
      "Register with your State Aquatic Association (SAA) and accumulate state ranking times",
      "Swim the qualifying time set by SFI for the national championship in your event",
      "Your SAA nominates you to SFI with your qualifying time and documentation",
      "Attend the national meet and compete in your individual events and relays",
      "Top performers are considered for India's international team selection",
    ],
    qualificationPath:
      "Club/school pool → State aquatic meets → SFI Junior qualifying time → Junior National Championship → SFI Senior qualifying time → Senior National Aquatic Championship",
    circuitContext:
      "SFI uses a time-qualification system rather than ranking-based selection. The full progression: club or school pool training → state aquatic meets → SFI Junior Nationals (U-14, U-18 categories, requires Junior qualifying time) → SFI Open National Championship (no time standard — open to all, ideal for first national exposure) → SFI Senior Nationals (requires Senior qualifying time). SFI publishes qualifying times at the start of each season — typically set below Asian Games/Commonwealth Games standards but above general state meet performance. The Senior National is the final domestic benchmark: times set here determine India's squad for Asian Games, Commonwealth Games, and World Aquatics Championship trials. The progression above Senior Nationals: national team time trials → India team selection → Asian Games / Commonwealth Games / FINA World Championships.",
    format: "Heats + semifinals + finals by event",
    prestige: "flagship",
    registrationUrl: "https://swimmingindia.org",
    sourceUrls: ["https://swimmingindia.org"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "swimming",
    slug: "junior-national-aquatic-championship",
    name: "Junior National Aquatic Championship",
    level: "National",
    description:
      "SFI's annual junior national swimming championship for U-18 athletes across all aquatic disciplines. Top performers represent India at the FINA World Junior Swimming Championship and Asian Youth Aquatic Games.",
    ageGroup: "Under-18 (separate U-14 and U-18 categories)",
    typicalDates: "May–June",
    registrationDeadline: "SAA nomination — April",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Swimming Federation of India",
      acronym: "SFI",
      website: "https://swimmingindia.org",
      type: "private",
      about:
        "SFI is the national governing body for aquatic sports in India, affiliated with FINA (World Aquatics).",
    },
    participationGuide: [
      "Train with an SFI-affiliated swimming club or academy and build your state times",
      "Participate in state-level junior swimming meets and achieve SFI Junior qualifying times",
      "Get nominated by your State Aquatic Association to SFI",
      "Attend the national venue, complete doping control formalities, and compete",
    ],
    qualificationPath:
      "Club/school swimming → State junior meets → SFI Junior qualifying time → SAA nomination → Junior National Championship → India junior international team",
    circuitContext:
      "SFI's age-group pathway uses time-based qualification. The junior ladder: club/school pool training → state junior aquatic meets → achieve SFI Junior qualifying times (published each season for U-14 and U-18 separately) → State Aquatic Association nomination → Junior National Aquatic Championship. Top 3 finishers in each event at the Junior National are considered for India's representation at the FINA World Junior Swimming Championships (U-18) and Asian Youth Aquatic Games. SFI also runs a sub-junior structure (below U-14) through state-level events, making the full age-group progression: sub-junior state meets → Junior National (U-14) → Junior National (U-18) → Open National Championship → Senior National. Building consistent qualifying times across multiple state and national junior meets demonstrates sustained improvement — SFI selectors value consistency over a single peak performance.",
    format: "Heats + finals by event (50m pool)",
    prestige: "developmental",
    registrationUrl: "https://swimmingindia.org",
    sourceUrls: ["https://swimmingindia.org"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "swimming",
    slug: "khelo-india-aquatics",
    name: "Khelo India Youth Games (Aquatics)",
    level: "National",
    description:
      "Swimming and aquatic events at India's largest youth multi-sport festival, the Khelo India Youth Games. Government-backed with scholarships for medalists. Swimming at Khelo India often unearths talent from smaller states that lack regular competitive exposure.",
    ageGroup: "Under-18",
    typicalDates: "January–February (varies by host state)",
    registrationDeadline: "State Sports Authority nomination — November",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Ministry of Youth Affairs & Sports / SAI",
      acronym: "SAI",
      website: "https://kheloindia.gov.in",
      type: "govt",
      about:
        "SAI administers the Khelo India program, India's flagship government sports initiative providing scholarships and infrastructure for youth athletes.",
    },
    participationGuide: [
      "Train with an SFI-affiliated club and participate in state Khelo India trials",
      "Achieve the qualifying time or rank set by your State Sports Authority for selection",
      "Your state nominates you to SAI with eligibility certificates",
      "Compete at the national aquatic venue at the Khelo India host state",
      "Medalists receive ₹5 lakh/year for 8 years from the Indian government",
    ],
    qualificationPath:
      "State sports authority trials → State squad → Khelo India Youth Games → Khelo India Scholarship → SAI NCOE program → SFI Junior/Senior circuit",
    circuitContext:
      "Khelo India Aquatics is a government-run pathway that runs in parallel to SFI's time-qualification circuit. The key difference: Khelo India selects swimmers through State Sports Authority trials — not SFI qualifying times — making it accessible to talented swimmers who haven't yet achieved SFI's minimum time standards. The Khelo India ladder: state sports authority trials → state Khelo India U-18 squad → Khelo India Youth Games → Khelo India Scholarship (₹5 lakh/year × 8 years for medalists) → SAI National Centre of Excellence (NCOE) for swimming. NCOE training includes access to 50m competition pools and professional coaches, and introduces swimmers to the SFI state aquatic meet circuit where SFI qualifying times can be achieved. This makes Khelo India the recommended first national step for swimmers from smaller states or non-metropolitan areas.",
    format: "Heats + finals (50m pool)",
    prestige: "developmental",
    prizePool: "₹5 lakh/year for 8 years for gold/silver/bronze medalists",
    registrationUrl: "https://kheloindia.gov.in",
    sourceUrls: ["https://kheloindia.gov.in"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "swimming",
    slug: "open-national-swimming-championship",
    name: "Open National Swimming Championship",
    level: "National",
    description:
      "SFI's open national championship that allows both Indian nationals and foreign nationals (NRIs, foreign-based coaches) to participate. It provides a competitive benchmark against international standards and is used by swimmers to register personal bests ahead of major international cycles.",
    ageGroup: "Open (all age groups)",
    typicalDates: "February–March",
    registrationDeadline: "Direct entry to SFI — 4 weeks before",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Swimming Federation of India",
      acronym: "SFI",
      website: "https://swimmingindia.org",
      type: "private",
      about:
        "SFI is the national governing body for aquatic sports in India, affiliated with FINA (World Aquatics).",
    },
    participationGuide: [
      "Register directly with SFI (no state nomination required for the Open Championship)",
      "Submit entry times and documents through the SFI online portal",
      "Pay the entry fee and report to the venue for heat draws",
      "Compete and use the event to set qualifying times for international meets",
    ],
    qualificationPath:
      "Direct entry (no state nomination or qualifying time required) → Compete → Use times to qualify for SFI Junior or Senior National Championship",
    circuitContext:
      "The SFI Open National Championship is the most accessible national swimming event — no qualifying time standard and no state nomination requirement. This makes it the ideal bridge from club-level to national competition. Times achieved at the Open National can be used to satisfy SFI's qualifying standards for Junior and Senior National Championships. The event also uniquely allows NRI swimmers and Indian-heritage athletes with foreign nationality to participate, creating competitive exposure against international benchmarks. In SFI's season calendar, the Open National (February–March) precedes the Junior National (May–June) and Senior National (September–October) — making it the ideal warm-up to confirm readiness for the formal championship circuit.",
    format: "Heats + finals (50m or 25m pool)",
    prestige: "ranking",
    registrationUrl: "https://swimmingindia.org",
    sourceUrls: ["https://swimmingindia.org"],
    lastScrapedAt: new Date(),
  },

  // ─── BADMINTON (BAI) ─────────────────────────────────────────────────────
  {
    sportSlug: "badminton",
    slug: "india-open-bwf-super-500",
    name: "India Open (BWF Super 500)",
    level: "International",
    description:
      "India's flagship international badminton tournament, part of the BWF World Tour at Super 500 level. Held in New Delhi, it attracts the world's top players and offers significant world ranking points. Indian players like PV Sindhu and Saina Nehwal have won this tournament on home soil.",
    ageGroup: "Open (18+, elite)",
    typicalDates: "January",
    registrationDeadline: "BWF world ranking-based automatic entry (deadline ~8 weeks before)",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Badminton Association of India",
      acronym: "BAI",
      website: "https://www.badmintonindia.org",
      type: "private",
      about:
        "BAI is the national governing body for badminton in India, affiliated with BWF (Badminton World Federation). India has produced Olympic gold medalists (PV Sindhu — Olympic champion). BAI organises national championships, the India Open, and India's participation in Thomas and Uber Cup.",
    },
    participationGuide: [
      "Achieve a world ranking within the direct acceptance cutoff (typically top 40–64)",
      "Entry is automatic based on BWF world ranking — no manual registration needed",
      "If not directly accepted, apply through the BAI for a host wildcard",
      "Confirm travel and equipment arrangements with your national federation",
      "Compete in the first round and advance through the bracket",
    ],
    qualificationPath:
      "School/academy → State ranking events → BAI national ranking → Senior National Championship → BWF international events (Syed Modi) → BWF Super 500 (India Open)",
    circuitContext:
      "Badminton has two distinct ranking systems Indian players must build simultaneously. Domestic: BAI national ranking — built through state ranking events → BAI National Ranking Tournaments → Senior National Championship. International: BWF world ranking — built through BWF-sanctioned international events only (domestic BAI events do not count toward BWF ranking). The international circuit ladder: BWF International Challenge → BWF International Series (Syed Modi level) → BWF Super 100 → BWF Super 300 → BWF Super 500 (India Open) → BWF Super 750 → BWF Super 1000 → BWF Finals. The India Open requires a BWF world ranking within the direct acceptance cutoff (approximately top 40–64 per discipline). Indian players typically spend 3–5 years at BWF International Challenge and Series level before their ranking is strong enough for direct India Open acceptance.",
    format: "Single elimination from first round",
    prestige: "flagship",
    prizePool: "USD 750,000 total prize money",
    registrationUrl: "https://www.badmintonindia.org",
    sourceUrls: ["https://www.badmintonindia.org", "https://www.bwfbadminton.com"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "badminton",
    slug: "senior-national-badminton-championship",
    name: "Senior National Badminton Championship",
    level: "National",
    description:
      "BAI's annual national championship — the definitive domestic title in Indian badminton. Winning here places players in serious contention for national team selection for BWF events, Commonwealth Games, and Asian Games. The tournament is a direct selection event for India's international calendar.",
    ageGroup: "Open (18+)",
    typicalDates: "December",
    registrationDeadline: "State Badminton Association entry — November",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Badminton Association of India",
      acronym: "BAI",
      website: "https://www.badmintonindia.org",
      type: "private",
      about:
        "BAI is the national governing body for badminton in India, affiliated with BWF.",
    },
    participationGuide: [
      "Register with your State Badminton Association (SBA) and build your state ranking",
      "Your SBA nominates you based on state championship or national ranking",
      "Complete BAI registration and confirm entry before the deadline",
      "Compete in singles, doubles, and mixed doubles events at the national venue",
    ],
    qualificationPath:
      "School/academy → State ranking events → BAI National Ranking Tournaments → SBA nomination → Senior National Badminton Championship",
    circuitContext:
      "BAI's domestic circuit has a clear progression: school/academy badminton → state ranking events (organised by State Badminton Associations) → BAI National Ranking Tournaments (held throughout the year, separate from the Senior National Championship) → Senior National Badminton Championship. The Senior National is the apex domestic event and the primary BAI selection event for Thomas Cup (men's team world championship), Uber Cup (women's team), Commonwealth Games, and Asian Games squads. BAI selectors observe every match at the Senior Nationals. For players with international ambitions, consistent Senior National podium finishes lead to BAI allocating wildcard spots at BWF International Challenge and Series events — allowing players to begin building their BWF world ranking alongside their domestic BAI ranking.",
    format: "Single elimination by discipline",
    prestige: "flagship",
    prizePool: "Significant prize money; national title",
    registrationUrl: "https://www.badmintonindia.org",
    sourceUrls: ["https://www.badmintonindia.org/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "badminton",
    slug: "junior-national-badminton-championship",
    name: "Junior National Badminton Championship",
    level: "National",
    description:
      "BAI's national championship for players under 19, featuring U-13, U-15, U-17, and U-19 categories. Top finishers represent India at the BWF World Junior Championships and Asian Junior Badminton Championships. This is where India's next badminton stars are identified.",
    ageGroup: "Under-19 (U-13, U-15, U-17, U-19 categories)",
    typicalDates: "September–October",
    registrationDeadline: "SBA nomination — August",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Badminton Association of India",
      acronym: "BAI",
      website: "https://www.badmintonindia.org",
      type: "private",
      about:
        "BAI is the national governing body for badminton in India, affiliated with BWF.",
    },
    participationGuide: [
      "Train with a BAI-affiliated badminton academy and participate in state junior tournaments",
      "Accumulate BAI junior ranking points through Junior National Ranking Tournaments",
      "Your SBA nominates top-ranked players in each age category",
      "Compete in your age-group draw at the national venue",
    ],
    qualificationPath:
      "School/academy → State junior events → BAI Junior National Ranking Tournaments → SBA nomination → Junior National Championship → BWF World Junior Championships",
    circuitContext:
      "BAI's junior circuit runs separately from the senior circuit, with its own National Ranking Tournament (NRT) series for U-13, U-15, U-17, and U-19 players. The junior ladder: school/academy badminton → state junior ranking events → BAI Junior NRT series (multiple events annually) → junior national ranking accumulation → SBA nomination → Junior National Championship. Top U-17 and U-19 finishers represent India at the BWF World Junior Championships (U-19) and Asian Junior Badminton Championships. BAI's junior national selection also feeds the Thomas Cup / Uber Cup junior squad pipeline. From the Junior National, players transition into the Senior NRT circuit and Senior National Championship at U-18 to U-20 age, while the strongest juniors also receive BAI support for BWF-sanctioned junior international events.",
    format: "Single elimination by age group and discipline",
    prestige: "developmental",
    registrationUrl: "https://www.badmintonindia.org",
    sourceUrls: ["https://www.badmintonindia.org/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "badminton",
    slug: "syed-modi-india-international",
    name: "Syed Modi India International (BWF International Series)",
    level: "International",
    description:
      "Named after Syed Modi, the talented Indian player who was tragically killed in 1988, this BWF International Series event in Lucknow is one of India's biggest international badminton tournaments outside the India Open. It offers world ranking points and attracts Asian players.",
    ageGroup: "Open (18+)",
    typicalDates: "October–November",
    registrationDeadline: "BWF ranking-based + open entry — ~8 weeks before",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Badminton Association of India",
      acronym: "BAI",
      website: "https://www.badmintonindia.org",
      type: "private",
      about:
        "BAI organises this tournament in partnership with BWF as part of India's international badminton calendar.",
    },
    participationGuide: [
      "Hold a BWF player ID (register at bwfbadminton.com)",
      "Check the BWF tournament calendar for entry opening dates",
      "Enter via the BWF online registration system before the deadline",
      "If entry is full, apply as an alternate and confirm closer to the event",
      "Travel to Lucknow and compete for world ranking points",
    ],
    qualificationPath:
      "BAI Senior National ranking → BAI wildcard allocation → BWF International Challenge events → BWF International Series (Syed Modi) → BWF Super 100/300 → India Open (Super 500)",
    circuitContext:
      "The Syed Modi India International is a BWF International Series event — the first step of the international circuit for Indian players transitioning from domestic badminton. The international ladder Indian players climb: strong BAI domestic ranking + Senior National podium → BAI wildcard at BWF International Challenge events (lowest international tier) → build BWF world ranking → BWF International Series (Syed Modi level) → BWF Super 100 → BWF Super 300 → BWF Super 500 (India Open). Competing here earns genuine BWF world ranking points counting toward India Open direct acceptance. For Indian players, the Syed Modi is strategically valuable because it is on home soil — lower travel cost, familiar conditions, home crowd — while still counting as an international ranking event. BAI typically allocates host wildcards to promising Indian players who need BWF world ranking points but don't yet meet the direct acceptance cutoff.",
    format: "Single elimination",
    prestige: "ranking",
    prizePool: "USD 85,000+ total prize money",
    registrationUrl: "https://www.badmintonindia.org",
    sourceUrls: ["https://www.bwfbadminton.com", "https://www.badmintonindia.org"],
    lastScrapedAt: new Date(),
  },

  // ─── VOLLEYBALL (VFI) ────────────────────────────────────────────────────
  {
    sportSlug: "volleyball",
    slug: "prime-volleyball-league",
    name: "Prime Volleyball League (PVL)",
    level: "National",
    description:
      "India's premier professional volleyball league, launched in 2022, featuring six city-based franchises. The PVL is transforming volleyball in India by creating a professional pathway for players and attracting international talent. It is the highest-profile domestic volleyball competition.",
    ageGroup: "Open (18+, professional)",
    typicalDates: "February–March",
    registrationDeadline: "Player auction — December/January",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Volleyball Federation of India",
      acronym: "VFI",
      website: "https://www.vfi.net.in",
      type: "private",
      about:
        "VFI is the national governing body for volleyball in India, affiliated with FIVB (Fédération Internationale de Volleyball). India participates in FIVB Nations League, Asian Volleyball Championship, and Commonwealth Games. The VFI launched the Prime Volleyball League in 2022 to professionalise the sport.",
    },
    participationGuide: [
      "Build domestic credentials through VFI National Championships and state leagues",
      "Register with VFI as a professional player and ensure your eligibility",
      "Get noticed by PVL franchise scouts through national championship performances",
      "Participate in the player draft/auction process",
      "Sign a franchise contract and attend pre-league training camps",
    ],
    qualificationPath:
      "School/club volleyball → District league → State league → Senior National Volleyball Championship → National team selection → PVL franchise auction",
    circuitContext:
      "VFI's domestic pyramid leads to the Prime Volleyball League at its apex. The full ladder: school/club volleyball → district league → state volleyball league → Senior National Volleyball Championship (primary selection event for national team) → national team selection for Asian Volleyball Championship and FIVB events → PVL franchise player auction. The PVL (launched 2022) is transforming volleyball by creating the first professional contract pathway — before 2022, there was no sustainable professional income in Indian volleyball. Franchise scouts observe the Senior National Championship to identify players. Unlike cricket's IPL, the PVL includes international players on each roster, so Indian players compete alongside world-class athletes from Brazil, USA, and Europe. Beach volleyball has a completely separate VFI circuit leading to the Beach National Championship and FIVB Beach Pro Tour qualification.",
    format: "Round-robin league followed by playoffs and final",
    prestige: "flagship",
    prizePool: "Significant prize money; franchise contracts",
    registrationUrl: "https://www.prevolleyleague.com",
    sourceUrls: ["https://www.prevolleyleague.com", "https://www.vfi.net.in"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "volleyball",
    slug: "senior-national-volleyball-championship",
    name: "Senior National Volleyball Championship",
    level: "National",
    description:
      "VFI's annual senior national championship for state teams, held since 1952. The primary domestic competition and the main selection platform for India's international volleyball teams competing in Asian Volleyball Championship and FIVB events.",
    ageGroup: "Open (18+, state teams)",
    typicalDates: "December–January",
    registrationDeadline: "State Volleyball Association entry — November",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Volleyball Federation of India",
      acronym: "VFI",
      website: "https://www.vfi.net.in",
      type: "private",
      about:
        "VFI is the national governing body for volleyball in India, affiliated with FIVB.",
    },
    participationGuide: [
      "Play for your district or club in your state volleyball league",
      "Attend the state team trials organised by your State Volleyball Association",
      "Get selected into the state senior squad",
      "Register and travel to the national venue for the group stage and knockout rounds",
    ],
    qualificationPath:
      "School/club volleyball → District league → State volleyball league → State team trials → Senior National Volleyball Championship",
    circuitContext:
      "The Senior National Volleyball Championship is the apex of VFI's state-representative ladder, held continuously since 1952. The domestic ladder: school/club volleyball → district tournaments → state volleyball league (organised by State Volleyball Association) → state senior team trials → Senior National Championship. VFI selectors formally observe the Senior National Championship to name players for the national team that represents India in the Asian Volleyball Championship, FIVB Nations League, Asian Games, and Commonwealth Games. Strong Senior National performances are the primary criterion for national team selection — no other domestic event carries equivalent weight. After national team selection, the Prime Volleyball League auction is the next destination for the best players.",
    format: "Group stage + knockout semifinals and final",
    prestige: "flagship",
    registrationUrl: "https://www.vfi.net.in",
    sourceUrls: ["https://www.vfi.net.in/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "volleyball",
    slug: "junior-national-volleyball-championship",
    name: "Junior National Volleyball Championship",
    level: "National",
    description:
      "VFI's annual junior national championship for players under 19. Featuring boys and girls categories, it is the pipeline for India's U-20 international volleyball program and a key event for identifying talent for the Senior National team.",
    ageGroup: "Under-19",
    typicalDates: "September–October",
    registrationDeadline: "State Volleyball Association entry — August",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Volleyball Federation of India",
      acronym: "VFI",
      website: "https://www.vfi.net.in",
      type: "private",
      about:
        "VFI is the national governing body for volleyball in India, affiliated with FIVB.",
    },
    participationGuide: [
      "Play for your school or club volleyball team and build your game at the state level",
      "Participate in state U-19 volleyball tournaments",
      "Attend state team trials and get selected into the junior state squad",
      "Travel to the national venue and compete in the group stage and knockout rounds",
    ],
    qualificationPath:
      "School/club volleyball → District U-19 tournaments → State U-19 trials → Junior National Volleyball Championship → India U-20 national team",
    circuitContext:
      "VFI's age-group structure leads to the Senior National Championship via the junior pathway. The ladder: school/club volleyball → district U-19 tournaments → state U-19 volleyball trials → Junior National Volleyball Championship → Senior National Volleyball Championship (transition at 19+). VFI selectors use the Junior National Championship to identify players for the India U-20 national team, which competes in the AVC U-20 Asian Volleyball Championship and FIVB U-20 World Championship. VFI monitors Junior National performances for early identification of players who may fast-track into the Senior National team — several current India senior national players were first noticed at the Junior National Championship at 16–17 years of age. After the Junior National, players typically transition to their state senior team for the Senior National Championship within 1–2 years.",
    format: "Group stage + knockout",
    prestige: "developmental",
    registrationUrl: "https://www.vfi.net.in",
    sourceUrls: ["https://www.vfi.net.in/tournaments"],
    lastScrapedAt: new Date(),
  },
  {
    sportSlug: "volleyball",
    slug: "beach-volleyball-national-championship",
    name: "Beach Volleyball National Championship",
    level: "National",
    description:
      "VFI's national beach volleyball championship for open and junior categories. Beach volleyball became an Olympic sport in 1996 and is growing rapidly in India. This championship is the primary pathway to the Indian beach volleyball national team for FIVB Beach Pro Tour and Asian Games.",
    ageGroup: "Open (18+) and Under-21",
    typicalDates: "February–March",
    registrationDeadline: "Direct team entry to VFI — 4 weeks before",
    isCurated: true,
    isVerified: true,
    federation: {
      name: "Volleyball Federation of India",
      acronym: "VFI",
      website: "https://www.vfi.net.in",
      type: "private",
      about:
        "VFI is the national governing body for volleyball in India, affiliated with FIVB. Beach volleyball is an Olympic discipline governed by FIVB.",
    },
    participationGuide: [
      "Form a pair (2 players per team) and register both players with VFI",
      "Participate in state-level beach volleyball events to build ranking",
      "Enter the national championship through direct team registration with VFI",
      "Travel to the beach venue (coastal city) and compete in the knockout format",
    ],
    qualificationPath:
      "State beach volleyball events → VFI Beach Volleyball National Championship → India national beach volleyball team → FIVB Beach Pro Tour Futures → FIVB Beach Pro Tour",
    circuitContext:
      "Beach volleyball is a completely separate circuit from indoor volleyball under VFI. The beach ladder: state-level beach tournaments (often in coastal states) → VFI Beach Volleyball National Championship → India national beach team selection. FIVB ranks beach volleyball pairs (teams of exactly 2 players), not individuals — so finding and developing a stable partnership is as critical as individual skill development. From the national team, India's pairs compete at FIVB Beach Pro Tour Futures (entry level) → FIVB Beach Pro Tour (main circuit). Beach volleyball is one of the few Olympic disciplines where Indian teams can realistically build FIVB world ranking relatively quickly, given the smaller global player pool compared to indoor volleyball. Beach volleyball requires specialised training on sand — not all indoor volleyball clubs offer this — so finding a dedicated beach volleyball training centre is the essential first step.",
    format: "Knockout (pairs format, best of 3 sets)",
    prestige: "developmental",
    registrationUrl: "https://www.vfi.net.in",
    sourceUrls: ["https://www.vfi.net.in/tournaments"],
    lastScrapedAt: new Date(),
  },
];

async function main() {
  if (!MONGO_URI) {
    console.error("MONGO_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  let inserted = 0;
  let updated = 0;

  for (const t of CURATED) {
    const filter = { sportSlug: t.sportSlug, name: t.name };
    const result = await Tournament.updateOne(filter, { $set: t }, { upsert: true });
    if (result.upsertedCount > 0) inserted++;
    else updated++;
  }

  console.log(`Done — ${inserted} inserted, ${updated} updated (${CURATED.length} total)`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
