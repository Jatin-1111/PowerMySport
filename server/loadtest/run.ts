import "./env";
import mongoose from "mongoose";
import { monitorEventLoopDelay } from "perf_hooks";
import { connectDB } from "../src/config/database";
import {
  initiateBooking,
  confirmMockPaymentSuccess,
  cancelBooking,
  getUserBookings,
} from "../src/client/services/BookingService";
import { Booking } from "../src/client/models/Booking";

type Stat = { ok: number; fail: number; lat: number[]; errors: Record<string, number> };

const pct = (a: number[], p: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!);
};
const classify = (e: any): string => {
  const m = String(e?.message || e).replace(/^Failed to initiate booking: /, "");
  if (/already booked|not available|already full/i.test(m)) return "slot-taken(expected)";
  if (/WriteConflict|write conflict/i.test(m)) return "WriteConflict(leaked)";
  if (/TransientTransactionError|Transaction/i.test(m)) return "TransactionError(leaked)";
  if (/timed out|timeout|ETIMEDOUT|server selection|wait queue/i.test(m)) return "TIMEOUT";
  return m.slice(0, 80);
};

/** Runs `total` tasks with at most `conc` in flight. */
async function pool<T>(total: number, conc: number, fn: (i: number) => Promise<T>, st: Stat) {
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= total) return;
      const t = process.hrtime.bigint();
      try {
        await fn(i);
        st.ok++;
      } catch (e) {
        st.fail++;
        const k = classify(e);
        st.errors[k] = (st.errors[k] || 0) + 1;
      } finally {
        st.lat.push(Number(process.hrtime.bigint() - t) / 1e6);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(conc, total) }, worker));
}

const newStat = (): Stat => ({ ok: 0, fail: 0, lat: [], errors: {} });
const day = (n: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
};
const hh = (h: number, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
const rnd = (n: number) => Math.floor(Math.random() * n);

let userIds: string[] = [];
let venueIds: string[] = [];
let coachIds: string[] = [];
let uCursor = 0;
const nextUser = () => userIds[uCursor++ % userIds.length]!;

const report = (name: string, st: Stat, ms: number, extra: Record<string, unknown> = {}) => {
  const line = {
    scenario: name,
    ops: st.ok + st.fail,
    ok: st.ok,
    fail: st.fail,
    opsPerSec: Math.round(((st.ok + st.fail) / ms) * 1000),
    p50: pct(st.lat, 50),
    p95: pct(st.lat, 95),
    p99: pct(st.lat, 99),
    max: pct(st.lat, 100),
    errors: st.errors,
    ...extra,
  };
  console.log(JSON.stringify(line));
  return line;
};

const lagHist = monitorEventLoopDelay({ resolution: 10 });

// ---------- scenarios ----------

/** Many users, different slots: the "normal busy day" capacity curve. */
async function ramp(levels: number[], perLevel: number) {
  for (const conc of levels) {
    const st = newStat();
    lagHist.reset();
    const t0 = Date.now();
    await pool(
      perLevel,
      conc,
      async () => {
        const venue = venueIds[rnd(venueIds.length)]!;
        const h = 9 + rnd(11);
        await initiateBooking({
          userId: nextUser(),
          venueId: venue,
          sport: "Tennis",
          date: day(1 + rnd(30)),
          startTime: hh(h),
          endTime: hh(h + 1),
        });
      },
      st
    );
    report(`ramp@${conc}`, st, Date.now() - t0, {
      eventLoopLagP99ms: Math.round(lagHist.percentile(99) / 1e6),
    });
  }
}

/** N users fight for ONE slot. Exactly one may win. */
let hotSeq = 0;
async function hotSlot(users: number, conc: number) {
  const venue = venueIds[0]!;
  const date = day(500 + Math.floor(Math.random() * 400) + hotSeq++);
  const st = newStat();
  const t0 = Date.now();
  await pool(
    users,
    conc,
    () =>
      initiateBooking({
        userId: nextUser(),
        venueId: venue,
        sport: "Tennis",
        date,
        startTime: hh(10),
        endTime: hh(11),
      }),
    st
  );
  const active = await Booking.countDocuments({ venueId: venue, date, startTime: "10:00" });
  report(`hot-slot x${users}@${conc}`, st, Date.now() - t0, {
    winners: st.ok,
    dbBookings: active,
    VERDICT: st.ok === 1 && active === 1 ? "PASS" : "FAIL: double-booking",
  });
}

/** Overlapping but non-identical windows on the same venue and the same coach. */
async function overlapRace(rounds: number, perRound: number) {
  let bad = 0;
  for (let r = 0; r < rounds; r++) {
    const venue = venueIds[1 + r]!;
    const date = day(Number(process.env.OVERLAP_DAY || 41) + (r % 5));
    // 10:00-11:00, 10:30-11:30, 10:15-10:45, 10:00-12:00, 9:30-10:30 all overlap each other
    const windows = [
      ["10:00", "11:00"],
      ["10:30", "11:30"],
      ["10:15", "10:45"],
      ["10:00", "12:00"],
      ["09:30", "10:30"],
    ];
    const st = newStat();
    await pool(
      perRound,
      perRound,
      (i) => {
        const w = windows[i % windows.length]!;
        return initiateBooking({
          userId: nextUser(),
          venueId: venue,
          sport: "Tennis",
          date,
          startTime: w[0]!,
          endTime: w[1]!,
        });
      },
      st
    );
    const winners = await Booking.find({ venueId: venue, date }).select("startTime endTime").lean();
    const overlaps = winners.some((a, i) =>
      winners.some((b, j) => i < j && a.startTime! < b.endTime! && b.startTime! < a.endTime!)
    );
    if (overlaps) bad++;
    if (r < 3)
      console.log(
        `  round ${r}: winners=${winners.length}`,
        winners.map((w) => `${w.startTime}-${w.endTime}`).join(" | ")
      );
  }
  console.log(
    JSON.stringify({
      scenario: `overlap-race ${rounds} rounds x ${perRound}`,
      roundsWithOverlappingDoubleBookings: bad,
      VERDICT: bad === 0 ? "PASS" : "FAIL: overlapping windows double-booked",
    })
  );
}

/** Same race but through a coach (freelance, playerLocation) on a different venue each round. */
async function coachOverlapRace(rounds: number, perRound: number) {
  let bad = 0;
  for (let r = 0; r < rounds; r++) {
    const coach = coachIds[r]!;
    const date = day(Number(process.env.OVERLAP_DAY || 41) + 5 + (r % 5));
    const windows = [
      ["10:00", "11:00"],
      ["10:30", "11:30"],
      ["10:15", "10:45"],
    ];
    const st = newStat();
    await pool(
      perRound,
      perRound,
      (i) => {
        const w = windows[i % windows.length]!;
        return initiateBooking({
          userId: nextUser(),
          coachId: coach,
          playerLocation: { type: "Point", coordinates: [77.2, 28.6] },
          sport: "Tennis",
          date,
          startTime: w[0]!,
          endTime: w[1]!,
        });
      },
      st
    );
    const n = await Booking.countDocuments({ coachId: coach, date });
    if (n > 1) bad++;
  }
  console.log(
    JSON.stringify({
      scenario: `coach-overlap-race ${rounds} rounds x ${perRound}`,
      roundsWithOverlappingDoubleBookings: bad,
      VERDICT: bad === 0 ? "PASS" : "FAIL: coach double-booked",
    })
  );
}

/** Launch-day: many users, a handful of popular venues, every hour slot. */
async function hotVenues(users: number, conc: number, hotCount: number) {
  const st = newStat();
  const hot = venueIds.slice(100, 100 + hotCount);
  const t0 = Date.now();
  await pool(
    users,
    conc,
    () => {
      const h = 9 + rnd(11);
      return initiateBooking({
        userId: nextUser(),
        venueId: hot[rnd(hot.length)]!,
        sport: "Badminton",
        date: day(50 + rnd(2)),
        startTime: hh(h),
        endTime: hh(h + 1),
      });
    },
    st
  );
  const capacity = hotCount * 11 * 2;
  report(`hot-venues ${hotCount} venues, ${capacity} slots`, st, Date.now() - t0, {
    note: "slot-taken is expected once capacity is exhausted; WriteConflict/Timeout is NOT",
  });
}

/** Full funnel: initiate -> pay -> read my bookings -> cancel. */
async function funnel(users: number, conc: number) {
  const st = newStat();
  const stepLat: Record<string, number[]> = { initiate: [], pay: [], list: [], cancel: [] };
  const timed = async <T>(k: string, f: () => Promise<T>) => {
    const t = Date.now();
    try {
      return await f();
    } finally {
      stepLat[k]!.push(Date.now() - t);
    }
  };
  const t0 = Date.now();
  await pool(
    users,
    conc,
    async () => {
      const userId = nextUser();
      const h = 9 + rnd(11);
      const { booking } = await timed("initiate", () =>
        initiateBooking({
          userId,
          venueId: venueIds[200 + rnd(200)]!,
          sport: "Tennis",
          date: day(60 + rnd(20)),
          startTime: hh(h),
          endTime: hh(h + 1),
        })
      );
      const id = booking._id.toString();
      await timed("pay", () => confirmMockPaymentSuccess(id, userId));
      await timed("list", () => getUserBookings(userId));
      if (Math.random() < 0.3) await timed("cancel", () => cancelBooking(id, userId, "loadtest"));
    },
    st
  );
  report(`funnel x${users}@${conc}`, st, Date.now() - t0, {
    stepP95ms: Object.fromEntries(Object.entries(stepLat).map(([k, v]) => [k, pct(v, 95)])),
  });
}

/** A hot-slot storm while ordinary users keep booking elsewhere: does one popular slot hurt everyone? */
async function collateral(stormUsers: number, stormConc: number, normalConc: number) {
  const base = newStat();
  const baseT0 = Date.now();
  await pool(
    1500,
    normalConc,
    async () => {
      const h = 9 + rnd(11);
      await initiateBooking({
        userId: nextUser(),
        venueId: venueIds[300 + rnd(100)]!,
        sport: "Tennis",
        date: day(100 + rnd(30)),
        startTime: hh(h),
        endTime: hh(h + 1),
      });
    },
    base
  );
  report("collateral: normal users ALONE", base, Date.now() - baseT0);

  const stormDate = day(200 + Math.floor(Math.random() * 400));
  const storm = newStat();
  const normal = newStat();
  let stormDone = false;
  const t0 = Date.now();
  const stormP = pool(
    stormUsers,
    stormConc,
    () =>
      initiateBooking({
        userId: nextUser(),
        venueId: venueIds[499]!,
        sport: "Tennis",
        date: stormDate,
        startTime: hh(10),
        endTime: hh(11),
      }),
    storm
  ).then(() => {
    stormDone = true;
  });
  // normal users keep arriving for as long as the storm lasts
  const normalP = Promise.all(
    Array.from({ length: normalConc }, async () => {
      while (!stormDone) {
        const h = 9 + rnd(11);
        const t = process.hrtime.bigint();
        try {
          await initiateBooking({
            userId: nextUser(),
            venueId: venueIds[300 + rnd(100)]!,
            sport: "Tennis",
            date: day(140 + rnd(30)),
            startTime: hh(h),
            endTime: hh(h + 1),
          });
          normal.ok++;
        } catch (e) {
          normal.fail++;
          const k = classify(e);
          normal.errors[k] = (normal.errors[k] || 0) + 1;
        }
        normal.lat.push(Number(process.hrtime.bigint() - t) / 1e6);
      }
    })
  );
  await stormP;
  await normalP;
  report("collateral: normal users DURING storm", normal, Date.now() - t0);
  report(`collateral: storm itself x${stormUsers}@${stormConc}`, storm, Date.now() - t0);
}

/** Post-run invariants over the whole collection. */
async function audit() {
  const db = mongoose.connection.db!;
  const active = [
    "AWAITING_PAYMENT",
    "AWAITING_PROVIDER",
    "PENDING_INVITES",
    "CONFIRMED",
    "IN_PROGRESS",
  ];
  const total = await Booking.estimatedDocumentCount();
  const dupExact = await Booking.aggregate([
    { $match: { venueId: { $exists: true }, status: { $in: active } } },
    { $group: { _id: { v: "$venueId", d: "$date", s: "$startTime" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "c" },
  ]).allowDiskUse(true);
  // Overlap check: sort per venue/date, flag any booking that starts before the previous one ends.
  const overlaps = await Booking.aggregate([
    { $match: { venueId: { $exists: true }, status: { $in: active } } },
    { $sort: { venueId: 1, date: 1, startTime: 1 } },
    {
      $group: {
        _id: { v: "$venueId", d: "$date" },
        slots: { $push: { s: "$startTime", e: "$endTime" } },
      },
    },
    { $match: { "slots.1": { $exists: true } } },
    {
      $project: {
        bad: {
          $reduce: {
            input: { $range: [1, { $size: "$slots" }] },
            initialValue: 0,
            in: {
              $cond: [
                {
                  $lt: [
                    { $arrayElemAt: ["$slots.s", "$$this"] },
                    { $arrayElemAt: ["$slots.e", { $subtract: ["$$this", 1] }] },
                  ],
                },
                { $add: ["$$value", 1] },
                "$$value",
              ],
            },
          },
        },
      },
    },
    { $match: { bad: { $gt: 0 } } },
    { $count: "c" },
  ]).allowDiskUse(true);
  const dupCodes = await Booking.aggregate([
    { $group: { _id: "$checkInCode", n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "c" },
  ]).allowDiskUse(true);
  const stats = await db.stats();
  console.log(
    JSON.stringify({
      scenario: "AUDIT",
      totalBookings: total,
      venueDaysWithOverlappingBookings: overlaps[0]?.c || 0,
      exactDuplicateSlots: dupExact[0]?.c || 0,
      duplicateCheckInCodes: dupCodes[0]?.c || 0,
      locks: await db.collection("bookingslotlocks").estimatedDocumentCount(),
      dataMB: Math.round(stats.dataSize / 1e6),
      indexMB: Math.round(stats.indexSize / 1e6),
    })
  );
}

async function main() {
  const which = process.argv[2] || "all";
  await connectDB();
  const db = mongoose.connection.db!;
  console.log("target db:", db.databaseName, "pool:", process.env.MONGO_MAX_POOL_SIZE);
  const sample = await db
    .collection("users")
    .aggregate([
      { $match: { role: { $in: ["Player", "Parent"] } } },
      { $sample: { size: 200_000 } },
      { $project: { _id: 1 } },
    ])
    .toArray();
  userIds = sample.map((u) => String(u._id));
  venueIds = (
    await db
      .collection("venues")
      .find({}, { projection: { _id: 1 } })
      .toArray()
  ).map((v) => String(v._id));
  coachIds = (
    await db
      .collection("coaches")
      .find({}, { projection: { _id: 1 } })
      .toArray()
  ).map((v) => String(v._id));
  console.log(
    `loaded ${userIds.length} users, ${venueIds.length} venues, ${coachIds.length} coaches`
  );
  lagHist.enable();
  if (!process.env.KEEP) {
    await db.collection("bookings").deleteMany({});
    await db.collection("bookingslotlocks").deleteMany({});
    await db.collection("bookingevents").deleteMany({});
  }

  const levels = (process.env.LEVELS || "25,50,100,200,400,800").split(",").map(Number);
  const run = (n: string) => which === "all" || which === n;
  if (run("hot")) {
    await hotSlot(50, 50);
    await hotSlot(500, 200);
    await hotSlot(2000, 400);
  }
  if (run("overlap")) {
    await overlapRace(20, 30);
    await coachOverlapRace(20, 30);
  }
  if (run("ramp")) await ramp(levels, Number(process.env.PER_LEVEL || 4000));
  if (run("hotvenues")) await hotVenues(Number(process.env.HOT_USERS || 20000), 400, 5);
  if (which === "collateral") await collateral(1000, 300, 30);
  if (run("funnel")) await funnel(Number(process.env.FUNNEL_USERS || 5000), 100);
  await audit();
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
