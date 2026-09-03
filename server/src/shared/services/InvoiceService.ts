import PDFDocument from "pdfkit";
import path from "path";
import {
  COMPANY_CIN,
  COMPANY_DISPLAY_NAME,
  COMPANY_GSTIN,
  COMPANY_LEGAL_NAME,
  COMPANY_ADDRESS_LINES,
  COMPANY_SUPPORT_EMAIL,
  COMPANY_TAGLINE,
  COMPANY_WEBSITE,
} from "../constants/company";

/**
 * PDFKit's built-in standard-14 fonts (Helvetica etc.) only support WinAnsi
 * encoding, which has no glyph for ₹ (U+20B9) — it silently mis-renders as
 * the low byte of the code point. Roboto (bundled via `roboto-fontface`,
 * OFL-licensed, ships as WOFF which fontkit reads directly) does include it,
 * so it's registered per-document below and used everywhere instead of
 * Helvetica. Courier remains fine for mono fields since none of those ever
 * contain a currency symbol.
 */
const ROBOTO_DIR = path.join(
  require.resolve("roboto-fontface/package.json"),
  "..",
  "fonts",
  "roboto"
);
const ROBOTO_REGULAR = path.join(ROBOTO_DIR, "Roboto-Regular.woff");
const ROBOTO_BOLD = path.join(ROBOTO_DIR, "Roboto-Bold.woff");

/**
 * Renders the 4 booking-flow tax invoices (venue / coach / academy / expert)
 * as a single-page A4 PDF that mirrors the approved HTML templates pixel for
 * pixel: same section order, spacing, and color tokens, converted from the
 * templates' 794x1123 CSS-px canvas into PDF points via SCALE.
 *
 * 'Geist Mono' (used for invoice numbers, GSTIN/CIN, transaction IDs in the
 * templates) isn't embeddable here — PDFKit's built-in Courier stands in for
 * it, which is visually equivalent for this monospace-numeric use.
 */

const BRAND = {
  orange: "#E97316",
  slate: "#0F172A",
  line: "#E2E8F0",
  text: "#0F172A",
  muted: "#94A3B8",
  mutedDark: "#64748B",
  labelGray: "#64748B",
  valueGray: "#334155",
  soft: "#F8FAFC",
  divider: "#F1F5F9",
  white: "#FFFFFF",
  green: "#22C55E",
  badgeGreenBg: "#DCFCE7",
  badgeGreenText: "#166534",
};

const CANVAS_WIDTH = 794;
const CANVAS_HEIGHT = 1123;
const CONTENT_PAD_X = 40;

export interface InvoiceLineItem {
  description: string;
  note?: string | undefined;
  qty: number;
  rate: number; // rupees
}

export interface InvoiceDetailField {
  label: string;
  value: string;
  mono?: boolean | undefined;
}

export interface InvoiceServiceProvider {
  name: string;
  addressLines: string[];
  gstin?: string | undefined;
}

export interface InvoicePaymentReference {
  method: string;
  merchantOrderId: string;
  transactionId?: string | undefined;
  paidAt?: Date | undefined;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  subtitle: string;
  billedTo: { name: string; email: string; phone: string };
  placeOfSupply: string;
  serviceProvider?: InvoiceServiceProvider | undefined;
  detailsSectionTitle: string;
  detailsBadge: string;
  detailFields: InvoiceDetailField[];
  lineItems: InvoiceLineItem[];
  payment: InvoicePaymentReference;
  discountLabel?: string | undefined;
  discountAmount: number;
  gstRatePercent: number;
  gstAmount: number;
  totalAmount: number;
  footerNote?: string | undefined;
}

export const formatINR = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return `₹${safe.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatInvoiceDate = (date: Date): string =>
  date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const formatInvoiceDateTime = (date: Date): string => {
  const datePart = formatInvoiceDate(date);
  const timePart = date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart}, ${timePart} IST`;
};

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const twoDigitsToWords = (n: number): string => {
  if (n < 20) return ONES[n] || "";
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens] || ""}${ones ? ` ${ONES[ones] || ""}` : ""}`;
};

const threeDigitsToWords = (n: number): string => {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
};

/** Indian numbering (thousand/lakh/crore) — whole-rupee words for "Amount in words". */
export const numberToIndianWords = (amount: number): string => {
  const rupees = Math.round(Math.max(0, amount));
  if (rupees === 0) return "Zero Rupees Only";

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));

  return `${parts.join(" ")} Rupees Only`;
};

const collectPdfBuffer = (doc: InstanceType<typeof PDFDocument>): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
};

export const renderInvoicePdf = async (data: InvoiceData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  doc.registerFont("Roboto", ROBOTO_REGULAR);
  doc.registerFont("Roboto-Bold", ROBOTO_BOLD);
  const SCALE = doc.page.width / CANVAS_WIDTH;
  const s = (v: number): number => v * SCALE;

  const pageWidth = doc.page.width;
  const contentX = s(CONTENT_PAD_X);
  const contentWidth = pageWidth - s(CONTENT_PAD_X) * 2;

  let cursorY = 0;

  // ---- helpers -------------------------------------------------------

  const text = (
    str: string,
    x: number,
    y: number,
    opts: {
      size: number;
      bold?: boolean;
      mono?: boolean;
      color?: string;
      width?: number;
      align?: "left" | "right" | "center";
      letterSpacingEm?: number;
      uppercase?: boolean;
    }
  ): void => {
    const fontSize = s(opts.size);
    const font = opts.mono
      ? opts.bold
        ? "Courier-Bold"
        : "Courier"
      : opts.bold
        ? "Roboto-Bold"
        : "Roboto";
    doc
      .fillColor(opts.color || BRAND.text)
      .font(font)
      .fontSize(fontSize);
    const renderStr = opts.uppercase ? str.toUpperCase() : str;
    const drawOpts: PDFKit.Mixins.TextOptions = {};
    if (opts.width !== undefined) drawOpts.width = opts.width;
    if (opts.align) drawOpts.align = opts.align;
    if (opts.letterSpacingEm) {
      drawOpts.characterSpacing = opts.letterSpacingEm * fontSize;
    }
    doc.text(renderStr, x, y, drawOpts);
  };

  const heightOf = (str: string, width: number, size: number, bold = false): number => {
    doc.font(bold ? "Roboto-Bold" : "Roboto").fontSize(s(size));
    return doc.heightOfString(str, { width });
  };

  const roundedRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    stroke?: string
  ): void => {
    doc.save();
    doc.roundedRect(x, y, w, h, r);
    if (stroke) doc.fillAndStroke(fill, stroke);
    else doc.fill(fill);
    doc.restore();
  };

  const hLine = (x: number, y: number, w: number, color: string): void => {
    doc.save();
    doc
      .moveTo(x, y)
      .lineTo(x + w, y)
      .lineWidth(s(1))
      .stroke(color);
    doc.restore();
  };

  // ---- 1. header -------------------------------------------------------

  const headerPadTop = s(26);
  const headerPadX = s(40);
  const headerContentHeight = s(28) + s(6) + s(11 * 1.3);
  const badgeHeight = s(26);
  const headerRightHeight = badgeHeight + s(8) + s(11 * 1.3);
  const headerHeight = headerPadTop + Math.max(headerContentHeight, headerRightHeight) + s(22);

  roundedRect(0, cursorY, pageWidth, headerHeight, 0, BRAND.orange);

  text(COMPANY_DISPLAY_NAME, headerPadX, cursorY + headerPadTop, {
    size: 28,
    bold: true,
    color: BRAND.white,
  });
  text(COMPANY_TAGLINE, headerPadX, cursorY + headerPadTop + s(28) + s(6), {
    size: 11,
    bold: true,
    color: "rgba(255,255,255,0.85)",
    uppercase: true,
    letterSpacingEm: 0.16,
  });

  const headerRightColRight = pageWidth - headerPadX;
  const subtitleUpper = data.subtitle.toUpperCase();
  const subtitleFontSize = s(11);
  doc.font("Roboto-Bold").fontSize(subtitleFontSize);
  const subtitleCharSpacing = 0.14 * subtitleFontSize;
  const subtitleTextWidth =
    doc.widthOfString(subtitleUpper) + subtitleCharSpacing * subtitleUpper.length;
  const headerRightColWidth = Math.min(s(320), Math.max(s(140), subtitleTextWidth + s(4)));
  const headerRightColX = headerRightColRight - headerRightColWidth;

  const badgeWidth = s(80);
  const badgeX = headerRightColRight - badgeWidth;
  const badgeY = cursorY + headerPadTop;
  roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, s(13), BRAND.slate);
  doc
    .save()
    .circle(badgeX + s(16), badgeY + badgeHeight / 2, s(3.5))
    .fill(BRAND.green)
    .restore();
  text("PAID", badgeX + s(24), badgeY + s(8), {
    size: 11,
    bold: true,
    color: BRAND.white,
    uppercase: true,
    letterSpacingEm: 0.1,
  });
  text(data.subtitle, headerRightColX, badgeY + badgeHeight + s(8), {
    size: 11,
    bold: true,
    color: "rgba(255,255,255,0.8)",
    uppercase: true,
    letterSpacingEm: 0.14,
    width: headerRightColWidth,
    align: "right",
  });

  cursorY += headerHeight;

  // ---- 2. slate divider --------------------------------------------

  doc.rect(0, cursorY, pageWidth, s(4)).fill(BRAND.slate);
  cursorY += s(4);

  // ---- 3. meta strip -------------------------------------------------

  const metaColWidth = pageWidth / 3;
  const metaPadV = s(14);
  const metaHeight = metaPadV + s(9) + s(3) + s(16) + metaPadV;
  doc.rect(0, cursorY, pageWidth, metaHeight).fill(BRAND.soft);
  hLine(0, cursorY + metaHeight, pageWidth, BRAND.line);

  const metaLabelOpts = {
    size: 9,
    bold: true,
    color: BRAND.muted,
    uppercase: true,
    letterSpacingEm: 0.12,
  };

  text("Invoice number", contentX, cursorY + metaPadV, metaLabelOpts);
  text(data.invoiceNumber, contentX, cursorY + metaPadV + s(13), {
    size: 13,
    bold: true,
    mono: true,
    color: BRAND.text,
  });

  const col2X = metaColWidth + s(20);
  hLine(metaColWidth, cursorY, s(1), BRAND.line);
  text("Issue date", col2X, cursorY + metaPadV, metaLabelOpts);
  text(formatInvoiceDate(data.issueDate), col2X, cursorY + metaPadV + s(13), {
    size: 13,
    bold: true,
    color: BRAND.text,
  });

  const col3X = metaColWidth * 2 + s(40);
  const col3Width = pageWidth - contentX - col3X;
  hLine(metaColWidth * 2, cursorY, s(1), BRAND.line);
  text("Amount paid", col3X, cursorY + metaPadV, {
    ...metaLabelOpts,
    width: col3Width,
    align: "right",
  });
  text(formatINR(data.totalAmount), col3X, cursorY + metaPadV + s(13), {
    size: 16,
    bold: true,
    color: BRAND.orange,
    width: col3Width,
    align: "right",
  });

  cursorY += metaHeight;

  // ---- 4. content area -------------------------------------------------

  const sectionGap = s(data.serviceProvider ? 13 : 20);
  cursorY += s(20);

  // -- 4a. billed to / billed by --

  const halfWidth = (contentWidth - s(16)) / 2;
  const cardPadX = s(18);
  const cardPadY = s(16);

  const addrHeight = (() => {
    doc.font("Roboto").fontSize(s(12));
    return doc.heightOfString(COMPANY_ADDRESS_LINES.join("\n"), {
      width: halfWidth - cardPadX * 2,
    });
  })();

  const infoCardHeight =
    cardPadY +
    s(9 * 1.3) + // "BILLED TO" label
    s(10) + // gap
    s(15 * 1.3) + // name
    s(2) +
    s(12 * 1.3) + // email
    s(12 * 1.3) + // phone
    s(10) + // gap before divider
    s(1) + // divider
    s(10) + // gap after divider
    s(11 * 1.3) + // "place of supply" label
    s(2) +
    s(12 * 1.3) + // value
    cardPadY;

  const infoCardHeightRight =
    cardPadY +
    s(9 * 1.3) +
    s(10) +
    s(15 * 1.3) +
    s(2) +
    addrHeight +
    s(10) +
    s(1) +
    s(10) +
    s(11 * 1.3) +
    s(2) +
    cardPadY;

  const infoCardHeightMax = Math.max(infoCardHeight, infoCardHeightRight);

  roundedRect(contentX, cursorY, halfWidth, infoCardHeightMax, s(12), BRAND.white, BRAND.line);
  roundedRect(
    contentX + halfWidth + s(16),
    cursorY,
    halfWidth,
    infoCardHeightMax,
    s(12),
    BRAND.white,
    BRAND.line
  );

  const labelSmall = {
    size: 9,
    bold: true,
    color: BRAND.muted,
    uppercase: true,
    letterSpacingEm: 0.14,
  };

  // Billed to
  let ly = cursorY + cardPadY;
  const leftInnerX = contentX + cardPadX;
  const innerWidth = halfWidth - cardPadX * 2;
  text("Billed to", leftInnerX, ly, labelSmall);
  ly += s(9 * 1.3) + s(10);
  text(data.billedTo.name, leftInnerX, ly, {
    size: 15,
    bold: true,
    color: BRAND.text,
    width: innerWidth,
  });
  ly += s(15 * 1.3) + s(2);
  text(data.billedTo.email || "-", leftInnerX, ly, {
    size: 12,
    color: BRAND.mutedDark,
    width: innerWidth,
  });
  ly += s(12 * 1.3);
  text(data.billedTo.phone || "-", leftInnerX, ly, {
    size: 12,
    color: BRAND.mutedDark,
    width: innerWidth,
  });
  ly += s(12 * 1.3) + s(10);
  hLine(leftInnerX, ly, innerWidth, BRAND.divider);
  ly += s(1) + s(10);
  text("Place of supply", leftInnerX, ly, { size: 11, color: BRAND.muted });
  ly += s(11 * 1.3) + s(2);
  text(data.placeOfSupply, leftInnerX, ly, {
    size: 12,
    bold: true,
    color: BRAND.valueGray,
  });

  // Billed by (always PowerMySport)
  let ry = cursorY + cardPadY;
  const rightInnerX = contentX + halfWidth + s(16) + cardPadX;
  text("Billed by", rightInnerX, ry, labelSmall);
  ry += s(9 * 1.3) + s(10);
  text(COMPANY_LEGAL_NAME, rightInnerX, ry, {
    size: 15,
    bold: true,
    color: BRAND.text,
    width: innerWidth,
  });
  ry += s(15 * 1.3) + s(2);
  text(COMPANY_ADDRESS_LINES.join("\n"), rightInnerX, ry, {
    size: 12,
    color: BRAND.mutedDark,
    width: innerWidth,
  });
  ry += addrHeight + s(10);
  hLine(rightInnerX, ry, innerWidth, BRAND.divider);
  ry += s(1) + s(10);
  const halfInner = innerWidth / 2;
  text("GSTIN", rightInnerX, ry, { size: 11, color: BRAND.muted });
  text("CIN", rightInnerX + halfInner, ry, { size: 11, color: BRAND.muted });
  ry += s(11 * 1.3) + s(2);
  text(COMPANY_GSTIN, rightInnerX, ry, {
    size: 11.5,
    bold: true,
    mono: true,
    color: BRAND.valueGray,
  });
  text(COMPANY_CIN, rightInnerX + halfInner, ry, {
    size: 11.5,
    bold: true,
    mono: true,
    color: BRAND.valueGray,
  });

  cursorY += infoCardHeightMax + sectionGap;

  // -- 4b. service provider (venue/coach/academy only) --

  if (data.serviceProvider) {
    const sp = data.serviceProvider;
    const spAddrHeight = (() => {
      doc.font("Roboto").fontSize(s(11.5));
      return doc.heightOfString(sp.addressLines.join("\n"), {
        width: contentWidth * 0.6,
      });
    })();
    const spPadY = s(14);
    const spHeight = spPadY + s(9 * 1.3) + s(3) + s(14 * 1.3) + s(3) + spAddrHeight + spPadY;

    roundedRect(contentX, cursorY, contentWidth, spHeight, s(12), BRAND.soft, BRAND.line);

    const spInnerX = contentX + cardPadX;
    let spy = cursorY + spPadY;
    text("Service provider", spInnerX, spy, labelSmall);
    spy += s(9 * 1.3) + s(3);
    text(sp.name, spInnerX, spy, {
      size: 14,
      bold: true,
      color: BRAND.text,
      width: contentWidth * 0.6,
    });
    spy += s(14 * 1.3) + s(3);
    text(sp.addressLines.join("\n"), spInnerX, spy, {
      size: 11.5,
      color: BRAND.mutedDark,
      width: contentWidth * 0.6,
    });

    const spRightX = contentX + contentWidth - cardPadX - s(180);
    let spry = cursorY + spPadY;
    text("Provider GSTIN", spRightX, spry, {
      size: 11,
      color: BRAND.muted,
      width: s(180),
      align: "right",
    });
    spry += s(11 * 1.3) + s(2);
    text(sp.gstin || "-", spRightX, spry, {
      size: 11.5,
      bold: true,
      mono: true,
      color: BRAND.valueGray,
      width: s(180),
      align: "right",
    });

    cursorY += spHeight + sectionGap;
  }

  // -- 4c. details card --

  const detailsHeaderH = s(11) + s(9 * 1.3) + s(11);
  const detailRows = Math.ceil(data.detailFields.length / 3);
  const detailRowH = s(10.5 * 1.3) + s(2) + s(13 * 1.3);
  const detailsGridPadY = s(13);
  const detailsGridH = detailsGridPadY * 2 + detailRows * detailRowH + (detailRows - 1) * s(11);
  const detailsCardH = detailsHeaderH + detailsGridH;

  roundedRect(contentX, cursorY, contentWidth, detailsCardH, s(12), BRAND.white, BRAND.line);
  doc.rect(contentX, cursorY, contentWidth, detailsHeaderH).fill(BRAND.soft);
  hLine(contentX, cursorY + detailsHeaderH, contentWidth, BRAND.line);

  text(data.detailsSectionTitle, contentX + cardPadX, cursorY + s(11), {
    size: 9,
    bold: true,
    color: BRAND.labelGray,
    uppercase: true,
    letterSpacingEm: 0.14,
  });

  const badgeText = data.detailsBadge.toUpperCase();
  doc.font("Roboto-Bold").fontSize(s(10));
  const badgeTextWidth = doc.widthOfString(badgeText);
  const detailsBadgeW = badgeTextWidth + s(18);
  roundedRect(
    contentX + contentWidth - cardPadX - detailsBadgeW,
    cursorY + s(11) - s(3),
    detailsBadgeW,
    s(19),
    s(10),
    BRAND.badgeGreenBg
  );
  text(badgeText, contentX + contentWidth - cardPadX - detailsBadgeW, cursorY + s(11), {
    size: 10,
    bold: true,
    color: BRAND.badgeGreenText,
    width: detailsBadgeW,
    align: "center",
    letterSpacingEm: 0.06,
  });

  const fieldsTop = cursorY + detailsHeaderH + detailsGridPadY;
  const detailColW = (contentWidth - cardPadX * 2 - s(20) * 2) / 3;
  data.detailFields.forEach((field, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const fx = contentX + cardPadX + col * (detailColW + s(20));
    const fy = fieldsTop + row * (detailRowH + s(11));
    text(field.label, fx, fy, {
      size: 10.5,
      color: BRAND.muted,
      width: detailColW,
    });
    text(field.value, fx, fy + s(10.5 * 1.3) + s(2), {
      size: field.mono ? 12 : 13,
      bold: true,
      mono: !!field.mono,
      color: BRAND.text,
      width: detailColW,
    });
  });

  cursorY += detailsCardH + sectionGap;

  // -- 4d. line items table --

  const qtyColW = s(62);
  const rateColW = s(110);
  const amountColW = s(120);
  const descColW = contentWidth - qtyColW - rateColW - amountColW;
  const descColX = contentX;
  const qtyColX = contentX + descColW;
  const rateColX = qtyColX + qtyColW;
  const amountColX = rateColX + rateColW;

  const lineItemHeaderH = s(10) + s(9 * 1.3) + s(10);
  const lineItemRowHeights = data.lineItems.map((item) => {
    const descH = heightOf(item.description, descColW - s(16), 13, true);
    const noteH = item.note ? heightOf(item.note, descColW - s(16), 11) : 0;
    const contentH = descH + (item.note ? s(3) + noteH : 0);
    return Math.max(contentH, s(13 * 1.3)) + s(13) * 2;
  });
  const lineItemsTotalH = lineItemRowHeights.reduce((a, b) => a + b, 0);
  const lineItemsCardH = lineItemHeaderH + lineItemsTotalH;

  roundedRect(contentX, cursorY, contentWidth, lineItemsCardH, s(12), BRAND.white, BRAND.line);
  doc.rect(contentX, cursorY, contentWidth, lineItemHeaderH).fill(BRAND.slate);

  const headerLabelOpts = {
    size: 9,
    bold: true,
    color: "#CBD5E1",
    uppercase: true,
    letterSpacingEm: 0.14,
  };
  text("Description", descColX, cursorY + s(10), {
    ...headerLabelOpts,
    width: descColW,
  });
  text("Qty", qtyColX, cursorY + s(10), {
    ...headerLabelOpts,
    width: qtyColW,
    align: "right",
  });
  text("Rate", rateColX, cursorY + s(10), {
    ...headerLabelOpts,
    width: rateColW,
    align: "right",
  });
  text("Amount", amountColX, cursorY + s(10), {
    ...headerLabelOpts,
    width: amountColW,
    align: "right",
  });

  let itemY = cursorY + lineItemHeaderH;
  data.lineItems.forEach((item, index) => {
    const rowH = lineItemRowHeights[index] ?? s(13 * 1.3) + s(26);
    if (index > 0) hLine(contentX, itemY, contentWidth, BRAND.divider);
    const padTop = s(13);
    text(item.description, descColX, itemY + padTop, {
      size: 13,
      bold: true,
      color: BRAND.text,
      width: descColW - s(16),
    });
    if (item.note) {
      const descH = heightOf(item.description, descColW - s(16), 13, true);
      text(item.note, descColX, itemY + padTop + descH + s(3), {
        size: 11,
        color: BRAND.muted,
        width: descColW - s(16),
      });
    }
    text(String(item.qty), qtyColX, itemY + padTop, {
      size: 13,
      color: BRAND.valueGray,
      width: qtyColW,
      align: "right",
    });
    text(formatINR(item.rate), rateColX, itemY + padTop, {
      size: 13,
      color: BRAND.valueGray,
      width: rateColW,
      align: "right",
    });
    text(formatINR(item.qty * item.rate), amountColX, itemY + padTop, {
      size: 13,
      bold: true,
      color: BRAND.text,
      width: amountColW,
      align: "right",
    });
    itemY += rowH;
  });

  cursorY += lineItemsCardH + sectionGap;

  // -- 4e. payment reference + amount-in-words | totals --

  const rightColW = s(320);
  const leftColW = contentWidth - rightColW - s(16);
  const rightColX = contentX + leftColW + s(16);

  const paymentCardPadY = s(14);
  const paymentRowsH = 4 * (s(11.5 * 1.3) + s(8)) - s(8);
  const paymentCardH = paymentCardPadY + s(9 * 1.3) + s(10) + paymentRowsH + paymentCardPadY;

  const wordsCardPadY = s(12);
  const wordsValueH = heightOf(numberToIndianWords(data.totalAmount), leftColW - s(32), 12.5, true);
  const wordsCardH = wordsCardPadY + s(9 * 1.3) + s(3) + wordsValueH + wordsCardPadY;

  const leftStackY = cursorY;
  roundedRect(contentX, leftStackY, leftColW, paymentCardH, s(12), BRAND.white, BRAND.line);

  let pry = leftStackY + paymentCardPadY;
  const prInnerX = contentX + s(16);
  const prInnerW = leftColW - s(32);
  text("Payment reference", prInnerX, pry, labelSmall);
  pry += s(9 * 1.3) + s(10);

  const paymentRows: [string, string, boolean?][] = [
    ["Method", data.payment.method],
    ["Merchant order ID", data.payment.merchantOrderId, true],
    ["Transaction ID", data.payment.transactionId || "-", true],
    ["Paid on", data.payment.paidAt ? formatInvoiceDateTime(data.payment.paidAt) : "-"],
  ];
  paymentRows.forEach(([label, value, mono]) => {
    text(label, prInnerX, pry, {
      size: 11.5,
      color: BRAND.mutedDark,
      width: prInnerW / 2,
    });
    text(value, prInnerX + prInnerW / 2, pry, {
      size: 11.5,
      bold: true,
      mono: !!mono,
      color: BRAND.text,
      width: prInnerW / 2,
      align: "right",
    });
    pry += s(11.5 * 1.3) + s(8);
  });

  const wordsY = leftStackY + paymentCardH + s(12);
  roundedRect(contentX, wordsY, leftColW, wordsCardH, s(12), BRAND.soft, BRAND.line);
  text("Amount in words", prInnerX, wordsY + wordsCardPadY, labelSmall);
  text(
    numberToIndianWords(data.totalAmount),
    prInnerX,
    wordsY + wordsCardPadY + s(9 * 1.3) + s(3),
    { size: 12.5, bold: true, color: BRAND.text, width: prInnerW }
  );

  // Totals card (right column)
  const totalsUpperPadY = s(14);
  const discountShown = data.discountAmount > 0;
  const totalsRows: [string, string, string | undefined][] = [
    ["Subtotal", formatINR(subtotalFromLineItems(data.lineItems)), undefined],
    [
      data.discountLabel && discountShown ? `Discount · ${data.discountLabel}` : "Discount",
      discountShown ? `−${formatINR(data.discountAmount)}` : formatINR(0),
      discountShown ? BRAND.green : undefined,
    ],
    [
      `GST${data.gstRatePercent > 0 ? ` @ ${data.gstRatePercent}%` : ""}`,
      formatINR(data.gstAmount),
      undefined,
    ],
  ];
  const totalsUpperH = totalsUpperPadY + totalsRows.length * s(12.5 * 1.3) + totalsUpperPadY;
  const totalsLowerH = s(14) * 2 + s(12 * 1.3) + s(1) + s(10 * 1.3);
  const totalsCardH = totalsUpperH + totalsLowerH;

  const totalsY = cursorY;
  roundedRect(rightColX, totalsY, rightColW, totalsCardH, s(12), BRAND.white, BRAND.line);

  let try_ = totalsY + totalsUpperPadY;
  const totalsInnerX = rightColX + s(16);
  const totalsInnerW = rightColW - s(32);
  totalsRows.forEach(([label, value, color]) => {
    text(label, totalsInnerX, try_, {
      size: 12.5,
      color: BRAND.mutedDark,
      width: totalsInnerW / 2,
    });
    text(value, totalsInnerX + totalsInnerW / 2, try_, {
      size: 12.5,
      bold: !!color,
      color: color || BRAND.text,
      width: totalsInnerW / 2,
      align: "right",
    });
    try_ += s(12.5 * 1.3);
  });

  const totalsLowerY = totalsY + totalsUpperH;
  doc.rect(rightColX, totalsLowerY, rightColW, totalsLowerH).fill(BRAND.slate);
  text("Total paid", totalsInnerX, totalsLowerY + s(14), {
    size: 12,
    bold: true,
    color: BRAND.white,
  });
  text("Inclusive of all taxes", totalsInnerX, totalsLowerY + s(14) + s(12 * 1.3) + s(1), {
    size: 10,
    color: BRAND.muted,
  });
  text(formatINR(data.totalAmount), totalsInnerX, totalsLowerY + (totalsLowerH - s(22 * 1.2)) / 2, {
    size: 22,
    bold: true,
    color: BRAND.orange,
    width: totalsInnerW,
    align: "right",
  });

  cursorY = Math.max(wordsY + wordsCardH, totalsY + totalsCardH);

  // ---- 5. footer -------------------------------------------------------

  const footerY = Math.max(cursorY + s(20), doc.page.height - s(90));
  hLine(0, footerY, pageWidth, BRAND.line);

  const footerPadY = s(16);
  text("Questions about this invoice?", contentX, footerY + footerPadY, {
    size: 11,
    bold: true,
    color: BRAND.valueGray,
  });
  text(
    `${COMPANY_SUPPORT_EMAIL} · ${COMPANY_WEBSITE}`,
    contentX,
    footerY + footerPadY + s(11 * 1.3) + s(3),
    { size: 11, color: BRAND.mutedDark }
  );
  text(
    data.footerNote || "This is a system generated invoice and does not require a signature.",
    contentX,
    footerY + footerPadY + (s(11 * 1.3) + s(3)) * 2,
    { size: 10, color: BRAND.muted }
  );

  text(COMPANY_DISPLAY_NAME, contentX, footerY + footerPadY, {
    size: 13,
    bold: true,
    color: BRAND.text,
    width: contentWidth,
    align: "right",
  });
  text("Page 1 of 1", contentX, footerY + footerPadY + s(13 * 1.3) + s(2), {
    size: 10,
    color: BRAND.muted,
    width: contentWidth,
    align: "right",
  });

  return collectPdfBuffer(doc);
};

const subtotalFromLineItems = (items: InvoiceLineItem[]): number =>
  items.reduce((sum, item) => sum + item.qty * item.rate, 0);
