import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { User } from "../client/models/User";
import { Venue } from "../client/models/Venue";
import { Coach } from "../client/models/Coach";
import Academy from "../admin/models/Academy";
import Admin from "../admin/models/Admin";
import { ADMIN_ROLES, SYSTEM_ADMIN_PERMISSIONS } from "../constants/adminPermissions";

/**
 * Seeds one approved, ready-to-log-in account per provider role (Parent,
 * Academy, VenueLister, Coach) plus a system admin into a LOCAL MongoDB.
 *
 * The repo's .env points at the production Atlas database, so this script
 * refuses to run unless MONGO_URI is set in the shell to a localhost URI:
 *
 *   MONGO_URI=mongodb://127.0.0.1:27019/Powermysport npx ts-node src/scripts/seedLocalDummyAccounts.ts
 *
 * Safe to re-run: an account whose email already exists is skipped.
 */

const assertLocalOnly = () => {
  const uri = process.env.MONGO_URI ?? "";
  let hostname = "";
  try {
    hostname = new URL(uri).hostname;
  } catch {
    // unparseable URI: treated as non-local below
  }
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  if (!isLocal || uri.startsWith("mongodb+srv")) {
    console.error(
      `Refusing to seed: MONGO_URI host "${hostname}" is not localhost. ` +
        "Set MONGO_URI in the shell to a local MongoDB (this script never writes to Atlas)."
    );
    process.exit(1);
  }
};

const CITY = {
  city: "New Delhi",
  state: "Delhi",
  pincode: "110001",
  address: "Connaught Place, New Delhi",
  point: { type: "Point" as const, coordinates: [77.209, 28.6139] as [number, number] },
};

const ACCOUNTS = {
  parent: {
    name: "Dummy Parent",
    email: "dummy.parent@example.com",
    phone: "9100000001",
    password: "PmsParent#2026!",
    role: "Parent" as const,
  },
  academy: {
    name: "Dummy Academy Owner",
    email: "dummy.academy@example.com",
    phone: "9100000002",
    password: "PmsAcademy#2026!",
    role: "Academy" as const,
  },
  venue: {
    name: "Dummy Venue Owner",
    email: "dummy.venue@example.com",
    phone: "9100000003",
    password: "PmsVenue#2026!",
    role: "VenueLister" as const,
  },
  coach: {
    name: "Dummy Coach",
    email: "dummy.coach@example.com",
    phone: "9100000004",
    password: "PmsCoach#2026!",
    role: "Coach" as const,
  },
};

const ADMIN_ACCOUNT = {
  name: "Dummy System Admin",
  email: "dummy.admin@example.com",
  password: "PmsAdmin#2026!",
};

const ensureUser = async (acc: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) => {
  const existing = await User.findOne({ email: acc.email });
  if (existing) {
    console.log(`- User exists, skipped: ${acc.email}`);
    return { user: existing, created: false };
  }
  const user = await User.create({
    name: acc.name,
    email: acc.email,
    phone: acc.phone,
    password: acc.password,
    role: acc.role,
    city: CITY.city,
    isActive: true,
  });
  console.log(`- User created: ${acc.email} (${acc.role})`);
  return { user, created: true };
};

async function main() {
  assertLocalOnly();
  await connectDB();
  console.log(
    `\nSeeding into ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}\n`
  );

  const ids: Record<string, Record<string, string>> = {};

  // Parent
  {
    const { user } = await ensureUser(ACCOUNTS.parent);
    ids.parent = { userId: user._id.toString() };
  }

  // Venue lister + one approved venue
  {
    const { user } = await ensureUser(ACCOUNTS.venue);
    let venue = await Venue.findOne({ ownerId: user._id });
    if (!venue) {
      venue = await Venue.create({
        ownerName: ACCOUNTS.venue.name,
        ownerEmail: ACCOUNTS.venue.email,
        ownerPhone: ACCOUNTS.venue.phone,
        emailVerified: true,
        ownerId: user._id,
        name: "Dummy Sports Arena",
        location: CITY.point,
        sports: ["Tennis", "Badminton"],
        pricePerHour: 800,
        amenities: ["Parking", "Changing Room", "Floodlights"],
        address: CITY.address,
        description: "Local test venue created by seedLocalDummyAccounts.",
        allowExternalCoaches: true,
        approvalStatus: "APPROVED",
      });
      console.log(`- Venue created: ${venue.name}`);
    }
    ids.venue = { userId: user._id.toString(), venueId: venue._id.toString() };
  }

  // Coach + approved coach profile
  {
    const { user } = await ensureUser(ACCOUNTS.coach);
    let coach = await Coach.findOne({ userId: user._id });
    if (!coach) {
      coach = await Coach.create({
        userId: user._id,
        bio: "Local test coach created by seedLocalDummyAccounts.",
        certifications: ["Level 1 Coaching Certificate"],
        sports: ["Tennis"],
        hourlyRate: 1000,
        serviceMode: "FREELANCE",
        baseLocation: CITY.point,
        serviceRadiusKm: 15,
        travelBufferTime: 20,
        availability: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: "06:00",
          endTime: "20:00",
        })),
        verificationStatus: "VERIFIED",
        isVerified: true,
        verifiedAt: new Date(),
        onboardingProgressStep: 3,
      });
      console.log("- Coach profile created");
    }
    ids.coach = { userId: user._id.toString(), coachId: coach._id.toString() };
  }

  // Academy owner + approved academy
  {
    const { user } = await ensureUser(ACCOUNTS.academy);
    let academy = await Academy.findOne({ ownerId: user._id });
    if (!academy) {
      academy = await Academy.create({
        name: "Dummy Sports Academy",
        legalName: "Dummy Sports Academy Pvt Ltd",
        slug: "dummy-sports-academy",
        description: "Local test academy created by seedLocalDummyAccounts.",
        establishedYear: 2020,
        sports: ["Tennis", "Badminton"],
        ageGroups: ["kids", "teens"],
        location: CITY.point,
        address: CITY.address,
        city: CITY.city,
        state: CITY.state,
        pincode: CITY.pincode,
        businessType: "pvt_ltd",
        languagesSpoken: ["English", "Hindi"],
        whatsappNumber: "+919100000002",
        contactEmail: ACCOUNTS.academy.email,
        contactPhone: "+919100000002",
        contactPersonName: ACCOUNTS.academy.name,
        maxBatchSize: 12,
        batchTimings: ["both"],
        ownerId: user._id,
        sessionRatePerHour: 80000,
        emailVerified: true,
        kycVerified: true,
        isApproved: true,
        isActive: true,
        onboardingStep: 7,
        onboardingCompleted: true,
      });
      console.log(`- Academy created: ${academy.name}`);
    }
    ids.academy = { userId: user._id.toString(), academyId: academy._id.toString() };
  }

  // System admin: lives in its own collection and signs in through the admin app.
  {
    let admin = await Admin.findOne({ email: ADMIN_ACCOUNT.email });
    if (admin) {
      console.log(`- Admin exists, skipped: ${ADMIN_ACCOUNT.email}`);
    } else {
      admin = await Admin.create({
        name: ADMIN_ACCOUNT.name,
        email: ADMIN_ACCOUNT.email,
        password: ADMIN_ACCOUNT.password,
        role: ADMIN_ROLES.SYSTEM_ADMIN,
        permissions: [...SYSTEM_ADMIN_PERMISSIONS],
        isActive: true,
      });
      console.log(`- Admin created: ${ADMIN_ACCOUNT.email} (${ADMIN_ROLES.SYSTEM_ADMIN})`);
    }
    ids.admin = { adminId: admin._id.toString() };
  }

  console.log("\nSEED_IDS_JSON " + JSON.stringify(ids));
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
