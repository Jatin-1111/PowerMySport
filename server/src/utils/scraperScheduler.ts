import cron from "node-cron";
import { bootFact } from "./boot";
import { scrapeScholarships } from "../scripts/scrapeScholarships";
import { scrapeTournaments } from "../scripts/scrapeTournaments";
import { scrapeUniversities } from "../scripts/scrapeUniversities";
import { log as __rootLog } from "./logger";
const log = __rootLog.child("scraper");

/**
 * The legacy weekly scrapers (Tournament, Scholarship, University) write free
 * text found by an AI web search into the one database, which is production. A
 * developer's machine is pointed at that same database, so a dev server left
 * running over a Sunday 02:00 IST used to run them against production, the same
 * class of mistake as the August incident where a dev server's cron ingested
 * rankings into production.
 *
 * So it runs only when `NODE_ENV` is "production", or when `SCRAPER_CRON=on`
 * asks for it by name. `SCRAPER_CRON_DISABLED=true` turns it off even then. This
 * is the same rule the AITA, ranking-digest and opportunity jobs already follow.
 */
export function initializeScraperScheduler() {
  const wanted = process.env.NODE_ENV === "production" || process.env.SCRAPER_CRON === "on";
  if (!wanted || process.env.SCRAPER_CRON_DISABLED === "true") {
    bootFact("jobs", "scrapers off");
    return { job: null };
  }

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
