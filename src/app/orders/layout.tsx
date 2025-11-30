import { requireAuth } from "@/lib/auth";

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return children;
}
