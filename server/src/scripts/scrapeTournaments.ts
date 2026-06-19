import axios from "axios";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { SportPathway } from "../shared/models/SportPathway";

dotenv.config();

// Dynamic DB Fetching used instead of static SPORTS_TO_SCRAPE

async function fetchMockHtml(sport: any) {
  // In a real scenario, this would dynamically determine URL or logic based on the sport
  if (sport.slug === "tennis") {
    return `
      <div class="tournament-row">
        <div class="name">${sport.governingBody} Championship Series (CS7)</div>
        <div class="dates">Oct 12 - Oct 16</div>
        <div class="location">New Delhi</div>
        <div class="age">U-14</div>
      </div>
      <div class="tournament-row">
        <div class="name">${sport.governingBody} Super Series (SS)</div>
        <div class="dates">Nov 01 - Nov 05</div>
        <div class="location">Mumbai</div>
        <div class="age">U-16</div>
      </div>
    `;
  } else if (sport.slug === "cricket") {
    return `
      <div class="tournament-row">
        <div class="name">${sport.governingBody} Vinoo Mankad Trophy</div>
        <div class="dates">Dec 01 - Dec 15</div>
        <div class="location">Various</div>
        <div class="age">U-19</div>
      </div>
      <div class="tournament-row">
        <div class="name">${sport.governingBody} Vijay Merchant Trophy</div>
        <div class="dates">Jan 10 - Jan 25</div>
        <div class="location">Various</div>
        <div class="age">U-16</div>
      </div>
    `;
  } else {
    return `
      <div class="tournament-row">
        <div class="name">${sport.governingBody} National Ranking Tournament</div>
        <div class="dates">Sep 15 - Sep 20</div>
        <div class="location">Hyderabad</div>
        <div class="age">U-15</div>
      </div>
    `;
  }
}

async function extractTournamentsWithAI(html: string, sport: any) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.warn(
      "⚠️ No GEMINI_API_KEY or GOOGLE_API_KEY found. Falling back to simple regex matching (Mock Mode).",
    );
    return fallbackExtraction(html, sport);
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });

    const prompt = `
      You are a web scraping assistant. I will provide you with the raw HTML/text of a sports tournament webpage.
      Extract all upcoming tournaments and return them as a JSON array of objects.
      Each object must have exactly these keys:
      - name (string)
      - level (string: e.g. "National", "State", "Grassroots", "Championship Series")
      - description (string: brief description, include the location)
      - ageGroup (string: e.g. "U-14", "U-16", "Open")

      Raw Webpage Text:
      ${html}
    `;

    const result = await genAI.models.generateContent({
      model: "gemma-4-31b-it",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    const text = (result.text ?? "").trim();

    // Clean up markdown formatting if any
    const jsonText = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(jsonText);

    if (Array.isArray(parsed)) {
      return parsed.map((t) => ({
        ...t,
        prerequisiteId: sport.prerequisiteId,
        prerequisiteName: sport.prerequisiteName,
      }));
    }
    return fallbackExtraction(html, sport);
  } catch (error) {
    console.error(`AI Extraction failed for ${sport.name}:`, error);
    return fallbackExtraction(html, sport);
  }
}

// Simple fallback if AI fails or key is missing
function fallbackExtraction(html: string, sport: any) {
  const scrapedTournaments: any[] = [];
  // Dummy logic: Extract basic rows from the mock HTML
  const matches = html.match(
    /<div class="name">(.*?)<\/div>[\s\S]*?<div class="location">(.*?)<\/div>[\s\S]*?<div class="age">(.*?)<\/div>/g,
  );

  if (matches) {
    matches.forEach((match) => {
      const nameMatch = match.match(/<div class="name">(.*?)<\/div>/);
      const locMatch = match.match(/<div class="location">(.*?)<\/div>/);
      const ageMatch = match.match(/<div class="age">(.*?)<\/div>/);

      if (nameMatch) {
        scrapedTournaments.push({
          name: nameMatch[1],
          level: "National",
          description: `Official tournament held at ${locMatch ? locMatch[1] : "TBD"}. Requires active ${sport.prerequisiteName}.`,
          ageGroup: ageMatch ? ageMatch[1] : "Open",
          prerequisiteId: sport.prerequisiteId,
          prerequisiteName: sport.prerequisiteName,
        });
      }
    });
  }
  return scrapedTournaments;
}

async function scrapeTournaments() {
  try {
    console.log("Connecting to database...");
    const dbUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/powermysport";
    await mongoose.connect(dbUri);
    console.log("Connected to MongoDB.");

    // Query all existing pathways instead of hardcoded array
    const pathways = await SportPathway.find({}).lean();

    if (!pathways || pathways.length === 0) {
      console.warn(
        "No sports pathways found in database. Please add a sport first.",
      );
      return;
    }

    for (const pathway of pathways as any[]) {
      const sportName = pathway.sportName || pathway.sportSlug;
      // Infer governing body from the National Level (level 4) or fallback
      const nationalLevel = pathway.levels?.find((l: any) => l.level === 4);
      const rawGoverningBody =
        nationalLevel?.governingBody || `${sportName} Federation`;

      // Clean governing body name for Prerequisite ID
      // If it's a long name like "All India Tennis Association", extract acronym "AITA"
      let governingBody = rawGoverningBody;
      const words = rawGoverningBody.split(" ");
      if (words.length > 2) {
        governingBody = words
          .map((w: string) => w[0])
          .join("")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase();
      } else {
        governingBody = words[0].replace(/[^a-zA-Z0-9]/g, "");
      }

      const sport = {
        slug: pathway.sportSlug,
        name: sportName,
        governingBody: governingBody,
        prerequisiteId: `${governingBody.toUpperCase()}_ID`,
        prerequisiteName: `${governingBody} Player ID`,
      };

      console.log(
        `\nFetching tournaments for ${sport.name} (${sport.governingBody})...`,
      );

      const html = await fetchMockHtml(sport);
      const scrapedTournaments = await extractTournamentsWithAI(html, sport);

      if (scrapedTournaments.length > 0) {
        console.log(
          `Scraped ${scrapedTournaments.length} tournaments for ${sport.name}. Updating database...`,
        );

        if (mongoose.connection.readyState === 1) {
          const pathway = await SportPathway.findOne({ sportSlug: sport.slug });

          if (pathway) {
            pathway.tournaments = [
              ...scrapedTournaments,
              ...pathway.tournaments.filter(
                (t: any) => !t.name.includes(sport.governingBody),
              ),
            ];
            await pathway.save();
            console.log(`Successfully updated ${sport.name} pathway.`);
          } else {
            console.log(
              `${sport.name} pathway not found in database. Skipping.`,
            );
          }
        } else {
          console.log(`Dry run data for ${sport.name}:`, scrapedTournaments);
        }
      } else {
        console.log(`No tournaments found for ${sport.name}.`);
      }
    }
  } catch (error) {
    console.error("Error during scraping process:", error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log("\nDisconnected from database.");
    }
  }
}

// Allow running directly
if (require.main === module) {
  scrapeTournaments();
}

export { scrapeTournaments };