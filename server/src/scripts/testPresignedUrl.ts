/**
 * Test presigned URL generation
 */

import { s3Service } from "../services/S3Service";
import "dotenv/config";

async function testPresignedUrl() {
  console.log("Testing presigned URL generation...\n");

  try {
    const result = await s3Service.generateImageUploadUrl(
      "test_image.jpg",
      "image/jpeg",
      "test-venue-id",
      false,
    );

    console.log("Generated URLs:");
    console.log("================");
    console.log("\nUpload URL:");
    console.log(result.uploadUrl);
    console.log("\nDownload URL:");
    console.log(result.downloadUrl);
    console.log("\nKey:");
    console.log(result.key);
    console.log("\nFile Name:");
    console.log(result.fileName);

    // Parse the upload URL to check region
    const url = new URL(result.uploadUrl);
    console.log("\n--- URL Analysis ---");
    console.log(`Host: ${url.hostname}`);
    console.log(`Protocol: ${url.protocol}`);

    // Check if it's using virtual-hosted-style or path-style
    if (url.hostname.includes(".s3.")) {
      console.log("✓ Using virtual-hosted-style URL");
      const parts = url.hostname.split(".");
      console.log(`  Bucket: ${parts[0]}`);
      console.log(`  Region: ${parts[2]}`);
    } else {
      console.log("✓ Using path-style URL");
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

testPresignedUrl();
