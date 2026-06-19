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
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { v4 as uuidv4 } from "uuid";

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
  private s3Client: any;

  constructor() {
    // Load environment variables first
    this.region = process.env.AWS_REGION || "ap-south-1";
    this.documentsBucket =
      process.env.AWS_S3_DOCUMENTS_BUCKET || "powermysport-documents";
    this.imagesBucket =
      process.env.AWS_S3_IMAGES_BUCKET || "powermysport-images";

    if (process.env.NODE_ENV === "development") {
      console.log(`[S3Service] Initializing with region: ${this.region}`);
      console.log(`[S3Service] Images bucket: ${this.imagesBucket}`);
      console.log(`[S3Service] Documents bucket: ${this.documentsBucket}`);
    }

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
      | "CERTIFICATE"
      | "panDocument"
      | "gstDocument",
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
   * Generate presigned upload URL for product images
   * @param fileName - Original file name
   * @param contentType - MIME type for image
   * @returns Presigned URL and metadata
   */
  async generateProductImageUploadUrl(
    fileName: string,
    contentType: string,
  ): Promise<UploadUrlResponse> {
    const fileExtension = fileName.split(".").pop();
    const sanitizedFileName = `product_${Date.now()}_${uuidv4().substring(0, 8)}.${fileExtension}`;
    const key = `products/${sanitizedFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: this.imagesBucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, putCommand, {
      expiresIn: 3600, // 1 hour
    });

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

  async generateCoachVenueImageUploadUrl(
    fileName: string,
    contentType: string,
    coachId: string,
  ): Promise<UploadUrlResponse> {
    const fileExtension = fileName.split(".").pop();
    const sanitizedFileName = `venue_${Date.now()}.${fileExtension}`;
    const key = `coaches/${coachId}/images/${sanitizedFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: this.imagesBucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, putCommand, {
      expiresIn: 3600,
    });

    const getCommand = new GetObjectCommand({
      Bucket: this.imagesBucket,
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
   * Generate presigned upload URL for concierge documents (birth certs, medical certs)
   * @param fileName - Original file name
   * @param contentType - MIME type for document
   * @param userId - User ID for folder organization
   * @param documentType - Type of document (e.g. BIRTH_CERTIFICATE, MEDICAL_CERTIFICATE)
   * @returns Presigned URL and metadata
   */
  async generateConciergeDocumentUploadUrl(
    fileName: string,
    contentType: string,
    userId: string,
    documentType: string,
  ): Promise<UploadUrlResponse> {
    const fileExtension = fileName.split(".").pop();
    const cleanDocType = documentType.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const sanitizedFileName = `${cleanDocType}_${Date.now()}.${fileExtension}`;
    const key = `concierge/${userId}/${sanitizedFileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: this.documentsBucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, putCommand, {
      expiresIn: 3600, // 1 hour
    });

    // Generate presigned download URL for private bucket
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
   * Generate presigned download URL for a concierge document
   * @param key - The S3 key of the document
   * @returns Presigned download URL (valid for 1 hour)
   */
  async generateConciergeDocumentDownloadUrl(key: string): Promise<string> {
    const getCommand = new GetObjectCommand({
      Bucket: this.documentsBucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, getCommand, {
      expiresIn: 3600, // 1 hour
    });
  }

  /**
   * Generate a presigned POST for secure chat image uploads.
   * Security enforced at AWS policy level:
   *  - content-length-range: 1 byte – 5 MB (prevents oversized uploads)
   *  - Content-Type: only image/jpeg, image/png, or image/webp
   *  - Unpredictable object key via uuid to prevent IDOR/scraping
   * @param conversationId - Used as a folder prefix
   * @param contentType - MIME type (must be jpeg/png/webp, validated by caller)
   */
  async generateChatImagePresignedPost(
    conversationId: string,
    contentType: "image/jpeg" | "image/png" | "image/webp",
  ): Promise<{ url: string; fields: Record<string, string>; key: string }> {
    const chatBucket = process.env.AWS_S3_CHAT_BUCKET;
    if (!chatBucket) {
      throw new Error("AWS_S3_CHAT_BUCKET environment variable is not set");
    }

    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ext = extMap[contentType] || "jpg";
    const key = `chats/${conversationId}/${uuidv4()}.${ext}`;

    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: chatBucket,
      Key: key,
      Conditions: [
        // Enforce strict 10 MB upload ceiling at the AWS level
        ["content-length-range", 1, 10 * 1024 * 1024],
        // Whitelist only allowed content types
        ["eq", "$Content-Type", contentType],
      ],
      Fields: {
        "Content-Type": contentType,
      },
      Expires: 300, // 5 minutes
    });

    return { url, fields, key };
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
