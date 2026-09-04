"use client";

import { type Product } from "@/lib/shop/ecommerce-api";
import { formatInr } from "@/lib/shop/format";
import { cn } from "@/utils/cn";
import { Check, Edit2, ShoppingBag, Trash2 } from "lucide-react";

interface SellerListingsTableProps {
  products: Product[];
  editingId: string | null;
  editPrice: string;
  setEditPrice: (v: string) => void;
  editStock: string;
  setEditStock: (v: string) => void;
  onStartEdit: (p: Product) => void;
  onCancelEdit: () => void;
  onSaveEdit: (productId: string) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  onDelete: (productId: string) => void;
  onCreateListing: () => void;
}

export function SellerListingsTable({
  products,
  editingId,
  editPrice,
  setEditPrice,
  editStock,
  setEditStock,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  deleteConfirmId,
  setDeleteConfirmId,
  onDelete,
  onCreateListing,
}: SellerListingsTableProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-base font-bold text-slate-900">No active listings</h3>
        <p className="mt-1 text-sm text-slate-500">
          Put your unused sports items for sale right now.
        </p>
        <button
          onClick={onCreateListing}
          className="mt-4 text-sm font-bold text-[#ff5722] hover:underline"
        >
          Create Listing &rarr;
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-500">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-6 py-4">Item</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Condition</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
            {products.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-400">
                          No Img
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-400">SKU: {p.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600">{p.category}</td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-bold",
                        p.condition === "USED"
                          ? "bg-slate-900 text-white"
                          : "bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {p.condition}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 font-bold text-slate-900">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-28 rounded-lg border border-slate-300 p-1 text-sm text-slate-900"
                      />
                    ) : (
                      formatInr(p.basePrice)
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editStock}
                        onChange={(e) => setEditStock(e.target.value)}
                        className="w-16 rounded-lg border border-slate-300 p-1 text-sm text-slate-900"
                      />
                    ) : (
                      p.totalStock
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => onSaveEdit(p.id)}
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                            title="Save"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={onCancelEdit}
                            className="rounded p-1 text-slate-500 hover:bg-slate-50"
                            title="Cancel"
                          >
                            &times;
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onStartEdit(p)}
                            className="rounded p-1 text-[#ff5722] hover:bg-[#ff5722]/5"
                            title="Edit Price/Stock"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {deleteConfirmId === p.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onDelete(p.id)}
                                className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-600 hover:bg-red-50"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(p.id)}
                              className="rounded p-1 text-red-600 hover:bg-red-50"
                              title="Deactivate Listing"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
