import { requireAuth } from "@/lib/auth";

export default async function OrderLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return children;
}
