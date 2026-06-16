import { GoogleGenerativeAI } from "@google/generative-ai";
import { Sport } from "../models/Sport";
import { SportPathway, SportPathwayDocument } from "../models/SportPathway";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

// ─── Helper ───────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPathwayPrompt(sportName: string): string {
  return `You are an expert Indian sports development consultant. Generate a detailed, accurate sports development pathway for "${sportName}" in India.

Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "sportName": "Proper name of the sport",
  "category": "One of: Ball Sports | Racquet Sports | Combat Sports | Water Sports | Winter Sports | Team Sports | Individual Sports | Fitness | Other",
  "overview": "2-3 sentences describing the sport and its development landscape in India",
  "governingBodyNational": "Name of the national governing body in India (e.g. BCCI for Cricket, BAI for Badminton)",
  "levels": [
    {
      "level": 1,
      "label": "Grassroots",
      "title": "Neighbourhood & Club Level",
      "description": "Detailed description of this stage in the Indian context (3-4 sentences)",
      "keyFocus": "Short phrase, e.g. 'Participation & Fundamentals'",
      "ageRange": "e.g. '5 – 14 years'",
      "competitions": "Key competitions at this level in India",
      "steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
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
  ]
}

Make all content specific to India's sports ecosystem, governing bodies, and actual competitions. Be accurate and informative.`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PathwayService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Main entry point: get pathway from DB or generate + cache it.
   */
  async getOrGeneratePathway(sportName: string): Promise<{
    pathway: SportPathwayDocument | null;
    source: "db" | "generated" | "not_a_sport";
    message?: string;
  }> {
    const slug = toSlug(sportName);

    // ── 1. Check cache ─────────────────────────────────────────────────────
    const existing = await SportPathway.findOne({ sportSlug: slug });
    if (existing) {
      // Bump lookup count (fire-and-forget)
      SportPathway.updateOne({ sportSlug: slug }, { $inc: { lookupCount: 1 } }).exec();
      return { pathway: existing, source: "db" };
    }

    // ── 2. Validate with existing Sport collection ─────────────────────────
    //    If the sport is already in our DB (verified), skip Gemini validation
    const knownSport = await Sport.findOne({ slug });

    // ── 3. Validate unknown sports via Gemini ──────────────────────────────
    if (!knownSport) {
      const isValid = await this.validateSport(sportName);
      if (!isValid) {
        return {
          pathway: null,
          source: "not_a_sport",
          message: `"${sportName}" does not appear to be a recognised sport or athletic activity.`,
        };
      }
    }

    // ── 4. Generate pathway with Gemini ────────────────────────────────────
    const generated = await this.generatePathway(sportName);
    if (!generated) {
      return {
        pathway: null,
        source: "not_a_sport",
        message: "Could not generate pathway for this sport at the moment.",
      };
    }

    // ── 5. Store in DB ─────────────────────────────────────────────────────
    const saved = await this.savePathway(slug, generated);
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
    if (!this.genAI) return true; // Allow if AI unavailable
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `Is "${sportName}" a real sport or athletic activity? Reply with only "yes" or "no".`;
      const result = await model.generateContent(prompt);
      const answer = result.response.text().trim().toLowerCase();
      return answer.startsWith("yes");
    } catch {
      return true; // Fail open — generate anyway
    }
  }

  private async generatePathway(sportName: string): Promise<{
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
  } | null> {
    if (!this.genAI) return null;

    const modelCandidates = [
      process.env.GEMINI_MODEL_NAME,
      "gemini-2.5-flash",
      "gemini-1.5-flash",
    ].filter(Boolean) as string[];

    for (const modelName of modelCandidates) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
        });

        const result = await model.generateContent(buildPathwayPrompt(sportName));
        const text = result.response.text().trim();

        // Strip any accidental markdown fences
        const jsonText = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
        const parsed = JSON.parse(jsonText);

        if (parsed && Array.isArray(parsed.levels) && parsed.levels.length === 5) {
          return parsed;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        // Try next model only on 404 (model not found)
        if (!msg.includes("404") && !msg.includes("not found")) throw err;
      }
    }
    return null;
  }

  private async savePathway(
    slug: string,
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
    },
  ): Promise<SportPathwayDocument> {
    const doc = new SportPathway({
      sportSlug: slug,
      sportName: data.sportName || slug,
      category: data.category || "Other",
      overview: data.overview || "",
      levels: data.levels,
      isVerified: false,
      lookupCount: 1,
    });
    return doc.save();
  }
}

export const pathwayService = new PathwayService();
