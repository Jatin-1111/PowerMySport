/**
 * Utility functions for transforming API responses
 * Ensures consistent data format between MongoDB and frontend
 */

/**
 * Transform a single document by converting _id to id
 * @param doc - Mongoose document or plain object
 * @returns Transformed object with id field
 */
export function transformDocument<T extends Record<string, any>>(
  doc: T,
): T & { id: string } {
  if (!doc) return doc as any;

  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };

  if (obj._id) {
    return {
      ...obj,
      id: obj._id.toString(),
    };
  }

  return obj as any;
}

/**
 * Transform an array of documents by converting _id to id for each
 * @param docs - Array of Mongoose documents or plain objects
 * @returns Array of transformed objects with id fields
 */
export function transformDocuments<T extends Record<string, any>>(
  docs: T[],
): Array<T & { id: string }> {
  if (!Array.isArray(docs)) return [];
  return docs.map((doc) => transformDocument(doc));
}
