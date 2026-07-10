"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench, Search, Car, Bike, Truck, BellRing, ClipboardList, MapPin, Phone, Clock,
  ChevronRight, X, ShieldCheck, MessageCircle, Gauge, Disc3, Zap, Droplets, Cog,
  CheckCircle2, Camera, Smartphone,
} from "lucide-react";
import { getSavedVehicles, removeVehicle, registerSW, type SavedVehicle } from "./pwa";
import InstallButton from "@/components/InstallButton";
import { waLink } from "@/lib/whatsapp";
import brand from "@/lib/brand.json";

const WA_HREF = waLink(
  brand.whatsapp || brand.phone,
  "Hola, quiero información sobre un servicio para mi vehículo."
);
const TEL_HREF = brand.phone ? `tel:${brand.phone.replace(/[^\d+]/g, "")}` : null;

const SERVICES = [
  { icon: Wrench, title: "Mantenimiento preventivo", text: "Servicios menores y mayores por kilometraje." },
  { icon: Droplets, title: "Cambio de aceite y filtros", text: "Con registro en el historial de tu vehículo." },
  { icon: Disc3, title: "Frenos y suspensión", text: "Pastillas, discos, amortiguadores y alineación." },
  { icon: Cog, title: "Motor y transmisión", text: "Diagnóstico, reparación y afinamiento completo." },
  { icon: Zap, title: "Sistema eléctrico", text: "Arranque, alternador, luces y escaneo de fallas." },
  { icon: Gauge, title: "Diagnóstico general", text: "Revisión completa antes de cotizar cualquier trabajo." },
];

const WHY = [
  {
    icon: Search,
    title: "Sigue tu reparación en vivo",
    text: "Con tu placa ves en qué etapa va tu vehículo, desde que entra hasta que se entrega.",
  },
  {
    icon: CheckCircle2,
    title: "Tú apruebas el presupuesto",
    text: "Te cotizamos antes de trabajar y apruebas desde tu celular. Sin sorpresas al recoger.",
  },
  {
    icon: Camera,
    title: "Fotos de cada avance",
    text: "El mecánico documenta el trabajo con fotos que ves en tu línea de tiempo.",
  },
  {
    icon: BellRing,
    title: "Te avisamos al instante",
    text: "Notificaciones en tu celular con cada cambio de etapa: listo, aprobación, entrega.",
  },
];

export default function HomeClient() {
  const router = useRouter();
  const [plate, setPlate] = useState("");
  const [saved, setSaved] = useState<SavedVehicle[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaved(getSavedVehicles());
    registerSW();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) {
      inputRef.current?.focus();
      return;
    }
    router.push(`/seguimiento/${clean}`);
  }

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50">
      {/* Header sticky */}
      <header className="bg-primary-950 text-white sticky top-0 z-40 border-b border-primary-900">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="bg-primary-600 rounded-xl p-2 shrink-0" aria-hidden="true">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold leading-tight tracking-wide truncate">
              MULTISERVICIOS SAN MIGUEL 96
            </p>
            <p className="text-primary-300 text-[11px] leading-tight">
              Taller mecánico · Chimaltenango
            </p>
          </div>
          <nav className="hidden md:flex items-center gap-5 text-sm text-primary-200 mr-2" aria-label="Secciones">
            <a href="#servicios" className="hover:text-white transition-colors">Servicios</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Cómo funciona</a>
            <a href="#contacto" className="hover:text-white transition-colors">Contacto</a>
          </nav>
          {WA_HREF ? (
            <a
              href={WA_HREF}
              target="_blank"
              rel="noopener"
              className="shrink-0 inline-flex items-center gap-1.5 bg-accent-600 hover:bg-accent-500 active:bg-accent-700 text-white rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">WhatsApp</span>
              <span className="sm:hidden">Escríbenos</span>
            </a>
          ) : (
            <a
              href="#contacto"
              className="shrink-0 inline-flex items-center gap-1.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors"
            >
              <MapPin className="w-4 h-4" aria-hidden="true" /> Visítanos
            </a>
          )}
        </div>
      </header>

      {/* Hero — punto caliente: promesa del negocio + acceso directo al seguimiento */}
      <section className="bg-primary-950 text-white px-4 pt-12 pb-24 sm:pt-16">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-center *:min-w-0">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-300">
              Autos · Motos · Camiones
            </p>
            <h1 className="mt-3 font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-wide leading-[1.05]">
              MECÁNICA CON
              <br />
              <span className="text-primary-400">TRANSPARENCIA TOTAL</span>
            </h1>
            <p className="mt-4 text-primary-200 max-w-md mx-auto lg:mx-0 text-base sm:text-lg">
              Cotizamos antes de trabajar, tú apruebas desde tu celular y sigues cada avance de tu
              reparación en vivo.
            </p>
            <ul className="mt-5 flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-sm text-primary-200">
              {["Presupuesto sin sorpresas", "Fotos de cada avance", "Aviso al instante"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-accent-400 shrink-0" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Tarjeta de seguimiento: la acción más frecuente de quien ya es cliente */}
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-5 sm:p-6 animate-slide-up">
            <h2 className="font-heading font-semibold text-lg tracking-wide text-slate-800">
              ¿TU VEHÍCULO ESTÁ EN EL TALLER?
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Escribe tu placa y mira el avance en tiempo real.
            </p>
            <form onSubmit={submit} className="mt-4">
              <label htmlFor="plate" className="sr-only">
                Placa del vehículo
              </label>
              <div className="flex rounded-2xl overflow-hidden ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-primary-500">
                <input
                  ref={inputRef}
                  id="plate"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={12}
                  className="plate-badge flex-1 min-w-0 bg-slate-50 text-slate-900 text-center text-2xl py-3.5 px-4 placeholder:text-slate-300 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white transition-colors px-5 flex items-center gap-2 font-semibold cursor-pointer"
                >
                  <Search className="w-5 h-5" aria-hidden="true" />
                  <span className="hidden sm:inline">Consultar</span>
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Tal como aparece en tu vehículo; no importan guiones ni espacios.
              </p>
            </form>

            {saved.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Mis vehículos
                </p>
                <ul className="mt-1 divide-y divide-slate-50">
                  {saved.map((v) => (
                    <li key={v.plate} className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          router.push(`/seguimiento/${v.plate}${v.code ? `?code=${v.code}` : ""}`)
                        }
                        className="flex-1 flex items-center gap-3 py-2.5 text-left cursor-pointer group min-w-0"
                      >
                        <span className="plate-badge bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-0.5 text-sm text-slate-800">
                          {v.plate}
                        </span>
                        <span className="text-sm text-slate-500 truncate flex-1">{v.label}</span>
                        <ChevronRight
                          className="w-5 h-5 text-slate-300 group-hover:text-primary-600 transition-colors shrink-0"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        onClick={() => {
                          removeVehicle(v.plate);
                          setSaved(getSavedVehicles());
                        }}
                        aria-label={`Quitar ${v.plate} de mis vehículos`}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Franja de confianza */}
      <div className="px-4 -mt-10">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center *:min-w-0">
          {[
            { icon: Car, label: "Autos" },
            { icon: Bike, label: "Motos" },
            { icon: Truck, label: "Camiones" },
            { icon: Clock, label: brand.hours || "Lun–Sáb" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
              <s.icon className="w-5 h-5 text-primary-600 shrink-0" aria-hidden="true" />
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 px-4">
        {/* Servicios */}
        <section id="servicios" className="max-w-5xl mx-auto pt-14 scroll-mt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 text-center">
            Servicios
          </p>
          <h2 className="mt-2 font-heading text-3xl sm:text-4xl font-bold tracking-wide text-slate-900 text-center">
            TODO LO QUE TU VEHÍCULO NECESITA
          </h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 *:min-w-0">
            {SERVICES.map((s) => (
              <div
                key={s.title}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex gap-3.5"
              >
                <div className="bg-primary-50 text-primary-700 rounded-xl p-2.5 h-fit shrink-0" aria-hidden="true">
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{s.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500 text-center">
            ¿No ves lo que buscas?{" "}
            {WA_HREF ? (
              <a href={WA_HREF} target="_blank" rel="noopener" className="font-semibold text-primary-600 hover:text-primary-500">
                Escríbenos y te cotizamos
              </a>
            ) : (
              <a href="#contacto" className="font-semibold text-primary-600 hover:text-primary-500">
                Visítanos y te cotizamos
              </a>
            )}
            .
          </p>
        </section>

        {/* Por qué nosotros */}
        <section className="max-w-5xl mx-auto pt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 text-center">
            Nuestra diferencia
          </p>
          <h2 className="mt-2 font-heading text-3xl sm:text-4xl font-bold tracking-wide text-slate-900 text-center">
            TU VEHÍCULO, SIEMPRE A LA VISTA
          </h2>
          <p className="mt-3 text-slate-500 text-center max-w-xl mx-auto">
            La mayoría de talleres te dicen &ldquo;llame mañana&rdquo;. Aquí lo ves tú mismo, desde tu
            celular.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4 *:min-w-0">
            {WHY.map((w) => (
              <div key={w.title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex gap-3.5">
                <div className="bg-accent-50 text-accent-700 rounded-xl p-2.5 h-fit shrink-0" aria-hidden="true">
                  <w.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{w.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{w.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="max-w-5xl mx-auto pt-14 scroll-mt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 text-center">
            Cómo funciona
          </p>
          <h2 className="mt-2 font-heading text-3xl sm:text-4xl font-bold tracking-wide text-slate-900 text-center">
            ASÍ DE SIMPLE
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3 *:min-w-0">
            {[
              {
                icon: ClipboardList,
                title: "Deja tu vehículo",
                text: "Te entregamos una orden impresa con tu folio y un código de acceso.",
              },
              {
                icon: Smartphone,
                title: "Síguelo con tu placa",
                text: "Mira cada etapa, las anotaciones del mecánico y aprueba el presupuesto en línea.",
              },
              {
                icon: BellRing,
                title: "Recíbelo sin sorpresas",
                text: "Te avisamos cuando esté listo y te llevas tu informe de servicio en PDF.",
              },
            ].map((s, i) => (
              <li key={s.title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center">
                <div className="mx-auto w-11 h-11 rounded-full bg-primary-600 text-white flex items-center justify-center font-heading font-bold text-lg" aria-hidden="true">
                  {i + 1}
                </div>
                <s.icon className="w-6 h-6 text-primary-600 mx-auto mt-3" aria-hidden="true" />
                <h3 className="mt-2 font-semibold text-slate-800">{s.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Contacto / CTA final */}
        <section id="contacto" className="max-w-5xl mx-auto pt-14 pb-14 scroll-mt-20">
          <div className="bg-primary-950 text-white rounded-2xl px-5 py-10 sm:px-10 text-center">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-wide">
              ¿TU VEHÍCULO NECESITA SERVICIO?
            </h2>
            <p className="mt-3 text-primary-200 max-w-md mx-auto">
              Tráelo al taller o escríbenos: te cotizamos sin compromiso y lo sigues en vivo desde tu
              celular.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {WA_HREF && (
                <a
                  href={WA_HREF}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-500 active:bg-accent-700 text-white rounded-xl px-6 py-3 font-semibold transition-colors"
                >
                  <MessageCircle className="w-5 h-5" aria-hidden="true" /> Escríbenos por WhatsApp
                </a>
              )}
              {TEL_HREF && (
                <a
                  href={TEL_HREF}
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-primary-700 text-white rounded-xl px-6 py-3 font-semibold transition-colors"
                >
                  <Phone className="w-5 h-5" aria-hidden="true" /> Llámanos
                </a>
              )}
              {!WA_HREF && !TEL_HREF && (
                <p className="inline-flex items-center gap-2 text-primary-100 font-semibold">
                  <MapPin className="w-5 h-5" aria-hidden="true" /> Te esperamos en el taller
                </p>
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-primary-200">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> {brand.address || "Guatemala"}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" /> {brand.hours || "Lun–Sáb"}
              </span>
            </div>
          </div>

          <div className="mt-6 max-w-md mx-auto space-y-3">
            <InstallButton appName="SM96 Taller" label="Instalar la app en tu celular" />
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Tus datos solo son visibles con tu placa y código de acceso.
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-primary-950 text-primary-200 text-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3">
          <p className="font-heading font-semibold tracking-wide text-white">
            MULTISERVICIOS SAN MIGUEL 96
          </p>
          <nav className="flex gap-5 text-primary-300" aria-label="Secciones del pie">
            <a href="#servicios" className="hover:text-white transition-colors">Servicios</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Cómo funciona</a>
            <a href="#contacto" className="hover:text-white transition-colors">Contacto</a>
          </nav>
        </div>
        <div className="border-t border-primary-900 py-3 text-center text-xs text-primary-400">
          © {new Date().getFullYear()} Multiservicios San Miguel 96 · {brand.address}
        </div>
      </footer>
    </div>
  );
}
