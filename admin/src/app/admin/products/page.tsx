"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  AdminProductRecord,
  adminEcommerceApi,
} from "@/modules/admin/services/ecommerce";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useState } from "react";

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminEcommerceApi.listProducts({
        page: 1,
        limit: 50,
      });

      const records = response.data?.products || [];
      setProducts(records);
    } catch (e) {
      console.error(e);
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const createSampleProduct = async () => {
    try {
      setCreating(true);
      await adminEcommerceApi.createProduct({
        sku: `DEMO-${Date.now()}`,
        name: "PowerMySport Match Tee",
        description: "Breathable t-shirt for high-intensity sessions.",
        category: "APPAREL",
        basePrice: 129900,
        salePrice: 99900,
        weight: 220,
        dimensions: { length: 30, width: 20, height: 3 },
        taxable: true,
        taxRate: 0.18,
        isActive: true,
        images: ["https://example.com/demo-tee.jpg"],
        variants: [
          {
            sku: `DEMO-${Date.now()}-M-BLK`,
            attributes: { size: "M", color: "Black" },
            price: 99900,
            stock: 35,
            reorderLevel: 8,
          },
        ],
      });

      await loadProducts();
    } catch (e) {
      console.error(e);
      setError("Failed to create product.");
    } finally {
      setCreating(false);
    }
  };

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
            <p className="text-2xl font-bold text-slate-900">
              {products.length}
            </p>
          </div>

          <button
            onClick={createSampleProduct}
            disabled={creating}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating..." : "Add Sample Product"}
          </button>
        </div>
      </Card>

      {loading ? (
        <div className="py-10 text-center">Loading products...</div>
      ) : null}

      {error ? (
        <Card className="bg-white">
          <div className="p-5 text-sm font-semibold text-red-600">{error}</div>
        </Card>
      ) : null}

      {!loading && !error ? (
        <Card className="overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product._id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.sku}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {product.category}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatInr(product.salePrice ?? product.basePrice)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {product.totalStock}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${product.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
