// ============================================
// VENUE ONBOARDING TYPES
// ============================================

export type VenueApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVIEW";

export interface VenueCoach {
  name: string;
  sport: string;
  hourlyRate: number;
  bio?: string;
}

export interface VenueDocument {
  type:
    | "OWNERSHIP_PROOF"
    | "BUSINESS_REGISTRATION"
    | "TAX_DOCUMENT"
    | "INSURANCE"
    | "CERTIFICATE";
  url: string;
  s3Key: string; // Permanent S3 key for regenerating presigned URLs
  fileName: string;
  uploadedAt: Date;
}

export interface OnboardingVenue {
  id?: string;
  venueId?: string;
  _id?: string;
  // Venue Lister Contact Info
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;

  // Venue Details
  name: string;
  sports: string[];
  pricePerHour: number;
  sportPricing?: Record<string, number>;
  amenities?: string[];
  address: string;
  openingHours?: string;
  description?: string;
  allowExternalCoaches?: boolean;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  images?: string[];
  imageKeys?: string[]; // S3 keys for venue images
  coverPhotoUrl?: string;
  coverPhotoKey?: string; // S3 key for cover photo
  documents?: VenueDocument[];
  approvalStatus?: VenueApprovalStatus;
}

// Lightweight type for admin pending venues list
export interface PendingVenueListItem {
  id: string;
  name: string;
  ownerEmail: string;
  ownerPhone: string;
  sports: string[];
  approvalStatus: VenueApprovalStatus;
  submittedAt: string;
  lastReviewedAt?: string;
}

export interface PresignedUrl {
  field: string;
  uploadUrl: string;
  downloadUrl: string;
  key: string; // S3 key - must be stored in DB for URL regeneration
  fileName: string;
  contentType: string;
  maxSizeBytes: number;
}

export interface OnboardingStep1Payload {
  // Venue Lister Contact Info
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}

export interface OnboardingStep2Payload {
  venueId: string;
  // Venue Details
  name: string;
  sports: string[];
  pricePerHour: number;
  sportPricing?: Record<string, number>;
  amenities: string[];
  address: string;
  openingHours: string;
  description: string;
  allowExternalCoaches: boolean;
  hasCoaches: boolean;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  images?: string[];
  coverPhotoUrl?: string;
}

export interface OnboardingStep3Payload {
  venueId: string;
  images: string[];
  imageKeys: string[]; // S3 keys for images
  coverPhotoUrl: string;
  coverPhotoKey: string; // S3 key for cover photo
  documents: Array<{
    type:
      | "OWNERSHIP_PROOF"
      | "BUSINESS_REGISTRATION"
      | "TAX_DOCUMENT"
      | "INSURANCE"
      | "CERTIFICATE";
    url: string;
    s3Key: string; // S3 key for document
    fileName: string;
  }>;
}

export interface ConfirmImagesPayload {
  venueId: string;
  images: string[];
  imageKeys: string[]; // S3 keys for images
  coverPhotoUrl: string;
  coverPhotoKey: string; // S3 key for cover photo
}

export interface UploadedImage {
  data: File;
  preview: string;
  isCover: boolean;
}

export interface UploadedDocument {
  type:
    | "OWNERSHIP_PROOF"
    | "BUSINESS_REGISTRATION"
    | "TAX_DOCUMENT"
    | "INSURANCE"
    | "CERTIFICATE";
  file: File;
  fileName: string;
}

export interface OnboardingStep5Payload {
  venueId: string;
  coaches: VenueCoach[];
}

export interface OnboardingFormState {
  step: 1 | 2 | 3 | 4 | 5;
  venueId?: string;
  basicDetails?: OnboardingStep1Payload;
  images?: UploadedImage[];
  documents?: UploadedDocument[];
  loading: boolean;
  error?: string;
  success?: string;
}
