import { Sport, SportDocument } from "../models/Sport";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export class SportsService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    if (GEMINI_API_KEY) {
      try {
        this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        console.log("✅ Gemini API initialized successfully");
      } catch (error) {
        console.error("❌ Failed to initialize Gemini API:", error);
      }
    } else {
      console.warn("⚠️ GEMINI_API_KEY not found in environment variables");
    }
  }

  /**
   * Get all available sports
   */
  async getAllSports(): Promise<SportDocument[]> {
    try {
      return await Sport.find({ isVerified: true }).sort({ name: 1 });
    } catch (error) {
      console.error("Error fetching sports:", error);
      throw new Error("Failed to fetch sports");
    }
  }

  /**
   * Search sports by name (fuzzy match)
   */
  async searchSports(query: string): Promise<SportDocument[]> {
    try {
      const regex = new RegExp(query, "i"); // case-insensitive
      return await Sport.find({
        isVerified: true,
        $or: [{ name: regex }, { slug: regex }],
      })
        .sort({ name: 1 })
        .limit(20);
    } catch (error) {
      console.error("Error searching sports:", error);
      throw new Error("Failed to search sports");
    }
  }

  /**
   * Verify a custom sport using Gemini API
   */
  async verifySportWithGemini(sportName: string): Promise<{
    isValid: boolean;
    message: string;
  }> {
    if (!this.genAI) {
      return {
        isValid: false,
        message: "Sport verification is currently unavailable",
      };
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

      const prompt = `You are a sports expert. Determine if the following is a real sport or athletic activity that can be taught or coached.

Sport name: "${sportName}"

Respond with a JSON object only (no markdown, no explanation):
{
  "isValid": boolean (true if it's a real sport/athletic activity, false otherwise),
  "explanation": "Brief reason why it is or isn't a sport"
}

Examples of valid sports: Cricket, Football, Badminton, Tennis, Yoga, CrossFit, Parkour, Pilates, Drone Racing, E-Sports
Examples of invalid: "xyz123", "not a sport", nonsensical words`;

      console.log(`🔍 Verifying sport: "${sportName}"`);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      console.log(`✅ Gemini response: ${text}`);

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`⚠️ Could not parse JSON from Gemini response`);
        return {
          isValid: false,
          message: "Could not verify sport",
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`✅ Sport "${sportName}" verification result:`, parsed);
      return {
        isValid: parsed.isValid,
        message: parsed.explanation,
      };
    } catch (error) {
      console.error(`❌ Error verifying sport "${sportName}":`, error);
      return {
        isValid: false,
        message: "Error verifying sport",
      };
    }
  }

  /**
   * Add a custom sport (after verification)
   */
  async addCustomSport(
    sportName: string,
    coachId: string,
    isVerified: boolean = true,
  ): Promise<SportDocument> {
    try {
      // Check if sport already exists
      const existing = await Sport.findOne({
        slug: sportName.toLowerCase().replace(/\s+/g, "-"),
      });

      if (existing) {
        return existing;
      }

      const sport = new Sport({
        name: sportName,
        slug: sportName.toLowerCase().replace(/\s+/g, "-"),
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
        addedBy: coachId,
      });

      return await sport.save();
    } catch (error) {
      console.error("Error adding custom sport:", error);
      throw new Error("Failed to add custom sport");
    }
  }

  /**
   * Get sport by name
   */
  async getSportByName(name: string): Promise<SportDocument | null> {
    try {
      return await Sport.findOne({
        slug: name.toLowerCase().replace(/\s+/g, "-"),
      });
    } catch (error) {
      console.error("Error getting sport:", error);
      return null;
    }
  }
}

export const sportsService = new SportsService();
