import { OrderDetailClient } from "@/components/shop/OrderDetailClient";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}

