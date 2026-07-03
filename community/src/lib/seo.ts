import type { Metadata } from "next";

/**
 * SEO configuration and helpers for the PowerMySport Community app.
 *
 * The community app is served under the `/community` base path (see
 * `next.config.ts` → `basePath`). Publicly it is reachable at
 * `https://powermysport.com/community` (proxied by the `client` app) and at
 * `https://community.powermysport.com/community`.
 *
 * To keep SEO output deterministic regardless of Next.js `basePath` handling,
 * every SEO-critical URL (canonical, Open Graph, Twitter, icons, manifest) is
 * emitted as a fully-qualified absolute URL built from `COMMUNITY_BASE_URL`.
 */

/** Public origin of the PowerMySport site (no trailing slash, no base path). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com"
).replace(/\/$/, "");

/** The app's base path (see `next.config.ts` → `basePath`). */
export const BASE_PATH = "/community";

/** Absolute base URL of the community app, including the `/community` base path. */
export const COMMUNITY_BASE_URL = `${SITE_URL}${BASE_PATH}`;

export const SITE_NAME = "PowerMySport Community";

export const SITE_DESCRIPTION =
  "Join the PowerMySport community — a parent-first, safety-focused space to ask questions, read expert sports blogs, discover vetted coaches and venues, and connect with players and coaches across India.";

export const SITE_KEYWORDS = [
  "sports community",
  "youth sports community",
  "parent sports community",
  "sports Q&A",
  "ask sports questions",
  "sports blog",
  "find sports coaches",
  "sports academy community",
  "youth athlete guidance",
  "PowerMySport community",
];

/** Absolute URLs for shared social/preview assets (served from community/public). */
export const OG_IMAGE = `${COMMUNITY_BASE_URL}/og-image.png`;
export const TWITTER_IMAGE = `${COMMUNITY_BASE_URL}/twitter-image.png`;
export const LOGO_URL = `${COMMUNITY_BASE_URL}/android-chrome-512x512.png`;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/** Build a fully-qualified community URL for a given path (e.g. "/blog"). */
export function communityUrl(path = "/"): string {
  if (!path || path === "/") return COMMUNITY_BASE_URL;
  return `${COMMUNITY_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Collapse whitespace and clamp a string to a search-friendly length. */
export function clampText(input: string, max = 160): string {
  const text = (input || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Strip HTML tags/entities from rich-text so it can be used in meta tags. */
export function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ");
}

/**
 * Fetch public JSON from the backend for use inside `generateMetadata` / server
 * components. Uses the native `fetch` (not the browser axios instance) so it is
 * server-safe, carries no credentials, and never triggers auth redirects. Any
 * failure resolves to `null` so metadata generation degrades gracefully.
 */
export async function fetchPublicData<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      // Public content — revalidate periodically rather than on every request.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: T };
    return (json?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

interface BuildMetadataInput {
  title?: string;
  description?: string;
  /** Path relative to the community base, e.g. "/blog" or "/q/123". */
  path?: string;
  keywords?: string[];
  /** Absolute image URL. Defaults to the shared Open Graph image. */
  image?: string;
  /** When true, the page is excluded from search indexing. */
  noindex?: boolean;
  type?: "website" | "article" | "profile";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
}

/**
 * Build a consistent Next.js `Metadata` object for a community page. Title is
 * passed through the root layout template (`%s | PowerMySport Community`).
 */
export function buildMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  keywords,
  image,
  noindex = false,
  type = "website",
  publishedTime,
  modifiedTime,
  authors,
}: BuildMetadataInput = {}): Metadata {
  const canonical = communityUrl(path);
  const ogImage = image || OG_IMAGE;

  const baseOpenGraph = {
    locale: "en_IN",
    url: canonical,
    siteName: SITE_NAME,
    title,
    description,
    images: [
      { url: ogImage, width: 1200, height: 630, alt: title || SITE_NAME },
    ],
  };

  const openGraph: Metadata["openGraph"] =
    type === "article"
      ? {
        ...baseOpenGraph,
        type: "article",
        ...(publishedTime ? { publishedTime } : {}),
        ...(modifiedTime ? { modifiedTime } : {}),
        ...(authors ? { authors } : {}),
      }
      : type === "profile"
        ? { ...baseOpenGraph, type: "profile" }
        : { ...baseOpenGraph, type: "website" };

  return {
    title,
    description,
    keywords: keywords ?? SITE_KEYWORDS,
    alternates: { canonical },
    robots: noindex
      ? { index: false, follow: false }
      : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image || TWITTER_IMAGE],
    },
  };
}

/** Root-level metadata applied to every community page via the app layout. */
export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default:
      "PowerMySport Community | Ask, Learn & Connect in Youth Sports",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  category: "sports",
  // Runtime browser assets are referenced origin-relative WITH the base path so
  // they resolve on whatever host serves the app (localhost, subdomain, proxy),
  // rather than being pinned to the production origin like the SEO URLs below.
  manifest: `${BASE_PATH}/site.webmanifest`,
  icons: {
    icon: [
      { url: `${BASE_PATH}/favicon.png`, type: "image/png" },
      {
        url: `${BASE_PATH}/favicon-32x32.png`,
        sizes: "32x32",
        type: "image/png",
      },
    ],
    shortcut: `${BASE_PATH}/favicon.png`,
    apple: [
      {
        url: `${BASE_PATH}/apple-touch-icon.png`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  alternates: { canonical: COMMUNITY_BASE_URL },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: COMMUNITY_BASE_URL,
    siteName: SITE_NAME,
    title: "PowerMySport Community | Ask, Learn & Connect in Youth Sports",
    description: SITE_DESCRIPTION,
    images: [
      { url: OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} preview` },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PowerMySport Community | Ask, Learn & Connect in Youth Sports",
    description: SITE_DESCRIPTION,
    images: [TWITTER_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};
