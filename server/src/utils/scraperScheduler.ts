import cron from "node-cron";
import { bootFact } from "./boot";
import { scrapeScholarships } from "../scripts/scrapeScholarships";
import { scrapeTournaments } from "../scripts/scrapeTournaments";
import { scrapeUniversities } from "../scripts/scrapeUniversities";
import { log as __rootLog } from "./logger";
const log = __rootLog.child("scraper");

export function initializeScraperScheduler() {
  // Run every Sunday at 2:00 AM
  const job = cron.schedule(
    "0 2 * * 0",
    async () => {
      log.info(`[${new Date().toISOString()}] Running scheduled scraper bots...`);

      const scrapers: Array<{ name: string; fn: () => Promise<void> }> = [
        { name: "Tournament", fn: scrapeTournaments },
        { name: "Scholarship", fn: scrapeScholarships },
        { name: "University", fn: scrapeUniversities },
      ];

      for (const { name, fn } of scrapers) {
        try {
          log.info(`Running ${name} scraper...`);
          await fn();
          log.info(`${name} scraper complete.`);
        } catch (error) {
          log.error(`${name} scraper failed:`, error);
        }
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  // Dated tournament-calendar extraction (TournamentEdition) is no longer a
  // cron job — it's now an admin-submitted-source + AI-extraction + review
  // flow (see dataSourceAdminController.ts / DataSourceExtractionService.ts).

  bootFact("jobs", "scrapers weekly");
  return { job };
}
