import "dotenv/config";
import mongoose from "mongoose";
import Admin from "../admin/models/Admin";
import {
  ADMIN_ROLES,
  getRolePermissions,
} from "../constants/adminPermissions";

/**
 * Re-syncs every SYSTEM_ADMIN's stored `permissions` array to the current
 * SYSTEM_ADMIN_PERMISSIONS (== ALL_PERMISSIONS) template.
 *
 * Why this is needed: SYSTEM_ADMIN's permission set is always "every
 * permission that currently exists in the catalog" — there's no concept of
 * a customized System Admin. Whenever the catalog itself changes (a
 * permission is added, renamed, or removed), every existing System Admin's
 * persisted array drifts out of sync with the catalog until something
 * re-writes it. A drifted array containing a permission string the current
 * catalog no longer recognizes fails Admin schema validation on the next
 * full-document .save() (login, password change, or any other unrelated
 * field update) — see: 2026-07-02 admin-permissions audit.
 *
 * Only SYSTEM_ADMIN accounts are touched. Other roles' permission arrays
 * are left as-is, since those can legitimately be hand-customized away from
 * their role template via the "Edit permissions" UI.
 */
const run = async () => {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/powermysport";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const systemAdmins = await Admin.find({ role: ADMIN_ROLES.SYSTEM_ADMIN });
  const canonicalPermissions = [...getRolePermissions(ADMIN_ROLES.SYSTEM_ADMIN)];
  const canonicalSet = new Set(canonicalPermissions);

  console.log(`Found ${systemAdmins.length} System Admin(s)`);
  console.log(`Canonical permission set has ${canonicalPermissions.length} entries`);
  console.log("---");

  let updated = 0;
  let unchanged = 0;

  for (const admin of systemAdmins) {
    const current = new Set(admin.permissions);
    const removed = admin.permissions.filter((p) => !canonicalSet.has(p));
    const added = canonicalPermissions.filter((p) => !current.has(p));

    if (removed.length === 0 && added.length === 0) {
      console.log(`${admin.name} (${admin.email}): already in sync`);
      unchanged++;
      continue;
    }

    await Admin.updateOne(
      { _id: admin._id },
      { $set: { permissions: canonicalPermissions } },
    );

    console.log(`${admin.name} (${admin.email}): synced`);
    if (removed.length > 0) console.log(`  removed: ${removed.join(", ")}`);
    if (added.length > 0) console.log(`  added:   ${added.join(", ")}`);
    updated++;
  }

  console.log("---");
  console.log(`Updated: ${updated}, already in sync: ${unchanged}`);

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
