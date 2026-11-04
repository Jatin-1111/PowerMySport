/**
 * Concierge documents are uploaded to `concierge/<userId>/<file>` in the documents
 * bucket (see S3Service.generateConciergeDocumentUploadUrl). A stored key is only
 * trusted, and only deleted by the account-deletion cascade, when it sits under the
 * owner's own prefix: a client-supplied key must never be able to point at another
 * user's object.
 */
export const conciergeKeyPrefix = (userId: string): string => `concierge/${userId}/`;

export const isOwnConciergeKey = (userId: string, key: unknown): key is string => {
  if (typeof key !== "string" || !userId) return false;
  const prefix = conciergeKeyPrefix(userId);
  if (!key.startsWith(prefix) || key.length === prefix.length) return false;
  return !key.split("/").some((segment) => segment === ".." || segment === ".");
};
