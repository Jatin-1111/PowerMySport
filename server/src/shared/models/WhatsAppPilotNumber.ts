import mongoose, { Document, Schema } from "mongoose";

/**
 * A number staff have let through to the WhatsApp assistant during the pilot.
 *
 * The number is never stored: `phoneHash` is a keyed hash (see
 * `hashPilotPhone`), enough to recognise the sender when they write in but not
 * reversible to a phone number if this collection leaks. `label` is the name
 * staff gave it, so the list stays readable ("Coach Ravi") without the number.
 */
export interface WhatsAppPilotNumberDocument extends Document {
  phoneHash: string;
  label: string;
  /** Last four digits, so two entries with the same label can be told apart. */
  lastFour: string;
  addedBy?: string;
  createdAt: Date;
}

const whatsAppPilotNumberSchema = new Schema<WhatsAppPilotNumberDocument>(
  {
    phoneHash: { type: String, required: true, unique: true },
    label: { type: String, default: "", maxlength: 80, trim: true },
    lastFour: { type: String, required: true },
    addedBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const WhatsAppPilotNumber = mongoose.model<WhatsAppPilotNumberDocument>(
  "WhatsAppPilotNumber",
  whatsAppPilotNumberSchema
);

/** Who the assistant answers: only the listed numbers, or everyone. */
export type WhatsAppPilotMode = "listed" | "everyone";

export interface WhatsAppPilotSettingsDocument extends Document {
  key: string;
  mode: WhatsAppPilotMode;
  updatedBy?: string;
  updatedAt: Date;
}

const whatsAppPilotSettingsSchema = new Schema<WhatsAppPilotSettingsDocument>(
  {
    key: { type: String, required: true, unique: true, default: "singleton" },
    mode: { type: String, enum: ["listed", "everyone"], default: "listed" },
    updatedBy: { type: String },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const WhatsAppPilotSettings = mongoose.model<WhatsAppPilotSettingsDocument>(
  "WhatsAppPilotSettings",
  whatsAppPilotSettingsSchema
);
