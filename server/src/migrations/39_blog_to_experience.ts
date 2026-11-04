import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 39: the blog becomes Experience.
 *
 * Parents told us "write a story" sounded like homework, and the thing they
 * actually wanted to share — how a tournament, an academy or a coach went — had
 * nowhere to live. Rather than add a second surface beside the blog, the blog
 * itself becomes Experience: shorter by default, optionally anchored to a real
 * tournament / venue / academy / coach, and surfaced on that subject's page.
 *
 * This migration moves the stored shape across. It does NOT touch
 * `client/models/Review.ts` — the booking-gated star rating on provider pages
 * is a different thing and stays exactly as it is.
 *
 * ── What it does ─────────────────────────────────────────────────────────────
 *  1. blogposts    -> experiences
 *     bloglikes    -> experiencelikes
 *     blogcomments -> experiencecomments
 *  2. experiencecomments.blogId   -> experienceId
 *  3. experiencelikes.targetType  "BLOG" -> "EXPERIENCE"
 *  4. experiences.topic -> sport + category, and backfill the new fields
 *     (subject, signals, attendedAt, moderationStatus)
 *  5. drop the indexes that referenced the fields that no longer exist, build
 *     the ones the new model declares
 *
 * ── Why the text index needs care ────────────────────────────────────────────
 * MongoDB permits exactly ONE text index per collection. `blog_search_v2`
 * survives the collection rename, so declaring `experience_search_v1` on the
 * model is not enough — Mongoose would try to build it alongside the old one,
 * MongoDB would reject the conflict with IndexOptionsConflict, and the failure
 * would be logged and forgotten while search quietly kept using the old index.
 * This is the same trap migration 27 was written for. Dropping first is the
 * only way. In that window an experience `$text` query returns nothing (Mongo
 * rejects it rather than falling back to a scan) — with 8 documents the rebuild
 * is instant, but that is why this is a migration and not a model edit.
 *
 * ── Why the indexes are built here rather than left to Mongoose ──────────────
 * `autoIndex` is off in production (config/database.ts), so a new index
 * declared on a model is never created on prod by itself.
 *
 * ── Ordering ─────────────────────────────────────────────────────────────────
 * Pushing to master auto-deploys the server. RUN THIS FIRST. The new code reads
 * `experiences`; if it deploys before this runs, the community blog reads an
 * empty collection.
 *
 * Idempotent: every step checks for its own result first, so a re-run on an
 * already-migrated database reports "nothing to do" and changes nothing.
 *
 * USAGE
 *   npm run migrate:experience                      # dry run (default)
 *   npm run migrate:experience -- --apply           # apply
 *   npm run migrate:experience -- --down --apply    # back to the blog shape
 */

interface Options {
  apply?: boolean;
}

const RENAMES: Array<[from: string, to: string]> = [
  ["blogposts", "experiences"],
  ["bloglikes", "experiencelikes"],
  ["blogcomments", "experiencecomments"],
];

/** The old `topic` field carried both of these at once. */
const SPORT_TOPICS = new Set([
  "Cricket",
  "Football",
  "Badminton",
  "Hockey",
  "Tennis",
  "Basketball",
  "Athletics",
  "Swimming",
  "Cycling",
]);

/**
 * Themed topics map onto a category. `nutrition` and `mindset` exist as
 * categories only because these posts do — dropping them would silently
 * relabel somebody's writing as "general".
 */
const TOPIC_TO_CATEGORY: Record<string, string> = {
  Fitness: "training",
  Training: "training",
  Nutrition: "nutrition",
  Mindset: "mindset",
  Recovery: "injury-recovery",
  Gear: "gear",
  General: "general",
};

const NEW_TEXT_INDEX = {
  name: "experience_search_v1",
  spec: {
    title: "text",
    excerpt: "text",
    tags: "text",
    "subject.nameSnapshot": "text",
    content: "text",
  } as const,
  weights: { title: 10, tags: 6, "subject.nameSnapshot": 6, excerpt: 4, content: 1 },
};

const OLD_TEXT_INDEX = {
  name: "blog_search_v2",
  spec: { title: "text", excerpt: "text", tags: "text", content: "text" } as const,
  weights: { title: 10, tags: 6, excerpt: 4, content: 1 },
};

const db = () => {
  const connection = mongoose.connection.db;
  if (!connection) throw new Error("Not connected to MongoDB");
  return connection;
};

const listCollections = async (): Promise<Set<string>> => {
  const names = await db().listCollections({}, { nameOnly: true }).toArray();
  return new Set(names.map((entry) => entry.name));
};

const indexNames = async (collection: string): Promise<Set<string>> => {
  const indexes = await db().collection(collection).indexes();
  return new Set(indexes.map((index) => index.name).filter(Boolean) as string[]);
};

const dropIfPresent = async (collection: string, names: string[], apply: boolean) => {
  const present = await indexNames(collection);
  for (const name of names) {
    if (!present.has(name)) continue;
    console.log(`  ${apply ? "dropping" : "would drop"} index ${collection}.${name}`);
    if (apply) await db().collection(collection).dropIndex(name);
  }
};

const createIfMissing = async (
  collection: string,
  name: string,
  spec: Record<string, unknown>,
  apply: boolean,
  extra: Record<string, unknown> = {}
) => {
  const present = await indexNames(collection);
  if (present.has(name)) return;
  console.log(`  ${apply ? "building" : "would build"} index ${collection}.${name}`);
  if (apply) {
    await db()
      .collection(collection)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .createIndex(spec as any, { name, ...extra });
  }
};

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Starting migration 39: blog -> experience (${apply ? "APPLY" : "DRY RUN"})...`);

  // ── 1. Rename the collections ───────────────────────────────────────────────
  let collections = await listCollections();
  for (const [from, to] of RENAMES) {
    if (collections.has(to)) {
      console.log(`  ${to} already exists — rename skipped.`);
      continue;
    }
    if (!collections.has(from)) {
      console.log(`  ${from} not found and ${to} absent — nothing to rename.`);
      continue;
    }
    const count = await db().collection(from).countDocuments();
    console.log(`  ${apply ? "renaming" : "would rename"} ${from} -> ${to} (${count} docs)`);
    if (apply) await db().collection(from).rename(to);
  }

  collections = await listCollections();
  if (!collections.has("experiences")) {
    console.log("  no experiences collection — stopping here.");
    if (!apply) console.log("Dry run complete — re-run with --apply.");
    return;
  }

  const experiences = db().collection("experiences");
  const comments = db().collection("experiencecomments");
  const likes = db().collection("experiencelikes");

  // ── 2. comments.blogId -> experienceId ──────────────────────────────────────
  const withBlogId = await comments.countDocuments({ blogId: { $exists: true } });
  console.log(`  comments still on blogId: ${withBlogId}`);
  if (apply && withBlogId > 0) {
    const result = await comments.updateMany(
      { blogId: { $exists: true } },
      { $rename: { blogId: "experienceId" } }
    );
    console.log(`    renamed on ${result.modifiedCount} comment(s).`);
  }

  // ── 3. likes.targetType BLOG -> EXPERIENCE ──────────────────────────────────
  const blogLikes = await likes.countDocuments({ targetType: "BLOG" });
  console.log(`  likes still on targetType BLOG: ${blogLikes}`);
  if (apply && blogLikes > 0) {
    const result = await likes.updateMany(
      { targetType: "BLOG" },
      { $set: { targetType: "EXPERIENCE" } }
    );
    console.log(`    updated ${result.modifiedCount} like(s).`);
  }

  // ── 4. topic -> sport + category, and the new fields ────────────────────────
  const withTopic = await experiences.find({ topic: { $exists: true } }).toArray();
  console.log(`  experiences still on topic: ${withTopic.length}`);

  if (withTopic.length > 0) {
    const tally = new Map<string, number>();
    for (const doc of withTopic) {
      const topic = typeof doc.topic === "string" ? doc.topic.trim() : "";
      const sport = SPORT_TOPICS.has(topic) ? topic : null;
      const category = sport ? "general" : TOPIC_TO_CATEGORY[topic] || "general";
      const key = `${topic || "(empty)"} -> sport:${sport ?? "—"} category:${category}`;
      tally.set(key, (tally.get(key) || 0) + 1);

      if (apply) {
        await experiences.updateOne(
          { _id: doc._id },
          { $set: { sport, category }, $unset: { topic: "" } }
        );
      }
    }
    for (const [line, count] of tally) console.log(`    ${line}  x${count}`);
  }

  // Backfill the fields the new model adds. `attendedAt` starts as the write
  // date: for a post written before the field existed that is the best evidence
  // we have of when the thing happened, and leaving it null would drop those
  // posts out of any date-ordered view.
  const needsBackfill = await experiences.countDocuments({
    moderationStatus: { $exists: false },
  });
  console.log(`  experiences needing new-field backfill: ${needsBackfill}`);
  if (apply && needsBackfill > 0) {
    const result = await experiences.updateMany({ moderationStatus: { $exists: false } }, [
      {
        $set: {
          subject: null,
          signals: null,
          attendedAt: "$createdAt",
          moderationStatus: "APPROVED",
          moderationNotes: null,
        },
      },
    ]);
    console.log(`    backfilled ${result.modifiedCount} experience(s).`);
  }

  // ── 5. Indexes ──────────────────────────────────────────────────────────────
  // Stale: these point at fields that no longer exist after step 2 and 4.
  await dropIfPresent(
    "experiences",
    ["topic_1", "topic_1_createdAt_-1", OLD_TEXT_INDEX.name],
    apply
  );
  await dropIfPresent(
    "experiencecomments",
    ["blogId_1", "blogId_1_createdAt_-1", "blogId_1_parentId_1_createdAt_1"],
    apply
  );

  await createIfMissing("experiences", "category_1", { category: 1 }, apply);
  await createIfMissing("experiences", "sport_1", { sport: 1 }, apply);
  await createIfMissing("experiences", "category_1_createdAt_-1", { category: 1, createdAt: -1 }, apply); // prettier-ignore
  await createIfMissing("experiences", "sport_1_createdAt_-1", { sport: 1, createdAt: -1 }, apply);
  await createIfMissing("experiences", "moderationStatus_1", { moderationStatus: 1 }, apply);
  await createIfMissing("experiences", "moderationStatus_1_createdAt_-1", { moderationStatus: 1, createdAt: -1 }, apply); // prettier-ignore
  await createIfMissing(
    "experiences",
    "subject_feed",
    {
      "subject.kind": 1,
      "subject.refId": 1,
      status: 1,
      isDeleted: 1,
      createdAt: -1,
    },
    apply
  );

  await createIfMissing("experiencecomments", "experienceId_1", { experienceId: 1 }, apply);
  await createIfMissing("experiencecomments", "experienceId_1_createdAt_-1", { experienceId: 1, createdAt: -1 }, apply); // prettier-ignore
  await createIfMissing("experiencecomments", "experienceId_1_parentId_1_createdAt_1", { experienceId: 1, parentId: 1, createdAt: 1 }, apply); // prettier-ignore

  // Last, and on its own: only one text index may exist at a time, so this must
  // follow the drop of blog_search_v2 above.
  await createIfMissing("experiences", NEW_TEXT_INDEX.name, NEW_TEXT_INDEX.spec, apply, {
    weights: NEW_TEXT_INDEX.weights,
  });

  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }
  console.log("Migration 39 complete.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 39 (${apply ? "APPLY" : "DRY RUN"})...`);
  console.log(
    "  NOTE: lossy in one direction — an experience written after the migration\n" +
      "  may carry a subject, signals or a category with no `topic` equivalent.\n" +
      "  Those fields are dropped, not preserved."
  );

  const collections = await listCollections();
  if (!collections.has("experiences")) {
    console.log("  nothing to revert.");
    return;
  }

  const experiences = db().collection("experiences");

  // Fold sport/category back into one topic, inverting the map above.
  const categoryToTopic = new Map(
    Object.entries(TOPIC_TO_CATEGORY).map(([topic, category]) => [category, topic])
  );
  const docs = await experiences.find({ topic: { $exists: false } }).toArray();
  console.log(`  experiences to fold back into topic: ${docs.length}`);

  if (apply) {
    for (const doc of docs) {
      const topic =
        (typeof doc.sport === "string" && doc.sport) ||
        categoryToTopic.get(String(doc.category)) ||
        "General";
      await experiences.updateOne(
        { _id: doc._id },
        {
          $set: { topic },
          $unset: {
            sport: "",
            category: "",
            subject: "",
            signals: "",
            attendedAt: "",
            moderationStatus: "",
            moderationNotes: "",
          },
        }
      );
    }

    await dropIfPresent(
      "experiences",
      [
        "category_1",
        "sport_1",
        "category_1_createdAt_-1",
        "sport_1_createdAt_-1",
        "moderationStatus_1",
        "moderationStatus_1_createdAt_-1",
        "subject_feed",
        NEW_TEXT_INDEX.name,
      ],
      apply
    );
    await createIfMissing("experiences", OLD_TEXT_INDEX.name, OLD_TEXT_INDEX.spec, apply, {
      weights: OLD_TEXT_INDEX.weights,
    });

    await db()
      .collection("experiencecomments")
      .updateMany({ experienceId: { $exists: true } }, { $rename: { experienceId: "blogId" } });
    await db()
      .collection("experiencelikes")
      .updateMany({ targetType: "EXPERIENCE" }, { $set: { targetType: "BLOG" } });

    for (const [from, to] of RENAMES) {
      const current = await listCollections();
      if (current.has(to) && !current.has(from)) {
        await db().collection(to).rename(from);
        console.log(`  renamed ${to} -> ${from}`);
      }
    }
  }

  console.log(apply ? "Revert complete." : "Dry run complete — re-run with --down --apply.");
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
      console.error("Migration 39 failed:", error);
      process.exit(1);
    });
}
