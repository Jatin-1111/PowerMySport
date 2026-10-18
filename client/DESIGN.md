---
version: alpha
name: PowerMySport-design-system
description: |
  A warm-paper system for a parent-facing sports guidance platform. A cream canvas replaces white, headlines pair a heavy grotesk with an italic serif accent, photography carries the emotion, and brand orange is reserved for the one decisive action on a screen. Structure comes from hairlines and tonal bands, not shadows or cards stacked on cards. Calm, trustworthy and athletic without shouting.

colors:
  # Surfaces
  canvas: "#F8F3EA"
  canvas-deep: "#EFE7DA"
  wash: "#FBE9D9"
  surface: "#FFFFFF"
  # Text
  ink: "#1C1B1A"
  body: "#4A4741"
  muted: "#7A766E"
  ash: "#A8A5A0"
  # Lines
  hairline: "#E1DCD3"
  hairline-ink: "rgba(28,27,26,0.20)"
  # Action and brand
  action: "#C2410C"
  action-hover: "#9A3412"
  brand-orange: "#E97316"
  # Semantic
  whatsapp: "#15803D"
  whatsapp-hover: "#166534"
  signal-amber: "#FCD34D"
  # Board (departures board only)
  board: "#1C1B1A"
  board-tile: "#2B2825"

typography:
  display:
    fontFamily: Geist
    fontSize: 62px
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: -0.04em
  display-accent:
    fontFamily: Newsreader
    fontStyle: italic
    fontSize: 1.22em
    fontWeight: 300
    lineHeight: 1.04
    letterSpacing: -0.02em
  heading-section:
    fontFamily: Newsreader
    fontSize: 60px
    fontWeight: 300
    lineHeight: 1.08
    letterSpacing: -0.02em
  heading-card:
    fontFamily: Newsreader
    fontSize: 24px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: -0.02em
  wordmark:
    fontFamily: Newsreader
    fontSize: 27px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: -0.02em
  lead:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: 0
  body:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: 0
  kicker:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  button:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  numeral:
    fontFamily: Newsreader
    fontSize: 48px
    fontWeight: 300
    lineHeight: 1
    letterSpacing: -0.02em
  board:
    fontFamily: Geist Mono
    fontWeight: 700
    letterSpacing: 0

rounded:
  button: 6px
  tile: 16px
  panel: 24px
  board: 16px
  full: 9999px

spacing:
  gutter-mobile: 16px
  gutter-tablet: 24px
  gutter-desktop: 32px
  section-mobile: 96px
  section-tablet: 128px
  section-desktop: 160px
  container: 1280px

components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#FFFFFF"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: 14px 28px
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "#FFFFFF"
    rounded: "{rounded.button}"
  button-text-link:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    textDecoration: underline
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.button}"
  header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    rounded: 0px
  footer:
    backgroundColor: "{colors.canvas-deep}"
    textColor: "{colors.body}"
    rounded: 0px
  tile-outline:
    backgroundColor: transparent
    borderColor: "{colors.hairline}"
    rounded: "{rounded.tile}"
  tile-photo:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.tile}"
  panel-wash:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  note-card:
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.hairline}"
    rounded: 12px
  departures-board:
    backgroundColor: "{colors.board}"
    textColor: "#FFFFFF"
    rounded: "{rounded.board}"
---

## Overview

PowerMySport helps parents make sporting decisions: which sport, which tournament, what the next stage asks of their child. The interface should feel like a thoughtful guide, not an app and not a sports brand's campaign. The resting surface is warm cream (`{colors.canvas}`), not white. Large statements are set in two voices, a heavy grotesk for the claim and a light italic serif for the phrase that matters. Real photography carries the feeling. Everything else recedes to hairlines, tonal bands and quiet labels.

The system was assembled from a study of Oura (warm paper, serif plus grotesque, one decisive action colour), Nike (extreme type contrast over plain chrome, colour kept for signal), Airbnb (modest weights, soft radii, one brand voltage, 8px-class buttons), and NerdWallet (hairline structure, nearly no shadows, guidance-first layout). Notion and Wise were reviewed and rejected: their purple pill and 900-weight display drift toward SaaS and fintech.

**Key characteristics**

- Cream canvas with a deeper cream band for contrast, never a jump to black mid-page.
- Two-voice headline: `{typography.display}` (Geist, semibold, tight) with `{typography.display-accent}` (Newsreader italic, light) for the key phrase.
- Section headings and card titles in light Newsreader; everything read in Geist.
- One action colour, `{colors.action}`, used for the primary button and nowhere else decorative.
- Hairlines and tonal bands instead of shadows, borders-plus-shadows cards, or gradients.
- Photography first: desaturated, warm, cropped so the subject is whole.
- One deliberate dark object on the page: the departures board.

## Colors

### Surfaces

- `{colors.canvas}` (#F8F3EA): default page background, header, hero, most sections.
- `{colors.canvas-deep}` (#EFE7DA): alternating bands ("How it works", the pathway section) and the footer. One step darker than canvas, same hue.
- `{colors.wash}` (#FBE9D9): the closing panel only. A pale orange tint, not a brand fill.
- `{colors.surface}` (#FFFFFF): reserved for content that must read as a document (forms, tables). Not a page background.

### Text

- `{colors.ink}` (#1C1B1A): headings, button labels, links, icons. Warm near-black; never `#000`.
- `{colors.body}` (#4A4741): paragraphs, nav links, footer text. 8.4:1 on canvas.
- `{colors.muted}` (#7A766E): kickers and captions. 4.1:1 on canvas and 3.7:1 on the deeper band, both under the 4.5:1 AA line for small text, so use it only for supporting text and never for essential copy.
- `{colors.ash}` (#A8A5A0): column labels on the dark departures board only.

### Action and brand

- `{colors.action}` (#C2410C): the primary button. It is the existing `power-orange-solid` token. White text on it is 5.2:1.
- `{colors.brand-orange}` (#E97316): the "My" in the wordmark and brand moments on large type. Never behind white text (3.03:1 fails AA).
- `{colors.whatsapp}` (#15803D): the WhatsApp button only, so the channel is recognisable. Not WhatsApp's own `#25D366` (2:1 under white).
- `{colors.signal-amber}`: dates on the departures board only.

### Lines

- `{colors.hairline}` (#E1DCD3): every divider and outline on cream.
- `{colors.hairline-ink}` (ink at 20%): the top rule of each step column on the deeper band.

### Rules

- **One accent.** Orange is the only chromatic colour in the interface. Green is for WhatsApp and success states. No purple, no gradients.
- **One gray family.** All neutrals are warm. Do not mix in cool slate on pages that use this system.
- **Colour is signal.** Chromatic colour comes from photography and from the action. Icons and decoration are ink.

## Typography

### Families

- **Geist** (already loaded as `--font-geist-sans`): UI, body, buttons, the heavy half of the hero headline.
- **Newsreader** (`--font-newsreader`, class `.font-editorial`): section headings, card titles, numerals, the wordmark, and the italic accent. Light weights at display sizes; it is too thin below about 20px, so never use it for body copy.
- **Geist Mono** (`--font-geist-mono`): the departures board tiles.

### Hierarchy

| Role               | Face              | Size (phone / tablet / desktop) | Weight                               |
| ------------------ | ----------------- | ------------------------------- | ------------------------------------ |
| Hero statement     | Geist             | 33 / 48 / 62px                  | 600, tracking -0.04em, leading 1.04  |
| Hero accent phrase | Newsreader italic | 1.22 times the statement        | 300, tracking -0.02em                |
| Section heading    | Newsreader        | 36 / 48 / 60px                  | 300, leading 1.08                    |
| Card title         | Newsreader        | 24px (featured 36px)            | 400                                  |
| Lead paragraph     | Geist             | 18px                            | 400, capped at 56ch                  |
| Body               | Geist             | 16px                            | 400, leading 1.625                   |
| Kicker             | Geist             | 14px                            | 500, `{colors.muted}`, sentence case |
| Button             | Geist             | 16px                            | 600                                  |
| Wordmark           | Newsreader        | 27px                            | 500                                  |

### Principles

- **Two voices, one line.** In the hero the italic serif runs larger than the grotesk because a light serif looks smaller at the same size. Keep that 1.22 ratio when reusing the pattern.
- **Weight signals role.** Heavy for the claim, light for editorial headings. Do not make section headings bold; the hero headline is the only heavy type on the page.
- **Sentence case everywhere.** Kickers, labels and buttons are not uppercase. The departures board is the exception because it imitates a physical board.
- **Measure.** Paragraphs are capped near 56 to 60 characters (`max-w-[56ch]`) and use `text-wrap: pretty`; headings use `text-wrap: balance`.
- **Numerals.** Step numbers are Newsreader light with tabular figures.

## Layout

- **Container:** `max-w-7xl` (1280px) with gutters of 16 / 24 / 32px.
- **Section rhythm:** 96px on phone, 128px on tablet, 160px on desktop (`py-24 sm:py-32 lg:py-40`). The vertical silence between sections is part of the brand; do not compress it.
- **Alternation:** canvas, canvas-deep, canvas, canvas-deep. Sections are told apart by tone, not by borders.
- **Hero:** headline column (32rem) and intro column (28rem) sit side by side, centred as a pair, vertically centred against each other, with a 64px gap. Below them one wide photograph spans the container. The pair stacks on phones.
- **Split sections:** a sticky heading on the left (5 of 12 columns) with the content scrolling on the right (7 of 12). Used for "Ask" and "How it works".
- **Bento grid:** four columns on `lg`, with the lead tile spanning two columns and two rows. Spans reset to one or two columns below `lg`.
- **Responsive:** every asymmetric layout collapses to a single column below 768px, with any overlap and rotation removed.

## Elevation and depth

- No shadows on cards. Surfaces are separated by tone (`canvas` against `canvas-deep`) or a 1px `{colors.hairline}`.
- The only shadow in the system is a soft warm one under a card that overlaps a photograph (the note card), at low opacity and tinted warm: `0 12px 24px -16px rgba(57,34,30,0.28)`.
- The header uses `backdrop-blur` over `canvas` at 90%. It is the only blurred element and it is fixed, so it does not repaint on scroll.

## Shapes

- Buttons: 6px (`{rounded.button}`). **No pill buttons.** This is a standing project rule, and it matches Airbnb's 8px-class buttons.
- Tiles and photographs: 16px (`{rounded.tile}`).
- Closing panel and large photo plates: 24px (`{rounded.panel}`).
- Departures board: 16px outer, 2px tiles.
- Radii step down as elements nest; an inner element is never rounder than its container.

## Components

### Header

`{colors.canvas}` at 90% with blur and a 1px hairline underneath, no shadow. Serif wordmark with "My" in `{colors.brand-orange}`. Nav links are `{colors.body}` at 16px medium weight with a `canvas-deep` hover and 8px radius. The active page is marked in action orange. Login is a ghost text button, Get Started is the primary button.

### Buttons

- **Primary** (`button-primary`): the single orange action per view. Hover darkens to `{colors.action-hover}`; press scales to 0.98 (`btn-motion`).
- **WhatsApp** (`button-whatsapp`): same shape, green, with the WhatsApp glyph. Used where the action is opening WhatsApp.
- **Text link** (`button-text-link`): ink, underlined with a 30% ink underline that goes solid on hover, with a trailing arrow. This is the secondary action; there is no ghost or outline button on cream.
- **Dark** (`button-dark`): ink fill for a secondary conversion on a deeper band ("Explore pathways").
- Focus: a 2px ink ring with a cream offset on every interactive element.

### Hero

Two-voice headline, a short intro, one primary button and one text link. A single wide photograph below (see Photography). A small note card ("After you message us") sits on the empty grass at the photo's lower left on `sm` and up, and below the photo on phones. Reassurances run as a hairline-ruled row of check marks beneath.

### Question list

A ruled list: hairline above and below each row, 20 to 24px type, a trailing diagonal arrow that lifts on hover. Each row opens WhatsApp with the question prefilled.

### Steps

Four columns on a `canvas-deep` band, each with a 1px `hairline-ink` top rule, a serif numeral, a semibold title and a short line. No cards.

### Explore tiles

Photographic tiles: the image fills the tile at 65% saturation, a warm-ink fade from the bottom (92% to 15%) keeps white text legible, and the photo zooms 4% on hover. The photos are decorative and carry empty alt text because the title and description name each tile. The lead tile (Sports Pathways) is two columns by two rows.

### Closing panel

A `{colors.wash}` panel with 24px radius, a serif heading, one primary action and one text link.

### Departures board

The signature object. Warm ink (`{colors.board}`) with `{colors.board-tile}` tiles, amber dates and white event text in Geist Mono, 16px outer radius. Every character is real calendar data, rows are links, tiles are hidden from assistive technology, and the flip animation is skipped under reduced motion. It is the one dark block on the cream page, deliberately.

### Footer

`{colors.canvas-deep}` with a hairline top edge. Serif wordmark, Geist links at 14px, columns headed in semibold sentence case, social buttons as 36px squares with a 6px radius that invert to ink on hover.

## Photography

- Real photographs only, never AI-generated imagery or staged "diverse team" stock.
- Desaturate to about 65 to 70% and warm slightly so the photo sits on the paper.
- **Crop to the subject.** Anchor the crop so the subject is whole before choosing an aspect ratio. The hero image (ball and boots, upper right) is anchored to the top; on phones it is shifted right so both stay in frame.
- Place text on empty areas of the image or on a fade, not over detail.
- Source from Unsplash (`images.unsplash.com`, already allowed in `next.config.ts`). Verify each photo's subject and that it loads before shipping.

## Motion

- Hover and focus transitions are 200ms on colour and transform. The tile zoom is 700ms ease-out.
- Section reveals use the existing CSS `.reveal-on-scroll` (scroll-timeline, visible by default). Do not add JavaScript reveals that start at `opacity: 0`; they leave content missing for crawlers and throttled tabs.
- Animate only `transform` and `opacity`. Everything is gated or neutralised under `prefers-reduced-motion`.
- No scroll-jacking, cursor-following effects or parallax.

## Content and copy

- Plain, specific language. No "elevate", "seamless", "unleash", "game-changer", "next-gen".
- **No em dashes** in user-visible copy.
- **No fabricated signals:** no invented reviews, counters, ratings or metrics. Real data (a genuine tournament date, a real rating) is fine.
- Sentence case for headings and labels. Active voice.
- Icons are Lucide at `strokeWidth={1.5}`, in ink. No emoji as icons.

## Do's and Don'ts

### Do

- Keep orange for the one decisive action on a screen.
- Pair the heavy grotesk with the light italic serif in hero statements; keep the serif larger.
- Separate sections by tone and hairline, and keep the generous vertical whitespace.
- Verify contrast: `{colors.muted}` is for supporting text only.
- Crop photographs to the subject and test the crop at phone width.

### Don't

- Don't use pill-shaped buttons or full-radius containers.
- Don't use purple, gradients, glassmorphism beyond the header blur, or neon.
- Don't put `{colors.brand-orange}` behind white text; use `{colors.action}`.
- Don't use `#000`, pure white page backgrounds, or cool slate neutrals on pages in this system.
- Don't put shadows on cards or stack bordered cards inside bordered cards.
- Don't bold the section headings or the italic accent phrase.
- Don't set Newsreader below about 20px or use it for body copy.
- Don't add a second dark section; the departures board is the single dark object.

## Implementation status (as of 2026-10-19, branch `client-uat`)

Applied everywhere in the client app, through the theme and the shared primitives rather than page by page:

- **Neutrals:** the whole `slate-*` scale in `globals.css` is redefined to the warm paper neutrals (50 and 100 are the deep tints, 200 is the hairline, 500 muted, 600 body, 900 ink). Every existing `slate-*` utility now resolves to them.
- **Second accent retired:** `indigo-*` resolves to the brand orange. `deep-slate` and `ghost-white` utilities were replaced with `ink` and `paper`.
- **Page canvas:** `--background` is paper, `--border` is the hairline, and the muted, secondary and accent surfaces are the deeper paper.
- **Shadows:** `--shadow-xs` to `--shadow-2xl` are warm, low and diffuse. There are no black drop shadows.
- **Primitives:** `Button` (secondary is ink, outline is an ink outline), `Card` (16px, hairline, hover goes to an ink border), `Input` (white field), `PageHeader` (paper band, serif light title, sentence-case kicker) follow the system.
- **Gradients:** decorative gradients across the app were flattened to a solid tone (ink for dark cards, paper for page washes, the first stop's colour otherwise). Image scrims that fade to transparent or black were kept because they exist for legibility.
- **Headings:** every `h1` with a bold grotesk title was switched to the serif at light weight (normal below 3xl), and marketing-area `h2`s the same. Dashboard section and card headings stay in the bold grotesk, as UI labels.

Not done, because it needs a person looking at each screen:

- Signed-in surfaces (dashboards, booking flows, expert and coach consoles, shop account) were changed through the theme and the codemods but not visually reviewed, because they need a login. Review them before release.
- Dashboard cards still use `rounded-2xl` and `rounded-3xl` in places (16 and 24px, within the scale) and some colour-coded status chips use blue, green and amber for meaning. These are intentional.
- Dark mode is untouched; the `.dark` variables still carry the old values.

The palette is defined once, in the `@theme inline` block of `src/app/globals.css`, and used as ordinary Tailwind utilities. A colour change is one edit there.

| Token        | Value   | Utilities                                         |
| ------------ | ------- | ------------------------------------------------- |
| `paper`      | #F8F3EA | `bg-paper`, `ring-offset-paper`                   |
| `paper-deep` | #EFE7DA | `bg-paper-deep`                                   |
| `wash`       | #FBE9D9 | `bg-wash`                                         |
| `ink`        | #1C1B1A | `text-ink`, `bg-ink`, `border-ink/20`, `ring-ink` |
| `ink-hover`  | #39332F | `hover:bg-ink-hover`                              |
| `ink-body`   | #4A4741 | `text-ink-body`                                   |
| `ink-muted`  | #7A766E | `text-ink-muted`                                  |
| `ink-ash`    | #A8A5A0 | `text-ink-ash`                                    |
| `hairline`   | #E1DCD3 | `border-hairline`, `ring-hairline`, `bg-hairline` |
| `board-tile` | #2B2825 | `bg-board-tile`                                   |

Orange is not duplicated: the action colour is the existing `power-orange-solid` token and the wordmark's "My" is `power-orange`, both from `@powermysport/shared-tokens`. Shared type helpers (`SECTION_HEADING`, `SECTION_LEAD`, `SectionKicker`) are in `src/modules/marketing/components/marketing/SectionKicker.tsx`. Do not write new hex literals for these colours; use the token.

Open items:

- Photographer credits for the Unsplash images are not recorded.
- The nav wraps at roughly 800px wide; it needs a no-wrap or tighter spacing pass.
- The "Explore" photo for Community shows a real child; confirm this is acceptable before launch.
- Muted text (`{colors.muted}`, 4.1:1 on canvas) falls short of AA for small text; audit existing uses and darken it if any carry essential copy.
