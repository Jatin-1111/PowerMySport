/**
 * Crawl the site's own static/marketing pages and embed their content into
 * KnowledgeChunk, chunked by heading.
 *
 * Unlike embedKnowledgeBase.ts (hand-authored FAQ content), this fetches the
 * live rendered HTML at ingestion time — the page IS the source of truth, so
 * re-running this after a copy change can never drift out of sync the way a
 * hand-copied paraphrase can (see the "What is PowerMySport?" staleness bug
 * this approach is designed to prevent from recurring).
 *
 * Run: npx ts-node src/scripts/embedWebsitePages.ts
 * Requires the client app to be running and reachable at SITE_BASE_URL
 * (defaults to http://localhost:3000).
 * Safe to re-run — each page's old chunks are deleted and replaced fresh.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import * as cheerio from "cheerio";
import { KnowledgeChunk } from "../shared/models/KnowledgeChunk";
import { embedText } from "../shared/services/knowledgeRetrievalService";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";
const SITE_BASE_URL = process.env.SITE_BASE_URL || "http://localhost:3000";

const ROUTES_TO_CRAWL = [
  "/",
  "/about",
  "/how-it-works",
  "/contact",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/content-policy",
  "/cookies",
  "/parental-consent",
  "/health-waiver",
];

const MAX_CHUNK_CHARS = 1500;
const MIN_CHUNK_CHARS = 40;

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "section"
  );
}

interface PageChunk {
  heading: string;
  content: string;
}

/**
 * Walks heading + paragraph/list elements in document order (cheerio's
 * .find() guarantees this regardless of nesting depth, so headings and their
 * body text don't need to be direct siblings) and groups body text under
 * its nearest preceding heading.
 */
function extractChunksFromHtml(html: string, pageTitle: string): PageChunk[] {
  const $ = cheerio.load(html);
  const main = $("main").first();
  const root = main.length ? main : $("body");

  const chunks: PageChunk[] = [];
  let currentHeading = pageTitle;
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (content.length >= MIN_CHUNK_CHARS) {
      chunks.push({ heading: currentHeading, content: content.slice(0, MAX_CHUNK_CHARS) });
    }
    buffer = [];
  };

  root.find("h1, h2, h3, h4, p, li").each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, " ").trim();
    if (!text) return;

    if ($el.is("h1, h2, h3, h4")) {
      flush();
      currentHeading = text;
    } else {
      buffer.push(text);
    }
  });
  flush();

  return chunks;
}

async function crawlPage(route: string): Promise<void> {
  const res = await fetch(`${SITE_BASE_URL}${route}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const $ = cheerio.load(html);
  const pageTitle = $("title").first().text().split("|")[0]?.trim() || route;

  const chunks = extractChunksFromHtml(html, pageTitle);
  console.log(`  ${route}: ${chunks.length} chunks`);

  // Remove this page's old chunks first — if a section is removed from the
  // page, its chunk shouldn't linger as a stale orphan.
  await KnowledgeChunk.deleteMany({ sourceType: "page", sourceId: { $regex: `^page:${route}#` } });

  for (const chunk of chunks) {
    const sourceId = `page:${route}#${slugify(chunk.heading)}`;
    const embedding = await embedText(`${chunk.heading}\n${chunk.content}`);
    await KnowledgeChunk.updateOne(
      { sourceType: "page", sourceId },
      { $set: { title: chunk.heading, content: chunk.content, embedding } },
      { upsert: true },
    );
  }
}

async function main() {
  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI/MONGODB_URI environment variable");
  }

  await mongoose.connect(MONGO_URI);
  console.log(`Connected to MongoDB. Crawling ${ROUTES_TO_CRAWL.length} pages from ${SITE_BASE_URL}...`);

  let succeeded = 0;
  let failed = 0;

  for (const route of ROUTES_TO_CRAWL) {
    try {
      await crawlPage(route);
      succeeded++;
    } catch (error) {
      failed++;
      console.error(`  ✗ ${route}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Done. ${succeeded} pages crawled, ${failed} failed.`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
