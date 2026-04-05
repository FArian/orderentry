import type { Metadata, Viewport } from "next";
import "./globals.css";
import pkg from "../../package.json";
import AppHeader from "@/components/AppHeader";
import Providers from "@/components/Providers";

// No force-dynamic here — every API route sets it individually where needed.
// The layout itself is static: NEXT_PUBLIC_APP_VERSION is baked at build time.

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || pkg.version || "0.0.0";
const SIMPLE_VERSION = (() => {
  const m = String(APP_VERSION).match(/(\d+\.\d+\.\d+)/);
  return m ? `v${m[1]}` : String(APP_VERSION);
})();

export const metadata: Metadata = {
  title: "z2Lab OrderEntry",
  description: "Auftragserfassung – ZLZ Zentrallabor AG",
};

// Force light mode across system-influenced UI
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        <Providers>
          <AppHeader version={SIMPLE_VERSION} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
