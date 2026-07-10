import type { Metadata, Viewport } from "next";
import brand from "@/lib/brand.json";

// Metadata propia del área de administración: usa un manifest distinto
// (start_url /admin, scope /admin) para que se pueda instalar como una app
// aparte de la del cliente. En iOS "Agregar a inicio" desde /admin abre el
// panel directo, sin quedar atrapado en la PWA del cliente.
export const metadata: Metadata = {
  title: {
    default: `Panel del taller | ${brand.name}`,
    template: `%s | ${brand.adminAppName}`,
  },
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: brand.adminAppName,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brand.adminThemeColor,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
