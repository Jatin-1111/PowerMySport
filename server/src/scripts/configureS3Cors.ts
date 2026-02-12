/**
 * Script to configure CORS policy for S3 buckets
 * This allows the frontend to upload files directly to S3 using presigned URLs
 */

import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";

const region = process.env.AWS_REGION || "ap-south-1";
const imagesBucket = process.env.AWS_S3_IMAGES_BUCKET || "powermysport-images";
const documentsBucket =
  process.env.AWS_S3_DOCUMENTS_BUCKET || "powermysport-verification";

// Configure S3 client
const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// CORS configuration for allowing uploads from frontend
const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
      AllowedOrigins: [
        "http://localhost:3000",
        "http://localhost:3001",
        process.env.FRONTEND_URL || "http://localhost:3000",
        // Add your production domain here when deploying
        // "https://yourdomain.com",
      ].filter((origin, index, self) => self.indexOf(origin) === index), // Remove duplicates
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3000,
    },
  ],
};

async function configureBucketCors(bucketName: string) {
  try {
    console.log(`\nConfiguring CORS for bucket: ${bucketName}`);

    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfiguration,
    });

    await s3Client.send(command);
    console.log(`✅ CORS configured successfully for ${bucketName}`);
    console.log(
      `   Allowed origins: ${corsConfiguration.CORSRules[0]?.AllowedOrigins?.join(", ") || "N/A"}`,
    );
  } catch (error: any) {
    console.error(`❌ Failed to configure CORS for ${bucketName}:`);
    console.error(`   Error: ${error.message}`);

    if (error.name === "NoSuchBucket") {
      console.error(`   → Bucket does not exist. Please create it first.`);
    } else if (error.name === "AccessDenied") {
      console.error(
        `   → Access denied. Check IAM permissions for PutBucketCors action.`,
      );
    }
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("S3 CORS Configuration Script");
  console.log("=".repeat(60));
  console.log(`Region: ${region}`);
  console.log(`Images Bucket: ${imagesBucket}`);
  console.log(`Documents Bucket: ${documentsBucket}`);
  console.log("=".repeat(60));

  // Configure both buckets
  await configureBucketCors(imagesBucket);
  await configureBucketCors(documentsBucket);

  console.log("\n" + "=".repeat(60));
  console.log("Configuration complete!");
  console.log("=".repeat(60));
  console.log("\n📝 Note: If you see errors, ensure:");
  console.log("   1. The S3 buckets exist");
  console.log("   2. Your AWS credentials have PutBucketCors permissions");
  console.log("   3. Your IAM policy includes:");
  console.log("      {");
  console.log('        "Effect": "Allow",');
  console.log('        "Action": ["s3:PutBucketCors", "s3:GetBucketCors"],');
  console.log('        "Resource": "arn:aws:s3:::your-bucket-name"');
  console.log("      }");
}

main();
