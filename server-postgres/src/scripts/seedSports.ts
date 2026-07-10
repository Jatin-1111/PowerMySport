import "dotenv/config";
import { connectDB } from "../config/database";
import { Sport } from "../shared/models/Sport";

const INITIAL_SPORTS = [
  // Ball Sports
  {
    name: "Cricket",
    category: "Ball Sports",
    description:
      "Cricket: precise hand-eye coordination over long durations against varying deliveries.",
    attributes: {
      interactionType: "team",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Football",
    category: "Ball Sports",
    description:
      "Football: constant movement and tactical spacing relying on foot control under pressure.",
    attributes: {
      interactionType: "team",
      demand: "endurance",
      contactLevel: "low",
    },
  },
  {
    name: "Basketball",
    category: "Ball Sports",
    description:
      "Basketball: rapid transitions and explosive vertical jumping in tight spaces.",
    attributes: {
      interactionType: "team",
      demand: "power",
      contactLevel: "low",
    },
  },
  {
    name: "Volleyball",
    category: "Ball Sports",
    description:
      "Volleyball: split-second reaction to airborne targets without ever holding the ball.",
    attributes: {
      interactionType: "team",
      demand: "reflex",
      contactLevel: "none",
    },
  },
  {
    name: "Baseball",
    category: "Ball Sports",
    description:
      "Baseball: sudden bursts of intense sprinting and hitting isolated from teammates.",
    attributes: {
      interactionType: "team",
      demand: "power",
      contactLevel: "none",
    },
  },
  {
    name: "Softball",
    category: "Ball Sports",
    description:
      "Softball: fast-paced pitching and hitting on a compact diamond requiring quick reactions.",
    attributes: {
      interactionType: "team",
      demand: "reflex",
      contactLevel: "none",
    },
  },
  {
    name: "Rugby",
    category: "Ball Sports",
    description:
      "Rugby: continuous physical grappling and tackling while maintaining field awareness.",
    attributes: {
      interactionType: "team",
      demand: "power",
      contactLevel: "high",
    },
  },

  // Racquet Sports
  {
    name: "Tennis",
    category: "Racquet Sports",
    description:
      "Tennis: sustained lateral agility and heavy groundstrokes across a large court.",
    attributes: {
      interactionType: "head-to-head",
      demand: "endurance",
      contactLevel: "none",
    },
  },
  {
    name: "Badminton",
    category: "Racquet Sports",
    description:
      "Badminton: extreme reflexes and explosive leaping to intercept high-speed shuttles.",
    attributes: {
      interactionType: "head-to-head",
      demand: "reflex",
      contactLevel: "none",
    },
  },
  {
    name: "Squash",
    category: "Racquet Sports",
    description:
      "Squash: highly strategic rebounding off walls in a very confined space.",
    attributes: {
      interactionType: "head-to-head",
      demand: "strategy",
      contactLevel: "none",
    },
  },
  {
    name: "Table Tennis",
    category: "Racquet Sports",
    description:
      "Table Tennis: intense micro-movements and spin calculation at point-blank range.",
    attributes: {
      interactionType: "head-to-head",
      demand: "reflex",
      contactLevel: "none",
    },
  },
  {
    name: "Racquetball",
    category: "Racquet Sports",
    description:
      "Racquetball: high-speed ricochets requiring immense endurance and fast positioning.",
    attributes: {
      interactionType: "head-to-head",
      demand: "endurance",
      contactLevel: "none",
    },
  },

  // Combat Sports
  {
    name: "Boxing",
    category: "Combat Sports",
    description:
      "Boxing: relentless punching combinations and head movement against a striking opponent.",
    attributes: {
      interactionType: "head-to-head",
      demand: "endurance",
      contactLevel: "high",
    },
  },
  {
    name: "Karate",
    category: "Combat Sports",
    description:
      "Karate: disciplined striking with sharp, controlled techniques focusing on speed and form.",
    attributes: {
      interactionType: "head-to-head",
      demand: "precision",
      contactLevel: "low",
    },
  },
  {
    name: "Taekwondo",
    category: "Combat Sports",
    description:
      "Taekwondo: high, rapid kicking combinations relying heavily on leg dexterity.",
    attributes: {
      interactionType: "head-to-head",
      demand: "flexibility",
      contactLevel: "low",
    },
  },
  {
    name: "Judo",
    category: "Combat Sports",
    description:
      "Judo: throwing and grappling to off-balance an opponent using leverage.",
    attributes: {
      interactionType: "head-to-head",
      demand: "strategy",
      contactLevel: "high",
    },
  },
  {
    name: "Wrestling",
    category: "Combat Sports",
    description:
      "Wrestling: pure muscular control and leverage to pin a resistant opponent to the mat.",
    attributes: {
      interactionType: "head-to-head",
      demand: "power",
      contactLevel: "high",
    },
  },
  {
    name: "Kung Fu",
    category: "Combat Sports",
    description:
      "Kung Fu: flowing traditional forms prioritizing balance, fluid strikes, and deep stances.",
    attributes: {
      interactionType: "head-to-head",
      demand: "flexibility",
      contactLevel: "low",
    },
  },
  {
    name: "Muay Thai",
    category: "Combat Sports",
    description:
      "Muay Thai: devastating eight-point strikes using fists, elbows, knees, and shins.",
    attributes: {
      interactionType: "head-to-head",
      demand: "power",
      contactLevel: "high",
    },
  },
  {
    name: "MMA (Mixed Martial Arts)",
    category: "Combat Sports",
    description:
      "MMA: blending multiple combat disciplines for seamless transitions between striking and grappling.",
    attributes: {
      interactionType: "head-to-head",
      demand: "strategy",
      contactLevel: "high",
    },
  },

  // Water Sports
  {
    name: "Swimming",
    category: "Water Sports",
    description:
      "Swimming: rhythmic, full-body propulsion through water demanding immense cardiovascular capacity.",
    attributes: {
      interactionType: "individual",
      demand: "endurance",
      contactLevel: "none",
    },
  },
  {
    name: "Diving",
    category: "Water Sports",
    description:
      "Diving: executing flawless mid-air acrobatics before piercing the water seamlessly.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Surfing",
    category: "Water Sports",
    description:
      "Surfing: maintaining balance and flow while reading unpredictable ocean swells.",
    attributes: {
      interactionType: "individual",
      demand: "reflex",
      contactLevel: "none",
    },
  },
  {
    name: "Water Polo",
    category: "Water Sports",
    description:
      "Water Polo: intense treading water combined with aggressive wrestling and throwing.",
    attributes: {
      interactionType: "team",
      demand: "endurance",
      contactLevel: "high",
    },
  },
  {
    name: "Kayaking",
    category: "Water Sports",
    description:
      "Kayaking: seated paddle navigation through calm waters or turbulent rapids.",
    attributes: {
      interactionType: "individual",
      demand: "power",
      contactLevel: "none",
    },
  },
  {
    name: "Canoeing",
    category: "Water Sports",
    description:
      "Canoeing: kneeling paddle strokes requiring synchronized upper body strength.",
    attributes: {
      interactionType: "individual",
      demand: "power",
      contactLevel: "none",
    },
  },
  {
    name: "Sailing",
    category: "Water Sports",
    description:
      "Sailing: tactical harnessing of wind power and currents using rigging.",
    attributes: {
      interactionType: "individual",
      demand: "strategy",
      contactLevel: "none",
    },
  },
  {
    name: "Paddleboarding",
    category: "Water Sports",
    description:
      "Paddleboarding: upright balancing on a board while propelling with a long paddle.",
    attributes: {
      interactionType: "individual",
      demand: "endurance",
      contactLevel: "none",
    },
  },

  // Winter Sports
  {
    name: "Skiing",
    category: "Winter Sports",
    description:
      "Skiing: high-speed descents down snowy slopes demanding precise edge control.",
    attributes: {
      interactionType: "individual",
      demand: "reflex",
      contactLevel: "none",
    },
  },
  {
    name: "Snowboarding",
    category: "Winter Sports",
    description:
      "Snowboarding: carving snow on a single board utilizing deep core balance.",
    attributes: {
      interactionType: "individual",
      demand: "flexibility",
      contactLevel: "none",
    },
  },
  {
    name: "Ice Skating",
    category: "Winter Sports",
    description:
      "Ice Skating: gliding on thin blades requiring perfect ankle strength and posture.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Ice Hockey",
    category: "Winter Sports",
    description:
      "Ice Hockey: violent collisions and rapid puck handling on slippery ice.",
    attributes: {
      interactionType: "team",
      demand: "reflex",
      contactLevel: "high",
    },
  },

  // Team Sports
  {
    name: "Kabaddi",
    category: "Team Sports",
    description:
      "Kabaddi: breath-holding raids into enemy territory to tag and escape grapplers.",
    attributes: {
      interactionType: "team",
      demand: "reflex",
      contactLevel: "high",
    },
  },
  {
    name: "Hockey",
    category: "Team Sports",
    description:
      "Hockey: bent-over running while manipulating a hard ball with a curved stick.",
    attributes: {
      interactionType: "team",
      demand: "endurance",
      contactLevel: "low",
    },
  },
  {
    name: "Lacrosse",
    category: "Team Sports",
    description:
      "Lacrosse: catching and hurling a rubber ball using a netted stick on the run.",
    attributes: {
      interactionType: "team",
      demand: "precision",
      contactLevel: "low",
    },
  },
  {
    name: "American Football",
    category: "Team Sports",
    description:
      "American Football: heavily armored tactical plays defined by violent tackling and sprinting.",
    attributes: {
      interactionType: "team",
      demand: "strategy",
      contactLevel: "high",
    },
  },

  // Individual Sports
  {
    name: "Golf",
    category: "Individual Sports",
    description:
      "Golf: extreme mechanical repetition to drive a stationary ball over vast distances.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Athletics",
    category: "Individual Sports",
    description:
      "Athletics: pure fundamental movements like running, jumping, or throwing for maximum output.",
    attributes: {
      interactionType: "individual",
      demand: "power",
      contactLevel: "none",
    },
  },
  {
    name: "Cycling",
    category: "Individual Sports",
    description:
      "Cycling: punishing leg output over prolonged distances maintaining aerodynamic form.",
    attributes: {
      interactionType: "individual",
      demand: "endurance",
      contactLevel: "none",
    },
  },
  {
    name: "Archery",
    category: "Individual Sports",
    description:
      "Archery: standing stillness and repeatable form under a fixed target, ignoring distractions.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Fencing",
    category: "Individual Sports",
    description:
      "Fencing: split-second reactive decisions against a moving opponent's blade range.",
    attributes: {
      interactionType: "head-to-head",
      demand: "reflex",
      contactLevel: "none",
    },
  },
  {
    name: "Gymnastics",
    category: "Individual Sports",
    description:
      "Gymnastics: extreme contortion and acrobatic strength holding the body against gravity.",
    attributes: {
      interactionType: "individual",
      demand: "flexibility",
      contactLevel: "none",
    },
  },
  {
    name: "Horse Riding",
    category: "Individual Sports",
    description:
      "Horse Riding: subtle non-verbal communication and physical harmony with a massive animal.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Rock Climbing",
    category: "Individual Sports",
    description:
      "Rock Climbing: solving vertical puzzles using grip strength and careful foot placement.",
    attributes: {
      interactionType: "individual",
      demand: "strategy",
      contactLevel: "none",
    },
  },
  {
    name: "Skateboarding",
    category: "Individual Sports",
    description:
      "Skateboarding: fearless repetition of flipping and grinding a rolling board on concrete.",
    attributes: {
      interactionType: "individual",
      demand: "reflex",
      contactLevel: "none",
    },
  },
  {
    name: "Parkour",
    category: "Individual Sports",
    description:
      "Parkour: vaulting and leaping fluidly through complex urban obstacles without stopping.",
    attributes: {
      interactionType: "individual",
      demand: "power",
      contactLevel: "none",
    },
  },

  // Fitness & Wellness
  {
    name: "Yoga",
    category: "Fitness",
    description:
      "Yoga: deep breathing paired with sustained, mindful stretching and isometric holds.",
    attributes: {
      interactionType: "individual",
      demand: "flexibility",
      contactLevel: "none",
    },
  },
  {
    name: "Pilates",
    category: "Fitness",
    description:
      "Pilates: intensely focused core stabilization using controlled, low-impact movements.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "CrossFit",
    category: "Fitness",
    description:
      "CrossFit: high-intensity intervals combining heavy lifting, gymnastics, and sprinting.",
    attributes: {
      interactionType: "individual",
      demand: "power",
      contactLevel: "none",
    },
  },
  {
    name: "Weight Training",
    category: "Fitness",
    description:
      "Weight Training: progressive muscular overload lifting heavy iron with strict form.",
    attributes: {
      interactionType: "individual",
      demand: "power",
      contactLevel: "none",
    },
  },
  {
    name: "Aerobics",
    category: "Fitness",
    description:
      "Aerobics: continuous, choreographed cardiovascular routines performed to music.",
    attributes: {
      interactionType: "individual",
      demand: "endurance",
      contactLevel: "none",
    },
  },
  {
    name: "Zumba",
    category: "Fitness",
    description:
      "Zumba: joyful, high-energy dance fitness relying on Latin rhythms and constant motion.",
    attributes: {
      interactionType: "individual",
      demand: "endurance",
      contactLevel: "none",
    },
  },
  {
    name: "Dance",
    category: "Fitness",
    description:
      "Dance: expressive bodily coordination memorizing complex steps and musical timing.",
    attributes: {
      interactionType: "individual",
      demand: "flexibility",
      contactLevel: "none",
    },
  },
  {
    name: "Martial Arts",
    category: "Fitness",
    description:
      "Martial Arts: rigorous drilling of combat techniques for self-defense and discipline.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Boot Camp",
    category: "Fitness",
    description:
      "Boot Camp: grueling military-style drills pushing mental toughness and total fitness.",
    attributes: {
      interactionType: "individual",
      demand: "endurance",
      contactLevel: "none",
    },
  },
  {
    name: "Stretching",
    category: "Fitness",
    description:
      "Stretching: deliberate elongation of muscle fibers to increase range of motion.",
    attributes: {
      interactionType: "individual",
      demand: "flexibility",
      contactLevel: "none",
    },
  },
  {
    name: "Meditation",
    category: "Fitness",
    description:
      "Meditation: complete physical stillness to achieve profound mental focus and clarity.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },

  // Other Sports
  {
    name: "Billiards",
    category: "Other",
    description:
      "Billiards: mathematical angle calculation and soft-touch cue ball control.",
    attributes: {
      interactionType: "head-to-head",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Darts",
    category: "Other",
    description:
      "Darts: throwing small projectiles at a board requiring absolute hand steadiness.",
    attributes: {
      interactionType: "head-to-head",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Bowling",
    category: "Other",
    description:
      "Bowling: hurling a heavy ball down a slick lane aiming for distant pins.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Badminton Doubles",
    category: "Racquet Sports",
    description:
      "Badminton Doubles: lightning-fast net intercepts and synchronized partner rotations.",
    attributes: {
      interactionType: "team",
      demand: "reflex",
      contactLevel: "none",
    },
  },
  {
    name: "Lawn Bowls",
    category: "Other",
    description:
      "Lawn Bowls: rolling biased balls on grass to gently approach a smaller target.",
    attributes: {
      interactionType: "head-to-head",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "Tenpin Bowling",
    category: "Other",
    description:
      "Tenpin Bowling: heavy ball delivery relying on consistent release angles and momentum.",
    attributes: {
      interactionType: "individual",
      demand: "precision",
      contactLevel: "none",
    },
  },
  {
    name: "E-Sports / Gaming",
    category: "Other",
    description:
      "E-Sports / Gaming: blinding finger speed and screen-reading reaction times while seated.",
    attributes: {
      interactionType: "team",
      demand: "reflex",
      contactLevel: "none",
    },
  },
];

const seedSports = async () => {
  try {
    await connectDB();
    console.log("📚 Seeding sports data...");

    // Update existing sports or insert new ones (preserves _id, addedBy, verifiedAt)
    let updatedCount = 0;
    let createdCount = 0;

    for (const sport of INITIAL_SPORTS) {
      const slug = sport.name.toLowerCase().replace(/\s+/g, "-");
      const result = await Sport.updateOne(
        { slug },
        {
          $set: {
            name: sport.name,
            category: sport.category,
            description: sport.description,
            attributes: sport.attributes,
            isVerified: true,
          },
          $setOnInsert: {
            verifiedAt: new Date(),
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) createdCount++;
      else if (result.modifiedCount > 0) updatedCount++;
    }

    console.log(
      `✅ Seeded successfully! Created ${createdCount}, Updated ${updatedCount} sports.`,
    );

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
