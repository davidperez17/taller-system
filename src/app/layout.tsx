import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Multiservicios San Miguel 96 — Seguimiento de tu vehículo",
    template: "%s | Multiservicios San Miguel 96",
  },
  description:
    "Consulta en vivo el avance de la reparación de tu auto, moto o camión en Multiservicios San Miguel 96. Solo necesitas tu placa.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SM96 Taller",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlow.variable} ${inter.variable}`}>
      <body className="bg-slate-50 text-slate-900 antialiased min-h-dvh">
        {children}
      </body>
    </html>
  );
}
