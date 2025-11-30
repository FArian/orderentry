import { requireGuest } from "@/lib/auth";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  await requireGuest();
  return children;
}

