import cron from "node-cron";
import { scrapeScholarships } from "../scripts/scrapeScholarships";
import { scrapeTournaments } from "../scripts/scrapeTournaments";
import { scrapeUniversities } from "../scripts/scrapeUniversities";
import { refreshAllCalendarSports } from "../shared/services/tournamentCalendarService";

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

  // Lane A: registry sports get dated tournament-edition extraction every
  // 2 days at 3:00 AM IST — dates change too fast for the weekly cadence.
  const calendarJob = cron.schedule(
    "0 3 */2 * *",
    async () => {
      console.log(
        `\n🗓 [${new Date().toISOString()}] Running tournament calendar (Lane A) refresh...`,
      );
      try {
        const results = await refreshAllCalendarSports();
        for (const r of results) {
          console.log(
            `  ${r.sportSlug}: ${r.upserted} editions upserted, ${r.warnings.length} warnings`,
          );
        }
      } catch (error) {
        console.error("❌ Tournament calendar refresh failed:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  console.log(
    "✅ Scraper scheduler initialized (weekly: 0 2 * * 0, calendar: 0 3 */2 * *)",
  );
  return { job, calendarJob };
}
