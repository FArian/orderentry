import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Einstellungen – z2Lab",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
