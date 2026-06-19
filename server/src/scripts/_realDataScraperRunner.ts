import mongoose from "mongoose";
import dotenv from "dotenv";
import { Sport } from "../shared/models/Sport";

dotenv.config();

function getCliFlag(name: string): string | undefined {
  const exactPrefix = `--${name}=`;
  const npmConfigName = `npm_config_${name.toLowerCase().replace(/-/g, "_")}`;

  const envValue = process.env[npmConfigName];
  if (envValue) {
    return envValue;
  }

  const argIndex = process.argv.findIndex((arg) => arg === `--${name}`);

  if (argIndex >= 0) {
    const value = process.argv[argIndex + 1];
    if (value && !value.startsWith("--")) {
      return value;
    }
  }

  const valueArg = process.argv.find((arg) => arg.startsWith(exactPrefix));
  return valueArg ? valueArg.slice(exactPrefix.length) : undefined;
}

function resolveSportFilter(): string | undefined {
  return (
    getCliFlag("sport") || getCliFlag("sportSlug") || getCliFlag("sport-slug")
  );
}

/**
 * Connects to MongoDB, fetches every known sport from the canonical Sport
 * collection, and runs `handler` for each one sequentially (sequential, not
 * parallel, to stay within Gemini rate limits during a full scraper pass).
 */
export async function runForEverySport(
  label: string,
  handler: (sport: { slug: string; name: string }) => Promise<number>,
): Promise<void> {
  console.log(`🚀 Starting ${label}...`);
  const sportFilter = resolveSportFilter()?.trim().toLowerCase();

  const dbUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/powermysport";

  await mongoose.connect(dbUri);
  console.log("✅ Connected to MongoDB");

  const sports = await Sport.find({}).select("slug name").lean();

  if (!sports || sports.length === 0) {
    console.warn(
      "⚠️ No sports found in the Sport collection. Nothing to scrape.",
    );
    await mongoose.disconnect();
    return;
  }

  const filteredSports = sportFilter
    ? sports.filter(
        (sport) =>
          sport.slug.toLowerCase() === sportFilter ||
          sport.name.toLowerCase() === sportFilter,
      )
    : sports;

  if (sportFilter && filteredSports.length === 0) {
    console.warn(
      `⚠️ No sport matched "${sportFilter}". Use a sport slug or exact sport name.`,
    );
    await mongoose.disconnect();
    return;
  }

  let totalFound = 0;

  for (const sport of filteredSports as Array<{ slug: string; name: string }>) {
    console.log(`\n🔍 ${label}: ${sport.name} (${sport.slug})`);
    try {
      const count = await handler({ slug: sport.slug, name: sport.name });
      totalFound += count;
      console.log(`   → ${count} real result(s) found and upserted.`);
    } catch (error) {
      console.error(`   ❌ Failed for ${sport.name}:`, error);
    }
  }

  console.log(
    `\n🏁 ${label} complete. ${totalFound} total result(s) across ${filteredSports.length} sport(s).`,
  );

  await mongoose.disconnect();
}
