/**
 * Prisma seed — minimal baseline data for a fresh PostgreSQL database.
 * Run with: `npm run db:seed`  (or automatically by `prisma migrate reset`).
 *
 * This intentionally seeds only foundational, non-user data (a starter set of
 * verified sports). Domain seeders/scrapers (tournaments, scholarships,
 * universities, sport base/state paths) live under src/scripts and should be
 * ported from their Mongoose originals following prisma/PORTING_GUIDE.md.
 */
import prisma from "../src/lib/prisma";

const SPORTS: Array<{ name: string; category: string }> = [
  { name: "Cricket", category: "Ball Sports" },
  { name: "Football", category: "Team Sports" },
  { name: "Badminton", category: "Racquet Sports" },
  { name: "Tennis", category: "Racquet Sports" },
  { name: "Basketball", category: "Team Sports" },
  { name: "Hockey", category: "Team Sports" },
  { name: "Swimming", category: "Water Sports" },
  { name: "Athletics", category: "Individual Sports" },
  { name: "Table Tennis", category: "Racquet Sports" },
  { name: "Kabaddi", category: "Team Sports" },
  { name: "Volleyball", category: "Team Sports" },
  { name: "Boxing", category: "Combat Sports" },
  { name: "Wrestling", category: "Combat Sports" },
  { name: "Chess", category: "Individual Sports" },
  { name: "Yoga", category: "Fitness" },
];

const toSlug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

async function main() {
  console.log("🌱 Seeding sports…");
  for (const s of SPORTS) {
    await prisma.sport.upsert({
      where: { slug: toSlug(s.name) },
      update: {},
      create: {
        name: s.name,
        slug: toSlug(s.name),
        category: s.category,
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
  }
  console.log(`✅ Seeded ${SPORTS.length} sports.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
