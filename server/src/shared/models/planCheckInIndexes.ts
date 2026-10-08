/**
 * The one-active-trial-per-child guard on `plancheckins`.
 *
 * Lives in its own file, with no mongoose import, so migration 52 can read the
 * definition without loading the model (loading a model with autoIndex on
 * creates its indexes in whatever database the connection points at).
 *
 * Scoped to `active` find-sport trials only: once the nudge has fired the record
 * becomes `due`, and a family retaking the assessment after that is a new trial,
 * not a duplicate. A missing `dependentId` indexes as null, so the guard also
 * covers a parent who ran the wizard without selecting a child.
 */
export const ACTIVE_FIND_SPORT_TRIAL_INDEX = {
  name: "one_active_find_sport_trial_per_child",
  key: { userId: 1, dependentId: 1 } as Record<string, 1 | -1>,
  partialFilterExpression: { source: "find_sport_trial", status: "active" } as Record<
    string,
    unknown
  >,
};
