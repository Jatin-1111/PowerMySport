import assert from "node:assert/strict";
import test from "node:test";
import {
  detailPageDateAgrees,
  harvestDocuments,
  parseCategoryToAgeGroups,
  stripSiteChrome,
  validateEditions,
} from "../admin/services/DataSourceExtractionService";

const AITA_DETAIL_URL = "https://aitatennis.com/tournament-content/?id=4997";

/**
 * Trimmed from the real AITA tournament page — the markup shape that motivated
 * the detail-page pass. Two acceptance lists plus a fact sheet on a signed
 * Azure blob URL, alongside the site chrome that must NOT be picked up.
 */
const AITA_DETAIL_HTML = `
<h1>TOURNAMENT CALENDAR 2026</h1>
<h4>AITA CHAMPIONSHIP SERIES TOURNAMENT (DELHI)</h4>
<div class="acc_sheet">Category - Under 18</div>
<div class="acc_sheet">Date - 10-08-2026</div>
<div class="acc_sheet">Download -
  <a target="_blank" href="https://bwtaitaprod.blob.core.windows.net/aitaors-files/data/factsheet/factsheet_1783944109.pdf?sv=2026-02-06&amp;se=2027-07-19T23:41:44Z">Fact Sheet</a>
</div>
<div class="acc_sheet">Download -
  <a href="https://aitatennis.com/acceptancelist?eventuid=8775&amp;acceptid=30066">Girls Under 18</a>
</div>
<div class="acc_sheet">Download -
  <a href="acceptancelist?eventuid=8774&amp;acceptid=30066">Boys Under 18</a>
</div>
<a href="https://twitter.com/AITA__Tennis">Tweets by AITA__Tennis</a>
<a href="https://aitatennis.com/news/some-story/">India's best Junior talent set for U18 Nationals</a>
`;

test("harvestDocuments picks up fact sheets and acceptance lists, ignoring chrome", () => {
  const documents = harvestDocuments(AITA_DETAIL_HTML, AITA_DETAIL_URL);

  assert.equal(documents.length, 3);
  assert.deepEqual(
    documents.map((d) => d.kind),
    ["factSheet", "acceptanceList", "acceptanceList"]
  );
  // A news headline is not a document, and a social link never is.
  assert.ok(!documents.some((d) => /twitter\.com/.test(d.url)));
  assert.ok(!documents.some((d) => /Junior talent/.test(d.label)));
});

test("harvestDocuments resolves relative hrefs against the page", () => {
  const documents = harvestDocuments(AITA_DETAIL_HTML, AITA_DETAIL_URL);

  const relative = documents.find((d) => d.label === "Boys Under 18");
  assert.equal(
    relative?.url,
    "https://aitatennis.com/tournament-content/acceptancelist?eventuid=8774&acceptid=30066"
  );
});

test("harvestDocuments decodes &amp; in hrefs so query strings stay valid", () => {
  const documents = harvestDocuments(AITA_DETAIL_HTML, AITA_DETAIL_URL);

  // Left encoded, these send a parameter literally named "amp;acceptid", and on
  // the signed fact-sheet URL they corrupt the signature into a dead download.
  assert.ok(!documents.some((d) => d.url.includes("&amp;")));

  const factSheet = documents.find((d) => d.kind === "factSheet");
  assert.equal(
    factSheet?.url,
    "https://bwtaitaprod.blob.core.windows.net/aitaors-files/data/factsheet/factsheet_1783944109.pdf?sv=2026-02-06&se=2027-07-19T23:41:44Z"
  );
});

test("harvestDocuments treats any downloadable file as a document whatever the label", () => {
  const documents = harvestDocuments(
    `<a href="/files/hotel-list.pdf">Click here</a>`,
    AITA_DETAIL_URL
  );
  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.kind, "other");
});

test("harvestDocuments accepts an HTML fact sheet — ITF events do not link a PDF", () => {
  const documents = harvestDocuments(
    `<a href="https://www.itftennis.com/en/tournament/m15-ahmedabad/ind/2026/">Fact Sheet</a>`,
    AITA_DETAIL_URL
  );
  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.kind, "factSheet");
});

/**
 * AITA's every page carries a site-wide "Forms" menu of a dozen generic PDFs
 * (constitution, code of conduct, circuit rules). Harvested raw, those twelve
 * fill the cap and evict the one fact sheet the page exists to publish — the
 * page's own document appears LAST in source order. Stripping chrome removes
 * them; ranking by kind keeps the fact sheet safe even if some menu survives.
 */
const CHROME_HEAVY_HTML = `
<nav class="main-menu">
  <a href="/wp-content/uploads/2023/08/AITA_Constitution.pdf">AITA Constitution</a>
  <a href="/wp-content/uploads/2020/10/Affiliations.pdf">Affiliations</a>
  <a href="/wp-content/uploads/2023/10/Code_of_Conduct.pdf">Code of Conduct</a>
</nav>
<div class="post_content">
  <h4>AITA CHAMPIONSHIP SERIES TOURNAMENT (CHANDIGARH)</h4>
  <a href="https://bwtaitaprod.blob.core.windows.net/f/factsheet_1784987123.pdf?sig=abc">Fact Sheet</a>
</div>
`;

test("stripSiteChrome removes the nav menu that would otherwise evict the fact sheet", () => {
  const documents = harvestDocuments(stripSiteChrome(CHROME_HEAVY_HTML), AITA_DETAIL_URL);

  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.kind, "factSheet");
});

test("harvestDocuments ranks the fact sheet above generic chrome that survives stripping", () => {
  // No stripping at all — the worst case for a federation site we have not seen.
  const documents = harvestDocuments(CHROME_HEAVY_HTML, AITA_DETAIL_URL);

  assert.equal(documents[0]?.kind, "factSheet");
  assert.ok(documents[0]?.url.includes("factsheet_1784987123"));
});

test("detailPageDateAgrees accepts the ambiguous DD-MM-YYYY the source prints", () => {
  // "10-08-2026" is the 10th of August; read as MM-DD it would be 8 October.
  assert.equal(detailPageDateAgrees("Date - 10-08-2026", "2026-08-10"), true);
});

test("detailPageDateAgrees tolerates a week-start date against the exact date", () => {
  assert.equal(detailPageDateAgrees("Date - 21-09-2026", "2026-09-21"), true);
  assert.equal(detailPageDateAgrees("Date - 25-09-2026", "2026-09-21"), true);
});

test("detailPageDateAgrees rejects a page describing a different event", () => {
  assert.equal(detailPageDateAgrees("Date - 10-03-2026", "2026-08-10"), false);
});

test("detailPageDateAgrees accepts a page that states no date at all", () => {
  // Losing a real fact sheet is worse than accepting an undated page.
  assert.equal(detailPageDateAgrees("Entries close soon.", "2026-08-10"), true);
});

/**
 * validateEditions is a whitelist that rebuilds each entry field by field, and
 * it runs a SECOND time on the saved draft at approval time. Any detail-page
 * field it forgets is silently discarded there — every edition would publish
 * with no fact sheet while extraction and review both looked perfectly healthy.
 */
test("validateEditions carries detail-page fields through to approval", () => {
  const enriched = [
    {
      name: "AITA CS7 (Delhi)",
      startDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      ageGroups: ["Under-18"],
      detailUrl: "https://aitatennis.com/tournament-content/?id=4997",
      officialName: "AITA CHAMPIONSHIP SERIES TOURNAMENT (DELHI)",
      organiser: "MASTER MIND TENNIS ACADEMY",
      state: "Delhi",
      category: "Under 18",
      documents: [
        { label: "Fact Sheet", url: "https://example.com/factsheet.pdf", kind: "factSheet" },
      ],
    },
  ];

  const { valid } = validateEditions(enriched);

  assert.equal(valid.length, 1);
  const edition = valid[0]!;
  assert.equal(edition.officialName, "AITA CHAMPIONSHIP SERIES TOURNAMENT (DELHI)");
  assert.equal(edition.organiser, "MASTER MIND TENNIS ACADEMY");
  assert.equal(edition.state, "Delhi");
  assert.equal(edition.category, "Under 18");
  assert.equal(edition.documents?.length, 1);
  assert.equal(edition.documents?.[0]?.kind, "factSheet");
});

test("validateEditions drops a document whose url is not http(s)", () => {
  const { valid } = validateEditions([
    {
      name: "AITA CS7 (Delhi)",
      startDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      documents: [
        { label: "Fact Sheet", url: "javascript:alert(1)", kind: "factSheet" },
        { label: "Real", url: "https://example.com/a.pdf", kind: "factSheet" },
      ],
    },
  ]);

  assert.equal(valid[0]?.documents?.length, 1);
  assert.equal(valid[0]?.documents?.[0]?.label, "Real");
});

test("parseCategoryToAgeGroups splits run-on categories", () => {
  assert.deepEqual(parseCategoryToAgeGroups("Under 12 Under 16"), ["Under-12", "Under-16"]);
  assert.deepEqual(parseCategoryToAgeGroups("Men Women"), ["Men", "Women"]);
  assert.deepEqual(parseCategoryToAgeGroups("Under 18"), ["Under-18"]);
  assert.deepEqual(parseCategoryToAgeGroups(undefined), []);
});
