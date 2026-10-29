import {
  CHILD_ACADEMIC_BOARDS,
  CHILD_EVENT_DATE_PRECISIONS,
  CHILD_EVENT_KINDS,
  CHILD_HISTORY_LIMITS,
  CHILD_SHARE_SECTIONS,
  CHILD_VIDEO_CONTENT_TYPES,
} from "@powermysport/shared-types";
import { z } from "zod";

/**
 * Request shapes for a child's history. They check the shape and the length; the service then
 * cleans the text and applies the rules that need the database (ownership, the cap, a played
 * tournament). `.strict()` so a body that names a field we do not take, such as `userId` or
 * `childId`, is refused instead of quietly ignored.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-03-15");
const { titleChars, detailChars, resultLabelChars } = CHILD_HISTORY_LIMITS;

export const createChildEventSchema = z
  .object({
    kind: z.enum(CHILD_EVENT_KINDS),
    title: z.string().trim().min(1, "Give this entry a title").max(titleChars),
    detail: z.string().max(detailChars).optional(),
    resultLabel: z.string().max(resultLabelChars).optional(),
    date: day,
    datePrecision: z.enum(CHILD_EVENT_DATE_PRECISIONS).default("month"),
    endedOn: day.optional(),
    resultUrl: z.string().max(600).optional(),
    editionSlug: z.string().max(120).optional(),
    sportSlug: z.string().max(60).optional(),
  })
  .strict();

/** `null` clears an optional field; leaving it out leaves it as it is. The kind never changes. */
export const updateChildEventSchema = z
  .object({
    title: z.string().trim().min(1).max(titleChars).optional(),
    detail: z.string().max(detailChars).nullable().optional(),
    resultLabel: z.string().max(resultLabelChars).nullable().optional(),
    date: day.optional(),
    datePrecision: z.enum(CHILD_EVENT_DATE_PRECISIONS).optional(),
    endedOn: day.nullable().optional(),
    resultUrl: z.string().max(600).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, "Nothing to change");

export const saveAcademicsSchema = z
  .object({
    board: z.enum(CHILD_ACADEMIC_BOARDS).nullable().optional(),
    graduationYear: z.number().int().nullable().optional(),
    school: z.string().max(120).nullable().optional(),
    intendedField: z.string().max(120).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, "Nothing to change");

export const startVideoUploadSchema = z
  .object({
    contentType: z.enum(CHILD_VIDEO_CONTENT_TYPES),
    sizeBytes: z.number().int().min(1).max(CHILD_HISTORY_LIMITS.videoMaxBytes),
    durationSeconds: z
      .number()
      .min(0)
      .max(24 * 60 * 60)
      .optional(),
    title: z.string().max(120).optional(),
  })
  .strict();

export const completeVideoUploadSchema = z
  .object({
    parts: z
      .array(
        z
          .object({
            partNumber: z.number().int().min(1).max(10_000),
            etag: z.string().min(1).max(200),
          })
          .strict()
      )
      .min(1)
      .max(200),
  })
  .strict();

const shareSections = z
  .array(z.enum(CHILD_SHARE_SECTIONS))
  .min(1, "Choose at least one section to share")
  .max(CHILD_SHARE_SECTIONS.length);
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Not a valid video");

export const createShareSchema = z
  .object({
    recipientLabel: z
      .string()
      .trim()
      .min(1, "Say who this link is for")
      .max(CHILD_HISTORY_LIMITS.shareLabelChars),
    sections: shareSections,
    videoIds: z.array(objectId).max(CHILD_HISTORY_LIMITS.videosPerChild).optional(),
    /** The parent's agreement to the sharing notice. Nothing is created without it. */
    consent: z.literal(true),
  })
  .strict();

export const previewShareSchema = z
  .object({
    sections: shareSections,
    videoIds: z.array(objectId).max(CHILD_HISTORY_LIMITS.videosPerChild).optional(),
  })
  .strict();

/** What someone holding a link types to ask to be put in touch. Nothing else is taken. */
export const contactRequestSchema = z
  .object({
    name: z.string().trim().min(1, "Add your name").max(CHILD_HISTORY_LIMITS.contactNameChars),
    email: z.string().trim().toLowerCase().max(254).email("That email address does not look right"),
    message: z.string().max(CHILD_HISTORY_LIMITS.contactMessageChars).optional(),
  })
  .strict();

/** The same choice as a share, carried in a query string for the parent's own CV download. */
export const cvChoiceQuerySchema = z
  .object({
    sections: z
      .string()
      .max(200)
      .transform((value) =>
        value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      )
      .pipe(shareSections),
    videoIds: z
      .string()
      .max(400)
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
          : undefined
      )
      .pipe(z.array(objectId).max(CHILD_HISTORY_LIMITS.videosPerChild).optional()),
  })
  .strict();

export const videoConsentSchema = z.object({ accepted: z.literal(true) }).strict();

export type StartVideoUploadBody = z.infer<typeof startVideoUploadSchema>;
export type CreateChildEventInput = z.infer<typeof createChildEventSchema>;
export type UpdateChildEventInput = z.infer<typeof updateChildEventSchema>;
export type SaveAcademicsInput = z.infer<typeof saveAcademicsSchema>;
