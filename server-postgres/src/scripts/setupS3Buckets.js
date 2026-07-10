/**
 * AWS S3 Bucket Setup Script
 * 
 * This script helps set up the required S3 buckets with proper configuration.
 * 
 * Prerequisites:
 * - AWS CLI installed and configured
 * - AWS credentials with admin access or S3 full access
 * 
 * Run: node src/scripts/setupS3Buckets.js
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

require('dotenv').config();

const REGION = process.env.AWS_REGION || 'ap-south-1';
const DOCUMENTS_BUCKET = process.env.AWS_S3_DOCUMENTS_BUCKET || 'powermysport-verification';
const IMAGES_BUCKET = process.env.AWS_S3_IMAGES_BUCKET || 'powermysport-images';
const CHAT_BUCKET = process.env.AWS_S3_CHAT_BUCKET || 'powermysport-chat';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const CORS_CONFIGURATION = `{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
`;

const IMAGE_BUCKET_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${IMAGES_BUCKET}/*"
    }
  ]
}
`;

const CHAT_BUCKET_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${CHAT_BUCKET}/*"
    }
  ]
}
`;

async function runCommand(command, description) {
    try {
        console.log(`\n🔄 ${description}...`);
        const { stdout, stderr } = await execAsync(command);
        if (stdout) console.log(stdout);
        if (stderr && !stderr.includes('BucketAlreadyOwnedByYou')) console.error(stderr);
        console.log(`✅ ${description} - Done`);
        return true;
    } catch (error) {
        if (error.message.includes('BucketAlreadyOwnedByYou') || error.message.includes('BucketAlreadyExists')) {
            console.log(`ℹ️  Bucket already exists, skipping creation`);
            return true;
        }
        console.error(`❌ ${description} - Failed:`, error.message);
        return false;
    }
}

async function setupS3Buckets() {
    console.log('='.repeat(60));
    console.log('AWS S3 BUCKET SETUP');
    console.log('='.repeat(60));
    console.log(`Region: ${REGION}`);
    console.log(`Documents Bucket: ${DOCUMENTS_BUCKET}`);
    console.log(`Images Bucket: ${IMAGES_BUCKET}`);
    console.log(`Chat Bucket: ${CHAT_BUCKET}`);
    console.log();

    // Check if AWS CLI is installed
    try {
        await execAsync('aws --version');
    } catch (error) {
        console.error('❌ AWS CLI is not installed or not in PATH');
        console.error('Please install AWS CLI: https://aws.amazon.com/cli/');
        process.exit(1);
    }

    // Create Documents Bucket
    await runCommand(
        `aws s3 mb s3://${DOCUMENTS_BUCKET} --region ${REGION}`,
        `Creating documents bucket: ${DOCUMENTS_BUCKET}`
    );

    // Create Images Bucket
    await runCommand(
        `aws s3 mb s3://${IMAGES_BUCKET} --region ${REGION}`,
        `Creating images bucket: ${IMAGES_BUCKET}`
    );

    // Create Chat Bucket
    await runCommand(
        `aws s3 mb s3://${CHAT_BUCKET} --region ${REGION}`,
        `Creating chat bucket: ${CHAT_BUCKET}`
    );

    // Write CORS configuration to temp file
    const fs = require('fs');
    const corsFile = 'temp-cors.json';
    fs.writeFileSync(corsFile, CORS_CONFIGURATION);

    // Configure CORS for Documents Bucket
    await runCommand(
        `aws s3api put-bucket-cors --bucket ${DOCUMENTS_BUCKET} --cors-configuration file://${corsFile}`,
        `Configuring CORS for ${DOCUMENTS_BUCKET}`
    );

    // Configure CORS for Images Bucket
    await runCommand(
        `aws s3api put-bucket-cors --bucket ${IMAGES_BUCKET} --cors-configuration file://${corsFile}`,
        `Configuring CORS for ${IMAGES_BUCKET}`
    );

    // Configure CORS for Chat Bucket
    await runCommand(
        `aws s3api put-bucket-cors --bucket ${CHAT_BUCKET} --cors-configuration file://${corsFile}`,
        `Configuring CORS for ${CHAT_BUCKET}`
    );

    // Write bucket policy to temp file
    const policyFile = 'temp-policy.json';
    fs.writeFileSync(policyFile, IMAGE_BUCKET_POLICY);

    // Make images bucket publicly readable
    await runCommand(
        `aws s3api put-public-access-block --bucket ${IMAGES_BUCKET} --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"`,
        `Removing public access block for ${IMAGES_BUCKET}`
    );

    await runCommand(
        `aws s3api put-bucket-policy --bucket ${IMAGES_BUCKET} --policy file://${policyFile}`,
        `Setting public read policy for ${IMAGES_BUCKET}`
    );

    // Write chat bucket policy to temp file
    const chatPolicyFile = 'temp-chat-policy.json';
    fs.writeFileSync(chatPolicyFile, CHAT_BUCKET_POLICY);

    // Make chat bucket publicly readable
    await runCommand(
        `aws s3api put-public-access-block --bucket ${CHAT_BUCKET} --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"`,
        `Removing public access block for ${CHAT_BUCKET}`
    );

    await runCommand(
        `aws s3api put-bucket-policy --bucket ${CHAT_BUCKET} --policy file://${chatPolicyFile}`,
        `Setting public read policy for ${CHAT_BUCKET}`
    );

    // Clean up temp files
    fs.unlinkSync(corsFile);
    fs.unlinkSync(policyFile);
    fs.unlinkSync(chatPolicyFile);

    console.log('\n' + '='.repeat(60));
    console.log('✅ S3 BUCKET SETUP COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`✅ Documents bucket: ${DOCUMENTS_BUCKET} (private)`);
    console.log(`✅ Images bucket: ${IMAGES_BUCKET} (public read)`);
    console.log(`✅ Chat bucket: ${CHAT_BUCKET} (public read)`);
    console.log(`✅ CORS configured for browser uploads`);
    console.log(`✅ Ready for venue onboarding!`);
    console.log('\n💡 Test the setup by running:');
    console.log('   npx ts-node src/scripts/testAwsS3.ts');
    console.log('='.repeat(60));
}

setupS3Buckets()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Setup failed:', error);
        process.exit(1);
    });
