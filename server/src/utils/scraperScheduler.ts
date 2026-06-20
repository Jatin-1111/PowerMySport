import cron from "node-cron";
import { scrapeScholarships } from "../scripts/scrapeScholarships";
import { scrapeTournaments } from "../scripts/scrapeTournaments";
import { scrapeUniversities } from "../scripts/scrapeUniversities";

export function initializeScraperScheduler() {
  console.log("📅 Initializing scraper scheduler...");

  // Run every Sunday at 2:00 AM
  const job = cron.schedule(
    "0 2 * * 0",
    async () => {
      console.log(
        `\n🔔 [${new Date().toISOString()}] Running scheduled scraper bots...`,
      );

      const scrapers: Array<{ name: string; fn: () => Promise<void> }> = [
        { name: "Tournament", fn: scrapeTournaments },
        { name: "Scholarship", fn: scrapeScholarships },
        { name: "University", fn: scrapeUniversities },
      ];

      for (const { name, fn } of scrapers) {
        try {
          console.log(`▶ Running ${name} scraper...`);
          await fn();
          console.log(`✅ ${name} scraper complete.`);
        } catch (error) {
          console.error(`❌ ${name} scraper failed:`, error);
        }
      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  console.log("✅ Scraper scheduler initialized (cron: 0 2 * * 0)");
  return job;
}
