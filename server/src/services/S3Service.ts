/**
 * S3 Service for handling presigned URLs and file uploads
 * Uses two separate S3 buckets:
 * - Documents bucket: for venue registration documents
 * - Images bucket: for venue photos and cover images
 */

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface PresignedUrlConfig {
  bucket: string;
  key: string;
  contentType: string;
  expiresIn: number; // in seconds
}

export interface UploadUrlResponse {
  uploadUrl: string;
  downloadUrl: string;
  fileName: string;
  key: string;
}

export class S3Service {
  private documentsBucket: string;
  private imagesBucket: string;
  private region: string;
  private s3Client: S3Client;

  constructor() {
    // Load environment variables first
    this.region = process.env.AWS_REGION || "ap-south-1";
    this.documentsBucket =
      process.env.AWS_S3_DOCUMENTS_BUCKET || "powermysport-documents";
    this.imagesBucket =
      process.env.AWS_S3_IMAGES_BUCKET || "powermysport-images";

    console.log(`[S3Service] Initializing with region: ${this.region}`);
    console.log(`[S3Service] Images bucket: ${this.imagesBucket}`);
    console.log(`[S3Service] Documents bucket: ${this.documentsBucket}`);

    const clientConfig: S3ClientConfig = {
      region: this.region,
    };

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    this.s3Client = new S3Client(clientConfig);
  }

  /**
   * Generate presigned upload URL for document uploads
   * @param fileName - Original file name
   * @param contentType - MIME type (e.g., application/pdf, image/jpeg)
   * @param documentType - Type of document for folder organization
   * @returns Presigned URL and metadata
   */
  async generateDocumentUploadUrl(
    fileName: string,
    contentType: string,
    documentType:
      | "OWNERSHIP_PROOF"
      | "BUSINESS_REGISTRATION"
      | "TAX_DOCUMENT"
      | "INSURANCE"
      | "CERTIFICATE",
    venueId: string,
  ): Promise<UploadUrlResponse> {
    const fileExtension = fileName.split(".").pop();
    const sanitizedFileName = `${documentType.toLowerCase()}_${Date.now()}.${fileExtension}`;
    const key = `venues/${venueId}/documents/${sanitizedFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: this.documentsBucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, putCommand, {
      expiresIn: 3600, // 1 hour
    });

    // Generate presigned download URL (valid for 7 days) for private bucket
    const getCommand = new GetObjectCommand({
      Bucket: this.documentsBucket,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, getCommand, {
      expiresIn: 604800, // 7 days
    });

    return {
      uploadUrl,
      downloadUrl,
      fileName: sanitizedFileName,
      key,
    };
  }

  /**
   * Generate presigned upload URL for venue images
   * @param fileName - Original file name
   * @param contentType - MIME type for image
   * @param venueId - Venue ID for folder organization
   * @param isCoverPhoto - Whether this is the cover photo
   * @returns Presigned URL and metadata
   */
  async generateImageUploadUrl(
    fileName: string,
    contentType: string,
    venueId: string,
    isCoverPhoto: boolean = false,
  ): Promise<UploadUrlResponse> {
    const fileExtension = fileName.split(".").pop();
    const folder = isCoverPhoto ? "cover" : "gallery";
    const sanitizedFileName = `${folder}_${Date.now()}.${fileExtension}`;
    const key = `venues/${venueId}/images/${sanitizedFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: this.imagesBucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, putCommand, {
      expiresIn: 3600, // 1 hour
    });

    // Generate presigned URL for downloading/viewing the image (7 days expiry)
    const getCommand = new GetObjectCommand({
      Bucket: this.imagesBucket,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, getCommand, {
      expiresIn: 604800, // 7 days
    });

    return {
      uploadUrl,
      downloadUrl,
      fileName: sanitizedFileName,
      key,
    };
  }

  /**
   * Generate presigned upload URL for user profile pictures
   * @param fileName - Original file name
   * @param contentType - MIME type for image
   * @param userId - User ID for folder organization
   * @returns Presigned URL and metadata
   */
  async generateProfilePictureUploadUrl(
    fileName: string,
    contentType: string,
    userId: string,
  ): Promise<UploadUrlResponse> {
    const fileExtension = fileName.split(".").pop();
    const sanitizedFileName = `profile_${Date.now()}.${fileExtension}`;
    const key = `users/${userId}/${sanitizedFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: this.imagesBucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, putCommand, {
      expiresIn: 3600, // 1 hour
    });

    // Generate presigned download URL (valid for 7 days) for private bucket
    const getCommand = new GetObjectCommand({
      Bucket: this.imagesBucket,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, getCommand, {
      expiresIn: 604800, // 7 days
    });

    return {
      uploadUrl,
      downloadUrl,
      fileName: sanitizedFileName,
      key,
    };
  }

  /**
   * Generate presigned upload URL for coach profile photos
   * @param fileName - Original file name
   * @param contentType - MIME type for image
   * @param venueId - Venue ID for folder organization
   * @returns Presigned URL and metadata
   */
  async generateCoachPhotoUploadUrl(
    fileName: string,
    contentType: string,
    venueId: string,
  ): Promise<UploadUrlResponse> {
    const fileExtension = fileName.split(".").pop();
    const sanitizedFileName = `coach_${Date.now()}.${fileExtension}`;
    const key = `venues/${venueId}/coaches/${sanitizedFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: this.imagesBucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, putCommand, {
      expiresIn: 3600, // 1 hour
    });

    // Generate presigned download URL (valid for 7 days) for private bucket
    const getCommand = new GetObjectCommand({
      Bucket: this.imagesBucket,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, getCommand, {
      expiresIn: 604800, // 7 days
    });

    return {
      uploadUrl,
      downloadUrl,
      fileName: sanitizedFileName,
      key,
    };
  }

  /**
   * Generate presigned upload URL for coach verification documents
   * @param fileName - Original file name
   * @param contentType - MIME type for document
   * @param coachId - Coach ID for folder organization
   * @param documentType - Verification document type
   * @returns Presigned URL and metadata
   */
  async generateCoachVerificationUploadUrl(
    fileName: string,
    contentType: string,
    coachId: string,
    documentType:
      | "CERTIFICATION"
      | "ID_PROOF"
      | "ADDRESS_PROOF"
      | "BACKGROUND_CHECK"
      | "INSURANCE"
      | "OTHER",
  ): Promise<UploadUrlResponse> {
    const fileExtension = fileName.split(".").pop();
    const sanitizedFileName = `${documentType.toLowerCase()}_${Date.now()}.${fileExtension}`;
    const key = `coaches/${coachId}/documents/${sanitizedFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: this.documentsBucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, putCommand, {
      expiresIn: 3600,
    });

    const getCommand = new GetObjectCommand({
      Bucket: this.documentsBucket,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, getCommand, {
      expiresIn: 604800,
    });

    return {
      uploadUrl,
      downloadUrl,
      fileName: sanitizedFileName,
      key,
    };
  }

  /**
   * Generate presigned download URL for existing file
   * @param key - S3 object key
   * @param bucketType - Type of bucket ("verification" for venues/documents, "images" for user profiles)
   * @param expiresIn - Expiration time in seconds (default 1 hour)
   * @returns Presigned download URL
   */
  async generateDownloadUrl(
    key: string,
    bucketType: "verification" | "images" = "images",
    expiresIn: number = 3600,
  ): Promise<string> {
    const bucket =
      bucketType === "verification" ? this.documentsBucket : this.imagesBucket;

    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, getCommand, { expiresIn });
  }

  /**
   * Delete file from S3
   * @param key - S3 object key
   * @param bucketType - Type of bucket ("documents" or "images")
   */
  async deleteFile(
    key: string,
    bucketType: "documents" | "images" = "images",
  ): Promise<void> {
    const bucket =
      bucketType === "documents" ? this.documentsBucket : this.imagesBucket;

    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.s3Client.send(deleteCommand);
  }

  /**
   * Delete multiple files
   * @param keys - Array of S3 object keys
   * @param bucketType - Type of bucket ("documents" or "images")
   */
  async deleteFiles(
    keys: string[],
    bucketType: "documents" | "images" = "images",
  ): Promise<void> {
    if (keys.length === 0) return;

    const bucket =
      bucketType === "documents" ? this.documentsBucket : this.imagesBucket;

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    });

    await this.s3Client.send(deleteCommand);
  }

  /**
   * Validate file for upload
   * @param fileName - File name
   * @param contentType - MIME type
   * @param fileSize - File size in bytes
   * @param allowedTypes - Allowed MIME types
   * @param maxSizeBytes - Maximum file size in bytes
   */
  validateFile(
    fileName: string,
    contentType: string,
    fileSize: number,
    allowedTypes: string[],
    maxSizeBytes: number,
  ): { valid: boolean; error?: string } {
    // Check file type
    if (!allowedTypes.includes(contentType)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
      };
    }

    // Check file size
    if (fileSize > maxSizeBytes) {
      const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `File size exceeds maximum of ${maxSizeMB}MB`,
      };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const s3Service = new S3Service();
