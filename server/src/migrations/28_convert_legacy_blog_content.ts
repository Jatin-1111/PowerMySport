import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { BlogPost } from "../community/models/BlogPost";
import { toContentHtml } from "../community/services/BlogService";

/**
 * Migration 28: convert legacy block-array blog content to Tiptap HTML.
 *
 * Posts written before the Tiptap editor stored `content` as an array of
 * blocks. BlogService has always converted those to HTML on read, so they
 * render correctly and nobody had a reason to migrate the stored shape —
 * that was a deliberate choice, recorded in the comment above
 * `legacyBlocksToHtml`.
 *
 * The reason changed. A MongoDB text index only indexes string values, so
 * migration 27's widened blog index does nothing for a post whose `content`
 * is an array: its body stays unsearchable no matter what the index covers.
 * Converting the stored shape is the only way those posts join search.
 *
 * ── Why this cannot change what a reader sees ────────────────────────────────
 * The conversion uses `toContentHtml`, the same function BlogService already
 * applies on every read. After the migration, `content` holds exactly the
 * string that used to be produced on the fly, so the rendered output is
 * byte-identical. Re-implementing the conversion here would be the one way to
 * get that wrong.
 *
 * ── Reversibility ────────────────────────────────────────────────────────────
 * HTML cannot be turned back into blocks, so there is no `down`. Instead every
 * applied run writes the original documents to migration-reports/ first, and
 * refuses to proceed if it cannot. Restoring is `--restore <file>`.
 *
 * Idempotent: posts whose content is already a string are skipped, so a second
 * run converts nothing.
 *
 * USAGE
 *   npm run migrate:blog-content                       # dry run (default)
 *   npm run migrate:blog-content -- --apply            # convert
 *   npm run migrate:blog-content -- --restore <file>   # put the blocks back
 */

interface Options {
  apply?: boolean;
  restore?: string;
}

const REPORT_DIR = path.resolve(process.cwd(), "migration-reports");

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 28: convert legacy blog content (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  const collection = BlogPost.collection;
  const all = await collection.find({}).toArray();
  const legacy = all.filter((doc) => typeof doc.content !== "string");

  console.log(`  blog posts:            ${all.length}`);
  console.log(`  already HTML strings:  ${all.length - legacy.length}`);
  console.log(`  legacy block arrays:   ${legacy.length}`);

  if (legacy.length === 0) {
    console.log("  nothing to convert.");
    return;
  }

  let emptyResults = 0;
  for (const doc of legacy) {
    const html = toContentHtml(doc.content);
    if (!html.trim()) {
      emptyResults += 1;
      console.log(`  ! "${doc.title}" converts to empty HTML — will be skipped`);
      continue;
    }
    console.log(
      `  "${String(doc.title).slice(0, 34)}" ${
        Array.isArray(doc.content) ? doc.content.length : "?"
      } blocks -> ${html.length} chars`,
    );
  }

  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }

  // The blocks are unrecoverable once overwritten, so the backup is a
  // precondition, not a nicety.
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(REPORT_DIR, `28-legacy-blog-content-${stamp}.json`);
  fs.writeFileSync(backup, JSON.stringify(legacy, null, 2));
  if (!fs.existsSync(backup)) {
    throw new Error("Refusing to convert: the backup was not written");
  }
  console.log(`  backup written: ${backup}`);

  let converted = 0;
  for (const doc of legacy) {
    const html = toContentHtml(doc.content);
    // An empty conversion would blank the post; leave it as blocks so it keeps
    // rendering through the read-time shim and can be looked at by hand.
    if (!html.trim()) {
      continue;
    }
    await collection.updateOne({ _id: doc._id }, { $set: { content: html } });
    converted += 1;
  }

  console.log(`  converted: ${converted}`);
  if (emptyResults) {
    console.log(`  left as blocks (empty conversion): ${emptyResults}`);
  }
  console.log("Migration 28 complete.");
};

/** Put the original block arrays back from a backup written by `up`. */
export const restore = async (file: string, apply: boolean) => {
  const docs = JSON.parse(fs.readFileSync(file, "utf8")) as {
    _id: string;
    title?: string;
    content: unknown;
  }[];
  console.log(
    `Restoring ${docs.length} posts from ${file} (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }

  for (const doc of docs) {
    await BlogPost.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(String(doc._id)) },
      { $set: { content: doc.content } },
    );
  }
  console.log("Restore complete.");
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const restoreIndex = argv.indexOf("--restore");
  const restoreFile = restoreIndex >= 0 ? argv[restoreIndex + 1] : undefined;

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() =>
      restoreFile ? restore(restoreFile, apply) : up({ apply }),
    )
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 28 failed:", error);
      process.exit(1);
    });
}
