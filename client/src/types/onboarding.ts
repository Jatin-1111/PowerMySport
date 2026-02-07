// ============================================
// VENUE ONBOARDING TYPES
// ============================================

export type VenueApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVIEW";

export interface VenueDocument {
  type:
    | "OWNERSHIP_PROOF"
    | "BUSINESS_REGISTRATION"
    | "TAX_DOCUMENT"
    | "INSURANCE"
    | "CERTIFICATE";
  url: string;
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
  coverPhotoUrl?: string;
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
  amenities: string[];
  address: string;
  openingHours: string;
  description: string;
  allowExternalCoaches: boolean;
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
  coverPhotoUrl: string;
  documents: Array<{
    type:
      | "OWNERSHIP_PROOF"
      | "BUSINESS_REGISTRATION"
      | "TAX_DOCUMENT"
      | "INSURANCE"
      | "CERTIFICATE";
    url: string;
    fileName: string;
  }>;
}

export interface ConfirmImagesPayload {
  venueId: string;
  images: string[];
  coverPhotoUrl: string;
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

export interface OnboardingFormState {
  step: 1 | 2 | 3;
  venueId?: string;
  basicDetails?: OnboardingStep1Payload;
  images?: UploadedImage[];
  documents?: UploadedDocument[];
  loading: boolean;
  error?: string;
  success?: string;
}
