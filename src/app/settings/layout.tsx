import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Einstellungen – ZetLab",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
