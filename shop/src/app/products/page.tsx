import ProductCard from "@/components/shop/ProductCard";
import { listProducts, type Product } from "@/lib/ecommerce-api";

export default async function ProductsPage() {
  const data = await listProducts({
    page: 1,
    limit: 24,
    sortBy: "newest",
  }).catch(() => ({ products: [] as Product[], total: 0, page: 1, pages: 1 }));
  const products = data.products;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
            PowerMySport Shop
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            Gear Up For Your Next Match
          </h1>
        </div>
      </header>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-600">
          No products yet. Seed products from admin to see catalog items here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
