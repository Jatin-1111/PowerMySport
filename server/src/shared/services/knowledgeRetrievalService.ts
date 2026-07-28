import { GoogleGenAI } from "@google/genai";
import { KnowledgeChunk } from "../models/KnowledgeChunk";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const embeddingModelCandidates = ["text-embedding-004", "gemini-embedding-001"];

export interface RetrievedChunk {
  title: string;
  content: string;
  score: number;
}

/**
 * Embeds text via Gemini's embedding API, falling back to the next candidate
 * model on 404/not-found only (mirrors the fallback pattern used for chat
 * models elsewhere).
 */
export async function embedText(text: string): Promise<number[]> {
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY environment variable");
  }

  const genAI = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  for (const model of embeddingModelCandidates) {
    try {
      const response = await genAI.models.embedContent({ model, contents: text });
      const values = response.embeddings?.[0]?.values;
      if (!values) throw new Error("Embedding response had no values");
      return values;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      if (msg.includes("404") || msg.includes("not found")) continue;
      throw error;
    }
  }

  throw new Error(
    `No supported Gemini embedding model found. Tried: ${embeddingModelCandidates.join(", ")}. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── In-memory corpus cache ────────────────────────────────────────────────────
// The knowledge base is small (tens to low hundreds of chunks), so brute-force
// cosine similarity over an in-memory cache is simpler and cheaper than a
// vector database at this scale. Cache is loaded lazily and can be refreshed
// after re-ingestion via refreshKnowledgeCache().

interface CachedChunk {
  title: string;
  content: string;
  embedding: number[];
}

let cache: CachedChunk[] | null = null;
let loadingPromise: Promise<CachedChunk[]> | null = null;

async function loadCache(): Promise<CachedChunk[]> {
  const docs = await KnowledgeChunk.find().select("title content embedding").lean();
  return docs.map((d) => ({ title: d.title, content: d.content, embedding: d.embedding }));
}

async function getCache(): Promise<CachedChunk[]> {
  if (cache) return cache;
  if (!loadingPromise) {
    loadingPromise = loadCache().then((loaded) => {
      cache = loaded;
      return loaded;
    });
  }
  return loadingPromise;
}

/** Call after re-running the embedding ingestion script to pick up fresh content without a restart. */
export function refreshKnowledgeCache(): void {
  cache = null;
  loadingPromise = null;
}

const MIN_RELEVANCE_SCORE = 0.6;

/**
 * Retrieves the top-K most relevant knowledge chunks for a query via cosine
 * similarity. Returns an empty array (never throws) on embedding/DB failure —
 * callers should treat retrieval as best-effort grounding, not a hard
 * dependency for the chat to function.
 */
export async function retrieveRelevantChunks(
  query: string,
  topK = 5,
): Promise<RetrievedChunk[]> {
  try {
    const [queryEmbedding, chunks] = await Promise.all([embedText(query), getCache()]);
    if (chunks.length === 0) return [];

    return chunks
      .map((c) => ({
        title: c.title,
        content: c.content,
        score: cosineSimilarity(queryEmbedding, c.embedding),
      }))
      .filter((c) => c.score >= MIN_RELEVANCE_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch {
    return [];
  }
}
