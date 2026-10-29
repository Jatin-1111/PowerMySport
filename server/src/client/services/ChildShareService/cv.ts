import path from "path";
import PDFDocument from "pdfkit";
import {
  CHILD_HISTORY_SOURCE_LABELS,
  type ChildAcademicBoard,
  type ChildSharePublicRow,
  type ChildSharePublicView,
  type ChildShareSection,
} from "@powermysport/shared-types";

/**
 * The sporting CV as a PDF: the same profile a link shows, laid out for a printer or an inbox.
 *
 * It is drawn from a `ChildSharePublicView`, the response the share serializer builds, and from
 * nothing else. So the PDF can only contain what the page contains, for the sections the parent
 * ticked, and a field the serializer does not send cannot reach it. The page and the PDF
 * disagreeing would need one of them to read from somewhere else, and neither does.
 *
 * The PDF does not carry the link. A file is forwarded, kept and attached to emails in ways a
 * link the family can stop is not, and a link inside it would outlive its meaning. Videos are
 * named, with a line saying they are on the shared page.
 *
 * Roboto is registered because the built-in fonts cannot draw every character a name or a
 * result link may hold; it is the font the invoices use.
 */

const ROBOTO_DIR = path.join(
  require.resolve("roboto-fontface/package.json"),
  "..",
  "fonts",
  "roboto"
);
const ROBOTO_REGULAR = path.join(ROBOTO_DIR, "Roboto-Regular.woff");
const ROBOTO_BOLD = path.join(ROBOTO_DIR, "Roboto-Bold.woff");

const INK = "#1C1B1A";
const BODY = "#4A4741";
const HAIRLINE = "#E1DCD3";

const MARGIN = 48;
const DATE_COLUMN = 92;

const BOARD_LABELS: Record<ChildAcademicBoard, string> = {
  CBSE: "CBSE",
  ICSE: "ICSE",
  ISC: "ISC",
  IB: "IB",
  STATE: "State board",
  OTHER: "Other",
};

const SECTION_TITLES: Record<ChildShareSection, string> = {
  results: "Results",
  ranking: "Rankings",
  coaching: "Coaching",
  fitness: "Fitness",
  awards: "Awards",
  academics: "Academics",
  videos: "Videos",
};

const ORDER: ChildShareSection[] = [
  "results",
  "ranking",
  "awards",
  "coaching",
  "fitness",
  "academics",
];

/** Dates are stored as UTC midnight, so they are drawn in UTC. */
const formatDate = (iso: string, precision: ChildSharePublicRow["datePrecision"]): string => {
  const date = new Date(iso);
  if (precision === "year") return String(date.getUTCFullYear());
  if (precision === "month") {
    return date.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const dayOf = (iso: string) => formatDate(iso, "day");

const duration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;

/** A file name that is safe in a header: letters and digits from the child's name. */
export const cvFileName = (view: Pick<ChildSharePublicView, "child">): string => {
  const slug = view.child.name
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return `${slug || "child"}-sporting-profile.pdf`;
};

export const renderCvPdf = (view: ChildSharePublicView): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: MARGIN + 12, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: { Title: `${view.child.name}, sporting profile`, Producer: "PowerMySport" },
    });
    doc.registerFont("Roboto", ROBOTO_REGULAR);
    doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer | string) =>
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    );
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - MARGIN * 2;
    const bottom = () => doc.page.height - doc.page.margins.bottom;

    /** Moves to a new page when `height` more would run into the bottom margin. */
    const room = (height: number) => {
      if (doc.y + height > bottom()) doc.addPage();
    };

    const rule = () => {
      doc
        .moveTo(MARGIN, doc.y)
        .lineTo(MARGIN + width, doc.y)
        .lineWidth(0.5)
        .strokeColor(HAIRLINE)
        .stroke();
    };

    const heading = (text: string) => {
      room(60);
      doc.moveDown(1.2);
      doc.font("Roboto-Bold").fontSize(13).fillColor(INK).text(text, MARGIN, doc.y, { width });
      doc.moveDown(0.3);
      rule();
      doc.moveDown(0.5);
    };

    // ── Header ────────────────────────────────────────────────────────────────
    doc
      .font("Roboto-Bold")
      .fontSize(26)
      .fillColor(INK)
      .text(view.child.name, MARGIN, MARGIN, { width });

    const level = view.child.level
      ? view.child.level.charAt(0).toUpperCase() + view.child.level.slice(1)
      : null;
    const where = [
      view.child.sport,
      level,
      view.child.sinceYear ? `since ${view.child.sinceYear}` : null,
      view.child.state,
      view.child.classYear ? `Class of ${view.child.classYear}` : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (where) doc.moveDown(0.3).font("Roboto").fontSize(12).fillColor(BODY).text(where, { width });

    doc
      .moveDown(0.8)
      .font("Roboto")
      .fontSize(9)
      .fillColor(BODY)
      .text(
        `Shared by the family on ${dayOf(view.sharedAt)}. The link it came from expires on ${dayOf(view.expiresAt)}.`,
        { width }
      )
      .moveDown(0.2)
      .text(view.notice, { width });

    const stats = [
      view.stats.yearsInSport ? `Years in sport: ${view.stats.yearsInSport}` : null,
      view.stats.tournaments ? `Tournaments: ${view.stats.tournaments}` : null,
      view.stats.awards ? `Awards: ${view.stats.awards}` : null,
    ].filter(Boolean);
    if (stats.length > 0) {
      doc
        .moveDown(0.8)
        .font("Roboto-Bold")
        .fontSize(11)
        .fillColor(INK)
        .text(stats.join("      "), { width });
    }

    // ── Sections ──────────────────────────────────────────────────────────────
    for (const section of ORDER) {
      const rows = view.timeline.filter((row) => row.section === section);
      const academics = section === "academics" ? view.academics : null;
      if (rows.length === 0 && !academics) continue;

      heading(SECTION_TITLES[section]);

      if (academics) {
        const facts = [
          academics.board ? `Board: ${BOARD_LABELS[academics.board]}` : null,
          academics.school ? `School: ${academics.school}` : null,
          academics.intendedField ? `Wants to study: ${academics.intendedField}` : null,
        ].filter(Boolean);
        if (facts.length > 0) {
          room(20);
          doc
            .font("Roboto")
            .fontSize(10)
            .fillColor(INK)
            .text(facts.join("      "), MARGIN, doc.y, { width });
          doc.moveDown(0.5);
        }
      }

      for (const row of rows) {
        const date =
          formatDate(row.occurredOn, row.datePrecision) +
          (row.endedOn ? ` to ${formatDate(row.endedOn, row.datePrecision)}` : "");
        const title = row.resultLabel ? `${row.title}  ·  ${row.resultLabel}` : row.title;
        const bodyWidth = width - DATE_COLUMN;

        doc.font("Roboto-Bold").fontSize(10.5);
        const titleHeight = doc.heightOfString(title, { width: bodyWidth });
        doc.font("Roboto").fontSize(9.5);
        const detailHeight = row.detail
          ? doc.heightOfString(row.detail, { width: bodyWidth }) + 2
          : 0;
        const linkHeight = row.resultUrl
          ? doc.heightOfString(row.resultUrl, { width: bodyWidth }) + 2
          : 0;
        const needed = titleHeight + detailHeight + linkHeight + 24;
        room(needed);

        const top = doc.y;
        doc
          .font("Roboto")
          .fontSize(9.5)
          .fillColor(BODY)
          .text(date, MARGIN, top, { width: DATE_COLUMN - 8 });

        doc
          .font("Roboto-Bold")
          .fontSize(10.5)
          .fillColor(INK)
          .text(title, MARGIN + DATE_COLUMN, top, {
            width: bodyWidth,
          });
        if (row.detail) {
          doc
            .font("Roboto")
            .fontSize(9.5)
            .fillColor(BODY)
            .text(row.detail, MARGIN + DATE_COLUMN, doc.y + 2, {
              width: bodyWidth,
            });
        }
        doc
          .font("Roboto")
          .fontSize(8.5)
          .fillColor(BODY)
          .text(CHILD_HISTORY_SOURCE_LABELS[row.source], MARGIN + DATE_COLUMN, doc.y + 3, {
            width: bodyWidth,
          });
        if (row.resultUrl) {
          doc
            .font("Roboto")
            .fontSize(8.5)
            .fillColor(INK)
            .text(row.resultUrl, MARGIN + DATE_COLUMN, doc.y + 1, {
              width: bodyWidth,
              link: row.resultUrl,
              underline: true,
            });
        }
        doc.y += 10;
      }
    }

    // ── Videos ────────────────────────────────────────────────────────────────
    if (view.videos.length > 0) {
      heading(SECTION_TITLES.videos);
      for (const clip of view.videos) {
        room(24);
        const meta =
          clip.durationSeconds !== undefined ? `  ·  ${duration(clip.durationSeconds)}` : "";
        doc
          .font("Roboto")
          .fontSize(10.5)
          .fillColor(INK)
          .text(`${clip.title ?? "Video"}${meta}`, MARGIN, doc.y, {
            width,
          });
        doc.moveDown(0.3);
      }
      doc
        .font("Roboto")
        .fontSize(9)
        .fillColor(BODY)
        .text("The videos are on the shared page.", MARGIN, doc.y + 2, {
          width,
        });
    }

    if (view.timeline.length === 0 && view.videos.length === 0 && !view.academics) {
      doc
        .moveDown(1.5)
        .font("Roboto")
        .fontSize(11)
        .fillColor(BODY)
        .text("Nothing has been added to the sections shared here yet.", { width });
    }

    // ── Footer on every page ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);
      const y = doc.page.height - MARGIN + 6;
      // Drawn below the bottom margin, so writing it cannot start a new page.
      doc.page.margins.bottom = 0;
      doc
        .font("Roboto")
        .fontSize(8)
        .fillColor(BODY)
        .text(
          `PowerMySport  ·  Provided by the family, not verified  ·  Page ${index + 1} of ${range.count}`,
          MARGIN,
          y,
          {
            width,
            align: "center",
            lineBreak: false,
          }
        );
    }

    doc.end();
  });
