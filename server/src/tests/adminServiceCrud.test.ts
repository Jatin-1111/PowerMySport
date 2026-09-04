/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for AdminService — plain admin-account CRUD, flagged as
// untested in the Phase 4 correctness sweep. `createAdmin` sends a real email
// on success, so the email module is stubbed with `mock.method` (same
// technique as PhonePeService in expertSessionLifecycle.integration.test.ts —
// must run through the dist/ build, see that file's header comment for why).
//
// Mocked on `../utils/email/auth` — the submodule that actually *defines*
// sendAdminTemporaryCredentialsEmail — rather than on `../utils/email`, the
// barrel that re-exports it. `export *` compiles to a live getter forwarding
// to the submodule, which isn't a configurable data property mock.method can
// replace; the submodule's own export is a plain one, and the barrel's getter
// still resolves to whatever's currently there, so mocking the submodule is
// both necessary and sufficient.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const EmailUtils = require("../utils/email/auth");
const AdminService = require("../admin/services/AdminService");
const Admin = require("../admin/models/Admin").default;
const redis = require("../config/redis").default;

let mongod: any;
let emailCallCount = 0;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  mock.method(EmailUtils, "sendAdminTemporaryCredentialsEmail", async () => {
    emailCallCount += 1;
  });
});

after(async () => {
  mock.restoreAll();
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

let emailCounter = 0;
const nextEmail = () => `admincrud${(emailCounter++).toString().padStart(4, "0")}@example.com`;

describe("AdminService — create", () => {
  it("creates an admin with a generated temporary password and sends the credentials email", async () => {
    const before = emailCallCount;
    const email = nextEmail();

    const admin = await AdminService.createAdmin({ name: "Priya Admin", email });

    assert.ok(admin._id);
    assert.equal(admin.email, email);
    assert.equal(admin.mustChangePassword, true);
    assert.equal(emailCallCount, before + 1);
  });

  it("defaults to SUPPORT_ADMIN with that role's template permissions when none are given", async () => {
    const admin = await AdminService.createAdmin({ name: "Default Role", email: nextEmail() });
    assert.equal(admin.role, "SUPPORT_ADMIN");
    assert.ok(admin.permissions.length > 0);
  });

  it("falls back to SUPPORT_ADMIN for an invalid role string rather than rejecting", async () => {
    const admin = await AdminService.createAdmin({
      name: "Bad Role",
      email: nextEmail(),
      role: "NOT_A_REAL_ROLE",
    });
    assert.equal(admin.role, "SUPPORT_ADMIN");
  });

  it("accepts a valid explicit role", async () => {
    const admin = await AdminService.createAdmin({
      name: "Finance Person",
      email: nextEmail(),
      role: "FINANCE_ADMIN",
    });
    assert.equal(admin.role, "FINANCE_ADMIN");
  });

  it("rejects a duplicate email", async () => {
    const email = nextEmail();
    await AdminService.createAdmin({ name: "First", email });
    await assert.rejects(
      () => AdminService.createAdmin({ name: "Second", email }),
      /already exists/i
    );
  });

  it("rejects invalid custom permissions", async () => {
    await assert.rejects(
      () =>
        AdminService.createAdmin({
          name: "Bad Perms",
          email: nextEmail(),
          permissions: ["NOT_A_REAL_PERMISSION"],
        }),
      /invalid permissions/i
    );
  });

  it("rolls back the created admin if the credentials email fails to send", async () => {
    mock.method(EmailUtils, "sendAdminTemporaryCredentialsEmail", async () => {
      throw new Error("smtp down");
    });

    const email = nextEmail();
    await assert.rejects(
      () => AdminService.createAdmin({ name: "Rollback Me", email }),
      /failed to send temporary credentials email/i
    );

    const found = await Admin.findOne({ email });
    assert.equal(found, null);

    // Restore the happy-path stub for subsequent tests.
    mock.method(EmailUtils, "sendAdminTemporaryCredentialsEmail", async () => {
      emailCallCount += 1;
    });
  });
});

describe("AdminService — read", () => {
  it("getAdminById returns the admin", async () => {
    const created = await AdminService.createAdmin({ name: "Findable", email: nextEmail() });
    const found = await AdminService.getAdminById(created._id.toString());
    assert.ok(found);
    assert.equal(found!.email, created.email);
  });

  it("getAdminById returns null for a nonexistent id", async () => {
    const found = await AdminService.getAdminById(new mongoose.Types.ObjectId().toString());
    assert.equal(found, null);
  });

  it("getAllAdmins includes newly created admins, newest first", async () => {
    const admin = await AdminService.createAdmin({ name: "Listed", email: nextEmail() });
    const all = await AdminService.getAllAdmins();
    assert.ok(all.some((a: any) => a._id.toString() === admin._id.toString()));
  });

  it("getAdminsWithPermission only returns active admins who actually have it", async () => {
    const withPerm = await AdminService.createAdmin({
      name: "Has Perm",
      email: nextEmail(),
      role: "SYSTEM_ADMIN",
    });
    const withoutPerm = await AdminService.createAdmin({
      name: "No Perm",
      email: nextEmail(),
      role: "ANALYTICS_ADMIN",
    });

    // Pick a permission SYSTEM_ADMIN's template grants but ANALYTICS_ADMIN's
    // does not, by reading it straight off the created admin.
    const permission = withPerm.permissions.find(
      (p: string) => !withoutPerm.permissions.includes(p)
    );
    assert.ok(permission, "expected SYSTEM_ADMIN and ANALYTICS_ADMIN to differ in permissions");

    const result = await AdminService.getAdminsWithPermission(permission);
    const emails = result.map((a: any) => a.email);
    assert.ok(emails.includes(withPerm.email));
    assert.ok(!emails.includes(withoutPerm.email));
  });
});

describe("AdminService — update", () => {
  it("updateAdmin persists field changes and strips any password field", async () => {
    const created = await AdminService.createAdmin({ name: "Updatable", email: nextEmail() });
    const before = await Admin.findById(created._id).select("+password");
    const passwordHashBefore = before!.password;

    const updated = await AdminService.updateAdmin(created._id.toString(), {
      name: "Updated Name",
      password: "should-be-ignored",
    } as any);

    assert.ok(updated);
    assert.equal(updated!.name, "Updated Name");

    // The stored hash is byte-for-byte unchanged — proof the password field
    // was actually stripped, not just hashed to something that happens not
    // to match a plaintext comparison.
    const after = await Admin.findById(created._id).select("+password");
    assert.equal(after!.password, passwordHashBefore);
  });

  it("setAdminActiveStatus deactivates and reactivates", async () => {
    const created = await AdminService.createAdmin({ name: "Togglable", email: nextEmail() });

    const deactivated = await AdminService.setAdminActiveStatus(created._id.toString(), false);
    assert.equal(deactivated.isActive, false);

    const reactivated = await AdminService.setAdminActiveStatus(created._id.toString(), true);
    assert.equal(reactivated.isActive, true);
  });

  it("setAdminActiveStatus throws for a nonexistent admin", async () => {
    await assert.rejects(
      () => AdminService.setAdminActiveStatus(new mongoose.Types.ObjectId().toString(), false),
      /admin not found/i
    );
  });

  it("updateAdminPermissions validates and normalizes the new set", async () => {
    const created = await AdminService.createAdmin({ name: "Perms", email: nextEmail() });
    await assert.rejects(
      () => AdminService.updateAdminPermissions(created._id.toString(), ["NOT_REAL"]),
      /invalid permissions/i
    );

    const updated = await AdminService.updateAdminPermissions(created._id.toString(), [
      "users:view",
    ]);
    assert.ok(updated.permissions.includes("users:view"));
  });

  it("updateAdminRole rejects an invalid role and resets permissions to the new role's template on success", async () => {
    const created = await AdminService.createAdmin({
      name: "Role Change",
      email: nextEmail(),
      role: "SUPPORT_ADMIN",
    });

    await assert.rejects(
      () => AdminService.updateAdminRole(created._id.toString(), "NOT_A_ROLE"),
      /invalid role/i
    );

    const updated = await AdminService.updateAdminRole(created._id.toString(), "FINANCE_ADMIN");
    assert.equal(updated.role, "FINANCE_ADMIN");
  });
});

describe("AdminService — password change", () => {
  // createAdmin generates its own random temporary password and never
  // returns it, so the success path is exercised against an admin created
  // directly with a known password instead of going through createAdmin.
  const seedAdminWithKnownPassword = async (password: string) => {
    const admin = new Admin({
      name: "Known Password",
      email: nextEmail(),
      role: "SUPPORT_ADMIN",
      permissions: [],
      password,
      mustChangePassword: true,
    });
    await admin.save();
    return admin;
  };

  it("changes the password when the current one matches, and clears mustChangePassword", async () => {
    const admin = await seedAdminWithKnownPassword("InitialPass123");

    const updated = await AdminService.changeAdminPassword({
      adminId: admin._id.toString(),
      currentPassword: "InitialPass123",
      newPassword: "aNewPassword456!",
    });
    assert.equal(updated.mustChangePassword, false);

    // New password logs in; old one no longer does.
    const login = await AdminService.loginAdmin({
      email: admin.email,
      password: "aNewPassword456!",
    });
    assert.ok(login.token);
    await assert.rejects(() =>
      AdminService.loginAdmin({ email: admin.email, password: "InitialPass123" })
    );
  });

  it("rejects a password change with the wrong current password", async () => {
    const created = await AdminService.createAdmin({ name: "Pw Wrong", email: nextEmail() });
    await assert.rejects(
      () =>
        AdminService.changeAdminPassword({
          adminId: created._id.toString(),
          currentPassword: "definitely-wrong",
          newPassword: "aNewPassword123!",
        }),
      /current password is incorrect/i
    );
  });

  it("rejects a password change for a nonexistent admin", async () => {
    await assert.rejects(
      () =>
        AdminService.changeAdminPassword({
          adminId: new mongoose.Types.ObjectId().toString(),
          currentPassword: "x",
          newPassword: "aNewPassword123!",
        }),
      /admin not found/i
    );
  });
});

describe("AdminService — login", () => {
  it("rejects a nonexistent email", async () => {
    await assert.rejects(
      () => AdminService.loginAdmin({ email: nextEmail(), password: "whatever" }),
      /invalid credentials/i
    );
  });

  it("rejects an inactive admin even with the right email", async () => {
    const created = await AdminService.createAdmin({ name: "Inactive", email: nextEmail() });
    await AdminService.setAdminActiveStatus(created._id.toString(), false);

    await assert.rejects(
      () => AdminService.loginAdmin({ email: created.email, password: "anything" }),
      /invalid credentials/i
    );
  });
});
