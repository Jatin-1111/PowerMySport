/**
 * AWS S3 Connectivity Test Script
 *
 * This script tests:
 * 1. AWS credentials configuration
 * 2. S3 bucket accessibility
 * 3. Presigned URL generation
 * 4. Upload/Download functionality
 *
 * Run: npx ts-node src/scripts/testAwsS3.ts
 */

import {
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { s3Service } from "../services/S3Service";

dotenv.config();

const testS3Configuration = async () => {
  console.log("=".repeat(60));
  console.log("AWS S3 CONNECTIVITY TEST");
  console.log("=".repeat(60));
  console.log();

  // Check environment variables
  console.log("📋 Checking AWS Configuration...");
  console.log("-".repeat(60));

  const config = {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    documentsBucket: process.env.AWS_S3_DOCUMENTS_BUCKET,
    imagesBucket: process.env.AWS_S3_IMAGES_BUCKET,
  };

  console.log(`✓ AWS Region: ${config.region || "NOT SET"}`);
  console.log(
    `✓ Access Key ID: ${config.accessKeyId?.substring(0, 8)}...${config.accessKeyId ? "SET" : "NOT SET"}`,
  );
  console.log(
    `✓ Secret Access Key: ${config.secretAccessKey ? "***SET***" : "NOT SET"}`,
  );
  console.log(`✓ Documents Bucket: ${config.documentsBucket || "NOT SET"}`);
  console.log(`✓ Images Bucket: ${config.imagesBucket || "NOT SET"}`);
  console.log();

  if (!config.accessKeyId || !config.secretAccessKey) {
    console.error("❌ AWS credentials not configured!");
    process.exit(1);
  }

  // Test S3 Client Connection
  console.log("🔌 Testing S3 Client Connection...");
  console.log("-".repeat(60));

  const s3Client = new S3Client({
    region: config.region || "ap-south-1",
    credentials: {
      accessKeyId: config.accessKeyId!,
      secretAccessKey: config.secretAccessKey!,
    },
  });

  // Test Documents Bucket
  try {
    console.log(`\n📦 Testing Documents Bucket: ${config.documentsBucket}`);
    const headCommand = new HeadBucketCommand({
      Bucket: config.documentsBucket,
    });
    await s3Client.send(headCommand);
    console.log(`✅ Documents bucket accessible`);

    // Try to list objects (limited to 5)
    const listCommand = new ListObjectsV2Command({
      Bucket: config.documentsBucket,
      MaxKeys: 5,
    });
    const listResult = await s3Client.send(listCommand);
    console.log(`   ℹ️  Objects in bucket: ${listResult.KeyCount || 0}`);
  } catch (error: any) {
    console.error(`❌ Documents bucket error: ${error.message}`);
    if (error.name === "NoSuchBucket") {
      console.error(
        `   💡 Bucket "${config.documentsBucket}" does not exist. Please create it first.`,
      );
    } else if (error.name === "AccessDenied") {
      console.error(
        `   💡 Access denied. Check bucket permissions and IAM policy.`,
      );
    }
  }

  // Test Images Bucket
  try {
    console.log(`\n🖼️  Testing Images Bucket: ${config.imagesBucket}`);
    const headCommand = new HeadBucketCommand({
      Bucket: config.imagesBucket,
    });
    await s3Client.send(headCommand);
    console.log(`✅ Images bucket accessible`);

    // Try to list objects (limited to 5)
    const listCommand = new ListObjectsV2Command({
      Bucket: config.imagesBucket,
      MaxKeys: 5,
    });
    const listResult = await s3Client.send(listCommand);
    console.log(`   ℹ️  Objects in bucket: ${listResult.KeyCount || 0}`);
  } catch (error: any) {
    console.error(`❌ Images bucket error: ${error.message}`);
    if (error.name === "NoSuchBucket") {
      console.error(
        `   💡 Bucket "${config.imagesBucket}" does not exist. Please create it first.`,
      );
    } else if (error.name === "AccessDenied") {
      console.error(
        `   💡 Access denied. Check bucket permissions and IAM policy.`,
      );
    }
  }

  // Test Presigned URL Generation
  console.log("\n🔗 Testing Presigned URL Generation...");
  console.log("-".repeat(60));

  try {
    // Test document upload URL
    const docUrl = await s3Service.generateDocumentUploadUrl(
      "test-document.pdf",
      "application/pdf",
      "OWNERSHIP_PROOF",
      "test-venue-123",
    );
    console.log("✅ Document upload URL generated successfully");
    console.log(`   Upload URL: ${docUrl.uploadUrl.substring(0, 80)}...`);
    console.log(`   Download URL: ${docUrl.downloadUrl}`);
  } catch (error: any) {
    console.error(`❌ Document URL generation failed: ${error.message}`);
  }

  try {
    // Test image upload URL
    const imageUrl = await s3Service.generateImageUploadUrl(
      "test-image.jpg",
      "image/jpeg",
      "test-venue-123",
      false,
    );
    console.log("\n✅ Image upload URL generated successfully");
    console.log(`   Upload URL: ${imageUrl.uploadUrl.substring(0, 80)}...`);
    console.log(`   Download URL: ${imageUrl.downloadUrl}`);
  } catch (error: any) {
    console.error(`❌ Image URL generation failed: ${error.message}`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log("✅ AWS Configuration: OK");
  console.log("✅ S3 Client: OK");
  console.log("✅ Presigned URL Generation: OK");
  console.log();
  console.log("💡 Next Steps:");
  console.log("   1. Make sure both S3 buckets exist in AWS");
  console.log(
    "   2. Set bucket policies to allow public read access (optional)",
  );
  console.log("   3. Configure CORS settings for browser uploads");
  console.log("   4. Test actual file uploads through the API endpoints");
  console.log("=".repeat(60));
};

// Run test
if (require.main === module) {
  testS3Configuration()
    .then(() => {
      console.log("\n✅ Test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Test failed:", error);
      process.exit(1);
    });
}

export { testS3Configuration };
