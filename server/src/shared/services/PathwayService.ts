import { GoogleGenAI } from "@google/genai";
import { Sport } from "../models/Sport";
import { SportPathway, SportPathwayDocument } from "../models/SportPathway";

// ─── Helper ───────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeCity(city?: string): string {
  if (!city) return "";
  return city.trim().toLowerCase().replace(/\s+/g, "-");
}

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
      "governingBody": "Relevant local/district body"
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
      "governingBody": "..."
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
      "governingBody": "..."
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
      "governingBody": "..."
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
      "governingBody": "International governing body"
    }
  ],
  "tournaments": [
    {
      "name": "Name of a notable tournament in India",
      "level": "e.g. Grassroots, State, National",
      "description": "Brief description of the tournament",
      "ageGroup": "e.g. Under-14, Under-17, Senior",
      "prerequisiteId": "A unique identifier for the required ID (e.g., BCCI_ID, AITA_ITN)",
      "prerequisiteName": "The human-readable name of the required ID (e.g., BCCI Player ID)",
      "prerequisiteGuide": ["Step 1 to get the prerequisite", "Step 2", "Step 3"],
      "documentChecklist": ["Proof of Age", "Medical Fitness Certificate", "Passport-sized Photographs"]
    }
  ],
  "scholarships": [
    {
      "name": "Name of the scholarship or support scheme",
      "provider": "e.g. Sports Authority of India, Khelo India, Corporate",
      "description": "Brief description of the financial or training support provided",
      "eligibility": "e.g. National medalist, Top 10 state rank",
      "prerequisiteId": "A unique identifier for the scholarship form (e.g., SAI_FORM_A)",
      "prerequisiteName": "The human-readable name of the form (e.g., SAI Scholarship Application)",
      "prerequisiteGuide": ["Step 1 to apply", "Step 2", "Step 3"],
      "documentChecklist": ["Income Certificate", "Sports Achievement Certificates", "Aadhar Card"]
    }
  ],
  "universities": [
    {
      "name": "Name of a prominent Indian university offering admission via sports quota for this sport",
      "location": "City, State",
      "admissionCriteria": "e.g. State level participation minimum",
      "sportsQuotaDetails": "Brief details on what the quota provides (e.g. marks relaxation, fee waiver)",
      "prerequisiteId": "A unique identifier for the sports quota application (e.g., SPORTS_QUOTA_APP)",
      "prerequisiteName": "The human-readable name of the application (e.g., University Sports Quota Form)",
      "prerequisiteGuide": ["Step 1 to apply for the quota", "Step 2", "Step 3"],
      "documentChecklist": ["12th Marksheet", "Highest Level Sports Certificate", "Character Certificate"]
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

If a child's age was provided, only include tournaments and scholarship entries relevant to that age group. For the pathway levels array, lead the "steps" of the most age-appropriate level with the most actionable next step for a child of that age — but always include all 5 levels in the output.

If a city was provided, make the "steps" arrays within each level mention local or regional resources where possible — for example, state sports authority centres, local federation bodies, or well-known academies in or near that city. For the universities array, prioritise universities in the same state as the city provided.`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PathwayService {
  private genAI: GoogleGenAI | null = null;
  constructor() {
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Main entry point: get pathway from DB or generate + cache it.
   */
  async getOrGeneratePathway(
    sportName: string,
    childAge?: number,
    childCity?: string,
  ): Promise<{
    pathway: SportPathwayDocument | null;
    source: "db" | "generated" | "not_a_sport";
    message?: string;
  }> {
    let slug = toSlug(sportName);

    // ── 1. Validate with existing Sport collection FIRST ───────────────────
    const knownSport = await Sport.findOne({ slug });
    console.log(
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
      console.log(`[PathwayService] Cache hit for ${cacheKey}`);
      SportPathway.updateOne({ cacheKey }, { $inc: { lookupCount: 1 } }).exec();
      return { pathway: existing, source: "db" };
    }

    // ── 3. Validate unknown sports via Gemini ──────────────────────────────
    if (!knownSport) {
      console.log(
        `[PathwayService] Validating unknown sport ${finalSportName} via Gemini...`,
      );
      const isValid = await this.validateSport(finalSportName);
      console.log(`[PathwayService] Validation result:`, isValid);
      if (!isValid) {
        return {
          pathway: null,
          source: "not_a_sport",
          message: `"${finalSportName}" does not appear to be a recognised sport or athletic activity.`,
        };
      }
    }

    // ── 4. Generate pathway with Gemini ────────────────────────────────────
    const generated = await this.generatePathway(
      finalSportName,
      childAge,
      childCity,
    );
    if (!generated) {
      return {
        pathway: null,
        source: "not_a_sport",
        message: "Could not generate pathway for this sport at the moment.",
      };
    }

    // ── 5. Store in DB ─────────────────────────────────────────────────────
    if (knownSport) {
      generated.sportName = knownSport.name;
      if (knownSport.category && knownSport.category !== "Other") {
        generated.category = knownSport.category;
      }
    }

    const saved = await this.savePathway(slug, cacheKey, generated);
    return { pathway: saved, source: "generated" };
  }

  /**
   * Search for pathways by sport name prefix (for autocomplete).
   */
  async searchPathways(query: string): Promise<SportPathwayDocument[]> {
    const regex = new RegExp(query.trim(), "i");
    return SportPathway.find({
      $or: [{ sportName: regex }, { sportSlug: regex }],
    })
      .sort({ lookupCount: -1, sportName: 1 })
      .limit(10)
      .lean() as unknown as SportPathwayDocument[];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async validateSport(sportName: string): Promise<boolean> {
    const prompt = `Is "${sportName}" a real sport or athletic activity? Reply with only "yes" or "no".`;

    if (this.genAI) {
      try {
        const result = await this.genAI.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
        });
        const answer = (result.text ?? "").trim().toLowerCase();
        return answer.startsWith("yes");
      } catch (err) {
        console.warn(
          "[PathwayService] Gemini validation failed, falling back.",
          err,
        );
      }
    }

    return true; // Fail open — generate anyway if API fails
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
    tournaments: Array<{
      name: string;
      level: string;
      description: string;
      ageGroup: string;
      prerequisiteId?: string;
      prerequisiteName?: string;
      prerequisiteGuide?: string[];
      documentChecklist?: string[];
    }>;
    scholarships: Array<{
      name: string;
      provider: string;
      description: string;
      eligibility: string;
      prerequisiteId?: string;
      prerequisiteName?: string;
      prerequisiteGuide?: string[];
      documentChecklist?: string[];
    }>;
    universities: Array<{
      name: string;
      location: string;
      admissionCriteria: string;
      sportsQuotaDetails: string;
      prerequisiteId?: string;
      prerequisiteName?: string;
      prerequisiteGuide?: string[];
      documentChecklist?: string[];
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
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-3.1-flash-lite",
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
          Array.isArray(parsed.tournaments) &&
          Array.isArray(parsed.scholarships) &&
          Array.isArray(parsed.universities) &&
          Array.isArray(parsed.equipment) &&
          Array.isArray(parsed.careers)
        ) {
          return parsed;
        }
      } catch (error) {
        console.error(`[PathwayService] Error with model ${modelName}:`, error);
        // Try next model if available
      }
    }

    console.error(
      `[PathwayService] All Gemini models failed to generate pathway.`,
    );
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
      tournaments: Array<any>;
      scholarships: Array<any>;
      universities: Array<any>;
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
      tournaments: data.tournaments || [],
      scholarships: data.scholarships || [],
      universities: data.universities || [],
      equipment: data.equipment || [],
      careers: data.careers || [],
      isVerified: false,
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
