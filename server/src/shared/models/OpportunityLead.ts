import mongoose, { Document, Schema } from "mongoose";

/**
 * A scheme or admission route found by AI web search that we do not cover yet
 * (see opportunityDiscovery.ts). A lead is a pointer for a person to look at,
 * never data: nothing here reaches a parent. Reading it goes through the same
 * source review as any other document, which is where facts get checked.
 */
export type OpportunityLeadStatus = "new" | "read" | "dismissed";

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
