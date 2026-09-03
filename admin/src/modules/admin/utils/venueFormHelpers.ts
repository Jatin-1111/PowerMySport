/**
 * Pure types, constants, and helpers for the admin AddVenueForm wizard —
 * extracted from `modules/admin/components/AddVenueForm.tsx`, which had
 * grown to 1,254 lines. Nothing here changed behavior, only location.
 */

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export const STEP_META: Array<{
  step: WizardStep;
  label: string;
  hint: string;
}> = [
  { step: 1, label: "Basic Details", hint: "Name and address" },
  { step: 2, label: "Venue Details", hint: "Sports, pricing, and settings" },
  { step: 3, label: "Photos", hint: "Upload venue visuals" },
  { step: 4, label: "Documents", hint: "Not required for admin" },
  { step: 5, label: "Review", hint: "Confirm and publish" },
];

export interface VenueFormData {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  name: string;
  address: string;
  sports: string[];
  pricePerHour: number | "";
  sportPricing: Record<string, number>;
  amenities: string[];
  description: string;
  latitude: number | "";
  longitude: number | "";
  location: {
    type: "Point";
    coordinates: [number, number];
  } | null;
  openingHours: any;
  allowExternalCoaches: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  generalImages: string[];
  generalImageKeys: string[];
  sportImages: Record<string, string[]>;
  sportImageKeys: Record<string, string[]>;
  coverPhotoUrl: string;
  coverPhotoKey: string;
}

export interface FormErrors {
  [key: string]: string;
}

export interface ApiConflictPayload {
  message?: string;
  requiresConversion?: boolean;
  requiresSeparateAccount?: boolean;
  existingRole?: string;
  targetRole?: string;
}

export const getApiConflictPayload = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return {} as { status?: number; data?: ApiConflictPayload };
  }

  const maybeError = error as {
    response?: { status?: number; data?: ApiConflictPayload };
  };

  return {
    status: maybeError.response?.status,
    data: maybeError.response?.data,
  };
};

export interface VenuePayload {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  name: string;
  address: string;
  sports: string[];
  pricePerHour: number;
  sportPricing: Record<string, number>;
  amenities: string[];
  description: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  openingHours: any;
  allowExternalCoaches: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  images?: string[];
  imageKeys?: string[];
  generalImages?: string[];
  generalImageKeys?: string[];
  sportImages?: Record<string, string[]>;
  sportImageKeys?: Record<string, string[]>;
  coverPhotoUrl?: string;
  coverPhotoKey?: string;
}
