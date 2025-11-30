import { requireGuest } from "@/lib/auth";

export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  await requireGuest();
  return children;
}

