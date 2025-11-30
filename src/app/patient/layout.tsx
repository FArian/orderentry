import { requireAuth } from "@/lib/auth";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return children;
}
