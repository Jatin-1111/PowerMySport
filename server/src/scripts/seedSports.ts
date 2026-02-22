import "dotenv/config";
import { connectDB } from "../config/database";
import { Sport } from "../models/Sport";

const INITIAL_SPORTS = [
  // Ball Sports
  { name: "Cricket", category: "Ball Sports" },
  { name: "Football", category: "Ball Sports" },
  { name: "Basketball", category: "Ball Sports" },
  { name: "Volleyball", category: "Ball Sports" },
  { name: "Baseball", category: "Ball Sports" },
  { name: "Softball", category: "Ball Sports" },
  { name: "Rugby", category: "Ball Sports" },

  // Racquet Sports
  { name: "Tennis", category: "Racquet Sports" },
  { name: "Badminton", category: "Racquet Sports" },
  { name: "Squash", category: "Racquet Sports" },
  { name: "Table Tennis", category: "Racquet Sports" },
  { name: "Racquetball", category: "Racquet Sports" },

  // Combat Sports
  { name: "Boxing", category: "Combat Sports" },
  { name: "Karate", category: "Combat Sports" },
  { name: "Taekwondo", category: "Combat Sports" },
  { name: "Judo", category: "Combat Sports" },
  { name: "Wrestling", category: "Combat Sports" },
  { name: "Kung Fu", category: "Combat Sports" },
  { name: "Muay Thai", category: "Combat Sports" },
  { name: "MMA (Mixed Martial Arts)", category: "Combat Sports" },

  // Water Sports
  { name: "Swimming", category: "Water Sports" },
  { name: "Diving", category: "Water Sports" },
  { name: "Surfing", category: "Water Sports" },
  { name: "Water Polo", category: "Water Sports" },
  { name: "Kayaking", category: "Water Sports" },
  { name: "Canoeing", category: "Water Sports" },
  { name: "Sailing", category: "Water Sports" },
  { name: "Paddleboarding", category: "Water Sports" },

  // Winter Sports
  { name: "Skiing", category: "Winter Sports" },
  { name: "Snowboarding", category: "Winter Sports" },
  { name: "Ice Skating", category: "Winter Sports" },
  { name: "Ice Hockey", category: "Winter Sports" },

  // Team Sports
  { name: "Kabaddi", category: "Team Sports" },
  { name: "Hockey", category: "Team Sports" },
  { name: "Lacrosse", category: "Team Sports" },
  { name: "American Football", category: "Team Sports" },

  // Individual Sports
  { name: "Golf", category: "Individual Sports" },
  { name: "Athletics", category: "Individual Sports" },
  { name: "Cycling", category: "Individual Sports" },
  { name: "Archery", category: "Individual Sports" },
  { name: "Fencing", category: "Individual Sports" },
  { name: "Gymnastics", category: "Individual Sports" },
  { name: "Horse Riding", category: "Individual Sports" },
  { name: "Rock Climbing", category: "Individual Sports" },
  { name: "Skateboarding", category: "Individual Sports" },
  { name: "Parkour", category: "Individual Sports" },

  // Fitness & Wellness
  { name: "Yoga", category: "Fitness" },
  { name: "Pilates", category: "Fitness" },
  { name: "CrossFit", category: "Fitness" },
  { name: "Weight Training", category: "Fitness" },
  { name: "Aerobics", category: "Fitness" },
  { name: "Zumba", category: "Fitness" },
  { name: "Dance", category: "Fitness" },
  { name: "Martial Arts", category: "Fitness" },
  { name: "Boot Camp", category: "Fitness" },
  { name: "Stretching", category: "Fitness" },
  { name: "Meditation", category: "Fitness" },

  // Other Sports
  { name: "Billiards", category: "Other" },
  { name: "Darts", category: "Other" },
  { name: "Bowling", category: "Other" },
  { name: "Badminton Doubles", category: "Racquet Sports" },
  { name: "Lawn Bowls", category: "Other" },
  { name: "Tenpin Bowling", category: "Other" },
  { name: "E-Sports / Gaming", category: "Other" },
];

const seedSports = async () => {
  try {
    await connectDB();
    console.log("📚 Seeding sports data...");

    // Clear existing sports
    await Sport.deleteMany({});
    console.log("🗑️  Cleared existing sports");

    // Create sports with slug
    const sportsWithSlugs = INITIAL_SPORTS.map((sport) => ({
      ...sport,
      slug: sport.name.toLowerCase().replace(/\s+/g, "-"),
      isVerified: true,
      verifiedAt: new Date(),
    }));

    const created = await Sport.insertMany(sportsWithSlugs);
    console.log(`✅ Seeded ${created.length} sports successfully!`);

    // Show summary by category
    const categories = Array.from(
      new Set(INITIAL_SPORTS.map((s) => s.category)),
    );
    console.log("\n📊 Sports by category:");
    categories.forEach((category) => {
      const count = INITIAL_SPORTS.filter(
        (s) => s.category === category,
      ).length;
      console.log(`   ${category}: ${count}`);
    });

    console.log("\n🎉 Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding sports:", error);
    process.exit(1);
  }
};

seedSports();
