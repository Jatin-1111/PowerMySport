"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  AdminProductRecord,
  ProductEditableFields,
  adminEcommerceApi,
} from "@/modules/admin/services/ecommerce";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { AdminDataTable, AdminDataTableColumn } from "@/modules/shared/ui/AdminDataTable";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { toast } from "@/lib/toast";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

const CATEGORIES = ["APPAREL", "FOOTWEAR", "ACCESSORIES", "EQUIPMENT"];

type SortBy = "name" | "basePrice" | "totalStock" | "createdAt";

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<SkeletonBlock rows={6} label="Loading products" />}>
      <AdminProductsPageContent />
    </Suspense>
  );
}

function AdminProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const pageParam = Number(searchParams.get("page"));
  const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;

  const setPage = (newPage: number) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set("page", String(newPage));
    router.replace(`${pathname}?${current.toString()}`, { scroll: false });
  };

  const [products, setProducts] = useState<AdminProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editingProduct, setEditingProduct] = useState<AdminProductRecord | null>(null);
  const [editForm, setEditForm] = useState<ProductEditableFields>({});
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminEcommerceApi.listProducts({
        page,
        limit: 20,
        search: search || undefined,
        isActive: statusFilter === "" ? undefined : statusFilter === "true",
        sortBy,
        sortOrder,
      });

      setProducts(response.data?.products || []);
      setTotalPages(response.data?.pages || 1);
      setTotal(response.data?.total || 0);
    } catch (e) {
      console.error(e);
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    const t = setTimeout(loadProducts, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadProducts, search]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const openEdit = (product: AdminProductRecord) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      shortDescription: product.shortDescription || "",
      description: product.description || "",
      category: product.category,
      basePrice: product.basePrice,
      salePrice: product.salePrice,
      isActive: product.isActive,
    });
  };

  const closeEdit = () => {
    setEditingProduct(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingProduct) return;
    setSaving(true);
    try {
      const response = await adminEcommerceApi.updateProduct(editingProduct.id, editForm);
      if (response.ok && response.data) {
        toast.success("Product updated.");
        closeEdit();
        await loadProducts();
      } else {
        toast.error(response.error?.message || "Failed to update product.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update product.");
    } finally {
      setSaving(false);
    }
  };

  const handleSortChange = (column: string) => {
    if (column === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column as SortBy);
      setSortOrder("asc");
    }
  };

  const columns: AdminDataTableColumn<AdminProductRecord>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (product) => <span className="font-medium text-slate-900">{product.name}</span>,
    },
    { key: "sku", header: "SKU", render: (product) => product.sku },
    {
      key: "category",
      header: "Category",
      render: (product) => product.category,
    },
    {
      key: "basePrice",
      header: "Price",
      sortable: true,
      render: (product) => formatInr(product.salePrice ?? product.basePrice),
    },
    {
      key: "totalStock",
      header: "Stock",
      sortable: true,
      render: (product) => product.totalStock,
    },
    {
      key: "isActive",
      header: "Status",
      render: (product) => (
        <StatusBadge
          status={product.isActive ? "Active" : "Inactive"}
          tone={product.isActive ? "green" : "slate"}
          size="sm"
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Commerce"
        title="Products"
        subtitle="The merchandise catalog: prices, stock and whether each item is on sale."
        action={
          <Link href="/admin/products/new" className={btn("accent")}>
            <Plus size={16} aria-hidden />
            Add product
          </Link>
        }
      />

      <div className="flex items-center gap-2">
        <label htmlFor="product-status" className="text-sm text-slate-600">
          Show
        </label>
        <select
          id="product-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className={`${fieldClass} !w-auto`}
        >
          <option value="">All products</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      {error ? (
        <ErrorNotice message={error} />
      ) : (
        <>
          <AdminDataTable
            columns={columns}
            rows={products}
            getRowKey={(product) => product.id}
            loading={loading}
            emptyMessage="No products match"
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by name or SKU",
            }}
            sort={{
              column: sortBy,
              direction: sortOrder,
              onChange: handleSortChange,
            }}
            pagination={{ page, totalPages, onPageChange: setPage, total }}
            onRowClick={openEdit}
            toolbarExtra={
              <ExportCsvButton
                filename="products.csv"
                rows={products}
                label="Export this page (CSV)"
                columns={[
                  { header: "Name", value: (p) => p.name },
                  { header: "SKU", value: (p) => p.sku },
                  { header: "Category", value: (p) => p.category },
                  {
                    header: "Base Price (INR)",
                    value: (p) => (p.basePrice / 100).toFixed(2),
                  },
                  {
                    header: "Sale Price (INR)",
                    value: (p) => (p.salePrice ? (p.salePrice / 100).toFixed(2) : ""),
                  },
                  { header: "Stock", value: (p) => p.totalStock },
                  {
                    header: "Status",
                    value: (p) => (p.isActive ? "Active" : "Inactive"),
                  },
                ]}
              />
            }
          />
        </>
      )}

      {editingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={closeEdit}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit product"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-16px_rgb(15_23_42/0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit product</h2>
                <p className="text-sm text-slate-500">SKU: {editingProduct.sku}</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  value={editForm.name ?? ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Short description</label>
                <input
                  value={editForm.shortDescription ?? ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      shortDescription: e.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  rows={3}
                  value={editForm.description ?? ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={editForm.category ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className={fieldClass}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={editForm.isActive ? "true" : "false"}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        isActive: e.target.value === "true",
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Base price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(editForm.basePrice ?? 0) / 100}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        basePrice: Math.round(Number(e.target.value) * 100),
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sale price (₹, optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.salePrice != null ? editForm.salePrice / 100 : ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        salePrice: e.target.value
                          ? Math.round(Number(e.target.value) * 100)
                          : undefined,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className={btn("outline")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className={btn("primary")}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
