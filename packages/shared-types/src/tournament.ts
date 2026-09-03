/**
 * Canonical Tournament shape, merged from the server Mongoose model and
 * client's local copy (client/src/modules/pathway/services/pathway.ts).
 * Admin and community had no Tournament type at all despite admin having a
 * tournament-facing UI — this is the first typed version available there.
 */

export interface FederationInfo {
  name: string;
  acronym: string;
  website?: string;
  type: "govt" | "private" | "hybrid";
  about?: string;
}

export interface Tournament {
  id?: string;
  name: string;
  sportSlug?: string;
  slug?: string;
  level: string;
  description: string;
  ageGroup: string;
  city?: string;

  prerequisiteId?: string;
  prerequisiteName?: string;
  prerequisiteGuide?: string[];
  documentChecklist?: string[];

  sourceUrls?: string[];
  typicalDates?: string;
  registrationDeadline?: string;
  registrationUrl?: string;

  isVerified?: boolean;
  isCurated?: boolean;
  lastScrapedAt?: string;

  /** String form covers the unpopulated-reference case some client call
   *  sites still pass through. */
  federation?: FederationInfo | string;
  federationSlug?: string;

  participationGuide?: string[];
  qualificationPath?: string;
  format?: string;
  prestige?: "flagship" | "ranking" | "developmental";
  prizePool?: string;
  entryFee?: string;
  selectionCriteria?: string;
  prizes?: string;
  keyFacts?: string[];
  importantNotes?: string[];
  circuitContext?: string;

  createdAt?: string;
  updatedAt?: string;
}
