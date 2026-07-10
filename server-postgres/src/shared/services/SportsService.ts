import type { Sport } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import prisma from "../../lib/prisma";
import { buildSafeSearchRegexSource } from "../../utils/regex";
import redis from "../../config/redis";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const toSlug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

export class SportsService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    if (GEMINI_API_KEY) {
      try {
        this.genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
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
  async getAllSports(): Promise<Sport[]> {
    try {
      return await prisma.sport.findMany({
        where: { isVerified: true },
        orderBy: { name: "asc" },
      });
    } catch (error) {
      console.error("Error fetching sports:", error);
      throw new Error("Failed to fetch sports");
    }
  }

  /**
   * Search sports by name (fuzzy match).
   *
   * NOTE (behavioral change): the Mongo version built a sanitized RegExp to
   * guard against ReDoS on this public endpoint. Postgres `contains` compiles
   * to a parameterized ILIKE, so there is no regex engine to attack — but we
   * still length-cap the input via buildSafeSearchRegexSource() and pass the
   * plain (regex-free) term, preserving the same length ceiling. `%`/`_` are
   * treated literally by Prisma's `contains`, so no wildcard injection either.
   */
  async searchSports(query: string): Promise<Sport[]> {
    try {
      // Reuse the existing helper only for its length-capping + trimming; strip
      // the regex-escaping so we search on the raw (capped) term.
      const term = buildSafeSearchRegexSource(query)
        .replace(/\\/g, "")
        .slice(0, 100);
      return await prisma.sport.findMany({
        where: {
          isVerified: true,
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { slug: { contains: term, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take: 20,
      });
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
      const result = await this.genAI.models.generateContent({
        model: "gemma-4-31b-it",
        contents: prompt,
      });
      const text = result.text ?? "";

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
  ): Promise<Sport> {
    try {
      const slug = toSlug(sportName);

      // Check if sport already exists
      const existing = await prisma.sport.findUnique({ where: { slug } });

      if (existing) {
        return existing;
      }

      const sport = await prisma.sport.create({
        data: {
          name: sportName,
          slug,
          isVerified,
          verifiedAt: isVerified ? new Date() : null,
          addedBy: coachId,
        },
      });

      // Invalidate the cached /sports listing + search results so the new
      // sport shows up immediately instead of waiting out the 1-hour TTL.
      if (isVerified) {
        await this.invalidateSportsCache();
      }

      return sport;
    } catch (error) {
      console.error("Error adding custom sport:", error);
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
      console.warn("Failed to invalidate sports cache:", error);
    }
  }

  /**
   * Get sport by name
   */
  async getSportByName(name: string): Promise<Sport | null> {
    try {
      return await prisma.sport.findUnique({ where: { slug: toSlug(name) } });
    } catch (error) {
      console.error("Error getting sport:", error);
      return null;
    }
  }
}

export const sportsService = new SportsService();
