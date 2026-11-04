/**
 * The unique indexes on `reviews`, defined once.
 *
 * Both `Review.ts` (its `schema.index` calls) and migration 50 read this, so the
 * model and the migration cannot drift apart. It is deliberately a plain data
 * module with no mongoose import: the migration must not load the Review model,
 * because importing a model while `autoIndex` is on creates its indexes in
 * whatever database the connection points at, and that is how a dry run can
 * write to production.
 *
 * Why partial and not sparse. A SPARSE compound index still indexes a document
 * if it has at least one of the key fields, and `targetType` and `userId` are on
 * every review, so a sparse index on `{bookingId, targetType, userId}` indexes
 * bookingless reviews too, with `bookingId` as null. Product reviews carry no
 * `bookingId` (and no `orderId`), so every one of them collided on the null.
 * A partial index only includes documents matching the filter.
 */
export interface ReviewUniqueIndexSpec {
  name: string;
  key: Record<string, 1 | -1>;
  unique: true;
  partialFilterExpression: Record<string, unknown>;
}

export const REVIEW_UNIQUE_INDEXES: ReviewUniqueIndexSpec[] = [
  {
    // A reviewer reviews each target of a booking once. A booking can carry a
    // venue review and a coach review, and each participant's own.
    name: "bookingId_1_targetType_1_userId_1",
    key: { bookingId: 1, targetType: 1, userId: 1 },
    unique: true,
    partialFilterExpression: { bookingId: { $type: "objectId" } },
  },
  {
    // One review per product per order, for reviews that carry an order.
    name: "orderId_1_targetType_1_targetId_1_userId_1",
    key: { orderId: 1, targetType: 1, targetId: 1, userId: 1 },
    unique: true,
    partialFilterExpression: { orderId: { $type: "objectId" } },
  },
  {
    // One review per user per product. Product reviews are written without a
    // booking or an order, and the shop controller refuses a second one in code;
    // this makes the database refuse it too, which the old sparse index only
    // did by accident.
    name: "product_review_one_per_user",
    key: { userId: 1, targetId: 1 },
    unique: true,
    partialFilterExpression: { targetType: "PRODUCT" },
  },
];
