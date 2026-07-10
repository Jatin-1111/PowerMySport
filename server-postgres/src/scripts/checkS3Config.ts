/**
 * Script to check S3 bucket configuration (CORS, ACL, Public Access)
 */

import {
  GetBucketCorsCommand,
  GetBucketAclCommand,
  GetPublicAccessBlockCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import "dotenv/config";

const region = process.env.AWS_REGION || "us-east-1";
const imagesBucket = process.env.AWS_S3_IMAGES_BUCKET || "powermysport-images";
const documentsBucket =
  process.env.AWS_S3_DOCUMENTS_BUCKET || "powermysport-documents";

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function checkBucketConfig(bucketName: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Checking configuration for: ${bucketName}`);
  console.log("=".repeat(60));

  // Check CORS
  try {
    const corsCommand = new GetBucketCorsCommand({ Bucket: bucketName });
    const corsResponse = await s3Client.send(corsCommand);
    console.log("\n✅ CORS Configuration:");
    console.log(JSON.stringify(corsResponse.CORSRules, null, 2));
  } catch (error: any) {
    if (error.name === "NoSuchCORSConfiguration") {
      console.log("\n❌ NO CORS CONFIGURATION FOUND!");
      console.log(
        "   This is the problem - CORS must be configured for uploads",
      );
    } else {
      console.log(`\n❌ Error checking CORS: ${error.message}`);
    }
  }

  // Check Public Access Block
  try {
    const publicAccessCommand = new GetPublicAccessBlockCommand({
      Bucket: bucketName,
    });
    const publicAccessResponse = await s3Client.send(publicAccessCommand);
    console.log("\n📋 Public Access Block Configuration:");
    console.log(
      JSON.stringify(
        publicAccessResponse.PublicAccessBlockConfiguration,
        null,
        2,
      ),
    );
  } catch (error: any) {
    if (error.name === "NoSuchPublicAccessBlockConfiguration") {
      console.log("\n✅ No Public Access Block (bucket can be public)");
    } else {
      console.log(`\n⚠️  Error checking public access: ${error.message}`);
    }
  }

  // Check ACL
  try {
    const aclCommand = new GetBucketAclCommand({ Bucket: bucketName });
    const aclResponse = await s3Client.send(aclCommand);
    console.log("\n📋 Bucket ACL:");
    console.log(`   Owner: ${aclResponse.Owner?.DisplayName}`);
    console.log(`   Grants: ${aclResponse.Grants?.length || 0}`);
    aclResponse.Grants?.forEach((grant) => {
      console.log(
        `   - ${grant.Grantee?.Type}: ${grant.Grantee?.URI || grant.Grantee?.DisplayName} (${grant.Permission})`,
      );
    });
  } catch (error: any) {
    console.log(`\n⚠️  Error checking ACL: ${error.message}`);
  }
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("S3 BUCKET CONFIGURATION CHECKER");
  console.log("=".repeat(60));
  console.log(`Region: ${region}`);

  await checkBucketConfig(imagesBucket);
  await checkBucketConfig(documentsBucket);

  console.log("\n" + "=".repeat(60));
  console.log("DIAGNOSIS:");
  console.log("=".repeat(60));
  console.log("\nFor uploads to work from browser:");
  console.log("1. ✅ Bucket must exist");
  console.log("2. ✅ CORS must be configured with:");
  console.log("   - AllowedOrigins: http://localhost:3000");
  console.log("   - AllowedMethods: PUT, POST");
  console.log("   - AllowedHeaders: *");
  console.log("3. ⚠️  Public access is NOT required for presigned URLs");
  console.log("4. ⚠️  Presigned URLs work even with private buckets");
  console.log(
    "\nIf CORS is missing, run: npx tsx src/scripts/configureS3Cors.ts",
  );
}

main();
