/**
 * Adds `id` (the string form of `_id`) to a document returned by a `.lean()`
 * query.
 *
 * A hydrated Mongoose document serialises with an `id` virtual; a lean object
 * does not, because lean skips virtuals. The client reads `booking.id`
 * everywhere (list keys, and the id sent back to confirm, reject or
 * reschedule), so a lean booking list without it crashed the coach bookings
 * page and sent `undefined` as the booking id.
 */
export const withId = <T extends { _id?: unknown }>(doc: T): T & { id: string } => ({
  ...doc,
  id: String(doc._id),
});
