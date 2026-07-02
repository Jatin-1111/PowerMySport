"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  AdminProductRecord,
  ProductEditableFields,
  adminEcommerceApi,
} from "@/modules/admin/services/ecommerce";
import { Card } from "@/modules/shared/ui/Card";
import {
  AdminDataTable,
  AdminDataTableColumn,
} from "@/modules/shared/ui/AdminDataTable";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { toast } from "@/lib/toast";
import { X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

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
    <Suspense fallback={<div className="text-center py-12">Loading products...</div>}>
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
  const [editingProduct, setEditingProduct] = useState<AdminProductRecord | null>(
    null,
  );
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
      const response = await adminEcommerceApi.updateProduct(
        editingProduct.id,
        editForm,
      );
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
      render: (product) => (
        <span className="font-medium text-slate-900">{product.name}</span>
      ),
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
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${product.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
        >
          {product.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Ecommerce"
        title="Products"
        subtitle="Manage merchandise catalog, pricing, and stock health."
      />

      <Card className="bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm text-slate-500">Catalog records</p>
            <p className="text-2xl font-bold text-slate-900">{total}</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <Link
              href="/admin/products/new"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Add New Product
            </Link>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="bg-white">
          <div className="p-5 text-sm font-semibold text-red-600">{error}</div>
        </Card>
      ) : (
        <Card className="bg-white">
          <AdminDataTable
            columns={columns}
            rows={products}
            getRowKey={(product) => product.id}
            loading={loading}
            emptyMessage="No products found."
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by name or SKU...",
            }}
            sort={{ column: sortBy, direction: sortOrder, onChange: handleSortChange }}
            pagination={{ page, totalPages, onPageChange: setPage, total }}
            onRowClick={openEdit}
            toolbarExtra={
              <ExportCsvButton
                filename="products.csv"
                rows={products}
                label="Export Page CSV"
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
        </Card>
      )}

      {editingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={closeEdit}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit product</h2>
                <p className="text-sm text-slate-500">SKU: {editingProduct.sku}</p>
              </div>
              <button
                onClick={closeEdit}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </label>
                <input
                  value={editForm.name ?? ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Short description
                </label>
                <input
                  value={editForm.shortDescription ?? ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      shortDescription: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editForm.description ?? ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Category
                  </label>
                  <select
                    value={editForm.category ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </label>
                  <select
                    value={editForm.isActive ? "true" : "false"}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        isActive: e.target.value === "true",
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Base price (paise)
                  </label>
                  <input
                    type="number"
                    value={editForm.basePrice ?? 0}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        basePrice: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sale price (paise, optional)
                  </label>
                  <input
                    type="number"
                    value={editForm.salePrice ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        salePrice: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeEdit}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
