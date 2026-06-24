import { GoogleGenAI } from "@google/genai";
import { Sport } from "../models/Sport";
import { SportPathway, SportPathwayDocument } from "../models/SportPathway";
import { Tournament } from "../models/Tournament";
import { Scholarship } from "../models/Scholarship";
import { University } from "../models/University";
import { realDataScraperService } from "./RealDataScraperService";
import { buildSafeSearchRegexSource } from "../../utils/regex";

const isDev = process.env.NODE_ENV !== "production";
const log = {
  info: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

type CanonicalAttachResult = {
  pathway: SportPathwayDocument;
  warnings: string[];
  entitiesReady: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeCity(city?: string): string {
  if (!city) return "";
  return city.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Top Indian sports to pre-warm at startup so the first user always gets an instant response */
const POPULAR_SPORTS = [
  "Cricket",
  "Badminton",
  "Football",
  "Kabaddi",
  "Hockey",
  "Tennis",
  "Athletics",
  "Wrestling",
  "Shooting",
  "Swimming",
];

/** Days before a pathway is considered stale and eligible for background refresh */
const DEFAULT_STALE_DAYS = parseInt(process.env.PATHWAY_STALE_DAYS || "30", 10);

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPathwayPrompt(
  sportName: string,
  childAge?: number,
  childCity?: string,
): string {
  const ageContext = childAge
    ? `The parent's child is ${childAge} years old.`
    : "";
  const cityContext = childCity
    ? `The family is based in ${childCity.trim()}, India.`
    : "";

  return `You are an expert Indian sports development consultant advising an average Indian parent. Generate a detailed, highly actionable, and realistic sports development pathway for their child in "${sportName}" within India. The tone should be encouraging, deeply rooted in the Indian sports ecosystem, and easy for a parent without a sports background to understand.
${ageContext ? `\n${ageContext}` : ""}${cityContext ? `\n${cityContext}` : ""}
Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "sportName": "Proper name of the sport",
  "category": "One of: Ball Sports | Racquet Sports | Combat Sports | Water Sports | Winter Sports | Team Sports | Individual Sports | Fitness | Other",
  "overview": "2-3 sentences explaining the sport's scope and future prospects in India to a parent, including why their child should pursue it.",
  "governingBodyNational": "Name of the national governing body in India (e.g. BCCI for Cricket, BAI for Badminton)",
  "levels": [
    {
      "level": 1,
      "label": "Grassroots",
      "title": "Neighbourhood & Club Level",
      "description": "Parent-friendly description of what to expect, how much time/money is involved, and how to get started in India.",
      "keyFocus": "Short phrase, e.g. 'Fun & Basic Skills'",
      "ageRange": "e.g. '5 – 14 years'",
      "competitions": "Key competitions at this level in India",
      "steps": ["Step 1 (Actionable for parent)", "Step 2", "Step 3", "Step 4"],
      "governingBody": "Relevant local/district body",
      "localResources": {
        "academies": ["Example local academy 1"],
        "facilities": ["Example local facility"],
        "governingBodies": ["Example local federation branch"]
      },
      "benchmarks": {
        "description": "What a child at this level should physically and technically be able to do",
        "metrics": [{"metric": "specific skill or fitness attribute", "target": "measurable target appropriate for this level and sport"}]
      },
      "trialInfo": {
        "typicalMonths": "Months when selection trials for this level typically happen in India (e.g. 'August–October')",
        "registrationProcess": "Step-by-step: how a parent registers their child for trials",
        "eligibilityAge": "Age range accepted at this level's trials",
        "selectionCriteria": ["Physical fitness component being tested", "Technical skill being assessed"],
        "tips": ["Actionable tip to prepare for trials"]
      },
      "injuryRisks": {
        "commonInjuries": ["Most common injury for this sport at this training intensity"],
        "preventionTips": ["Specific, actionable injury prevention advice"],
        "warningSignsToWatch": ["Symptom or sign a parent must not ignore — when to see a doctor"]
      },
      "talentSignals": {
        "physicalMarkers": ["Observable physical trait that indicates elite potential for this sport"],
        "cognitiveMarkers": ["Mental or tactical aptitude sign coaches look for"],
        "behavioralMarkers": ["Character trait or habit that predicts long-term success at elite level"]
      },
      "mentalSkillsFocus": ["Top mental skill to develop at this level", "second skill", "third skill"],
      "coachSelectionGuide": {
        "mustHave": ["Non-negotiable qualification or quality for a coach at this level"],
        "niceToHave": ["Desirable but not essential trait"],
        "redFlags": ["Warning sign of a coach who could harm a young athlete at this stage"],
        "questionsToAsk": ["Specific interview question a parent should ask before hiring"]
      },
      "governmentSchemes": [
        {
          "name": "Official scheme name (e.g. Khelo India Youth Games, SAI Training Centre, TOPS)",
          "body": "Ministry or body that runs it (e.g. Ministry of Youth Affairs & Sports, SAI)",
          "eligibility": "Who qualifies — age range, performance level, sport",
          "benefit": "What it provides — ₹ stipend amount or in-kind support (kit, coaching, travel)",
          "howToApply": "Concise application process — where to register, deadline cycle"
        }
      ],
      "academicIntegration": "Practical advice for parents on balancing school academics with sport at this specific level — board exam timing, school permissions, residential academies that cover studies",
      "proactiveDocuments": ["Document to start collecting NOW that will be required at a higher level — be specific (e.g. 'Birth certificate issued by municipal corporation', 'School sports participation certificate signed by principal')"]
    },
    {
      "level": 2,
      "label": "District",
      "title": "District & Zonal Level",
      "description": "...",
      "keyFocus": "Technical Skills & Competition",
      "ageRange": "...",
      "competitions": "...",
      "steps": ["..."],
      "governingBody": "...",
      "localResources": { "academies": [], "facilities": [], "governingBodies": [] },
      "benchmarks": { "description": "...", "metrics": [{"metric": "...", "target": "..."}] },
      "trialInfo": { "typicalMonths": "...", "registrationProcess": "...", "eligibilityAge": "...", "selectionCriteria": ["..."], "tips": ["..."] },
      "injuryRisks": { "commonInjuries": ["..."], "preventionTips": ["..."], "warningSignsToWatch": ["..."] },
      "talentSignals": { "physicalMarkers": ["..."], "cognitiveMarkers": ["..."], "behavioralMarkers": ["..."] },
      "mentalSkillsFocus": ["..."],
      "coachSelectionGuide": { "mustHave": ["..."], "niceToHave": ["..."], "redFlags": ["..."], "questionsToAsk": ["..."] },
      "governmentSchemes": [{ "name": "...", "body": "...", "eligibility": "...", "benefit": "...", "howToApply": "..." }],
      "academicIntegration": "...",
      "proactiveDocuments": ["..."]
    },
    {
      "level": 3,
      "label": "State",
      "title": "State Level",
      "description": "...",
      "keyFocus": "Performance & State Representation",
      "ageRange": "...",
      "competitions": "...",
      "steps": ["..."],
      "governingBody": "...",
      "localResources": { "academies": [], "facilities": [], "governingBodies": [] },
      "benchmarks": { "description": "...", "metrics": [{"metric": "...", "target": "..."}] },
      "trialInfo": { "typicalMonths": "...", "registrationProcess": "...", "eligibilityAge": "...", "selectionCriteria": ["..."], "tips": ["..."] },
      "injuryRisks": { "commonInjuries": ["..."], "preventionTips": ["..."], "warningSignsToWatch": ["..."] },
      "talentSignals": { "physicalMarkers": ["..."], "cognitiveMarkers": ["..."], "behavioralMarkers": ["..."] },
      "mentalSkillsFocus": ["..."],
      "coachSelectionGuide": { "mustHave": ["..."], "niceToHave": ["..."], "redFlags": ["..."], "questionsToAsk": ["..."] },
      "governmentSchemes": [{ "name": "...", "body": "...", "eligibility": "...", "benefit": "...", "howToApply": "..." }],
      "academicIntegration": "...",
      "proactiveDocuments": ["..."]
    },
    {
      "level": 4,
      "label": "National",
      "title": "National Level",
      "description": "...",
      "keyFocus": "Elite Performance & National Ranking",
      "ageRange": "...",
      "competitions": "...",
      "steps": ["..."],
      "governingBody": "...",
      "localResources": { "academies": [], "facilities": [], "governingBodies": [] },
      "benchmarks": { "description": "...", "metrics": [{"metric": "...", "target": "..."}] },
      "trialInfo": { "typicalMonths": "...", "registrationProcess": "...", "eligibilityAge": "...", "selectionCriteria": ["..."], "tips": ["..."] },
      "injuryRisks": { "commonInjuries": ["..."], "preventionTips": ["..."], "warningSignsToWatch": ["..."] },
      "talentSignals": { "physicalMarkers": ["..."], "cognitiveMarkers": ["..."], "behavioralMarkers": ["..."] },
      "mentalSkillsFocus": ["..."],
      "coachSelectionGuide": { "mustHave": ["..."], "niceToHave": ["..."], "redFlags": ["..."], "questionsToAsk": ["..."] },
      "governmentSchemes": [{ "name": "TOPS (Target Olympic Podium Scheme)", "body": "SAI / Ministry of Youth Affairs", "eligibility": "...", "benefit": "...", "howToApply": "..." }],
      "academicIntegration": "...",
      "proactiveDocuments": ["..."]
    },
    {
      "level": 5,
      "label": "International",
      "title": "International Level",
      "description": "...",
      "keyFocus": "World-Class Excellence & Olympic Pathway",
      "ageRange": "...",
      "competitions": "Key international competitions (Asian Games, World Championships, Olympics, etc.)",
      "steps": ["..."],
      "governingBody": "International governing body",
      "localResources": { "academies": [], "facilities": [], "governingBodies": [] },
      "benchmarks": { "description": "...", "metrics": [{"metric": "...", "target": "..."}] },
      "trialInfo": { "typicalMonths": "...", "registrationProcess": "...", "eligibilityAge": "...", "selectionCriteria": ["..."], "tips": ["..."] },
      "injuryRisks": { "commonInjuries": ["..."], "preventionTips": ["..."], "warningSignsToWatch": ["..."] },
      "talentSignals": { "physicalMarkers": ["..."], "cognitiveMarkers": ["..."], "behavioralMarkers": ["..."] },
      "mentalSkillsFocus": ["..."],
      "coachSelectionGuide": { "mustHave": ["..."], "niceToHave": ["..."], "redFlags": ["..."], "questionsToAsk": ["..."] },
      "governmentSchemes": [{ "name": "...", "body": "...", "eligibility": "...", "benefit": "...", "howToApply": "..." }],
      "academicIntegration": "...",
      "proactiveDocuments": ["..."]
    }
  ],
  "equipment": [
    {
      "level": "e.g. Grassroots, Intermediate, Professional",
      "items": ["Item 1", "Item 2"],
      "estimatedCost": "e.g. ₹2,000 - ₹5,000"
    }
  ],
  "careers": [
    {
      "role": "e.g. Coach, Umpire, Sports Manager",
      "description": "Brief description of the career path",
      "demand": "e.g. High, Growing, Niche"
    }
  ]
}

Make all content specific to India's sports ecosystem, governing bodies, and actual competitions. Focus on giving parents practical advice and clear expectations. Be accurate and informative.

If a child's age was provided, lead the "steps" of the most age-appropriate level with the most actionable next step for a child of that age — but always include all 5 levels in the output.

If a city was provided, you MUST populate the \`localResources\` object for the lower levels (Grassroots, District, State) with REAL, accurate names of academies, training facilities (e.g., SAI centres), and local federation branches located in or near that city. If none exist or you cannot be certain, leave the arrays empty.
Do not just merge local places into the general "steps" — use the \`localResources\` structured format.

Do NOT include "tournaments", "scholarships", or "universities" arrays in your response — those are supplied separately from a verified database, not generated by you.`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PathwayService {
  private genAI: GoogleGenAI | null = null;

  /** Set of cacheKeys currently being refreshed — prevents duplicate Gemini calls */
  private refreshInProgressSet = new Set<string>();

  constructor() {
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Main entry point: get pathway from DB or generate + cache it.
   * Tournaments/scholarships/universities are loaded from the canonical
   * collections (not Gemini) via attachCanonicalEntities().
   * If the cached pathway is stale, a background refresh is triggered
   * (serve-stale-while-revalidating pattern).
   */
  async getOrGeneratePathway(
    sportName: string,
    childAge?: number,
    childCity?: string,
  ): Promise<{
    pathway: SportPathwayDocument | null;
    source: "db" | "generated" | "not_a_sport";
    isStale?: boolean;
    entitiesReady?: boolean;
    message?: string;
    warnings?: string[];
  }> {
    let slug = toSlug(sportName);

    // ── 1. Validate with existing Sport collection FIRST ───────────────────
    const knownSport = await Sport.findOne({ slug });
    log.info(
      `[PathwayService] getOrGeneratePathway for ${sportName} - slug: ${slug}, knownSport:`,
      knownSport ? knownSport.name : "null",
    );

    const finalSportName = knownSport ? knownSport.name : sportName;
    slug = knownSport ? knownSport.slug : slug;

    // ── 2. Build composite cache key ───────────────────────────────────────
    const cacheKey = `${slug}_${childAge ?? "any"}_${normalizeCity(childCity)}`;

    // ── 3. Check cache by cacheKey ─────────────────────────────────────────
    const existing = await SportPathway.findOne({ cacheKey });
    if (existing) {
      log.info(`[PathwayService] Cache hit for ${cacheKey}`);
      SportPathway.updateOne({ cacheKey }, { $inc: { lookupCount: 1 } }).exec();

      // ── Stale-while-revalidate: return cached, refresh in background ───
      const isStale = this.isPathwayStale(existing);
      if (isStale && !this.refreshInProgressSet.has(cacheKey)) {
        log.info(
          `[PathwayService] Pathway ${cacheKey} is stale — triggering background refresh`,
        );
        this.refreshPathway(cacheKey).catch((err) =>
          log.error(
            `[PathwayService] Background refresh failed for ${cacheKey}:`,
            err,
          ),
        );
      }

      // Attach live canonical data (tournaments/scholarships/universities).
      // Non-blocking: if entities are missing the scraper fires in the background.
      const enriched = await this.attachCanonicalEntities(
        existing,
        slug,
        finalSportName,
        childCity,
      );
      return {
        pathway: enriched.pathway,
        source: "db",
        isStale,
        entitiesReady: enriched.entitiesReady,
        warnings: enriched.warnings,
      };
    }

    // ── 4. For unknown sports: validate + generate IN PARALLEL ─────────────
    //    For known sports: skip validation entirely (it's already confirmed).
    let generated: Awaited<ReturnType<typeof this.generatePathway>>;

    if (!knownSport) {
      log.info(
        `[PathwayService] Unknown sport — running validate+generate in parallel: ${finalSportName}`,
      );
      const [isValid, gen] = await Promise.all([
        this.validateSport(finalSportName),
        this.generatePathway(finalSportName, childAge, childCity),
      ]);
      log.info(`[PathwayService] Validation: ${isValid}, generated: ${!!gen}`);
      if (!isValid) {
        return {
          pathway: null,
          source: "not_a_sport",
          message: `"${finalSportName}" does not appear to be a recognised sport or athletic activity.`,
        };
      }
      generated = gen;
    } else {
      // ── 5. Known sport — generate directly (no validation round-trip) ────
      generated = await this.generatePathway(
        finalSportName,
        childAge,
        childCity,
      );
    }

    if (!generated) {
      // Graceful fallback: if generation fails for a city/age variant,
      // serve any existing cached pathway for this sport slug.
      const fallbackDoc = await SportPathway.findOne({ sportSlug: slug }).sort({
        lookupCount: -1,
      });
      if (fallbackDoc) {
        log.warn(
          `[PathwayService] Generation failed for ${cacheKey} — serving fallback for ${slug}`,
        );
        const enriched = await this.attachCanonicalEntities(
          fallbackDoc,
          slug,
          finalSportName,
          childCity,
        );
        return {
          pathway: enriched.pathway,
          source: "db",
          isStale: true,
          entitiesReady: enriched.entitiesReady,
          warnings: [
            ...(enriched.warnings || []),
            "City-specific data is being generated. Showing general pathway for now.",
          ],
        };
      }
      return {
        pathway: null,
        source: "not_a_sport",
        message:
          "Could not generate pathway for this sport right now. Please try again in a moment.",
      };
    }

    // ── 6. Store in DB ─────────────────────────────────────────────────────
    if (knownSport) {
      generated.sportName = knownSport.name;
      if (knownSport.category && knownSport.category !== "Other") {
        generated.category = knownSport.category;
      }
    }

    const saved = await this.savePathway(slug, cacheKey, generated);

    // Attach canonical entities (non-blocking — scraper fires in background if needed)
    const enriched = await this.attachCanonicalEntities(
      saved,
      slug,
      finalSportName,
      childCity,
    );
    return {
      pathway: enriched.pathway,
      source: "generated",
      entitiesReady: enriched.entitiesReady,
      warnings: enriched.warnings,
    };
  }

  /**
   * Search for pathways by sport name prefix (for autocomplete).
   */
  async searchPathways(query: string): Promise<SportPathwayDocument[]> {
    // Escape + length-cap user input to prevent regex injection / ReDoS.
    const regex = new RegExp(buildSafeSearchRegexSource(query), "i");
    return SportPathway.find({
      $or: [{ sportName: regex }, { sportSlug: regex }],
    })
      .sort({ lookupCount: -1, sportName: 1 })
      .limit(10)
      .lean() as unknown as SportPathwayDocument[];
  }

  /**
   * Force-refresh the Gemini-generated skeleton of a pathway (levels/equipment/careers).
   * Tournaments/scholarships/universities continue to be served from canonical collections.
   * Safe to call fire-and-forget — duplicate calls for the same cacheKey are no-ops.
   */
  async refreshPathway(cacheKey: string): Promise<SportPathwayDocument | null> {
    if (this.refreshInProgressSet.has(cacheKey)) {
      log.info(
        `[PathwayService] Refresh already in-progress for ${cacheKey}, skipping.`,
      );
      return null;
    }

    this.refreshInProgressSet.add(cacheKey);
    log.info(`[PathwayService] 🔄 Refreshing pathway: ${cacheKey}`);

    try {
      // Mark in DB for multi-instance safety
      await SportPathway.updateOne(
        { cacheKey },
        { $set: { refreshInProgress: true } },
      );

      // Parse slug / age / city back from cacheKey e.g. "cricket_12_ludhiana"
      const parts = cacheKey.split("_");
      const sportSlug: string = parts[0] ?? cacheKey;
      const rawAge = parts[1];
      const rawCity = parts.slice(2).join("-");
      const childAge =
        rawAge && rawAge !== "any" ? parseInt(rawAge, 10) : undefined;
      const childCity = rawCity && rawCity !== "" ? rawCity : undefined;

      // Prefer sportName from existing doc
      const existingDoc = await SportPathway.findOne({ cacheKey })
        .select("sportName")
        .lean();
      const sportName: string = String(
        (existingDoc as any)?.sportName || sportSlug,
      );

      const generated = await this.generatePathway(
        sportName,
        childAge,
        childCity,
      );

      if (!generated) {
        log.warn(
          `[PathwayService] Refresh generation returned null for ${cacheKey}`,
        );
        await SportPathway.updateOne(
          { cacheKey },
          { $set: { refreshInProgress: false } },
        );
        return null;
      }

      const refreshed = await SportPathway.findOneAndUpdate(
        { cacheKey },
        {
          $set: {
            ...generated,
            // Ensure canonical fields are never overwritten by Gemini output
            tournaments: [],
            scholarships: [],
            universities: [],
            sportSlug,
            cacheKey,
            lastRefreshedAt: new Date(),
            refreshInProgress: false,
          },
        },
        { upsert: true, new: true },
      );

      log.info(`[PathwayService] ✅ Pathway refreshed: ${cacheKey}`);

      // Also trigger a scraper refresh for the canonical data
      try {
        await realDataScraperService.scrapeSport({
          sportSlug,
          sportName: String(sportName),
        });
      } catch (scraperErr) {
        log.warn(
          `[PathwayService] Scraper refresh after pathway refresh failed for ${sportSlug}:`,
          scraperErr,
        );
      }

      return refreshed as SportPathwayDocument;
    } catch (err) {
      log.error(`[PathwayService] ❌ Refresh error for ${cacheKey}:`, err);
      await SportPathway.updateOne(
        { cacheKey },
        { $set: { refreshInProgress: false } },
      ).catch(() => {});
      return null;
    } finally {
      this.refreshInProgressSet.delete(cacheKey);
    }
  }

  /**
   * Returns cacheKeys of pathways that haven't been refreshed within thresholdDays.
   * Capped at 50 results per call to avoid hammering Gemini in a single run.
   */
  async getStalePathways(
    thresholdDays: number = DEFAULT_STALE_DAYS,
  ): Promise<string[]> {
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

    const staleDocs = await SportPathway.find({
      $or: [
        { lastRefreshedAt: { $exists: false } },
        { lastRefreshedAt: null },
        { lastRefreshedAt: { $lt: cutoff } },
      ],
      refreshInProgress: { $ne: true },
    })
      .select("cacheKey")
      .sort({ lastRefreshedAt: 1 }) // oldest first
      .limit(50)
      .lean();

    return staleDocs.map((doc: any) => doc.cacheKey as string).filter(Boolean);
  }

  /**
   * Pre-warm pathways for the top popular Indian sports.
   * Only generates if a generic (age=any, city=any) pathway doesn't already exist.
   * Called once at server startup with a delay.
   */
  async preWarmPopularSports(): Promise<void> {
    log.info("[PathwayService] 🔥 Pre-warming popular sports...");

    for (const sportName of POPULAR_SPORTS) {
      try {
        const slug = toSlug(sportName);
        const cacheKey = `${slug}_any_`;

        const exists = await SportPathway.findOne({ cacheKey })
          .select("_id")
          .lean();

        if (exists) {
          log.info(`[PathwayService] Pre-warm skipped (cached): ${cacheKey}`);
          continue;
        }

        log.info(`[PathwayService] Pre-warming: ${sportName}`);
        const generated = await this.generatePathway(sportName);
        if (generated) {
          await this.savePathway(slug, cacheKey, generated);
          // Also kick off a canonical data scrape for freshly pre-warmed sports
          realDataScraperService
            .scrapeSport({ sportSlug: slug, sportName })
            .catch((err) =>
              log.warn(
                `[PathwayService] Pre-warm scrape failed for ${sportName}:`,
                err,
              ),
            );
          log.info(`[PathwayService] ✅ Pre-warmed: ${sportName}`);
        }

        // Stagger to respect Gemini rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        log.warn(`[PathwayService] Pre-warm failed for ${sportName}:`, err);
      }
    }

    log.info("[PathwayService] ✅ Pre-warming complete.");
  }

  /**
   * Returns basic stats about the pathway collection for admin dashboards.
   */
  async getStats(): Promise<{
    total: number;
    verified: number;
    stale: number;
    topSports: Array<{ sportName: string; lookupCount: number }>;
  }> {
    const cutoff = new Date(
      Date.now() - DEFAULT_STALE_DAYS * 24 * 60 * 60 * 1000,
    );

    const [total, verified, stale, topSports] = await Promise.all([
      SportPathway.countDocuments(),
      SportPathway.countDocuments({ isVerified: true }),
      SportPathway.countDocuments({
        $or: [
          { lastRefreshedAt: { $exists: false } },
          { lastRefreshedAt: null },
          { lastRefreshedAt: { $lt: cutoff } },
        ],
      }),
      SportPathway.find()
        .sort({ lookupCount: -1 })
        .limit(10)
        .select("sportName lookupCount")
        .lean(),
    ]);

    return {
      total,
      verified,
      stale,
      topSports: (topSports as any[]).map((d) => ({
        sportName: d.sportName,
        lookupCount: d.lookupCount,
      })),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Fetch entities (tournaments/scholarships/universities) for a sport,
   * waiting for the scraper if they aren't in the DB yet.
   * Used by the dedicated /entities endpoint so the client can fetch this
   * in parallel while the skeleton is already displayed.
   */
  async getEntities(
    sportName: string,
    childCity?: string,
  ): Promise<{ tournaments: any[]; scholarships: any[]; universities: any[] }> {
    const slug = toSlug(sportName);
    const knownSport = await Sport.findOne({ slug });
    const finalSlug = knownSport ? knownSport.slug : slug;
    const finalName = knownSport ? knownSport.name : sportName;

    const cityQuery = this.buildCityQuery(childCity);

    const [t, s, u] = await Promise.all([
      Tournament.find({ sportSlug: finalSlug, ...cityQuery })
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
      Scholarship.find({ sportSlug: finalSlug, ...cityQuery })
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
      University.find({ sportSlug: finalSlug, ...cityQuery })
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
    ]);

    const missingEntities = t.length === 0 || s.length === 0 || u.length === 0;
    const missingDates =
      t.length > 0 &&
      (t as any[]).some(
        (doc) => !doc.typicalDates && !doc.registrationDeadline,
      );
    const needsRefresh = missingEntities || missingDates;
    if (needsRefresh) {
      log.info(
        `[PathwayService] getEntities: scraping ${finalSlug} (missingEntities=${missingEntities}, missingDates=${missingDates})...`,
      );
      try {
        await realDataScraperService.scrapeSport({
          sportSlug: finalSlug,
          sportName: finalName,
          ...(childCity ? { city: childCity } : {}),
        });
      } catch (err) {
        log.error(
          `[PathwayService] getEntities scraper failed for ${finalSlug}:`,
          err,
        );
      }

      const [t2, s2, u2] = await Promise.all([
        Tournament.find({ sportSlug: finalSlug, ...cityQuery })
          .sort({ updatedAt: -1 })
          .limit(6)
          .lean(),
        Scholarship.find({ sportSlug: finalSlug, ...cityQuery })
          .sort({ updatedAt: -1 })
          .limit(6)
          .lean(),
        University.find({ sportSlug: finalSlug, ...cityQuery })
          .sort({ updatedAt: -1 })
          .limit(6)
          .lean(),
      ]);
      return { tournaments: t2, scholarships: s2, universities: u2 };
    }

    return { tournaments: t, scholarships: s, universities: u };
  }

  /**
   * Overlays live data from the canonical Tournament/Scholarship/University
   * collections onto a pathway response. Non-blocking: if entities are missing,
   * the scraper is fired in the background and empty arrays are returned
   * immediately so the skeleton can be served to the client right away.
   */
  private async attachCanonicalEntities(
    pathway: SportPathwayDocument,
    sportSlug: string,
    sportName?: string,
    childCity?: string,
  ): Promise<CanonicalAttachResult> {
    const cityQuery = this.buildCityQuery(childCity);

    const [tournaments, scholarships, universities] = await Promise.all([
      Tournament.find({ sportSlug, ...cityQuery })
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
      Scholarship.find({ sportSlug, ...cityQuery })
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
      University.find({ sportSlug, ...cityQuery })
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
    ]);

    const plain =
      typeof (pathway as any).toObject === "function"
        ? (pathway as any).toObject()
        : pathway;

    const missingEntities =
      tournaments.length === 0 ||
      scholarships.length === 0 ||
      universities.length === 0;
    const missingDates =
      tournaments.length > 0 &&
      (tournaments as any[]).some(
        (t) => !t.typicalDates && !t.registrationDeadline,
      );
    const needsRefresh = missingEntities || missingDates;

    if (needsRefresh && sportName) {
      // Fire scraper in the background — don't block the response.
      log.info(
        `[PathwayService] Stale canonical data for ${sportSlug} (missingEntities=${missingEntities}, missingDates=${missingDates}) — scraper started in background.`,
      );
      realDataScraperService
        .scrapeSport({
          sportSlug,
          sportName,
          ...(childCity ? { city: childCity } : {}),
        })
        .catch((err) =>
          log.error(
            `[PathwayService] Background scraper failed for ${sportSlug}:`,
            err,
          ),
        );

      return {
        pathway: {
          ...plain,
          tournaments,
          scholarships,
          universities,
        } as SportPathwayDocument,
        warnings: [],
        // entitiesReady=false tells the client to call /entities and wait for fresh data
        entitiesReady: !missingEntities && !missingDates,
      };
    }

    return {
      pathway: {
        ...plain,
        tournaments,
        scholarships,
        universities,
      } as SportPathwayDocument,
      warnings: [],
      entitiesReady: true,
    };
  }

  private buildCityQuery(childCity?: string) {
    if (!childCity) return {};
    const cityRegex = new RegExp(`^${childCity}$`, "i");
    return {
      $or: [
        { city: cityRegex },
        { city: { $exists: false } },
        { city: null },
        { city: /national/i },
      ],
    };
  }

  private isPathwayStale(doc: SportPathwayDocument): boolean {
    const staleCutoff = new Date(
      Date.now() - DEFAULT_STALE_DAYS * 24 * 60 * 60 * 1000,
    );
    const referenceDate = (doc as any).lastRefreshedAt ?? doc.createdAt;
    return referenceDate < staleCutoff;
  }

  private async validateSport(sportName: string): Promise<boolean> {
    const prompt = `Is "${sportName}" a real sport or athletic activity? Reply with only "yes" or "no".`;

    if (this.genAI) {
      try {
        const result = await this.genAI.models.generateContent({
          model: "gemini-2.5",
          contents: prompt,
        });
        const answer = (result.text ?? "").trim().toLowerCase();
        return answer.startsWith("yes");
      } catch (err) {
        log.warn(
          "[PathwayService] Gemini validation failed, falling back.",
          err,
        );
      }
    }

    return true; // Fail open — generate anyway if API unavailable
  }

  private async generatePathway(
    sportName: string,
    childAge?: number,
    childCity?: string,
  ): Promise<{
    sportName: string;
    category: string;
    overview: string;
    levels: Array<{
      level: number;
      label: string;
      title: string;
      description: string;
      keyFocus: string;
      ageRange: string;
      competitions: string;
      steps: string[];
      governingBody: string;
    }>;
    equipment: Array<{
      level: string;
      items: string[];
      estimatedCost: string;
    }>;
    careers: Array<{
      role: string;
      description: string;
      demand: string;
    }>;
  } | null> {
    if (!this.genAI) return null;

    const modelCandidates = [
      process.env.GEMINI_MODEL_NAME,
      "gemini-2.5",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
    ].filter(Boolean) as string[];

    for (const modelName of modelCandidates) {
      try {
        const result = await this.genAI.models.generateContent({
          model: modelName,
          contents: buildPathwayPrompt(sportName, childAge, childCity),
          config: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
        });
        const text = (result.text ?? "").trim();

        // Strip any accidental markdown fences
        const jsonText = text
          .replace(/^```[a-z]*\n?/i, "")
          .replace(/```$/i, "")
          .trim();
        const parsed = JSON.parse(jsonText);

        if (
          parsed &&
          Array.isArray(parsed.levels) &&
          parsed.levels.length === 5 &&
          Array.isArray(parsed.equipment) &&
          Array.isArray(parsed.careers)
        ) {
          return parsed;
        }

        log.warn(
          `[PathwayService] Model ${modelName} returned incomplete data — trying next.`,
        );
      } catch (error) {
        log.error(`[PathwayService] Error with model ${modelName}:`, error);
      }
    }

    log.error("[PathwayService] All Gemini models failed to generate pathway.");
    return null;
  }

  private async savePathway(
    slug: string,
    cacheKey: string,
    data: {
      sportName: string;
      category: string;
      overview: string;
      levels: Array<{
        level: number;
        label: string;
        title: string;
        description: string;
        keyFocus: string;
        ageRange: string;
        competitions: string;
        steps: string[];
        governingBody: string;
      }>;
      equipment: Array<any>;
      careers: Array<any>;
    },
  ): Promise<SportPathwayDocument> {
    const docData = {
      sportSlug: slug,
      cacheKey,
      sportName: data.sportName || slug,
      category: data.category || "Other",
      overview: data.overview || "",
      levels: data.levels,
      // Tournaments/scholarships/universities are NEVER written here — they
      // live exclusively in the canonical collections and get attached at
      // read time via attachCanonicalEntities().
      tournaments: [],
      scholarships: [],
      universities: [],
      equipment: data.equipment || [],
      careers: data.careers || [],
      isVerified: false,
      lastRefreshedAt: new Date(),
      refreshInProgress: false,
    };

    const saved = await SportPathway.findOneAndUpdate(
      { cacheKey },
      {
        $setOnInsert: docData,
        $inc: { lookupCount: 1 },
      },
      { upsert: true, new: true },
    );

    return saved as SportPathwayDocument;
  }
}

export const pathwayService = new PathwayService();
