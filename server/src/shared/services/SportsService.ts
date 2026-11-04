import { Sport, SportDocument } from "../models/Sport";
import { Venue } from "../../client/models/Venue";
import { Coach } from "../../client/models/Coach";
import { Expert } from "../../client/models/ExpertProfile";
import Academy from "../../admin/models/Academy";
import { SUPPORTED_SPORTS } from "../constants/supportedSports";
import { GoogleGenAI } from "@google/genai";
import { buildSafeSearchRegexSource } from "../../utils/regex";
import { bootFact } from "../../utils/boot";
import redis from "../../config/redis";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("sports");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export class SportsService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    if (GEMINI_API_KEY) {
      try {
        this.genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        bootFact("ai", "gemini");
      } catch (error) {
        log.error("Failed to initialize Gemini API:", error);
      }
    } else {
      log.warn("GEMINI_API_KEY not found in environment variables");
    }
  }

  /**
   * The sports parents can filter by: the supported sports, plus any other
   * directory sport that a listed provider (approved venue, verified coach,
   * active expert, live academy) really offers, so nobody becomes unfindable.
   * Free-text sports that are not in the directory are ignored.
   */
  async getDiscoverySports(): Promise<{ name: string; slug: string; supported: boolean }[]> {
    const [directory, ...used] = await Promise.all([
      Sport.find({ isVerified: true }).select("name slug").lean(),
      Venue.distinct("sports", { approvalStatus: "APPROVED" }),
      Coach.distinct("sports", { verificationStatus: "VERIFIED", isVerified: true }),
      Expert.distinct("sports", { isActive: true }),
      Academy.distinct("sports", { isApproved: true, kycVerified: true, isActive: true }),
    ]);

    const byName = new Map(directory.map((s) => [s.name.trim().toLowerCase(), s]));
    const result = new Map<string, { name: string; slug: string; supported: boolean }>();

    for (const sport of SUPPORTED_SPORTS) {
      result.set(sport.name.toLowerCase(), { name: sport.name, slug: sport.slug, supported: true });
    }
    for (const raw of used.flat() as string[]) {
      const key = String(raw).trim().toLowerCase();
      const known = byName.get(key);
      if (known && !result.has(key)) {
        result.set(key, { name: known.name, slug: known.slug, supported: false });
      }
    }

    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get all available sports
   */
  async getAllSports(): Promise<SportDocument[]> {
    try {
      return await Sport.find({ isVerified: true }).sort({ name: 1 }).lean();
    } catch (error) {
      log.error("Error fetching sports:", error);
      throw new Error("Failed to fetch sports");
    }
  }

  /**
   * Search sports by name (fuzzy match)
   */
  async searchSports(query: string): Promise<SportDocument[]> {
    try {
      // Escape + length-cap the (unauthenticated) user input before building a
      // regex to prevent regex injection and ReDoS DoS on this public endpoint.
      const regex = new RegExp(buildSafeSearchRegexSource(query), "i");
      return await Sport.find({
        isVerified: true,
        $or: [{ name: regex }, { slug: regex }],
      })
        .sort({ name: 1 })
        .limit(20)
        .lean();
    } catch (error) {
      log.error("Error searching sports:", error);
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
      const prompt = `You are a sports expert. Determine if the following is a real sport or athletic activity that can be taught or coached.

Sport name: "${sportName}"

Respond with a JSON object only (no markdown, no explanation):
{
  "isValid": boolean (true if it's a real sport/athletic activity, false otherwise),
  "explanation": "Brief reason why it is or isn't a sport"
}

Examples of valid sports: Cricket, Football, Badminton, Tennis, Yoga, CrossFit, Parkour, Pilates, Drone Racing, E-Sports
Examples of invalid: "xyz123", "not a sport", nonsensical words`;

      log.info(`Verifying sport: "${sportName}"`);
      const result = await this.genAI.models.generateContent({
        model: "gemma-4-31b-it",
        contents: prompt,
      });
      const text = result.text ?? "";

      log.info(`Gemini response: ${text}`);

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log.warn(`Could not parse JSON from Gemini response`);
        return {
          isValid: false,
          message: "Could not verify sport",
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      log.info(`Sport "${sportName}" verification result:`, parsed);
      return {
        isValid: parsed.isValid,
        message: parsed.explanation,
      };
    } catch (error) {
      log.error(`Error verifying sport "${sportName}":`, error);
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
    isVerified: boolean = true
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

      const saved = await sport.save();

      // Invalidate the cached /sports listing + search results so the new
      // sport shows up immediately instead of waiting out the 1-hour TTL.
      if (isVerified) {
        await this.invalidateSportsCache();
      }

      return saved;
    } catch (error) {
      log.error("Error adding custom sport:", error);
      throw new Error("Failed to add custom sport");
    }
  }

  /**
   * Clears cached responses for the /sports listing and search endpoints.
   * Fails open — a Redis hiccup here should never block sport creation.
   */
  private async invalidateSportsCache(): Promise<void> {
    try {
      const keys = await redis.keys("cache:/api/sports*");
      if (keys.length) await redis.del(...keys);
    } catch (error) {
      log.warn("Failed to invalidate sports cache:", error);
    }
  }

  /**
   * Get sport by name
   */
  async getSportByName(name: string): Promise<SportDocument | null> {
    try {
      return await Sport.findOne({
        slug: name.toLowerCase().replace(/\s+/g, "-"),
      }).lean();
    } catch (error) {
      log.error("Error getting sport:", error);
      return null;
    }
  }
}

export const sportsService = new SportsService();
