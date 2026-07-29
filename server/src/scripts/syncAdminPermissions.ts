/**
 * Re-syncs each admin's stored `permissions` array with their role template.
 *
 * Report only (safe):  npx ts-node src/scripts/syncAdminPermissions.ts
 * Actually write:      npx ts-node src/scripts/syncAdminPermissions.ts --apply
 *
 * Admin records carry a denormalised copy of their role's permissions, so adding
 * a new permission to adminPermissions.ts silently leaves every existing admin
 * without it. That is how all three active SYSTEM_ADMINs ended up on 30 of 35 —
 * missing the pathways and data-sources permissions added after their accounts
 * were created. Run this after adding any permission.
 *
 * Additive only. Permissions an admin holds beyond their role template are left
 * alone: the system supports ad-hoc grants (getAdminsWithPermission matches on
 * either the role template OR the permissions array), so pruning them would
 * silently revoke access somebody deliberately granted.
 *
 * Distinct from migrateAdminPermissions.ts, which is a one-time rename of the
 * legacy SUPER_ADMIN/ADMIN roles and skips anyone already on the new system.
 */

import "dotenv/config";
import mongoose from "mongoose";
import Admin from "../admin/models/Admin";
import { getRolePermissions } from "../constants/adminPermissions";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";
if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
/** Deactivated admins are skipped unless asked for — they should not silently regain access. */
const INCLUDE_INACTIVE = process.argv.includes("--include-inactive");

async function main(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (will write)" : "REPORT ONLY (no writes)"}`);
  console.log(`Scope: ${INCLUDE_INACTIVE ? "all admins" : "active admins only"}\n`);

  const admins = await Admin.find(INCLUDE_INACTIVE ? {} : { isActive: true });

  let changed = 0;
  let alreadyComplete = 0;

  for (const admin of admins) {
    const template = getRolePermissions(admin.role) as string[];
    if (template.length === 0) {
      console.log(`?  ${admin.email} — role "${admin.role}" has no template, skipping`);
      continue;
    }

    const held = [...(admin.permissions ?? [])];
    const missing = template.filter((p) => !held.includes(p));
    const extra = held.filter((p) => !template.includes(p));

    if (missing.length === 0) {
      alreadyComplete++;
      console.log(`OK ${String(admin.email).padEnd(32)} ${held.length}/${template.length}` + (extra.length ? `  (+${extra.length} ad-hoc, kept)` : ""));
      continue;
    }

    changed++;
    console.log(`>> ${String(admin.email).padEnd(32)} ${held.length}/${template.length} — adding ${missing.length}`);
    for (const p of missing) console.log(`      + ${p}`);
    if (extra.length) console.log(`      (keeping ${extra.length} ad-hoc: ${extra.join(", ")})`);

    if (APPLY) {
      admin.permissions = [...held, ...missing];
      await admin.save();
    }
  }

  console.log(`\n─── ${changed} admin(s) ${APPLY ? "updated" : "would change"}, ${alreadyComplete} already complete ───`);
  if (!APPLY && changed > 0) console.log("Report only — nothing written. Re-run with --apply.");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
