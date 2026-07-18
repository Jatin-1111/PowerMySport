/**
 * Seed curated, manually-verified federation records.
 * Run: npx ts-node src/scripts/seed-federations.ts
 *
 * Data is sourced from official federation websites and tournament circulars.
 * The `dataVerifiedAt` field records when each record was last cross-checked.
 * Do NOT run scrapers to overwrite fields that carry a dataVerifiedAt — those
 * are the ground-truth records scrapers must defer to.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { Federation } from "../shared/models/Federation";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";
if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

const SEED_DATA = [
  {
    slug: "aita",
    name: "All India Tennis Association",
    acronym: "AITA",
    sportSlug: "tennis",
    type: "national" as const,
    about:
      "The All India Tennis Association (AITA) is the national governing body for tennis in India, recognised by the International Tennis Federation (ITF) and the Olympic Committee of India. Founded in 1920, AITA administers all competitive tennis in India — from junior grassroots tournaments to the Davis Cup and Billie Jean King Cup national teams. All competitive players must be registered with their state tennis association, which is affiliated to AITA, before they can participate in any AITA-sanctioned event.",
    founded: 1920,
    headquarters: "New Delhi",
    website: "https://aitatennis.com",
    officialCalendarUrl: "https://aitatennis.com/management/calendar.php",
    affiliations: [
      "International Tennis Federation (ITF)",
      "Asian Tennis Federation (ATF)",
      "Indian Olympic Association (IOA)",
    ],
    keyFacts: [
      "Governs all competitive tennis in India — from sub-junior grassroots to Davis Cup national team",
      "Runs a year-round national ranking circuit across all states, typically 40–60+ sanctioned tournaments annually",
      "Junior categories: Under-10, Under-12, Under-14, Under-16, Under-18 — all with separate Boys and Girls draws",
      "Age is calculated as of January 1st of the tournament year — a player who turns 12 in March plays U-12 all year",
      "AITA registration is mandatory — obtained through the player's State Tennis Association, not AITA directly",
      "ITF Junior circuit events (Grade A–5) in India are also administered through AITA's calendar",
      "National ranking points determine seedings, wildcards, and eligibility for higher-tier invitation events",
    ],
    eligibilityCriteria: {
      ageCutoffRule:
        "Age is determined as of January 1st of the calendar year in which the tournament is held. A player who turns 14 at any point during 2025 competes in the U-14 category for the full year 2025.",
      categories: [
        {
          name: "Under-10",
          maxAge: 10,
          genders: ["Boys", "Girls"],
          notes:
            "Entry-level category. Some state associations run their own U-10 circuits feeding into AITA events.",
        },
        {
          name: "Under-12",
          maxAge: 12,
          genders: ["Boys", "Girls"],
          notes:
            "First category with AITA national ranking points. Players must hold valid AITA registration.",
        },
        {
          name: "Under-14",
          maxAge: 14,
          genders: ["Boys", "Girls"],
          notes:
            "National Championships held annually. Top performers qualify for ITF Junior Grade 5 events.",
        },
        {
          name: "Under-16",
          maxAge: 16,
          genders: ["Boys", "Girls"],
          notes:
            "Pathway to Davis Cup / Billie Jean King Cup Junior teams. ITF Grade 3–5 events open.",
        },
        {
          name: "Under-18",
          maxAge: 18,
          genders: ["Boys", "Girls"],
          notes:
            "Highest junior category. Top-ranked players qualify for ITF Grade 1–2 events and senior wildcards.",
        },
        {
          name: "Open",
          maxAge: 99,
          genders: ["Men", "Women"],
          notes:
            "Senior category. ITF World Tennis Tour events (M15/W15–M25/W25) require ITF player ID in addition to AITA registration.",
        },
      ],
      registrationRequired: true,
      stateAssociationFirst: true,
      notes:
        "Players must first register with their State Tennis Association. The state association then affiliates the player with AITA. Without a valid AITA number, the player cannot be entered into the official draw by the tournament organiser. Registration typically takes 2–4 weeks. Entry fees range from ₹500–₹2,000 per tournament depending on category and level. There is no wildcard provision for unregistered players at national-level events.",
    },
    registrationSteps: [
      "Identify your State Tennis Association — every Indian state has an AITA-affiliated body (e.g. Delhi Tennis Association, Maharashtra State Tennis Association).",
      "Submit the state association membership application with: birth certificate or Aadhaar card, 2 passport-size photographs, medical fitness certificate, and the membership fee (varies by state, typically ₹500–₹2,000/year).",
      "Once accepted, the state association assigns an AITA player number. This number is required for all tournament entries.",
      "Monitor AITA's official tournament calendar (aita.in) for upcoming events. Each tournament publishes a circular with entry deadlines, usually 4–6 weeks before the event.",
      "Submit entries through your State Association's designated contact or the online entry system specified in the tournament circular. The state association validates eligibility before forwarding to the organiser.",
      "Prepare required documents before the tournament: AITA registration card, birth proof, school NOC (for minors), and the specific entry fee payment confirmation.",
    ],
    requiredDocuments: [
      "Valid AITA registration card (obtained via State Tennis Association)",
      "Birth certificate or Aadhaar card — original + photocopy for age verification",
      "4 recent passport-size photographs",
      "Medical fitness certificate from a registered doctor (dated within 6 months)",
      "School / college No-Objection Certificate (NOC) — mandatory for players under 18",
      "Parent / guardian consent form (for players under 18) — available on aita.in",
      "Entry fee payment proof as specified in the tournament circular",
    ],
    contact: {
      email: "info@aita.in",
      address:
        "All India Tennis Association, R.K. Khanna Tennis Stadium, Africa Avenue, New Delhi – 110029",
    },
    sourceUrls: [
      "https://www.aita.in",
      "https://www.aita.in/tournament-calendar",
      "https://www.itftennis.com/en/organisations/all-india-tennis-association/IND/",
    ],
    dataVerifiedAt: new Date("2026-07-10"),
    isActive: true,
  },

  // ─── ITF ──────────────────────────────────────────────────────────────────────
  {
    slug: "itf",
    name: "International Tennis Federation",
    acronym: "ITF",
    sportSlug: "tennis",
    type: "hybrid" as const,
    about:
      "The International Tennis Federation (ITF) is the world governing body for tennis, founded in 1913. It administers the Davis Cup (men's national team competition), the Billie Jean King Cup (women's), the ITF Junior Circuit (Grade 5 through Grade A), the ITF World Tennis Tour (professional development circuit with M15/M25/W15/W25 categories), and tennis at the Olympic and Paralympic Games. India is represented in the ITF through AITA, which is the ITF member association for India.",
    founded: 1913,
    headquarters: "Roehampton, London, United Kingdom",
    website: "https://www.itftennis.com",
    officialCalendarUrl: "https://www.itftennis.com/en/tournament-calendar/",
    affiliations: [
      "International Olympic Committee (IOC)",
      "International Paralympic Committee (IPC)",
      "World Anti-Doping Agency (WADA)",
      "213 national member associations worldwide",
    ],
    keyFacts: [
      "World governing body for tennis — 213 national member associations including AITA",
      "Administers Davis Cup (oldest international team tennis competition, since 1900)",
      "ITF World Tennis Tour: M15/W15 and M25/W25 grade events — first step on the international professional circuit",
      "ITF Junior Circuit: Grade 5 (most accessible) through Grade A (Junior Grand Slams) for players under 18",
      "No minimum age for ITF World Tennis Tour (adult events) — ITF world ranking determines acceptance",
      "Junior Circuit age cutoff: under 18 as of Day 1 of the main draw (not January 1st)",
      "India hosts among the highest number of ITF tour events in Asia annually",
    ],
    eligibilityCriteria: {
      ageCutoffRule:
        "For ITF Junior Circuit events: a player must be under 18 years of age as of the first day of the main draw (not January 1st). For ITF World Tennis Tour (adult) events: no age restriction — any player with an ITF player ID and sufficient ITF world ranking can enter.",
      categories: [
        {
          name: "ITF Junior Circuit (Grade 5)",
          maxAge: 17,
          genders: ["Boys", "Girls"],
          notes:
            "Most accessible junior grade — no ITF junior ranking required for direct acceptance. Ideal first international event for players who have competed at AITA Junior CS/NS level.",
        },
        {
          name: "ITF Junior Circuit (Grade 4–3)",
          maxAge: 17,
          genders: ["Boys", "Girls"],
          notes:
            "Requires an established ITF junior ranking. Players typically need 2–3 Grade 5 results to build sufficient ranking for Grade 4 acceptance.",
        },
        {
          name: "ITF Junior Circuit (Grade A — Junior Grand Slams)",
          maxAge: 17,
          genders: ["Boys", "Girls"],
          notes:
            "Requires a top-100 ITF junior ranking. Includes Junior Australian Open, Junior Roland Garros, Junior Wimbledon, Junior US Open. Wildcard recipients are nominated by their national federation (AITA for India).",
        },
        {
          name: "ITF World Tennis Tour M15/W15 (Adult)",
          maxAge: 99,
          genders: ["Men", "Women"],
          notes:
            "No minimum age. ITF world ranking determines direct acceptance vs. qualifying. Indian players must also hold a valid AITA membership for India-hosted editions. Prize money: $15,000 USD.",
        },
        {
          name: "ITF World Tennis Tour M25/W25 (Adult)",
          maxAge: 99,
          genders: ["Men", "Women"],
          notes:
            "Higher ITF world ranking required than M15/W15. Prize money: $25,000 USD. Both ITF player ID and AITA membership required for India-hosted events.",
        },
      ],
      registrationRequired: true,
      stateAssociationFirst: false,
      notes:
        "ITF player ID is free and obtained directly at itftennis.com — no state association intermediary is needed for ITF registration itself. However, India-hosted ITF events additionally require a valid AITA membership (which does require state association registration). For Junior Circuit events, the player's ITF junior ranking must be sufficient for the grade they are entering.",
    },
    registrationSteps: [
      "Create a free player account at itftennis.com and obtain your ITF player ID — this is required for all ITF events worldwide.",
      "For India-hosted events: also complete AITA registration through your State Tennis Association (mandatory for local organisers).",
      "Check the ITF tournament calendar (itftennis.com/en/tournament-calendar/) for upcoming India events and their entry opening dates.",
      "Submit your entry through the ITF Tournament Entry System (TES) before the event-specific deadline (usually 4 weeks before the event).",
      "Monitor the acceptance list — players are accepted by ITF world ranking order. If not directly accepted, you may be placed on the alternate list or can enter qualifying.",
      "For Junior Circuit events: your ITF junior ranking automatically determines your eligibility grade. Start with Grade 5 if you have no ITF junior ranking.",
    ],
    requiredDocuments: [
      "ITF player ID (free — register at itftennis.com)",
      "Valid AITA registration card (for India-hosted events)",
      "Passport or birth certificate for age verification at Junior Circuit events",
      "ITF junior ranking confirmation (for Grade 3 and above Junior Circuit events)",
      "Entry fee payment confirmation as specified in the tournament circular",
    ],
    contact: {
      email: "communications@itftennis.com",
      address:
        "ITF, Bank Lane, Roehampton, London SW15 5XZ, United Kingdom",
    },
    stateAssociations: [
      {
        name: "All India Tennis Association (AITA)",
        state: "National",
        website: "https://www.aita.in",
      },
    ],
    sourceUrls: [
      "https://www.itftennis.com/en/about-itf/about-us/",
      "https://www.itftennis.com/en/players/register/",
      "https://www.itftennis.com/en/tournament-calendar/",
      "https://www.itftennis.com/en/players/junior-circuit/",
    ],
    dataVerifiedAt: new Date("2026-07-10"),
    isActive: true,
  },

  // ─── ATP ──────────────────────────────────────────────────────────────────────
  {
    slug: "atp",
    name: "Association of Tennis Professionals",
    acronym: "ATP",
    sportSlug: "tennis",
    type: "hybrid" as const,
    about:
      "The Association of Tennis Professionals (ATP) is the governing body for men's professional tennis, founded in 1972. It administers the ATP Tour (Grand Slams, ATP Masters 1000, ATP 500, ATP 250) and the ATP Challenger Tour — the second tier of men's professional tennis, one level below the ATP Tour. The ATP Challenger Tour is the most direct development pathway for players ranked ~100–500 ATP to earn points toward breaking into the ATP Top 100 and competing on the main Tour.",
    founded: 1972,
    headquarters: "London, United Kingdom (European HQ) / Ponte Vedra Beach, Florida, USA (Americas HQ)",
    website: "https://www.atptour.com",
    officialCalendarUrl: "https://www.atptour.com/en/tournaments",
    affiliations: [
      "International Tennis Federation (ITF)",
      "International Olympic Committee (IOC) — Olympic tennis administered jointly with ITF",
    ],
    keyFacts: [
      "Governs all ATP-ranked men's professional tennis events worldwide",
      "ATP Challenger Tour: 2nd tier — ~180 events/year globally, prize money $50,000–$175,000 USD",
      "Players ranked ~150–500 ATP typically compete primarily on the Challenger Tour",
      "Bengaluru Open is India's flagship ATP Challenger event — held annually at KSLTA Stadium",
      "No minimum age for Challenger events — ATP ranking determines acceptance",
      "Players under 15 are restricted from professional competition under ATP rules",
      "ATP ranking is separate from ITF world ranking — both needed for full professional circuit access",
    ],
    eligibilityCriteria: {
      ageCutoffRule:
        "Players under 15 cannot compete in ATP events. Players aged 15–17 have annual restrictions on the number of professional events they can enter (ATP safeguarding policy). Players 18 and above have no age restrictions — ATP ranking alone determines acceptance.",
      categories: [
        {
          name: "ATP Challenger Tour",
          maxAge: 99,
          genders: ["Men"],
          minRanking: "Approximately ATP ranking 100–500 for direct acceptance (varies by Challenger grade: 50/75/100/125)",
          notes:
            "The ATP Challenger Tour is the development circuit for men aspiring to the ATP main Tour. Prize money ranges from $50,000–$175,000 USD depending on Challenger grade. A Challenger 75 event (like Bengaluru Open) typically requires ~ATP ranking 200–400 for direct acceptance. Lower-ranked players can enter qualifying.",
        },
        {
          name: "ATP Tour (Main Tour)",
          maxAge: 99,
          genders: ["Men"],
          minRanking: "Top 100–200 ATP for direct acceptance into ATP 250 events (varies by event prestige)",
          notes:
            "The ATP main Tour consists of ATP 250, ATP 500, ATP Masters 1000, and Grand Slams. Players ranked outside the direct acceptance range can qualify through wild cards or qualifying rounds. No Indian player currently holds a main Tour singles ranking in the top 100.",
        },
      ],
      registrationRequired: true,
      stateAssociationFirst: false,
      notes:
        "ATP registration requires a player account at atptour.com, professional status declaration, and adherence to ATP anti-doping and safeguarding rules. For India-hosted events, AITA membership is also required. ATP ranking points are earned only from ATP-sanctioned events — ITF World Tennis Tour points do NOT directly convert, though both systems feed into player ranking calculations once a player enters ATP-sanctioned events.",
    },
    registrationSteps: [
      "Build your ITF world ranking through ITF World Tennis Tour (M15/M25) events — this is the standard pathway before entering ATP events.",
      "Register as an ATP player at atptour.com — provide professional status declaration and accept ATP codes of conduct.",
      "Also hold a valid AITA membership for India-hosted ATP events.",
      "Monitor the ATP tournament calendar for Challenger events in India; Bengaluru Open typically opens entries ~6 weeks before the event.",
      "Submit your entry through the ATP player portal before the entry deadline — acceptance is by ATP ranking order.",
      "Lower-ranked players can enter the qualifying draw (also acceptance by ranking); alternates may be called up if spots open.",
    ],
    requiredDocuments: [
      "ATP player account and registration (atptour.com)",
      "Valid AITA registration card (for India-hosted events)",
      "Passport — mandatory for international events",
      "Anti-doping whereabouts filing with ITIA (International Tennis Integrity Agency)",
      "Entry fee as specified in the tournament circular",
    ],
    contact: {
      email: "media@atptour.com",
      address: "ATP Media, 200 Tournament Road, Ponte Vedra Beach, FL 32082, USA",
    },
    stateAssociations: [
      {
        name: "All India Tennis Association (AITA)",
        state: "National",
        website: "https://www.aita.in",
      },
    ],
    sourceUrls: [
      "https://www.atptour.com/en/about/overview",
      "https://www.atptour.com/en/tournaments",
      "https://www.atptour.com/en/players/player-development/overview",
    ],
    dataVerifiedAt: new Date("2026-07-10"),
    isActive: true,
  },

  // ─── UTR ──────────────────────────────────────────────────────────────────────
  {
    slug: "utr",
    name: "Universal Tennis",
    acronym: "UTR",
    sportSlug: "tennis",
    type: "hybrid" as const,
    about:
      "Universal Tennis (UTR) is a technology company founded in 2008 that operates the Universal Tennis Rating (UTR) system — an algorithmic, dynamic rating (scale 1.00–16.50) calculated from any match result, regardless of tournament type. UTR also operates the UTR Pro Tennis Series, a global network of prize-money events open to all players. In India, UTR events provide an accessible, ranking-free pathway to competitive tennis and a globally comparable skill benchmark.",
    founded: 2008,
    headquarters: "San Francisco, California, USA",
    website: "https://www.universaltennis.com",
    officialCalendarUrl: "https://www.universaltennis.com/events",
    affiliations: [
      "Used by NCAA Division I/II college tennis programs (USA) for recruitment assessment",
      "Used by ATP, ITF, and national federations as a supplementary ranking tool",
    ],
    keyFacts: [
      "UTR is an algorithmic rating — updated within 48 hours of any tracked match result",
      "Scale: 1.00–16.50 (16.50 corresponds to the world's top-ranked professional players)",
      "Open entry for all skill levels — no AITA or ITF membership required",
      "UTR Pro Tennis Series events offer prize money and are open to any rated player",
      "UTR results do NOT count toward AITA national ranking or ITF world ranking",
      "Widely used by US college coaches to assess Indian players for tennis scholarships",
      "A UTR of 10.00+ is equivalent to a strong amateur/developing professional player",
      "No age restriction — players from 8 to 80+ can have a UTR rating",
    ],
    eligibilityCriteria: {
      ageCutoffRule:
        "There is no age cutoff rule for UTR. Players of any age can create a UTR account and participate in UTR-sanctioned events. Some specific events may define an age range in their entry criteria.",
      categories: [
        {
          name: "UTR Pro Tennis Series",
          maxAge: 99,
          genders: ["Men", "Women"],
          notes:
            "Prize money events open to any UTR-rated player. Some events specify a UTR range (e.g. 8.00–14.00) to ensure competitive balance. No AITA or ITF membership required — a free UTR account is sufficient.",
        },
        {
          name: "UTR Sanctioned Club/Academy Events",
          maxAge: 99,
          genders: ["Men", "Women"],
          notes:
            "Club-level events submitted for UTR tracking. Results count toward UTR rating but carry no prize money. Ideal first step for players without any formal ranking.",
        },
        {
          name: "UTR College Showcase Events",
          maxAge: 22,
          genders: ["Men", "Women"],
          notes:
            "Events designed for players seeking US college tennis scholarships. Results are visible to NCAA coaches. Popular among Indian players aged 15–18 targeting Division I or II programs.",
        },
      ],
      registrationRequired: true,
      stateAssociationFirst: false,
      notes:
        "Registration is a free UTR account at universaltennis.com — no state association or national federation involvement. Some UTR Pro Tennis Series events in India may additionally require AITA membership at the organiser's discretion. UTR rating is automatically generated once you have at least 3 tracked match results. The rating updates dynamically after every result — there is no season reset.",
    },
    registrationSteps: [
      "Create a free account at universaltennis.com and generate your UTR ID — this is all you need to participate in basic UTR events.",
      "Play tracked matches at UTR-sanctioned clubs, academies, or UTR events to establish your rating (minimum 3 results needed for an official UTR rating).",
      "Browse upcoming UTR events in India at universaltennis.com/events or the UTR mobile app.",
      "Register for your chosen event directly through the UTR platform — no external portal or state association needed.",
      "After each match, results are submitted by the tournament organiser and your UTR updates automatically within 48 hours.",
    ],
    requiredDocuments: [
      "Free UTR account (universaltennis.com) — no physical documents required",
      "Entry fee payment as specified in the individual event listing",
      "Some Pro Tennis Series events may require AITA membership — check the specific event circular",
    ],
    contact: {
      email: "support@universaltennis.com",
      address: "Universal Tennis Inc., San Francisco, California, USA",
    },
    sourceUrls: [
      "https://www.universaltennis.com/about",
      "https://www.universaltennis.com/events",
      "https://www.universaltennis.com/ratings",
    ],
    dataVerifiedAt: new Date("2026-07-10"),
    isActive: true,
  },
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  for (const doc of SEED_DATA) {
    const result = await Federation.findOneAndUpdate(
      { slug: doc.slug },
      { $set: doc },
      { upsert: true, new: true, runValidators: true },
    );
    console.log(`Upserted: ${result.acronym} (${result.slug})`);
  }

  console.log("Seed complete.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
