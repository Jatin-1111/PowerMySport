import { User, UserDocument } from "../../../client/models/User";
import { normalizeAddressInput } from "../../utils/address";

/**
 * Add a new address for the user
 */
export const addAddress = async (
  userId: string,
  addressData: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  }
): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.addresses) {
    user.addresses = [];
  }

  // Canonicalize on write (Tier 0) so the stored value is consistent even if
  // the request bypassed the UI dropdown.
  const data = normalizeAddressInput(addressData);

  const newAddress: any = {
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    addressLine1: data.addressLine1,
    ...(data.addressLine2 !== undefined ? { addressLine2: data.addressLine2 } : {}),
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    country: data.country || "IN",
    isDefault: user.addresses.length === 0, // First address is default
  };

  user.addresses.push(newAddress);

  // Set default address ID if this is the first address
  if (user.addresses && user.addresses.length === 1 && user.addresses[0]!._id) {
    user.defaultAddressId = user.addresses[0]!._id as any;
  }

  await user.save();
  return user;
};

/**
 * Update an existing address
 */
export const updateAddress = async (
  userId: string,
  addressId: string,
  addressData: {
    fullName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }
): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user || !user.addresses) {
    throw new Error("User or address not found");
  }

  const address = user.addresses.find((addr) => addr._id?.toString() === addressId);
  if (!address) {
    throw new Error("Address not found");
  }

  // Canonicalize provided fields on write (Tier 0).
  const data = normalizeAddressInput(addressData);

  // Update address fields
  if (data.fullName) address.fullName = data.fullName;
  if (data.email) address.email = data.email;
  if (data.phone) address.phone = data.phone;
  if (data.addressLine1) address.addressLine1 = data.addressLine1;
  if (data.addressLine2 !== undefined) address.addressLine2 = data.addressLine2;
  if (data.city) address.city = data.city;
  if (data.state) address.state = data.state;
  if (data.postalCode) address.postalCode = data.postalCode;
  if (data.country) address.country = data.country;

  address.updatedAt = new Date();

  await user.save();
  return user;
};

/**
 * Delete an address
 */
export const deleteAddress = async (userId: string, addressId: string): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user || !user.addresses) {
    throw new Error("User or address not found");
  }

  const addressIndex = user.addresses.findIndex((addr) => addr._id?.toString() === addressId);
  if (addressIndex === -1) {
    throw new Error("Address not found");
  }

  user.addresses.splice(addressIndex, 1);

  // If deleted address was default, set new default
  if (
    user.defaultAddressId?.toString() === addressId &&
    user.addresses &&
    user.addresses.length > 0
  ) {
    user.defaultAddressId = user.addresses[0]!._id as any;
    user.addresses[0]!.isDefault = true;
  } else if (user.addresses && user.addresses.length === 0) {
    user.defaultAddressId = undefined as any;
  }

  // Clear isDefault flag if no default is set
  user.addresses.forEach((addr) => {
    if (!user.defaultAddressId) {
      addr.isDefault = false;
    }
  });

  await user.save();
  return user;
};

/**
 * Set default address for user
 */
export const setDefaultAddress = async (
  userId: string,
  addressId: string
): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user || !user.addresses) {
    throw new Error("User or address not found");
  }

  const address = user.addresses.find((addr) => addr._id?.toString() === addressId);
  if (!address) {
    throw new Error("Address not found");
  }

  // Clear previous default
  user.addresses.forEach((addr) => {
    addr.isDefault = false;
  });

  // Set new default
  address.isDefault = true;
  user.defaultAddressId = address._id as any;

  await user.save();
  return user;
};

/**
 * Get all addresses for a user
 */
export const getUserAddresses = async (userId: string): Promise<UserDocument["addresses"]> => {
  const user = await User.findById(userId).select("addresses defaultAddressId");
  if (!user) {
    throw new Error("User not found");
  }

  return user.addresses || [];
};
