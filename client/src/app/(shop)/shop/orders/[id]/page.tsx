import { OrderDetailClient } from "@/components/shop/OrderDetailClient";

export default function OrderPage({ params }: { params: { id: string } }) {
  return <OrderDetailClient orderId={params.id} />;
}
