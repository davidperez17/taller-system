import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Barlow, Inter } from "next/font/google";
import brand from "@/lib/brand.json";
import "./globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
});

// Cuerpo de las páginas públicas (se aplica solo bajo `.pub`); el panel admin
// sigue usando Inter. Barlow + Barlow Condensed = pareja "acción/atlética".
const barlowText = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow-text",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — Seguimiento de tu vehículo`,
    template: `%s | ${brand.name}`,
  },
  description: `Consulta en vivo el avance de la reparación de tu auto, moto o camión en ${brand.name}. Solo necesitas tu placa.`,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: brand.clientAppName,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brand.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowText.variable} ${inter.variable}`}>
      <head>
        {/* Captura `beforeinstallprompt` apenas se parsea el <head>. El evento se
            dispara muy temprano (Android/Chrome) y suele llegar antes de que React
            hidrate y adjunte su listener; si no lo guardamos aquí, el botón de
            instalar no tendría el prompt nativo y caería en las instrucciones
            manuales. Lo dejamos en window.__deferredBIP y avisamos con un evento. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    window.__deferredBIP = e;
    window.dispatchEvent(new Event('bip-available'));
  });
  window.addEventListener('appinstalled', function(){
    window.__deferredBIP = null;
    window.dispatchEvent(new Event('bip-installed'));
  });
})();`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="bg-slate-50 text-slate-900 antialiased min-h-dvh"
      >
        {children}
      </body>
    </html>
  );
}
