import { realDataScraperService } from "../shared/services/RealDataScraperService";
import { runForEverySport } from "./_realDataScraperRunner";

async function scrapeScholarships() {
  await runForEverySport("Scholarship scraper", (sport) =>
    realDataScraperService.scrapeScholarshipsForSport({
      sportSlug: sport.slug,
      sportName: sport.name,
    }),
  );
}

// Allow running directly: npx ts-node src/scripts/scrapeScholarships.ts
if (require.main === module) {
  scrapeScholarships();
}

export { scrapeScholarships };
