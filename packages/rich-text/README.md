# @powermysport/rich-text

Formatted text for pathway content (answers, overviews, details): the renderer the
website draws it with, and the paste cleaner and toolbar logic the admin editor
uses. One package so that **what an editor previews is what a parent sees**.

The text is stored as **Markdown in a plain text field**. It is still plain text, so
nothing in it can run, the roadmap chat reads it as it stands, and the editor can be
replaced later without migrating a word.

## What is here

| Export                                                                                                         | Used by               | What it does                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `RichText`                                                                                                     | client, admin preview | Draws Markdown as paragraphs, lists, bold, small headings and tables. React elements only, raw HTML dropped. |
| `normalizeRichText`, `remarkKeepLineBreaks`                                                                    | `RichText`            | Word bullets (`•` + tab) become list items; a single line break stays a line break.                          |
| `cleanPastedContent`, `htmlToMarkdown`                                                                         | admin editor          | Turns what Word or Google Docs put on the clipboard into Markdown. Needs a DOM (browser or jsdom).           |
| `toggleBold`, `toggleBulletList`, `toggleNumberedList`, `toggleHeading`, `insertTable`, `tidyAll`, `applyEdit` | admin editor          | What each toolbar button does: pure functions from text and selection to a replacement.                      |

## Using it from an app

The package ships raw TypeScript, so each app must:

1. depend on it (`"@powermysport/rich-text": "*"` in its `package.json`),
2. list it in `transpilePackages` in `next.config.ts`, and
3. **add a Tailwind source line to `globals.css`**:

   ```css
   @source "../../../packages/rich-text/src";
   ```

Step 3 is easy to miss and fails quietly. `RichText` carries Tailwind classes of its
own, and Tailwind v4 only generates classes from files it scans. A workspace package
sits outside the app, so without that line the page renders, but its lists, tables and
headings come out unstyled.

## Safety

`RichText` never builds an HTML string, so there is no sanitiser for the server and
browser to disagree about. Raw HTML in the text is dropped (`skipHtml`), only a fixed
set of elements is drawn, links go through react-markdown's URL filter (no
`javascript:`), images and code are not drawn, and every heading level is drawn as one
small `h4`.

## Tests

The renderer's tests are in `client/tests/richText.test.tsx`; the paste cleaner, toolbar
logic and editor component are tested in `admin/tests/richText*.test.ts(x)`.
