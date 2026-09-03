import type { UserRole } from "./enums";

/**
 * Canonical User shape, merged from three definitions that had drifted
 * independently: the server Mongoose model, admin/src/types/index.ts, and
 * client/src/types/index.ts. Concrete gaps found during that merge:
 *
 *  - bio/sportInterests/involvementYears existed flat on the server model,
 *    nested under client's `parentProfile`, and not at all on admin.
 *  - googleId, shippingAddress, addresses/defaultAddressId existed on the
 *    server model and client, but not admin.
 *  - isIdentityPublic, playerProfile, hasPassword existed only on client.
 *
 * Everything below is optional unless every one of the three consumers
 * already treated it as required, so adopting this type is a safe superset
 * for existing call sites rather than a breaking narrowing.
 *
 * Deliberately NOT included: `password`, `resetPasswordToken`,
 * `resetPasswordExpires`. Those are server-internal and never belong in a
 * type that admin/client/community import — including them here would make
 * it easy to accidentally serialize them into a response.
 */

export interface UserAddress {
  _id?: string;
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface RefundMethod {
  id?: string;
  type: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  isDefault?: boolean;
  addedAt?: string;
  updatedAt?: string;
}

export interface BusinessDetails {
  name?: string;
  gstNumber?: string;
  address?: string;
}

export interface PayoutInfo {
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
}

/**
 * Admin's local copy had every nested field optional; client's had them
 * required ("Aligned with backend IVenueListerProfile type" — which itself
 * disagreed with admin). Went with the looser shape: nothing in this repo
 * constructs a VenueListerProfile object literal without checking fields
 * first, so optional is the safe direction — a caller that already assumed
 * required fields still works via the optional chaining it already uses.
 */
export interface VenueListerProfile {
  businessDetails?: BusinessDetails;
  payoutInfo?: PayoutInfo;
  canAddMoreVenues?: boolean;
}

export interface PlayerProfile {
  sports?: string[];
}

export interface ParentProfile {
  bio?: string;
  sportInterests?: string[];
  involvementYears?: number;
}

export interface User {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;

  dob?: string;
  city?: string;
  photoUrl?: string;
  photoS3Key?: string;
  googleId?: string;
  isIdentityPublic?: boolean;
  hasPassword?: boolean;
  lastActiveAt?: string;

  bio?: string;
  sportInterests?: string[];
  involvementYears?: number;
  /** Client-side convenience wrapper over the three fields above — kept for
   *  the components already built against it rather than forcing a rewrite
   *  as part of this migration. */
  parentProfile?: ParentProfile;

  playerProfile?: PlayerProfile;
  venueListerProfile?: VenueListerProfile;
  /** Dependent isn't migrated into this package yet — out of scope for the
   *  User/Tournament/Booking pass. Keep it loose rather than assert a shape
   *  this package doesn't actually define. */
  dependents?: unknown[];

  addresses?: UserAddress[];
  defaultAddressId?: string;
  shippingAddress?: UserShippingAddress;
  refundMethods?: RefundMethod[];

  isActive?: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  deactivatedAt?: string;
  pendingDeletion?: boolean;
  deletionRequestedAt?: string;

  createdAt?: string;
  updatedAt?: string;
}
