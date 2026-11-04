import "../config/env";

import mongoose from "mongoose";

import { Opportunity } from "../shared/models/Opportunity";
import {
  parseOpportunity,
  parseOpportunityDraft,
  todayInIndia,
} from "../shared/validation/opportunityFormat";

// ─── Starter admissions & scholarships, as DRAFTS ───────────────────────────
//
// Researched 2026-09-28, tennis first. None of this is published by the
// script: every entry lands as a draft with no verification date, so it stays
// invisible to parents until a person has opened each source, corrected what
// has changed, pressed "Mark verified" and published it from Admin → Content →
// Admissions & Scholarships.
//
// That is deliberate. Several Indian government sites could not be read during
// the research, so some figures came from secondary sources; those entries say
// so in `verificationNote`, which the page shows to parents.
//
// Insert-only: an entry whose slug already exists is skipped, never updated,
// so re-running this can never overwrite an editor's corrections.
//
//   npx ts-node src/scripts/seedOpportunityDrafts.ts            (dry run)
//   npx ts-node src/scripts/seedOpportunityDrafts.ts --apply    (writes drafts)
//
// Run it with npx, not `npm run … -- --apply`: PowerShell strips the `--` and
// the flag with it, which silently turns the write into another dry run.

type Draft = Record<string, unknown> & { slug: string; title: string };

export const DRAFTS: Draft[] = [
  // ── Admissions: college ──
  {
    slug: "du-sports-quota",
    track: "admission",
    category: "college",
    title: "Delhi University sports quota (supernumerary seats)",
    summary:
      "Delhi University keeps extra undergraduate seats, on top of normal intake, for students with a sporting record. Lawn tennis is one of the sports. Selection combines a sports trial, your certificates and your CUET score.",
    owner: { name: "University of Delhi", type: "university" },
    allSports: true,
    sports: [],
    geography: { scope: "india" },
    eligibility: {
      gender: "any",
      level:
        "Sports certificates dated within the window the bulletin sets (for 2026-27: 1 May 2023 to 30 April 2026), up to five per sport.",
      academic: "A CUET-UG score, and an application through DU's CSAS-UG portal.",
    },
    selection: "trials",
    benefit: { summary: "A supernumerary (extra) seat, outside the general merit list." },
    cycle: {
      label: "2026-27",
      closesOn: "2026-08-03",
      keyDates: [
        { label: "Sports trials began", date: "2026-07-29" },
        { label: "Lawn tennis trial", date: "2026-07-30" },
        { label: "Sports trials ended", date: "2026-08-03" },
      ],
    },
    steps: [
      "Take CUET-UG, and apply on DU's CSAS-UG portal, choosing the sports quota and up to three sports.",
      "Upload your sports certificates from inside the certificate window.",
      "Attend the trial for your sport on the scheduled date at the DU Sports Complex.",
      "Seats are allotted in the CSAS rounds after the trials.",
    ],
    keyFacts: [
      "2,153 sports-quota seats across 28 sports in 2026-27.",
      "Weightage in 2026-27: trial 50%, certificates 25%, CUET 25%.",
      "For individual sports such as tennis the trial is marked out of 400, on performance.",
    ],
    applyUrl: "https://admission.uod.ac.in/",
    sources: [
      { label: "DU admissions portal", url: "https://admission.uod.ac.in/" },
      {
        label: "Careers360: DU sports trial schedule 2026",
        url: "https://news.careers360.com/du-ug-admission-2026-sports-trial-schedule-out-supernumerary-quota-delhi-university-dates-venues-cuet",
        publishedOn: "2026-07-17",
      },
    ],
    verificationNote:
      "The number of tennis seats, and how many points each kind of certificate earns, were not confirmed from DU's own bulletin.",
  },
  {
    slug: "iit-sports-excellence-admission",
    track: "admission",
    category: "college",
    title: "IIT Sports Excellence Admission (SEA)",
    summary:
      "Some IITs keep two extra seats per programme for students who have a JEE Advanced rank and a national or international medal. It runs outside JoSAA, on its own portal, and lawn tennis is one of the eligible sports.",
    owner: {
      name: "Indian Institute of Technology Madras (for participating IITs)",
      type: "university",
    },
    allSports: false,
    sports: ["tennis"],
    geography: { scope: "india" },
    eligibility: {
      gender: "any",
      level:
        "At least one national or international medal in the last four years, at events run by a federation recognised by the Ministry of Youth Affairs and Sports.",
      academic: "A JEE Advanced rank.",
    },
    selection: "apply",
    benefit: {
      summary:
        "One of two supernumerary seats per programme: one gender-neutral, one for women only.",
    },
    cycle: { label: "2026-27", keyDates: [] },
    steps: [
      "Write JEE Advanced; SEA is not a way around it.",
      "Apply on the SEA portal with your sports certificates when it opens after JEE Advanced results.",
      "Candidates are ranked on a points score for their sporting record.",
    ],
    keyFacts: [
      "Participating IITs in 2026-27 included Madras, Indore, Kharagpur and Mandi.",
      "Points: international gold, silver, bronze, participation = 100, 90, 80, 50; national gold, silver, bronze = 60, 50, 40, then weighted by sport.",
      "JoSAA itself has no sports quota.",
    ],
    applyUrl: "https://ugadmissions.iitm.ac.in/sea/information.html",
    sources: [
      {
        label: "IIT Madras: Sports Excellence Admission",
        url: "https://ugadmissions.iitm.ac.in/sea/information.html",
      },
      { label: "PIB release", url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2024920" },
    ],
    verificationNote:
      "Which IITs take part changes every year; one source also listed IIT Roorkee for 2026-27.",
  },

  // ── Admissions: school ──
  {
    slug: "kendriya-vidyalaya-sports-admission",
    track: "admission",
    category: "school",
    title: "Kendriya Vidyalaya admission: sports consideration",
    summary:
      "Kendriya Vidyalaya admission guidelines give special consideration to children who have placed in the top three at recognised school and national games.",
    owner: { name: "Kendriya Vidyalaya Sangathan", type: "central-government" },
    allSports: true,
    sports: [],
    geography: { scope: "india" },
    eligibility: {
      gender: "any",
      level:
        "1st, 2nd or 3rd place at Khelo India, SGFI (school games), CBSE, national or state government games.",
    },
    selection: "apply",
    benefit: { summary: "Special consideration in admission to a Kendriya Vidyalaya." },
    cycle: {
      label: "2026-27",
      keyDates: [{ label: "Class 1 registration opened", date: "2026-03-20" }],
    },
    steps: [
      "Read the year's admission guidelines, published each spring.",
      "Apply in the normal admission window with your child's sports certificates.",
    ],
    keyFacts: ["The guidelines are reissued every year as a PDF, usually in March."],
    sources: [
      {
        label: "KVS admission guidelines 2026-27",
        url: "https://kvsangathan.nic.in/en/document/kendriya-vidyalaya-sangathan-admission-guidelines-2026-2027/",
      },
    ],
    verificationNote:
      "How much weight the sports consideration carries, and in which classes, was not confirmed from the PDF.",
  },

  // ── Admissions: exam concessions ──
  {
    slug: "cbse-sports-exam-attendance-concessions",
    track: "admission",
    category: "exam-concession",
    title: "CBSE board exams and attendance for athletes",
    summary:
      "CBSE lets students who are representing at national or international events move a clashing board exam to a later session, and relaxes the attendance requirement for them.",
    owner: { name: "Central Board of Secondary Education", type: "school-board" },
    allSports: true,
    sports: [],
    geography: { scope: "india" },
    eligibility: {
      gender: "any",
      level: "Participation in a national or international event recognised by SAI or BCCI.",
    },
    selection: "apply",
    benefit: {
      summary:
        "A later exam session when an event clashes with a board exam, and up to 25% relaxation of the 75% attendance rule.",
    },
    cycle: {
      label: "2025-26 board exams",
      keyDates: [
        { label: "Class 12 special exam", date: "2026-04-11" },
        { label: "Class 12 special exam", date: "2026-04-13" },
      ],
    },
    steps: [
      "Tell the school as soon as an event is confirmed; the school applies to CBSE, not the student.",
      "Keep the event's official documents: they are required for both the exam change and attendance relaxation.",
    ],
    keyFacts: [
      "Class 10 students with a clash sit the later (May) session; there are no separate special exams for Class 10.",
      "Attendance relaxation needs documents and the school's recommendation.",
    ],
    sources: [
      {
        label: "CBSE: special provision for sports students",
        url: "https://www.cbse.gov.in/cbsenew/documents/Special_provision_for_the_students_021224.pdf",
        publishedOn: "2024-12-02",
      },
      {
        label: "CBSE: attendance eligibility circular",
        url: "https://www.cbse.gov.in/cbsenew/documents/Strict_Compliance_attendance_Eligibility_05082025.pdf",
        publishedOn: "2025-08-05",
      },
    ],
    verificationNote: "State boards and CISCE have their own rules, not covered here.",
  },

  // ── Admissions: academies ──
  {
    slug: "khelo-india-accredited-academies",
    track: "admission",
    category: "academy",
    title: "Khelo India accredited academies",
    summary:
      "Khelo India publishes a list of accredited academies, including tennis academies. Each academy runs its own selection, so the list is where to start looking, not an application.",
    owner: { name: "Sports Authority of India (Khelo India)", type: "central-government" },
    allSports: false,
    sports: ["tennis"],
    geography: { scope: "india" },
    selection: "trials",
    benefit: { summary: "Training at an academy accredited under the Khelo India scheme." },
    cycle: { keyDates: [] },
    steps: [
      "Find the tennis academies on the latest accredited list.",
      "Contact the academy directly for its selection trials and fees.",
    ],
    keyFacts: [
      "SAI's National Centres of Excellence do not include tennis; accredited academies are the Khelo India route for it.",
      "A revamped Khelo India scheme (2026-31) was approved in 2026 and may change how academies are accredited.",
    ],
    sources: [
      {
        label: "List of Khelo India accredited academies",
        url: "https://kheloindia.gov.in/uploads/List%20Of%20Khelo%20India%20Accreditated%20Academies%2008.11.2024%20(1).pdf",
        publishedOn: "2024-11-08",
      },
    ],
    verificationNote:
      "The newest list found was dated 8 November 2024; check for a later one before publishing.",
  },

  // ── Admissions: study abroad ──
  {
    slug: "us-college-tennis",
    track: "admission",
    category: "study-abroad",
    title: "Playing college tennis in the United States",
    summary:
      "US universities recruit junior tennis players and can fund their studies. It works by recruitment: coaches find and approach players, mostly by their UTR rating, from around Class 10.",
    owner: { name: "NCAA (US college athletics)", type: "international-body" },
    allSports: false,
    sports: ["tennis"],
    geography: { scope: "abroad" },
    eligibility: {
      gender: "any",
      level: "A competitive UTR rating; what counts as competitive varies a lot by division.",
      academic:
        "Registration with the NCAA Eligibility Center, which checks academics and amateur status.",
    },
    selection: "recruitment",
    benefit: {
      summary:
        "A place on a college team, often with full or partial athletic aid towards tuition and living costs.",
    },
    cycle: { keyDates: [] },
    steps: [
      "Keep a UTR rating current by playing rated events; coaches filter by it.",
      "Register with the NCAA Eligibility Center.",
      "From 15 June after Class 10 (sophomore year), coaches may contact players directly.",
      "From 1 August before Class 11 (junior year), players can make official visits.",
    ],
    keyFacts: [
      "Since April 2026, prospects enrolling from 2026-27 may keep tennis prize money.",
      "Division I eligibility now runs five years from enrolment or from age 19, whichever comes first.",
      "At schools in the House settlement, tennis teams have a 10-player roster limit and any rostered player can receive full or partial aid.",
    ],
    sources: [
      {
        label: "NCAA: eligibility changes for prospects",
        url: "https://ncaa.org/news/2026/4/15/media-center-di-cabinet-adopts-changes-to-eligibility-rules-for-prospects.aspx",
        publishedOn: "2026-04-15",
      },
      {
        label: "NCAA: age-based eligibility rules",
        url: "https://www.ncaa.org/eligibility-center/division-i-and-division-ii-age-based-eligibility-rules/",
      },
      {
        label: "NCAA: roster limits",
        url: "https://www.ncaa.org/news/2025/6/23/media-center-di-board-of-directors-formally-adopts-changes-to-roster-limits.aspx",
        publishedOn: "2025-06-23",
      },
    ],
    verificationNote:
      "The contact and visit dates come from recruiting guides rather than an NCAA page; check them against the current NCAA recruiting calendar.",
  },

  // ── Scholarships: government ──
  {
    slug: "khelo-india-athlete-scholarship",
    track: "scholarship",
    category: "government",
    title: "Khelo India athlete scholarship",
    summary:
      "Talented young athletes spotted at the Khelo India Youth Games are supported for up to eight years. There is no application: players are picked by scouts from performances at the Games.",
    owner: {
      name: "Sports Authority of India / Ministry of Youth Affairs and Sports",
      type: "central-government",
    },
    allSports: true,
    sports: [],
    geography: { scope: "india" },
    eligibility: { gender: "any", level: "Strong performance at the Khelo India Youth Games." },
    selection: "scouted",
    benefit: {
      summary:
        "About ₹6.28 lakh a year for up to eight years, including ₹1.2 lakh a year paid to the athlete as a pocket allowance; the rest pays for training.",
      amount: {
        value: 628000,
        currency: "INR",
        period: "year",
        note: "Under the 2021-26 guidelines",
      },
    },
    cycle: { keyDates: [] },
    steps: [
      "Qualify for your state's team at the Khelo India Youth Games.",
      "Perform well there: scouts select roughly the top two per event.",
      "Selected athletes are named in published induction notices; poor performance can lead to being dropped.",
    ],
    keyFacts: ["Around 1,000 athletes a year are supported across all sports."],
    sources: [
      {
        label: "Khelo India scheme operational guidelines",
        url: "https://kheloindia.gov.in/uploads/Khelo-India-Scheme-Operational-Guidelines.pdf",
      },
    ],
    verificationNote:
      "Figures are from the 2021-26 guidelines. The revamped scheme approved for 2026-31 may change the amounts; its guidelines were not yet published.",
  },
  {
    slug: "tops-development-group",
    track: "scholarship",
    category: "government",
    title: "TOPS Development group (Target Olympic Podium Scheme)",
    summary:
      "The government's elite athlete programme has a development group for young athletes with Olympic potential. Athletes are nominated, often on their federation's recommendation; there is no open application.",
    owner: { name: "Sports Authority of India (Mission Olympic Cell)", type: "central-government" },
    allSports: true,
    sports: [],
    geography: { scope: "india" },
    eligibility: {
      gender: "any",
      level: "National or international results that mark Olympic potential.",
    },
    selection: "nominated",
    benefit: {
      summary:
        "A monthly allowance plus funding for training and competition tailored to the athlete.",
      amount: {
        value: 25000,
        currency: "INR",
        period: "month",
        note: "Development group allowance",
      },
    },
    cycle: { keyDates: [] },
    steps: [
      "Build results in your federation's ranking events; federations recommend athletes.",
      "The Mission Olympic Cell decides who is inducted.",
    ],
    keyFacts: [
      "The core group's allowance is ₹50,000 a month.",
      "On 10 September 2026, AITA announced eight young tennis players under TOPS Development and the Target Asian Games Group.",
    ],
    sources: [
      {
        label: "SAI: Target Olympic Podium Scheme",
        url: "https://sportsauthorityofindia.nic.in/sai_new/target-olympic-podium",
      },
      { label: "AITA news", url: "https://www.aitatennis.com/" },
    ],
  },
  {
    slug: "haryana-sports-scholarship",
    track: "scholarship",
    category: "government",
    title: "Haryana sports scholarship for students",
    summary:
      "Haryana pays a yearly scholarship to student athletes from the state who won medals at national or international level in the previous year, subject to a family income limit.",
    owner: { name: "Department of Sports, Haryana", type: "state-government" },
    allSports: true,
    sports: [],
    geography: { scope: "state", state: "Haryana" },
    eligibility: {
      gender: "any",
      level: "A national or international medal in the previous year.",
      income: "Family income up to ₹1.8 lakh a year (₹2.5 lakh for SC candidates).",
    },
    selection: "apply",
    benefit: {
      summary:
        "National gold, silver, bronze: ₹60,000, ₹48,000, ₹36,000. International: ₹84,000, ₹72,000, ₹60,000.",
    },
    cycle: { keyDates: [] },
    steps: [
      "Apply to the Haryana sports department with your medal certificates and income proof.",
    ],
    keyFacts: [],
    sources: [
      { label: "Haryana Sports: scholarship", url: "https://haryanasports.gov.in/scholarship/" },
    ],
    verificationNote:
      "The official page could not be read during research; amounts came from a search summary of a 2023 notification and must be checked.",
  },
  {
    slug: "tamil-nadu-elite-sports-support",
    track: "scholarship",
    category: "government",
    title: "Tamil Nadu ELITE, MIMS and CDS athlete schemes",
    summary:
      "Tamil Nadu's sports authority funds athletes with the potential to win international medals, in three tiers.",
    owner: { name: "Sports Development Authority of Tamil Nadu", type: "state-government" },
    allSports: true,
    sports: [],
    geography: { scope: "state", state: "Tamil Nadu" },
    eligibility: {
      gender: "any",
      level: "Potential international medallists; need is also considered.",
    },
    selection: "nominated",
    benefit: {
      summary:
        "ELITE ₹30 lakh, MIMS ₹12 lakh, CDS ₹4 lakh per athlete per year, for 50, 125 and 200 athletes.",
    },
    cycle: { keyDates: [] },
    steps: ["Contact SDAT about selection for the year's intake."],
    keyFacts: [],
    sources: [
      {
        label: "SDAT: talent development",
        url: "https://sdat.tn.gov.in/content.php?token=talentdevelop",
      },
    ],
    verificationNote:
      "Figures came from a search summary (around 2025), not from reading the official page.",
  },

  // ── Scholarships: international ──
  {
    slug: "grand-slam-player-development-grants",
    track: "scholarship",
    category: "international",
    title: "Grand Slam Player Development Programme grants",
    summary:
      "The four Grand Slams fund promising juniors and young professionals from developing tennis nations through the ITF. Players are chosen on rankings and nominated; there is no application.",
    owner: {
      name: "International Tennis Federation, for the Grand Slams",
      type: "international-body",
    },
    allSports: false,
    sports: ["tennis"],
    geography: { scope: "international" },
    eligibility: {
      ageNote: "Juniors: girls 14-17, boys 15-18. Professionals: women 18-21, men 19-22.",
      gender: "any",
      level: "A ranking strong enough to be selected; the ITF nominates.",
    },
    selection: "nominated",
    benefit: {
      summary: "A grant of US$12,500 to US$50,000.",
      amount: { value: 50000, currency: "USD", period: "year", note: "Up to" },
    },
    cycle: {
      label: "2026",
      keyDates: [{ label: "2026 recipients announced", date: "2026-01-22" }],
    },
    steps: ["Build an ITF junior or professional ranking; selection is by the ITF."],
    keyFacts: [
      "65 players received grants in 2026, including India's Maaya Rajeshwaran Revathi (US$25,000).",
    ],
    sources: [
      {
        label: "ITF: Grand Slam Player Development Programme",
        url: "https://www.itftennis.com/en/growing-the-game/grand-slam-player-development-programme/",
      },
      {
        label: "Roland-Garros: 2026 grant recipients",
        url: "https://www.rolandgarros.com/en-us/article/2026-grand-slam-player-development-programme-grant-recipients-announced",
        publishedOn: "2026-01-22",
      },
    ],
  },
  {
    slug: "atf-14u-touring-team",
    track: "scholarship",
    category: "international",
    title: "Asian Tennis Federation 14 & under touring team",
    summary:
      "A funded European tour for Asia's best 14-and-under players, run with the ITF and the Grand Slam programme. Selection is on Asian (ATF) under-14 rankings.",
    owner: { name: "Asian Tennis Federation", type: "international-body" },
    allSports: false,
    sports: ["tennis"],
    geography: { scope: "international" },
    eligibility: { ageMax: 14, gender: "any", level: "A high ATF under-14 ranking." },
    selection: "nominated",
    benefit: {
      summary:
        "A funded competition tour of Europe for 6 boys and 6 girls from Asia, with coaches.",
    },
    cycle: {
      label: "2026",
      keyDates: [
        { label: "Tour began", date: "2026-07-09" },
        { label: "Tour ended", date: "2026-08-08" },
      ],
    },
    steps: [
      "Play ATF under-14 events to build an Asian ranking; selection follows the published criteria.",
    ],
    keyFacts: [
      "Three Indian players were selected for the 2026 tour.",
      "ATF also pays small year-end ranking awards, e.g. US$1,000 for third.",
    ],
    sources: [
      {
        label: "ATF: 2026 selection criteria",
        url: "https://www.asiantennis.com/wp-content/uploads/2026/04/Players-Selection-Criteria-GSPDP_ITF_ATF-Developement-Projects-2026-RV-2.pdf",
        publishedOn: "2026-04-01",
      },
      { label: "AITA: 2026 selection", url: "https://aitatennis.com/30476-2/" },
    ],
    verificationNote: "The selection-criteria PDF could not be parsed during research.",
  },

  // ── Scholarships: companies ──
  {
    slug: "indianoil-sports-scholarship",
    track: "scholarship",
    category: "company",
    title: "IndianOil sports scholarship",
    summary:
      "IndianOil pays monthly scholarships to young athletes ranked in the top ten nationally in junior or sub-junior categories, for three years.",
    owner: { name: "Indian Oil Corporation", type: "public-sector-company" },
    allSports: true,
    sports: [],
    geography: { scope: "india" },
    eligibility: {
      ageMax: 19,
      gender: "any",
      level:
        "Elite: junior or sub-junior national rank 1-5, or a national semi-final. Scholar: rank 6-10, or a national quarter-final.",
    },
    selection: "apply",
    benefit: {
      summary:
        "Elite scholars ₹15,000, ₹17,000, ₹19,000 a month over three years; scholars ₹12,000, ₹14,000, ₹16,000; plus travel and lodging.",
    },
    cycle: { keyDates: [] },
    steps: ["Watch for IndianOil's scholarship notification; windows are irregular."],
    keyFacts: [],
    sources: [
      {
        label: "IndianOil: sports scholarship details",
        url: "https://iocl.com/uploads/Sports_SCHOLARSHIP_DETAIL.pdf",
      },
    ],
    verificationNote: "Application windows are irregular; check whether one is open.",
  },
  {
    slug: "gosports-foundation-scholarship",
    track: "scholarship",
    category: "company",
    title: "GoSports Foundation athlete programmes",
    summary:
      "A non-profit that supports promising young Indian athletes with funding and mentoring. Tennis is among the sports it lists.",
    owner: { name: "GoSports Foundation", type: "foundation" },
    allSports: false,
    sports: ["tennis"],
    geography: { scope: "india" },
    selection: "nominated",
    benefit: { summary: "Funding and mentoring for selected athletes." },
    cycle: { keyDates: [] },
    steps: ["Check the foundation's programme pages for how athletes are selected."],
    keyFacts: [],
    sources: [{ label: "GoSports Foundation programmes", url: "https://gosports.in/programmes/" }],
    verificationNote: "How often it selects, and how, was not confirmed.",
  },

  // ── Scholarships: universities ──
  {
    slug: "lpu-sports-scholarship",
    track: "scholarship",
    category: "university",
    title: "Lovely Professional University sports scholarship",
    summary:
      "LPU waives tuition, up to the full fee, for students with national or international sporting achievements, after a trial. Several private universities run similar schemes.",
    owner: { name: "Lovely Professional University", type: "university" },
    allSports: true,
    sports: [],
    geography: { scope: "state", state: "Punjab" },
    eligibility: { gender: "any", level: "National or international sporting achievement." },
    selection: "trials",
    benefit: { summary: "A tuition waiver of up to 100%." },
    cycle: { keyDates: [] },
    steps: ["Apply for admission and the sports scholarship, then attend the trial."],
    keyFacts: [],
    sources: [
      {
        label: "LPU: scholarship for sports performance",
        url: "https://www.lpu.in/scholarship/scholarship-on-the-basis-of-performance-in-sports.php",
      },
    ],
  },
];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  // Every draft must pass the draft schema, and must also be publishable once
  // someone verifies it: a starter entry that can never be published is noise.
  const today = todayInIndia();
  const problems: string[] = [];
  for (const draft of DRAFTS) {
    const asDraft = parseOpportunityDraft(draft);
    if (!asDraft.ok) problems.push(...asDraft.errors.map((e) => `${draft.slug}: ${e}`));
    const asPublished = parseOpportunity({ ...draft, lastVerifiedOn: today });
    if (!asPublished.ok) problems.push(...asPublished.errors.map((e) => `${draft.slug}: ${e}`));
  }
  const slugs = DRAFTS.map((d) => d.slug);
  const duplicates = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
  if (duplicates.length) problems.push(`duplicate slugs: ${duplicates.join(", ")}`);
  if (problems.length) {
    console.error("The drafts do not match the format:");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exitCode = 1;
    return;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGO_URI (or MONGODB_URI) before running this.");

  // A dry run must not write. Locally `autoIndex` is on (it keys off
  // NODE_ENV), so merely connecting with the model loaded would create the
  // collection and its indexes in production. Both are switched off here and
  // done explicitly, only under --apply.
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  try {
    const existing = new Set(
      (
        await Opportunity.find({ slug: { $in: slugs } })
          .select("slug")
          .lean()
      ).map((d) => d.slug)
    );
    const toInsert = DRAFTS.filter((d) => !existing.has(d.slug));

    for (const draft of DRAFTS) {
      console.log(`${existing.has(draft.slug) ? "skip (exists)" : "insert      "}  ${draft.slug}`);
    }

    if (!apply) {
      console.log(`\nDry run: would insert ${toInsert.length} draft(s). Re-run with --apply.`);
      return;
    }

    await Opportunity.createCollection();
    await Opportunity.createIndexes();
    if (toInsert.length) {
      await Opportunity.insertMany(toInsert.map((d) => ({ ...d, status: "draft" })));
    }
    console.log(`\nInserted ${toInsert.length} draft(s). None are visible to parents yet.`);
    console.log("Verify and publish each from Admin → Content → Admissions & Scholarships.");
  } finally {
    await mongoose.disconnect();
  }
}

// Importable by the tests without connecting to anything.
if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
