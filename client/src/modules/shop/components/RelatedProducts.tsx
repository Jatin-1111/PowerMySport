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
        <div className="h-0.5 flex-1 bg-gradient-to-r from-slate-200 to-transparent ml-6 hidden sm:block" />
      </div>

      {/* Horizontal scrolling container on mobile, grid on desktop */}
      <div className="mt-8 -mx-4 flex gap-4 overflow-x-auto px-4 pb-8 sm:mx-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-x-visible sm:px-0 sm:pb-0 snap-x snap-mandatory">
        {products.map((product) => (
          <div
            key={product.id}
            className="min-w-[280px] sm:min-w-0 snap-start shrink-0"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
