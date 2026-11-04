import "./env";
import mongoose from "mongoose";
import { connectDB } from "../src/config/database";
import "../src/client/services/BookingService"; // registers every model the booking flow touches
import { User } from "../src/client/models/User";
import { Coach } from "../src/client/models/Coach";
import { Venue } from "../src/client/models/Venue";

const PLAYERS = Number(process.env.SEED_PLAYERS || 1_000_000);
const COACHES = Number(process.env.SEED_COACHES || 2_000);
const VENUES = Number(process.env.SEED_VENUES || 500);
const BATCH = 20_000;

const SPORTS = ["Tennis", "Badminton", "Cricket", "Football", "Swimming"];

const phone = (i: number) => `9${String(i).padStart(9, "0")}`;

async function main() {
  await connectDB();
  const db = mongoose.connection.db!;
  console.log("db:", db.databaseName);

  console.log("building indexes for all registered models...");
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));

  await Promise.all(
    ["users", "coaches", "venues", "bookings", "bookingslotlocks"].map((c) =>
      db.collection(c).deleteMany({})
    )
  );

  // Coaches and venues first (small, go through Mongoose so they are valid docs).
  const coachUsers = Array.from({ length: COACHES }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(),
    name: `Coach ${i}`,
    email: `coach${i}@loadtest.invalid`,
    phone: phone(500_000_000 + i),
    role: "Coach",
    googleId: `lt-coach-${i}`,
    isActive: true,
  }));
  const venueUsers = Array.from({ length: VENUES }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(),
    name: `Venue Owner ${i}`,
    email: `venue${i}@loadtest.invalid`,
    phone: phone(600_000_000 + i),
    role: "VenueLister",
    googleId: `lt-venue-${i}`,
    isActive: true,
  }));
  await db.collection("users").insertMany([...coachUsers, ...venueUsers] as any);

  const allDays = [0, 1, 2, 3, 4, 5, 6];
  await Coach.insertMany(
    coachUsers.map((u, i) => ({
      userId: u._id,
      sports: [SPORTS[i % 2]],
      hourlyRate: 600 + (i % 10) * 100,
      serviceMode: "FREELANCE",
      serviceRadiusKm: 15,
      baseLocation: {
        type: "Point",
        coordinates: [77.2 + (i % 50) * 0.001, 28.6 + (i % 50) * 0.001],
      },
      availability: allDays.map((d) => ({ dayOfWeek: d, startTime: "06:00", endTime: "22:00" })),
      isVerified: true,
      verificationStatus: "VERIFIED",
    })) as any,
    { ordered: false }
  );
  await Venue.insertMany(
    venueUsers.map((u, i) => ({
      ownerId: u._id,
      ownerName: u.name,
      ownerEmail: u.email,
      ownerPhone: u.phone,
      name: `Loadtest Arena ${i}`,
      location: {
        type: "Point",
        coordinates: [77.1 + (i % 100) * 0.001, 28.5 + (i % 100) * 0.001],
      },
      sports: ["Tennis", "Badminton"],
      pricePerHour: 500 + (i % 8) * 100,
      allowExternalCoaches: true,
      approvalStatus: "APPROVED",
    })) as any,
    { ordered: false }
  );
  console.log(`seeded ${COACHES} coaches, ${VENUES} venues`);

  // Players: raw driver inserts, 1M docs. Unordered batches keep the index
  // build cost realistic (indexes already exist) without Mongoose overhead.
  const t0 = Date.now();
  const users = db.collection("users");
  for (let off = 0; off < PLAYERS; off += BATCH) {
    const n = Math.min(BATCH, PLAYERS - off);
    const docs = new Array(n);
    for (let j = 0; j < n; j++) {
      const i = off + j;
      docs[j] = {
        name: `Player ${i}`,
        email: `p${i}@loadtest.invalid`,
        phone: phone(i),
        role: i % 3 === 0 ? "Parent" : "Player",
        googleId: `lt-p-${i}`,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    await users.insertMany(docs, { ordered: false });
    if ((off / BATCH) % 5 === 0)
      console.log(`players ${off + n}/${PLAYERS} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }

  const stats = await db.stats();
  console.log(
    "done. dataSize MB:",
    (stats.dataSize / 1e6).toFixed(0),
    "indexSize MB:",
    (stats.indexSize / 1e6).toFixed(0)
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
