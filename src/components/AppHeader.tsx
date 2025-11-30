"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AppHeader({ version }: { version: string }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

  async function refreshAuth() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setAuthed(!!data?.authenticated);
    } catch {
      setAuthed(false);
    }
  }

  useEffect(() => {
    refreshAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <header className="w-full border-b bg-gray-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-2 grid grid-cols-3 items-center">
        <div className="justify-self-start text-xs text-gray-500">Version {version}</div>
        <div className="justify-self-center">
          <Image
            src="/logo.svg"
            alt="zetLab logo"
            width={32}
            height={32}
            className="h-8 w-auto select-none"
          />
        </div>
        <div className="justify-self-end text-sm min-h-[1rem]">
          {authed === null ? null : authed ? (
            <form action="/api/logout" method="post">
              <button className="text-blue-600 hover:underline" type="submit">Logout</button>
            </form>
          ) : (
            <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
          )}
        </div>
      </div>
    </header>
  );
}

