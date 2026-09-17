import type { ReactElement } from "react";

/**
 * The frame every social preview image is drawn in.
 *
 * ── Why one module rather than a template per route ─────────────────────────
 * A link to a roadmap page and a link to a ranking list should look like they
 * came from the same place. Eight hand-drawn variants would not, and the old
 * single static image had the opposite problem: it was the same everywhere and
 * said nothing anywhere. One frame, one slot for what the page actually is.
 *
 * ── This is Satori, not a browser ───────────────────────────────────────────
 * `next/og` renders through Satori, which implements a deliberate subset of
 * CSS. Things that will silently do the wrong thing here:
 *
 *   - Only flexbox. No grid, no float, no position: absolute outside a
 *     relatively-positioned parent.
 *   - Every element with more than one child needs an explicit `display: flex`.
 *     Satori throws rather than guessing.
 *   - No external stylesheet and no Tailwind classes; styles are inline.
 *   - Text does not wrap the way a browser wraps it, so the headline is clamped
 *     in code rather than trusted to overflow gracefully.
 *
 * ── The font ────────────────────────────────────────────────────────────────
 * No `fonts` option is passed, so this uses the Geist face that `next/og` ships
 * with. That is a deliberate trade: the site's display face is Space Grotesk,
 * but using it here means committing a .ttf and keeping it in step with the
 * Google-hosted copy `next/font` serves. Geist is close in character and costs
 * nothing. To switch, drop the .ttf in and pass it through `fonts` — the
 * layout below does not depend on the face.
 */

/** Brand tokens, literal because Satori cannot read a CSS custom property. */
const NAVY = "#0f172a";
const ORANGE = "#e97316";
const MUTED = "#94a3b8";

/** The same bolt as the favicon, on the same 64-unit grid. */
const BOLT = "M39 4 L12 38 L28 38 L25 60 L52 24 L35 24 Z";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

/**
 * Cut to a word boundary so a preview never ends mid-word.
 *
 * Deliberately short. At this type size a headline beyond ~70 characters either
 * shrinks to the point of pointlessness or runs past three lines and collides
 * with the footer.
 */
const clamp = (value: string, max: number): string => {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

export interface OgFrameProps {
  /** Small orange line above the headline: what kind of page this is. */
  eyebrow?: string;
  /** The page, in the words a person would use. */
  headline: string;
  /** One supporting line. Omitted rather than padded when there is nothing to say. */
  subline?: string;
}

/**
 * Headline size steps down as the text lengthens.
 *
 * Satori has no way to fit text to a box, so the alternative to this is either
 * a headline that overflows or one sized for the longest case and too small for
 * every other.
 */
const headlineSize = (length: number): number => {
  if (length <= 28) return 78;
  if (length <= 48) return 66;
  return 54;
};

export function ogFrame({ eyebrow, headline, subline }: OgFrameProps): ReactElement {
  const text = clamp(headline, 70);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: NAVY,
        padding: "64px 72px",
        // A single flat accent, no gradient. The brand is one strong colour on a
        // dark field; a gradient here would read as decoration rather than as a
        // signature, and would be the first thing to look dated.
        borderBottom: `14px solid ${ORANGE}`,
      }}
    >
      {/* Wordmark */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="14" fill={ORANGE} />
          <path d={BOLT} fill={NAVY} />
        </svg>
        <div
          style={{
            marginLeft: 20,
            fontSize: 34,
            color: "#ffffff",
            letterSpacing: -0.5,
          }}
        >
          PowerMySport
        </div>
      </div>

      {/* What this page is */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow ? (
          <div
            style={{
              fontSize: 26,
              color: ORANGE,
              letterSpacing: 3,
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            {clamp(eyebrow, 40)}
          </div>
        ) : null}
        <div
          style={{
            fontSize: headlineSize(text.length),
            color: "#ffffff",
            lineHeight: 1.12,
            letterSpacing: -1.5,
          }}
        >
          {text}
        </div>
        {subline ? (
          <div style={{ fontSize: 30, color: MUTED, marginTop: 22, lineHeight: 1.35 }}>
            {clamp(subline, 110)}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", fontSize: 24, color: MUTED }}>powermysport.com</div>
    </div>
  );
}
