"use client";

import {
  addUserAddress,
  deleteUserAddress,
  getUserAddresses,
  setDefaultUserAddress,
  updateUserAddress,
  type UserAddress,
} from "@/lib/shop/ecommerce-api";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { cn } from "@/utils/cn";
import { Edit2, MapPin, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

export function AddressManagement() {
  const { user } = useAuthStore();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [defaultAddressId, setDefaultAddressId] = useState<
    string | undefined
  >();
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

      toast.success(
        editingId
          ? "Address updated successfully!"
          : "Address added successfully!",
      );
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
      toast.success("Address deleted successfully!");
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
      toast.success("Default address updated!");
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
        <p className="text-sm text-slate-500">
          Add, update, or delete shipping addresses.
        </p>
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
                  "p-4 rounded-xl border-2 transition-all cursor-pointer",
                  defaultAddressId === address._id
                    ? "border-[#ff5722] bg-orange-50/30"
                    : "border-slate-200 bg-slate-50/30 hover:border-slate-300",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900">
                        {address.fullName}
                      </h4>
                      {defaultAddressId === address._id && (
                        <span className="px-2 py-1 text-xs font-bold bg-[#ff5722] text-white rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-2">
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
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setEditingId(address._id || null)}
                      className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-all"
                      disabled={loading}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(address._id || "")}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-all"
                      disabled={loading || addresses.length === 1}
                      title={
                        addresses.length === 1
                          ? "Cannot delete the last address"
                          : ""
                      }
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all"
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
          className="space-y-6 max-w-2xl bg-slate-50/50 p-6 sm:p-8 rounded-3xl border border-slate-200/60 shadow-xs"
        >
          <div className="flex items-center justify-between mb-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Recipient Name
              </label>
              <input
                required
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Email Address
              </label>
              <input
                required
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Phone Number
              </label>
              <input
                required
                type="tel"
                placeholder="e.g. +91 99999 99999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Address Line 1
              </label>
              <input
                required
                type="text"
                placeholder="House/Flat No., Building, Street Name"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                placeholder="Apartment, suite, floor, etc."
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                City
              </label>
              <input
                required
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                State
              </label>
              <input
                required
                type="text"
                placeholder="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Postal / ZIP Code
              </label>
              <input
                required
                type="text"
                placeholder="6-digit ZIP code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Country
              </label>
              <input
                required
                type="text"
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl bg-[#ff5722] hover:bg-[#e64a19] text-sm font-bold text-white transition-all active:scale-95 shadow-md shadow-[#ff5722]/15 disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : editingId
                  ? "Update Address"
                  : "Add Address"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={loading}
              className="px-6 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* No addresses state */}
      {addresses.length === 0 && !isAddingNew && !editingId && (
        <div className="text-center py-12 bg-slate-50/50 rounded-3xl border border-slate-200/60">
          <MapPin className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600 font-bold mb-4">
            No addresses saved yet
          </p>
          <button
            onClick={() => setIsAddingNew(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ff5722] hover:bg-[#e64a19] text-sm font-bold text-white transition-all"
          >
            <Plus size={18} />
            Add Your First Address
          </button>
        </div>
      )}
    </div>
  );
}
