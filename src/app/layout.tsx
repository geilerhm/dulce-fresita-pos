import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dulce Fresita",
  description: "Punto de venta e inventario — Dulce Fresita",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dulce Fresita",
  },
};

export const viewport: Viewport = {
  themeColor: "#e84c65",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} light`}>
      <body className="flex h-screen overflow-hidden font-sans bg-background select-none">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
