"use client";

import React, { useState } from "react";

interface SellerListingFormProps {
  loading: boolean;
  /** Resolves to whether the listing was created — the form only clears on success. */
  onSubmit: (fields: {
    name: string;
    description: string;
    category: string;
    brand: string;
    basePrice: string;
    condition: "NEW" | "USED";
    stock: string;
    imageUrl: string;
  }) => Promise<boolean>;
  onCancel: () => void;
}

export function SellerListingForm({ loading, onSubmit, onCancel }: SellerListingFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("EQUIPMENT");
  const [brand, setBrand] = useState("GENERIC");
  const [basePrice, setBasePrice] = useState("");
  const [condition, setCondition] = useState<"NEW" | "USED">("USED");
  const [stock, setStock] = useState("1");
  const [imageUrl, setImageUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const succeeded = await onSubmit({
      name,
      description,
      category,
      brand,
      basePrice,
      condition,
      stock,
      imageUrl,
    });
    if (!succeeded) return;
    setName("");
    setDescription("");
    setBasePrice("");
    setStock("1");
    setImageUrl("");
    setCondition("USED");
    setBrand("GENERIC");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-6 rounded-3xl border border-slate-200/60 bg-slate-50/50 p-6 sm:p-8"
    >
      <h3 className="text-lg font-black text-slate-900">Gear Listing Form</h3>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Product Name
          </label>
          <input
            required
            type="text"
            placeholder="e.g. Kookaburra English Willow Bat"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Description
          </label>
          <textarea
            required
            rows={3}
            placeholder="Describe details like use time, scratches, dimensions, size..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
          >
            <option value="EQUIPMENT">Equipment</option>
            <option value="APPAREL">Apparel</option>
            <option value="FOOTWEAR">Footwear</option>
            <option value="ACCESSORIES">Accessories</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Brand
          </label>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
          >
            <option value="GENERIC">Generic</option>
            <option value="NIKE">Nike</option>
            <option value="ADIDAS">Adidas</option>
            <option value="PUMA">Puma</option>
            <option value="SG">SG</option>
            <option value="SS">SS</option>
            <option value="MRF">MRF</option>
            <option value="CEAT">CEAT</option>
            <option value="KOOKABURRA">Kookaburra</option>
            <option value="UNDER_ARMOUR">Under Armour</option>
            <option value="ASICS">Asics</option>
            <option value="WILSON">Wilson</option>
            <option value="YONEX">Yonex</option>
            <option value="BABOLAT">Babolat</option>
            <option value="HEAD">Head</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Condition
          </label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as "NEW" | "USED")}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
          >
            <option value="USED">Pre-owned / Used</option>
            <option value="NEW">Brand New / Unused</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Price (INR)
          </label>
          <input
            required
            type="number"
            min="1"
            placeholder="₹ Amount"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Stock quantity
          </label>
          <input
            required
            type="number"
            min="1"
            placeholder="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Gear Image URL
          </label>
          <input
            type="url"
            placeholder="https://example.com/gear.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-[#ff5722] py-3 text-sm font-bold text-white shadow-md shadow-[#ff5722]/15 transition hover:bg-[#e64a19] disabled:opacity-50"
        >
          List Item
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
