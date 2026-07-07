import type { Metadata, Viewport } from "next";

// Metadata propia del área de administración: usa un manifest distinto
// (start_url /admin, scope /admin) para que se pueda instalar como una app
// aparte de la del cliente. En iOS "Agregar a inicio" desde /admin abre el
// panel directo, sin quedar atrapado en la PWA del cliente.
export const metadata: Metadata = {
  title: {
    default: "Panel del taller | San Miguel 96",
    template: "%s | SM96 Admin",
  },
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SM96 Admin",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#172554",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
