/**
 * Simple script to verify CORS configuration
 */

import { GetBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";

const region = process.env.AWS_REGION || "us-east-1";
const imagesBucket = process.env.AWS_S3_IMAGES_BUCKET || "powermysport-images";

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function checkCors() {
  console.log(`Checking CORS for: ${imagesBucket}`);
  console.log(`Region: ${region}\n`);

  try {
    const command = new GetBucketCorsCommand({ Bucket: imagesBucket });
    const response = await s3Client.send(command);

    console.log("CORS Rules Found:");
    response.CORSRules?.forEach((rule, index) => {
      console.log(`\nRule ${index + 1}:`);
      console.log(`  Allowed Origins: ${rule.AllowedOrigins?.join(", ")}`);
      console.log(`  Allowed Methods: ${rule.AllowedMethods?.join(", ")}`);
      console.log(`  Allowed Headers: ${rule.AllowedHeaders?.join(", ")}`);
      console.log(`  Max Age: ${rule.MaxAgeSeconds}s`);
    });

    // Check if localhost:3000 is allowed
    const hasLocalhost = response.CORSRules?.some((rule) =>
      rule.AllowedOrigins?.includes("http://localhost:3000"),
    );

    const hasPUT = response.CORSRules?.some((rule) =>
      rule.AllowedMethods?.includes("PUT"),
    );

    console.log("\n--- Verification ---");
    console.log(`✓ localhost:3000 allowed: ${hasLocalhost ? "YES" : "NO"}`);
    console.log(`✓ PUT method allowed: ${hasPUT ? "YES" : "NO"}`);

    if (!hasLocalhost || !hasPUT) {
      console.log("\n❌ CORS is NOT properly configured!");
      console.log("Run: npx tsx src/scripts/configureS3Cors.ts");
    } else {
      console.log("\n✅ CORS is properly configured!");
    }
  } catch (error: any) {
    if (error.name === "NoSuchCORSConfiguration") {
      console.log("❌ NO CORS CONFIGURATION FOUND!");
      console.log("\nThis is why uploads are failing.");
      console.log("Run: npx tsx src/scripts/configureS3Cors.ts");
    } else {
      console.log(`Error: ${error.message}`);
    }
  }
}

checkCors();
