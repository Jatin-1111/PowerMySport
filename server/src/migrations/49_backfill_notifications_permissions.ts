import "dotenv/config";
import mongoose from "mongoose";
import { getRolePermissions, NOTIFICATIONS_PERMISSIONS } from "../constants/adminPermissions";

/**
 * Migration 49: grant existing admins the notifications permissions their role
 * template now includes.
 *
 * ── Why ──
 *
 * `notifications:view` and `notifications:manage` gate the reminder monitoring
 * routes (/api/admin/reminders). Each admin stores their own copy of their
 * role's permissions, taken when the account was created, so adding the
 * permissions to the SUPPORT_ADMIN and OPERATIONS_ADMIN templates did nothing
 * for admins who already exist. Until this runs, those admins get a 403 on the
 * Notifications page.
 *
 * ── What it touches ──
 *
 * Only `notifications:*`, and only the ones the admin's role template grants:
 *   SUPPORT_ADMIN     + notifications:view
 *   OPERATIONS_ADMIN  + notifications:view, notifications:manage
 *   SYSTEM_ADMIN      + both. It already passes every check by role; this only
 *                       keeps its stored list in line with its template.
 * FINANCE_ADMIN, ANALYTICS_ADMIN and roles with no template get nothing.
 * Every other permission is left as it is. That is the difference from
 * scripts/syncAdminPermissions.ts, which re-adds the WHOLE template and so
 * would re-grant anything deliberately removed from a customised admin.
 *
 * Deactivated admins are skipped unless `--include-inactive` is passed, so an
 * account that is switched back on later doesn't come back with new access
 * nobody reviewed.
 *
 * Writes use `$addToSet`, not `admin.save()`: a full save re-validates every
 * stored permission, and one legacy string would fail the whole update.
 * The raw collection is used so importing the model can't create indexes on
 * production (autoIndex is on for local scripts).
 *
 * Idempotent: a second run matches nothing.
 *
 * USAGE (call ts-node directly: PowerShell drops the `--` in `npm run x -- --apply`)
 *   npx ts-node src/migrations/49_backfill_notifications_permissions.ts                    # dry run (default)
 *   npx ts-node src/migrations/49_backfill_notifications_permissions.ts --apply            # write
 *   npx ts-node src/migrations/49_backfill_notifications_permissions.ts --include-inactive # also deactivated admins
 *   npx ts-node src/migrations/49_backfill_notifications_permissions.ts --down             # dry run of the rollback
 *   npx ts-node src/migrations/49_backfill_notifications_permissions.ts --down --apply     # roll back
 */

interface Options {
  apply?: boolean;
  includeInactive?: boolean;
}

interface Summary {
  scanned: number;
  changed: number;
  granted: number;
}

interface AdminRow {
  _id: mongoose.Types.ObjectId;
  email?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}

const NOTIFICATION_PERMISSIONS: string[] = Object.values(NOTIFICATIONS_PERMISSIONS);

const admins = () => mongoose.connection.collection<AdminRow>("admins");

export const up = async (options: Options = {}): Promise<Summary> => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 49: backfill notifications permissions (${apply ? "APPLY" : "DRY RUN"}, ` +
      `${options.includeInactive ? "all admins" : "active admins only"})...`
  );

  const rows = await admins()
    .find(options.includeInactive ? {} : { isActive: true })
    .project<AdminRow>({ email: 1, role: 1, permissions: 1, isActive: 1 })
    .toArray();

  const summary: Summary = { scanned: rows.length, changed: 0, granted: 0 };

  for (const row of rows) {
    const template = getRolePermissions(row.role ?? "") as readonly string[];
    const owed = NOTIFICATION_PERMISSIONS.filter((p) => template.includes(p));
    const held = row.permissions ?? [];
    const missing = owed.filter((p) => !held.includes(p));

    if (missing.length === 0) continue;

    summary.changed++;
    summary.granted += missing.length;
    console.log(`  ${String(row.email).padEnd(36)} ${row.role}: + ${missing.join(", ")}`);

    if (apply) {
      await admins().updateOne(
        { _id: row._id },
        { $addToSet: { permissions: { $each: missing } } }
      );
    }
  }

  console.log(`  scanned ${summary.scanned} admin(s).`);
  if (summary.changed === 0) {
    console.log("  every admin already holds the notifications permissions their role grants.");
    return summary;
  }

  console.log(
    `  ${summary.changed} admin(s) ${apply ? "updated" : "would be updated"}, ` +
      `${summary.granted} permission(s) ${apply ? "granted" : "to grant"}.`
  );
  console.log(apply ? "Migration 49 complete." : "Dry run complete. Re-run with --apply.");
  return summary;
};

/**
 * Removes `notifications:*` from every admin, active or not.
 *
 * This can't tell a grant made by `up` from one made by hand in the admin
 * permission picker, so it removes both. Anyone granted access by hand will
 * need it re-granted.
 */
export const down = async (options: Options = {}): Promise<Summary> => {
  const apply = Boolean(options.apply);
  console.log(
    `Rolling back migration 49: remove notifications permissions (${apply ? "APPLY" : "DRY RUN"})...`
  );

  const filter = { permissions: { $in: NOTIFICATION_PERMISSIONS } };
  const rows = await admins()
    .find(filter)
    .project<AdminRow>({ email: 1, permissions: 1 })
    .toArray();

  for (const row of rows) {
    const held = (row.permissions ?? []).filter((p) => NOTIFICATION_PERMISSIONS.includes(p));
    console.log(`  ${String(row.email).padEnd(36)} - ${held.join(", ")}`);
  }

  const summary: Summary = { scanned: rows.length, changed: rows.length, granted: 0 };

  if (rows.length === 0) {
    console.log("  no admin holds a notifications permission. Nothing to do.");
    return summary;
  }

  if (!apply) {
    console.log(
      `  ${rows.length} admin(s) would lose their notifications permissions. Re-run with --down --apply.`
    );
    return summary;
  }

  await admins().updateMany(filter, { $pull: { permissions: { $in: NOTIFICATION_PERMISSIONS } } });
  console.log(`  removed notifications permissions from ${rows.length} admin(s).`);
  return summary;
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const options: Options = {
    apply: argv.includes("--apply"),
    includeInactive: argv.includes("--include-inactive"),
  };
  const isDown = argv.includes("--down");

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri, { autoIndex: false })
    .then(() => (isDown ? down(options) : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 49 failed:", error);
      process.exit(1);
    });
}
