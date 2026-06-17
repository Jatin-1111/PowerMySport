export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function getProductPrice(product: {
  basePrice: number;
  salePrice?: number;
}): number {
  return product.salePrice ?? product.basePrice;
}
