import { getRelatedProducts } from "@/lib/shop/ecommerce-api";
import { ProductCard } from "./ProductCard";

export async function RelatedProducts({ productId }: { productId: string }) {
  const products = await getRelatedProducts(productId, 4).catch(() => []);

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 sm:mt-24">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 sm:text-3xl">
          You Might Also Like
        </h2>
        <div className="ml-6 hidden h-0.5 flex-1 bg-gradient-to-r from-slate-200 to-transparent sm:block" />
      </div>

      {/* Horizontal scrolling container on mobile, grid on desktop */}
      <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-8 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-x-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {products.map((product) => (
          <div key={product.id} className="min-w-[280px] shrink-0 snap-start sm:min-w-0">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
