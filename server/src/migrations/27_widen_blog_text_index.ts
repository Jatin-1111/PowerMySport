import "dotenv/config";
import mongoose from "mongoose";
import { BlogPost } from "../community/models/BlogPost";

/**
 * Migration 27: rebuild the blog text index so it covers the article body.
 *
 * The old index was { title, excerpt, tags }. Searching for a phrase that
 * appears in a post returned nothing unless it also happened to sit in the
 * title or excerpt — which is most of what people actually search for.
 *
 * ── Why this needs a migration and not just a model edit ─────────────────────
 * MongoDB permits exactly ONE text index per collection. Mongoose's autoIndex
 * is on (see config/database.ts), so on the next deploy it would try to build
 * the new index next to the old one, MongoDB would reject it with an
 * IndexOptionsConflict, and the failure would be logged and forgotten — the
 * app would keep running against the narrow index with nobody the wiser.
 *
 * ── Cost ─────────────────────────────────────────────────────────────────────
 * MongoDB permits only one text index, so the old one must be dropped before
 * the new one is built. In that window a `$text` query on blogs does NOT fall
 * back to a scan — MongoDB rejects it — so blog search returns nothing until
 * the build finishes. (searchCommunity degrades per-collection rather than
 * failing the request, so questions keep working meanwhile.) The new index
 * covers full article bodies and is therefore larger than the old one. Run it
 * during a quiet window; the dry run reports the document count so that size
 * is a decision rather than a surprise.
 *
 * ── A limit worth knowing ────────────────────────────────────────────────────
 * A text index only indexes string values. Posts still stored in the legacy
 * block-editor format keep `content` as an array of blocks, so widening the
 * index does nothing for them — their bodies stay unsearchable until that
 * content is converted to the Tiptap HTML string format.
 *
 * Idempotent: the target index is named, so a second run sees it already
 * present and does nothing.
 *
 * USAGE
 *   npm run migrate:blog-search                 # dry run (default)
 *   npm run migrate:blog-search -- --apply      # drop old, build new
 *   npm run migrate:blog-search -- --down --apply   # back to the narrow index
 */

const NEW_INDEX_NAME = "blog_search_v2";

const NEW_INDEX_SPEC = {
  title: "text",
  excerpt: "text",
  tags: "text",
  content: "text",
} as const;

const NEW_INDEX_WEIGHTS = { title: 10, tags: 6, excerpt: 4, content: 1 };

const OLD_INDEX_SPEC = {
  title: "text",
  excerpt: "text",
  tags: "text",
} as const;

interface Options {
  apply?: boolean;
}

const findTextIndexes = async () => {
  const collection = BlogPost.collection;
  const indexes = await collection.indexes();
  return indexes.filter((index) =>
    Object.values(index.key || {}).includes("text"),
  );
};

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 27: widen blog text index (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  const collection = BlogPost.collection;
  const total = await collection.countDocuments();
  const textIndexes = await findTextIndexes();

  console.log(`  blog documents to index: ${total}`);
  console.log(
    `  existing text indexes:   ${
      textIndexes.map((index) => index.name).join(", ") || "none"
    }`,
  );

  if (textIndexes.some((index) => index.name === NEW_INDEX_NAME)) {
    console.log("  already on the wide index — nothing to do.");
    return;
  }

  if (!apply) {
    console.log(
      `  would drop ${textIndexes.length} text index(es) and build ${NEW_INDEX_NAME}`,
    );
    console.log("Dry run complete — re-run with --apply.");
    return;
  }

  // Drop first: MongoDB refuses a second text index, so these cannot overlap.
  // Blog `$text` queries are rejected in this window, not slowed — blog
  // results are simply absent until the build below finishes.
  for (const index of textIndexes) {
    if (index.name) {
      console.log(`  dropping ${index.name}...`);
      await collection.dropIndex(index.name);
    }
  }

  console.log(`  building ${NEW_INDEX_NAME}...`);
  await collection.createIndex(NEW_INDEX_SPEC, {
    name: NEW_INDEX_NAME,
    weights: NEW_INDEX_WEIGHTS,
  });

  console.log("Migration 27 complete.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Reverting migration 27 (${apply ? "APPLY" : "DRY RUN"}) — narrowing the blog text index...`,
  );

  const collection = BlogPost.collection;
  const textIndexes = await findTextIndexes();

  if (!apply) {
    console.log(
      `  would drop ${textIndexes.length} text index(es) and restore the title/excerpt/tags index`,
    );
    return;
  }

  for (const index of textIndexes) {
    if (index.name) {
      await collection.dropIndex(index.name);
    }
  }

  await collection.createIndex(OLD_INDEX_SPEC);
  console.log("Revert complete.");
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };
  const isDown = argv.includes("--down");

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => (isDown ? down(options) : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 27 failed:", error);
      process.exit(1);
    });
}
