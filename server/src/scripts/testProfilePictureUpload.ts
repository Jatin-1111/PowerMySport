/**
 * Test script to debug profile picture upload 403 error
 */

import "dotenv/config";
import { S3Service } from "../services/S3Service";

async function testProfilePictureUpload() {
  console.log("=".repeat(60));
  console.log("Testing Profile Picture Upload");
  console.log("=".repeat(60));

  const s3Service = new S3Service();
  const testUserId = "698dfb8ecb0d69b6f0bdb5a0"; // Use your actual user ID
  const testFileName = "test.png";
  const testContentType = "image/png";

  try {
    console.log("\n1. Generating presigned URL...");
    const result = await s3Service.generateProfilePictureUploadUrl(
      testFileName,
      testContentType,
      testUserId,
    );

    console.log("\n✅ Presigned URL generated successfully:");
    console.log(`   Upload URL: ${result.uploadUrl.substring(0, 100)}...`);
    console.log(`   Download URL: ${result.downloadUrl}`);
    console.log(`   S3 Key: ${result.key}`);
    console.log(`   File Name: ${result.fileName}`);

    console.log("\n2. Testing with a simple fetch...");
    console.log("   Note: This will fail with 403 if bucket policy is wrong");
    console.log(
      "   Note: This will fail with SignatureDoesNotMatch if credentials are wrong",
    );

    // Try a simple test upload
    const testData = Buffer.from("test data");

    const response = await fetch(result.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": testContentType,
      },
      body: testData,
    });

    console.log(
      `\n   Response Status: ${response.status} ${response.statusText}`,
    );

    if (response.ok) {
      console.log("   ✅ Upload successful!");
    } else {
      const errorText = await response.text();
      console.log("   ❌ Upload failed:");
      console.log(`   Error: ${errorText}`);
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error("   Stack:", error.stack);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test complete");
  console.log("=".repeat(60));
}

testProfilePictureUpload();
