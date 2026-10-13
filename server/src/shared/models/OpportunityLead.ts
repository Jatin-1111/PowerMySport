import mongoose, { Document, Schema } from "mongoose";

/**
 * A scheme or admission route found by AI web search that we do not cover yet
 * (see opportunityDiscovery.ts). A lead is a pointer for a person to look at,
 * never data: nothing here reaches a parent. Reading it goes through the same
 * source review as any other document, which is where facts get checked.
 */
export type OpportunityLeadStatus = "new" | "read" | "dismissed";

export const LEAD_FITS = ["high", "medium", "low", "none"] as const;
export type LeadFit = (typeof LEAD_FITS)[number];

export interface LeadTriage {
  /** How well it fits what parents of junior athletes here can act on. */
  fit?: LeadFit;
  /** One short sentence behind the fit, or behind a rule-based dismissal. */
  reason?: string;
  /** An entry we already have that this looks like. A suggestion; never dismisses. */
  possibleDuplicateOf?: { slug: string; title: string };
  /** For an aggregator lead: the official page, taken from real search results only. */
  officialUrl?: string;
  /** "rules" for the checks that need no AI, "ai" when a model judged the fit. */
  by: "rules" | "ai";
  at: Date;
}

export interface OpportunityLeadDocument extends Document {
  name: string;
  owner?: string;
  track: "admission" | "scholarship";
  /** One sentence on why the search thought it relevant. */
  why?: string;
  /** The search result's own address, resolved from Google's redirect link. */
  url: string;
  domain: string;
  /** An aggregator site: useful for finding a scheme, never the source to cite. */
  isAggregator: boolean;
  /** The search that found it, so an unhelpful query can be spotted and changed. */
  query: string;
  sportSlug?: string;
  status: OpportunityLeadStatus;
  /** The source submission it was read into, once someone did. */
  submissionId?: mongoose.Types.ObjectId;
  dismissReason?: string;
  /** Set when triage dismissed it, not a person. Shown apart and restorable. */
  autoDismissed?: boolean;
  /** Set when a person restores an auto-dismissed lead: triage never dismisses it again. */
  triageLocked?: boolean;
  /** What triage made of it (opportunityLeadTriage.ts). Advice for a person, never a decision. */
  triage?: LeadTriage;
  firstFoundAt: Date;
  lastFoundAt: Date;
  timesFound: number;
  createdAt: Date;
  updatedAt: Date;
}

const opportunityLeadSchema = new Schema<OpportunityLeadDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    owner: { type: String, trim: true, maxlength: 200 },
    track: { type: String, enum: ["admission", "scholarship"], required: true },
    why: { type: String, trim: true, maxlength: 400 },
    url: { type: String, required: true, unique: true, trim: true },
    domain: { type: String, required: true },
    isAggregator: { type: Boolean, default: false },
    query: { type: String, required: true },
    sportSlug: { type: String, lowercase: true },
    status: { type: String, enum: ["new", "read", "dismissed"], default: "new", index: true },
    submissionId: { type: Schema.Types.ObjectId, ref: "DataSourceSubmission" },
    dismissReason: { type: String, trim: true, maxlength: 300 },
    autoDismissed: { type: Boolean, default: undefined },
    triageLocked: { type: Boolean, default: undefined },
    triage: {
      type: new Schema(
        {
          fit: { type: String, enum: LEAD_FITS },
          reason: { type: String, trim: true, maxlength: 300 },
          possibleDuplicateOf: {
            type: new Schema({ slug: String, title: String }, { _id: false }),
            default: undefined,
          },
          officialUrl: { type: String, trim: true },
          by: { type: String, enum: ["rules", "ai"], required: true },
          at: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: undefined,
    },
    firstFoundAt: { type: Date, required: true },
    lastFoundAt: { type: Date, required: true },
    timesFound: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const OpportunityLead = mongoose.model<OpportunityLeadDocument>(
  "OpportunityLead",
  opportunityLeadSchema
);
