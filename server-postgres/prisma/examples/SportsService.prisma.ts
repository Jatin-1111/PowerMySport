/**
 * ============================================================================
 * REFERENCE PORT — SportsService  (Mongoose  ->  Prisma)
 * ============================================================================
 * This is the canonical worked example referenced by prisma/PORTING_GUIDE.md.
 * It is the 1:1 Prisma port of src/shared/services/SportsService.ts. Drop this
 * in over the original once `prisma generate` has produced the client, then
 * delete this example. The public method signatures and return shapes are
 * preserved so controllers/routes require NO changes.
 *
 * Key translations demonstrated here:
 *   Sport.find({ isVerified:true }).sort({name:1}).lean()
 *     -> prisma.sport.findMany({ where:{isVerified:true}, orderBy:{name:'asc'} })
 *   $or:[{name:regex},{slug:regex}]  (Mongo regex)
 *     -> OR:[{name:{contains,mode:'insensitive'}}, {slug:{...}}]  (Postgres ILIKE)
 *   Sport.findOne({ slug })  -> prisma.sport.findUnique({ where:{slug} })
 *   new Sport({...}).save()   -> prisma.sport.create({ data:{...} })
 * ============================================================================
 */
import type { Sport } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import prisma from "../../src/lib/prisma";
import { buildSafeSearchRegexSource } from "../../src/utils/regex";
import redis from "../../src/config/redis";

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

  /** Get all verified sports (ordered by name). */
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
   * Search sports by name/slug (case-insensitive contains).
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
      const term = buildSafeSearchRegexSource(query).replace(/\\/g, "").slice(0, 100);
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

  async verifySportWithGemini(
    sportName: string,
  ): Promise<{ isValid: boolean; message: string }> {
    if (!this.genAI) {
      return { isValid: false, message: "Sport verification is currently unavailable" };
    }
    try {
      const prompt = `You are a sports expert. Determine if the following is a real sport or athletic activity that can be taught or coached.\n\nSport name: "${sportName}"\n\nRespond with a JSON object only (no markdown, no explanation):\n{\n  "isValid": boolean,\n  "explanation": "Brief reason"\n}`;
      const result = await this.genAI.models.generateContent({
        model: "gemma-4-31b-it",
        contents: prompt,
      });
      const text = result.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { isValid: false, message: "Could not verify sport" };
      const parsed = JSON.parse(jsonMatch[0]);
      return { isValid: parsed.isValid, message: parsed.explanation };
    } catch (error) {
      console.error(`❌ Error verifying sport "${sportName}":`, error);
      return { isValid: false, message: "Error verifying sport" };
    }
  }

  /** Add a custom sport (upsert-by-slug). */
  async addCustomSport(
    sportName: string,
    coachId: string,
    isVerified = true,
  ): Promise<Sport> {
    try {
      const slug = toSlug(sportName);

      const existing = await prisma.sport.findUnique({ where: { slug } });
      if (existing) return existing;

      const sport = await prisma.sport.create({
        data: {
          name: sportName,
          slug,
          isVerified,
          verifiedAt: isVerified ? new Date() : null,
          addedBy: coachId,
        },
      });

      if (isVerified) await this.invalidateSportsCache();
      return sport;
    } catch (error) {
      console.error("Error adding custom sport:", error);
      throw new Error("Failed to add custom sport");
    }
  }

  private async invalidateSportsCache(): Promise<void> {
    try {
      const keys = await redis.keys("cache:/api/sports*");
      if (keys.length) await redis.del(...keys);
    } catch (error) {
      console.warn("Failed to invalidate sports cache:", error);
    }
  }

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
