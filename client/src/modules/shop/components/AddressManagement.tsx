"use client";

import {
  addUserAddress,
  deleteUserAddress,
  getUserAddresses,
  lookupPincode,
  setDefaultUserAddress,
  updateUserAddress,
  type UserAddress,
} from "@/lib/shop/ecommerce-api";
import { INDIAN_STATES } from "@/lib/shop/indianStates";
import { useAuthStore } from "../../auth/store/authStore";
import { cn } from "@/utils/cn";
import { Edit2, MapPin, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

export function AddressManagement() {
  const { user } = useAuthStore();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [defaultAddressId, setDefaultAddressId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("IN");
  const [pincodeLoading, setPincodeLoading] = useState(false);

  // Tier 1: when a full 6-digit pincode is entered, auto-fill city + state from
  // the free India Post lookup so they stay consistent without manual typing.
  const handlePostalChange = async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setPostalCode(digits);
    if (digits.length !== 6) return;

    setPincodeLoading(true);
    try {
      const location = await lookupPincode(digits);
      if (location) {
        if (location.city) setCity(location.city);
        if (location.state) setState(location.state);
      }
    } finally {
      setPincodeLoading(false);
    }
  };

  // Load addresses on mount
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const data = await getUserAddresses();
        setAddresses(data);
        const defaultAddr = data.find((a) => a.isDefault);
        if (defaultAddr?._id) {
          setDefaultAddressId(defaultAddr._id);
        }
      } catch (err) {
        console.error("Failed to load addresses:", err);
      }
    };
    loadAddresses();
  }, []);

  // Set form fields when user/address changes
  useEffect(() => {
    if (editingId) {
      const address = addresses.find((a) => a._id === editingId);
      if (address) {
        setFullName(address.fullName);
        setEmail(address.email);
        setPhone(address.phone);
        setAddressLine1(address.addressLine1);
        setAddressLine2(address.addressLine2 || "");
        setCity(address.city);
        setState(address.state);
        setPostalCode(address.postalCode);
        setCountry(address.country || "IN");
      }
    } else if (user && !isAddingNew) {
      // Reset form when not editing
      setFullName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setAddressLine1("");
      setAddressLine2("");
      setCity("");
      setState("");
      setPostalCode("");
      setCountry("IN");
    }
  }, [editingId, addresses, user, isAddingNew]);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setState("");
    setPostalCode("");
    setCountry("IN");
    setEditingId(null);
    setIsAddingNew(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const addressData = {
        fullName,
        email,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
      };

      let response;
      if (editingId) {
        response = await updateUserAddress(editingId, addressData);
      } else {
        response = await addUserAddress(addressData);
      }

      setAddresses(response.addresses);
      if (response.defaultAddressId) {
        setDefaultAddressId(response.defaultAddressId);
      }

      toast.success(editingId ? "Address updated" : "Address added");
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save address");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;

    setLoading(true);
    try {
      const response = await deleteUserAddress(addressId);
      setAddresses(response.addresses);
      if (response.defaultAddressId) {
        setDefaultAddressId(response.defaultAddressId);
      }
      toast.success("Address deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete address");
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    setLoading(true);
    try {
      const response = await setDefaultUserAddress(addressId);
      setAddresses(response.addresses);
      if (response.defaultAddressId) {
        setDefaultAddressId(response.defaultAddressId);
      }
      toast.success("Default address updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to set default address");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Manage Addresses</h2>
        <p className="text-sm text-slate-500">Add, update, or delete shipping addresses.</p>
      </div>

      {/* Saved Addresses List */}
      {addresses.length > 0 && !isAddingNew && !editingId && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900">Saved Addresses</h3>
          <div className="grid gap-4">
            {addresses.map((address) => (
              <div
                key={address._id}
                className={cn(
                  "cursor-pointer rounded-xl border-2 p-4 transition-all",
                  defaultAddressId === address._id
                    ? "border-[#ff5722] bg-orange-50/30"
                    : "border-slate-200 bg-slate-50/30 hover:border-slate-300"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900">{address.fullName}</h4>
                      {defaultAddressId === address._id && (
                        <span className="rounded-full bg-[#ff5722] px-2 py-1 text-xs font-bold text-white">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {address.addressLine1}
                      {address.addressLine2 && `, ${address.addressLine2}`}
                    </p>
                    <p className="text-sm text-slate-600">
                      {address.city}, {address.state} {address.postalCode}
                    </p>
                    <p className="text-sm text-slate-600">
                      {address.phone} • {address.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setEditingId(address._id || null)}
                      className="rounded-lg p-2 text-slate-600 transition-all hover:bg-slate-200"
                      disabled={loading}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(address._id || "")}
                      className="rounded-lg p-2 text-red-600 transition-all hover:bg-red-100"
                      disabled={loading || addresses.length === 1}
                      title={addresses.length === 1 ? "Cannot delete the last address" : ""}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {defaultAddressId !== address._id && (
                  <button
                    onClick={() => handleSetDefault(address._id || "")}
                    className="mt-3 text-sm font-bold text-[#ff5722] hover:underline"
                    disabled={loading}
                  >
                    Set as Default
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setIsAddingNew(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 font-bold text-slate-600 transition-all hover:bg-slate-50"
          >
            <Plus size={18} />
            Add New Address
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {(isAddingNew || editingId) && (
        <form
          onSubmit={handleSubmit}
          className="shadow-xs max-w-2xl space-y-6 rounded-3xl border border-slate-200/60 bg-slate-50/50 p-6 sm:p-8"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">
              {editingId ? "Edit Address" : "Add New Address"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Recipient Name
              </label>
              <input
                required
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Email Address
              </label>
              <input
                required
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Phone Number
              </label>
              <input
                required
                type="tel"
                placeholder="e.g. +91 99999 99999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Address Line 1
              </label>
              <input
                required
                type="text"
                placeholder="House/Flat No., Building, Street Name"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                placeholder="Apartment, suite, floor, etc."
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                City
              </label>
              <input
                required
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                State
              </label>
              <select
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              >
                <option value="">Select state</option>
                {/* Preserve a legacy/non-canonical value so editing still shows it */}
                {state && !INDIAN_STATES.includes(state) && <option value={state}>{state}</option>}
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Postal / ZIP Code
              </label>
              <input
                required
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit ZIP code"
                value={postalCode}
                onChange={(e) => handlePostalChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
              {pincodeLoading && (
                <p className="mt-1 text-xs text-slate-400">Looking up city & state…</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Country
              </label>
              <select
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              >
                {country && country !== "IN" && <option value={country}>{country}</option>}
                <option value="IN">India</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-[#ff5722] px-6 py-3 text-sm font-bold text-white shadow-md shadow-[#ff5722]/15 transition-all hover:bg-[#e64a19] active:scale-95 disabled:opacity-50"
            >
              {loading ? "Saving..." : editingId ? "Update Address" : "Add Address"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-900 transition-all hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* No addresses state */}
      {addresses.length === 0 && !isAddingNew && !editingId && (
        <div className="rounded-3xl border border-slate-200/60 bg-slate-50/50 py-12 text-center">
          <MapPin className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="mb-4 font-bold text-slate-600">No addresses saved yet</p>
          <button
            onClick={() => setIsAddingNew(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ff5722] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#e64a19]"
          >
            <Plus size={18} />
            Add Your First Address
          </button>
        </div>
      )}
    </div>
  );
}
