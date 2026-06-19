import { realDataScraperService } from "../shared/services/RealDataScraperService";
import { runForEverySport } from "./_realDataScraperRunner";

async function scrapeTournaments() {
  await runForEverySport("Tournament scraper", (sport) =>
    realDataScraperService.scrapeTournamentsForSport({
      sportSlug: sport.slug,
      sportName: sport.name,
    }),
  );
}

// Allow running directly: npx ts-node src/scripts/scrapeTournaments.ts
if (require.main === module) {
  scrapeTournaments();
}

export { scrapeTournaments };
