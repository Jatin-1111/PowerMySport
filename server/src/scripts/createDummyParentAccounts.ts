import "dotenv/config";
import { connectDB } from "../config/database";
import { User } from "../client/models/User";

/**
 * Creates dummy "Parent" role accounts for seeding community content.
 * Usage: npx ts-node src/scripts/createDummyParentAccounts.ts
 */
const SHARED_PASSWORD = "PmsParent#2026!";

const DUMMY_PARENTS = [
  { name: "Aarav Sharma", email: "dummy.parent1@powermysport.com", phone: "9000000001" },
  { name: "Priya Nair", email: "dummy.parent2@powermysport.com", phone: "9000000002" },
  { name: "Rohan Mehta", email: "dummy.parent3@powermysport.com", phone: "9000000003" },
  { name: "Sneha Iyer", email: "dummy.parent4@powermysport.com", phone: "9000000004" },
  { name: "Vikram Singh", email: "dummy.parent5@powermysport.com", phone: "9000000005" },
];

async function createDummyParentAccounts() {
  try {
    await connectDB();

    console.log("\nCreating dummy Parent accounts...\n");

    for (const parent of DUMMY_PARENTS) {
      const existing = await User.findOne({ email: parent.email });
      if (existing) {
        console.log(`- Skipped (already exists): ${parent.email}`);
        continue;
      }

      await User.create({
        name: parent.name,
        email: parent.email,
        phone: parent.phone,
        password: SHARED_PASSWORD,
        role: "Parent",
        isActive: true,
      });

      console.log(`- Created: ${parent.email}`);
    }

    console.log("\nDone.\n");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createDummyParentAccounts();
