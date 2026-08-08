import type { EditionDocument, EditionDocumentKind } from "@/modules/sports/services/pathway";

export interface DisplayDocument extends EditionDocument {
  /** `label`, numbered when the same label appears more than once for its kind. */
  displayLabel: string;
}

export interface DocumentGroup {
  kind: EditionDocumentKind;
  items: DisplayDocument[];
}

const labelKey = (doc: EditionDocument) => `${doc.kind}|${doc.label.trim().toLowerCase()}`;

/**
 * Groups documents by kind and numbers any that share a label.
 *
 * Two things drove this. Federations publish several documents of one kind, and
 * repeating the same explanatory line under each row read as noise — so the
 * explanation belongs to the group, not the row.
 *
 * More importantly, AITA publishes two different acceptance lists for the same
 * event, both labelled "Girls Under 18". Side by side those look like an
 * accidental duplicate, but the two pages genuinely differ, so collapsing them
 * would cost the reader a real draw. Numbering says "there are genuinely two"
 * without inventing a distinction the source does not actually give us.
 *
 * True duplicates — the same url twice — never reach here; they are dropped
 * server-side in sanitizeEditionDocuments.
 */
export function groupDocumentsByKind(documents: EditionDocument[]): DocumentGroup[] {
  const totals = new Map<string, number>();
  for (const doc of documents) {
    totals.set(labelKey(doc), (totals.get(labelKey(doc)) ?? 0) + 1);
  }

  const groups = new Map<EditionDocumentKind, DisplayDocument[]>();
  const running = new Map<string, number>();

  for (const doc of documents) {
    const total = totals.get(labelKey(doc)) ?? 1;
    let displayLabel = doc.label;
    if (total > 1) {
      const index = (running.get(labelKey(doc)) ?? 0) + 1;
      running.set(labelKey(doc), index);
      displayLabel = `${doc.label} (${index} of ${total})`;
    }
    const existing = groups.get(doc.kind);
    if (existing) existing.push({ ...doc, displayLabel });
    else groups.set(doc.kind, [{ ...doc, displayLabel }]);
  }

  return [...groups.entries()].map(([kind, items]) => ({ kind, items }));
}
