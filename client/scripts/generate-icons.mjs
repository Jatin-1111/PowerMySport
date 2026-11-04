/**
 * Renders every icon asset from one geometry definition.
 *
 * ── Why a script rather than committed art ───────────────────────────────────
 * There are eight raster files across five sizes plus an SVG, and the old set
 * had already drifted: `app/icon.svg` carried a letterform in Tailwind's
 * orange-500 while `favicon.png` carried the runner logo, so the tab icon and
 * the home-screen icon were two different marks. One definition, regenerated on
 * demand, is the only way that stays true.
 *
 * ── Why a bolt on navy, and not the runner ──────────────────────────────────
 * The runner-and-bolt logo is the brand, but it cannot survive a favicon: at
 * 16px the figure collapses into an orange blob, which is what the previous
 * favicon was. A tab icon has about 256 pixels to work with, so it gets one
 * shape with one job. The bolt is the half of the logo that stays readable, and
 * it keeps the semantic tie to the name.
 *
 * Navy field rather than orange: measured across candidates at 16px, the dark
 * field gives the glyph a hard edge and reads on both light and dark browser
 * chrome, where orange-on-white loses its own boundary. #e97316 on #0f172a is
 * 5.7:1 — comfortably past the 3:1 WCAG asks of a non-text graphic, and past it
 * by enough that the antialiasing at 16px does not eat the margin.
 *
 * USAGE
 *   node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, "..");
const publicDir = join(clientRoot, "public");
const appDir = join(clientRoot, "src", "app");

/** Brand tokens. Kept literal: an SVG cannot read a CSS custom property, and a
 * silent drift here would ship a slightly-wrong orange to every browser tab. */
const NAVY = "#0f172a"; // --deep-slate
const ORANGE = "#e97316"; // --power-orange

/**
 * The bolt, on a 64-unit grid.
 *
 * Chosen from four candidates rendered at 16, 20 and 32px and compared as
 * pixels rather than as geometry. Thinner arms disappeared at 16px; a larger
 * version crowded the corners at 32px; a skewed "speed lean" muddied into the
 * background at 16px. This one holds at all three.
 */
const BOLT = "M39 4 L12 38 L28 38 L25 60 L52 24 L35 24 Z";

/** `inset` shrinks the glyph to leave a maskable safe zone. */
const markSvg = ({ radius = 14, inset = 0 } = {}) => {
  const scale = (64 - inset * 2) / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="${radius}" fill="${NAVY}"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <path d="${BOLT}" fill="${ORANGE}"/>
  </g>
</svg>`;
};

const png = async (svg, size, out) => {
  // `density` matters: sharp rasterises the SVG at this DPI before resizing, so
  // a low value produces a soft 512px icon from a 64-unit viewBox.
  await sharp(Buffer.from(svg), { density: 600 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  return out;
};

const main = async () => {
  await mkdir(publicDir, { recursive: true });

  // Next serves this one directly from the app directory.
  const rounded = markSvg();
  await writeFile(join(appDir, "icon.svg"), `${rounded}\n`, "utf8");

  const targets = [
    // Browser tabs. `favicon.png` was a 1280x1280, 249KB copy of the full logo,
    // downloaded in full by every visitor to paint a 16px square.
    ["favicon-16x16.png", 16, rounded],
    ["favicon-32x32.png", 32, rounded],
    ["favicon.png", 48, rounded],
    // iOS applies its own corner mask and its own background, so this one is
    // square-cornered and fully opaque: rounding it here would round it twice.
    ["apple-touch-icon.png", 180, markSvg({ radius: 0 })],
    ["android-chrome-192x192.png", 192, rounded],
    ["android-chrome-512x512.png", 512, rounded],
    // Maskable: Android crops to whatever shape the launcher wants, so the glyph
    // sits inside the 80% safe zone and the field bleeds to the edge.
    ["android-chrome-maskable-512x512.png", 512, markSvg({ radius: 0, inset: 7 })],
  ];

  for (const [name, size, svg] of targets) {
    await png(svg, size, join(publicDir, name));
    console.log(`  wrote public/${name} (${size}x${size})`);
  }
  console.log("  wrote src/app/icon.svg");
};

await main();
