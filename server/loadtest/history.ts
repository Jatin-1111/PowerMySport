import "./env";
import mongoose from "mongoose";
import { randomBytes } from "crypto";
import { connectDB } from "../src/config/database";

// Adds N completed past bookings so the Booking collection and its ~14 indexes
// are production-sized before the load run. Dates are in the past, so they never
// collide with the future slots the load test books.
const N = Number(process.env.HISTORY || 2_000_000);
const BATCH = 20_000;
(async () => {
  await connectDB();
  const db = mongoose.connection.db!;
  const users = (
    await db
      .collection("users")
      .aggregate([
        { $match: { role: { $in: ["Player", "Parent"] } } },
        { $sample: { size: 200000 } },
        { $project: { _id: 1 } },
      ])
      .toArray()
  ).map((u) => u._id);
  const venues = (
    await db
      .collection("venues")
      .find({}, { projection: { _id: 1 } })
      .toArray()
  ).map((v) => v._id);
  const coaches = (
    await db
      .collection("coaches")
      .find({}, { projection: { _id: 1 } })
      .toArray()
  ).map((v) => v._id);
  const col = db.collection("bookings");
  const t0 = Date.now();
  const now = Date.now();
  for (let off = 0; off < N; off += BATCH) {
    const docs = new Array(Math.min(BATCH, N - off));
    for (let j = 0; j < docs.length; j++) {
      const u = users[Math.floor(Math.random() * users.length)];
      const h = 9 + Math.floor(Math.random() * 11);
      const when = new Date(now - (2 + Math.floor(Math.random() * 365)) * 864e5);
      const day = new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()));
      const useCoach = Math.random() < 0.3;
      docs[j] = {
        userId: u,
        organizerId: u,
        participantId: u,
        participantName: "Hist",
        ...(useCoach
          ? { coachId: coaches[Math.floor(Math.random() * coaches.length)] }
          : { venueId: venues[Math.floor(Math.random() * venues.length)] }),
        sport: "Tennis",
        date: day,
        startTime: `${String(h).padStart(2, "0")}:00`,
        endTime: `${String(h + 1).padStart(2, "0")}:00`,
        totalAmount: 1000,
        serviceFee: 50,
        taxAmount: 9,
        status: "COMPLETED",
        checkInCode: randomBytes(5).toString("hex").toUpperCase(),
        payments: [],
        createdAt: when,
        updatedAt: when,
        expiresAt: when,
      };
    }
    await col.insertMany(docs, { ordered: false });
    if ((off / BATCH) % 10 === 0)
      console.log(`history ${off + docs.length}/${N} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }
  const s = await db.stats();
  console.log(
    "done. bookings:",
    await col.estimatedDocumentCount(),
    "dataMB",
    Math.round(s.dataSize / 1e6),
    "indexMB",
    Math.round(s.indexSize / 1e6)
  );
  process.exit(0);
})();
