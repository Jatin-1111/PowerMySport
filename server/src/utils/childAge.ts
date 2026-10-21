/**
 * A child's age today.
 *
 * The stored `Player.age` is whatever it was on the day the profile was written
 * and nothing ages it, so it is only a fallback for the few profiles that never
 * had a date of birth. The date of birth is the field that stays true, so it
 * wins wherever both exist.
 */
export const resolveChildAge = (
  row: { dob?: Date | string | null; age?: number | null },
  now: Date = new Date()
): number | null => {
  if (row.dob) {
    const born = new Date(row.dob);
    if (!Number.isNaN(born.getTime())) {
      let age = now.getUTCFullYear() - born.getUTCFullYear();
      const monthDelta = now.getUTCMonth() - born.getUTCMonth();
      if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) {
        age -= 1;
      }
      return age >= 0 ? age : null;
    }
  }
  return typeof row.age === "number" && Number.isFinite(row.age) ? row.age : null;
};
