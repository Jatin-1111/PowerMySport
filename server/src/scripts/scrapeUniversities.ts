import { realDataScraperService } from "../shared/services/RealDataScraperService";
import { runForEverySport } from "./_realDataScraperRunner";

async function scrapeUniversities() {
  await runForEverySport("University scraper", (sport) =>
    realDataScraperService.scrapeUniversitiesForSport({
      sportSlug: sport.slug,
      sportName: sport.name,
    }),
  );
}

// Allow running directly: npx ts-node src/scripts/scrapeUniversities.ts
if (require.main === module) {
  scrapeUniversities();
}

export { scrapeUniversities };
