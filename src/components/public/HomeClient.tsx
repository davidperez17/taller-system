"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, ChevronRight, X, Bell, MessageCircle, Phone, MapPin, Clock,
  ClipboardList, Smartphone, BellRing, CheckCircle2, Camera, ShieldCheck,
  Wrench, Zap, Snowflake, Bike, Truck, Award, Building2,
} from "lucide-react";
import { motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import { getSavedVehicles, removeVehicle, registerSW, type SavedVehicle } from "./pwa";
import InstallButton from "@/components/InstallButton";
import { waLink } from "@/lib/whatsapp";
import brand from "@/lib/brand.json";

/* Paleta acotada a las páginas públicas (no toca brand.json / admin):
   grafito con cuerpo #1c1c20, gris neutro #f4f4f5, blanco, borde #e5e5e7,
   texto #1c1c20 / muted #63636a, verde ok #137a41 y — con moderación —
   rojo racing #c8102e SOLO como color de acción (CTA, foco, estado vivo). */

const WA_PHONE = brand.whatsapp || brand.phone || "50251414958";
const WA_AGENDA =
  waLink(WA_PHONE, "Hola, quiero agendar una cita en Multiservicios San Miguel.") ?? "#contacto";
const WA_MAZDA = waLink(WA_PHONE, "Hola, quiero consultar por el servicio de mi Mazda.") ?? WA_AGENDA;
const WA_FLOTA =
  waLink(WA_PHONE, "Hola, quiero información del plan de mantenimiento para flotas.") ?? WA_AGENDA;
const TEL_HREF = `tel:${WA_PHONE.replace(/[^\d+]/g, "")}`;

const STEPS = [
  {
    icon: ClipboardList,
    title: "Déjanos tu vehículo",
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
    text: "Guarda tu vehículo y te avisamos al instante en cada avance hasta la entrega.",
  },
];

// `hover` = movimiento característico del icono al pasar el cursor (spring).
const SERVICES: { icon: typeof Wrench; title: string; text: string; hover: TargetAndTransition }[] = [
  { icon: Wrench, title: "Mecánica general", text: "Frenos, suspensión, motor, transmisión y mantenimiento preventivo.", hover: { rotate: -20, scale: 1.15 } },
  { icon: Zap, title: "Electromecánica", text: "Diagnóstico computarizado, sistema eléctrico, alternadores y sensores.", hover: { scale: 1.25, rotate: 8 } },
  { icon: Snowflake, title: "Aire acondicionado", text: "Carga de gas, compresores y mantenimiento del sistema de clima.", hover: { scale: 1.2, rotate: 12 } },
  { icon: Bike, title: "Motocicletas", text: "Servicio completo: motor, frenos, eléctrico y mantenimiento periódico.", hover: { x: 5, scale: 1.1 } },
  { icon: Truck, title: "Camiones", text: "Mantenimiento y reparación de vehículos de carga y trabajo pesado.", hover: { x: 6, scale: 1.08 } },
];

const DIFERENCIA = [
  { icon: Search, title: "Sigue tu reparación en vivo", text: "Con tu placa ves en qué etapa va tu vehículo, desde que entra hasta que se entrega." },
  { icon: CheckCircle2, title: "Tú apruebas el presupuesto", text: "Te cotizamos antes de trabajar y apruebas desde tu celular. Sin sorpresas al recoger." },
  { icon: Camera, title: "Fotos de cada avance", text: "El mecánico documenta el trabajo con fotos que ves en tu línea de tiempo." },
  { icon: Bell, title: "Avisos al instante", text: "Guarda tu vehículo y recibe una notificación en cada cambio de etapa." },
];

const SPECIALTIES = ["Mecánica", "Electricidad", "Aire acondicionado", "Diagnóstico Mazda", "Control de calidad"];

const ROLES = [
  "Jefe de taller",
  "Mecánico Mazda",
  "Electromecánico",
  "Técnico A/C",
  "Mecánico de motos",
  "Técnico de camiones",
  "Mecánico general",
  "Control de calidad",
];

export default function HomeClient() {
  const router = useRouter();
  const [plate, setPlate] = useState("");
  const [saved, setSaved] = useState<SavedVehicle[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

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
    <div className="pub min-h-dvh flex flex-col bg-sm-bg text-sm-graphite">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-50 bg-sm-graphite/95 backdrop-blur border-b border-white/10">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
          <a href="#inicio" className="flex items-center min-w-0" aria-label="Multiservicios San Miguel 96 — inicio">
            <img
              src="/logo/logo-mts96.png"
              alt="Multiservicios San Miguel 96"
              width={1458}
              height={381}
              className="h-9 sm:h-10 w-auto shrink-0 select-none mix-blend-screen"
              draggable={false}
            />
          </a>
          <a
            href={WA_AGENDA}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-white/25 hover:border-white/50 hover:bg-white/5 text-white px-3.5 py-2 text-sm font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Escríbenos</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>
        </div>
      </header>

      {/* ============ HERO = HERRAMIENTA DE CONSULTA ============ */}
      <section id="inicio" className="relative bg-sm-graphite text-white overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/img-2.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-55"
          style={{ filter: "grayscale(0.65) contrast(1.06) brightness(1.05)" }}
        />
        {/* Velo: oscuro arriba (legibilidad del titular) y más ligero al centro
            para que la foto se vea. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(24,24,27,0.86) 0%, rgba(24,24,27,0.5) 44%, rgba(24,24,27,0.7) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl px-4 pt-12 pb-14 sm:pt-16 text-center">
          <h1 className="font-heading font-bold uppercase leading-[1.04] text-[34px] sm:text-[44px] tracking-wide text-balance">
            Mira cómo va tu vehículo
          </h1>
          <p className="mt-3 text-[15px] sm:text-base text-white/70 max-w-md mx-auto">
            Ingresa tu placa y sigue tu reparación en vivo, paso a paso. Guárdalo para recibir avisos.
          </p>

          {/* Panel de consulta — el ancla de la página */}
          <div className="mt-7 bg-white text-sm-graphite rounded-2xl shadow-xl p-5 sm:p-6 text-left animate-slide-up">
            <form onSubmit={submit}>
              <label htmlFor="plate" className="block text-sm font-semibold text-sm-graphite">
                Consulta por tu placa
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  ref={inputRef}
                  id="plate"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="P 845 KL"
                  autoComplete="off"
                  autoCapitalize="characters"
                  inputMode="text"
                  maxLength={12}
                  className="plate-badge flex-1 min-w-0 h-12 rounded-xl border-2 border-sm-border focus:border-sm-red bg-sm-surface-2 focus:bg-white px-4 text-xl text-sm-graphite placeholder:text-sm-faint focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  className="shrink-0 inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active text-white font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sm-red focus-visible:ring-offset-2"
                >
                  <Search className="w-5 h-5" aria-hidden="true" />
                  <span className="hidden sm:inline">Consultar</span>
                </button>
              </div>
              <p className="mt-2 text-xs text-sm-muted">
                Tal como aparece en tu vehículo; no importan guiones ni espacios.
              </p>
            </form>

            {saved.length > 0 && (
              <div className="mt-4 border-t border-sm-border pt-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sm-muted">
                  <Bell className="w-3.5 h-3.5" aria-hidden="true" /> Mis vehículos
                </p>
                <ul className="mt-1.5 space-y-1">
                  {saved.map((v) => (
                    <li key={v.plate} className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          router.push(`/seguimiento/${v.plate}${v.code ? `?code=${v.code}` : ""}`)
                        }
                        className="flex-1 flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left cursor-pointer group hover:bg-sm-bg transition-colors min-w-0"
                      >
                        <span className="plate-badge shrink-0 bg-sm-bg border border-sm-border rounded-lg px-2.5 py-0.5 text-sm text-sm-graphite">
                          {v.plate}
                        </span>
                        <span className="flex-1 text-sm text-sm-muted truncate">{v.label}</span>
                        <ChevronRight className="w-5 h-5 text-sm-faint group-hover:text-sm-red transition-colors shrink-0" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => {
                          removeVehicle(v.plate);
                          setSaved(getSavedVehicles());
                        }}
                        aria-label={`Quitar ${v.plate} de mis vehículos`}
                        className="p-2 rounded-lg text-sm-faint hover:text-sm-red hover:bg-sm-bg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confianza — franja discreta */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-white/65">
            {["Autos", "Motos", "Camiones"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-sm-red" aria-hidden="true" /> {t}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {brand.hours || "Lun–Sáb"}
            </span>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* ============ CÓMO FUNCIONA (secuencia real) ============ */}
        <section id="como-funciona" className="mx-auto max-w-5xl px-4 pt-14 sm:pt-16 scroll-mt-20">
          <h2 className="font-heading font-bold uppercase text-[28px] sm:text-[34px] tracking-wide text-center">
            Así de simple
          </h2>
          <p className="mt-2 text-center text-sm-muted max-w-md mx-auto">
            La mayoría de talleres te dicen “llame mañana”. Aquí lo ves tú mismo, desde tu celular.
          </p>
          <ol className="mt-9 grid gap-8 sm:gap-5 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex sm:flex-col gap-4 sm:gap-0 sm:text-center">
                {/* conector */}
                {i < STEPS.length - 1 && (
                  <span className="hidden sm:block absolute top-5 left-1/2 w-full h-px bg-sm-border" aria-hidden="true" />
                )}
                <div className="relative z-10 shrink-0 sm:mx-auto grid place-items-center w-10 h-10 rounded-full bg-sm-graphite text-white font-heading font-bold">
                  {i + 1}
                </div>
                <div className="sm:mt-4">
                  <div className="flex items-center gap-2 sm:justify-center">
                    <s.icon className="w-[18px] h-[18px] text-sm-muted" aria-hidden="true" />
                    <h3 className="font-semibold text-sm-graphite">{s.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-sm-muted sm:max-w-[26ch] sm:mx-auto">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ============ SERVICIOS (foto + lista, sin tarjetas repetidas) ============ */}
        <section id="servicios" className="mx-auto max-w-5xl px-4 pt-16 sm:pt-20 scroll-mt-20">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 lg:gap-12 items-center *:min-w-0">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/5] sm:aspect-[3/2] lg:aspect-[3/4] bg-sm-graphite">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/img-1.jpg"
                alt="Repuestos y refacciones en el taller Multiservicios San Miguel"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 to-transparent">
                <p className="text-white font-heading font-semibold uppercase tracking-wide">
                  Repuestos originales y alternos
                </p>
              </div>
            </div>
            <div>
              <h2 className="font-heading font-bold uppercase text-[28px] sm:text-[34px] tracking-wide">
                Todo lo que tu vehículo necesita
              </h2>
              <p className="mt-2 text-sm-muted">
                Carros, motos y camiones. Diagnóstico computarizado y repuestos garantizados.
              </p>
              <ul className="mt-6 divide-y divide-sm-border">
                {SERVICES.map((s) => (
                  <motion.li
                    key={s.title}
                    className="group flex gap-3.5 py-3.5"
                    whileHover={reduce ? undefined : "hover"}
                  >
                    <motion.span
                      className="mt-0.5 shrink-0 text-sm-graphite group-hover:text-sm-red transition-colors"
                      variants={reduce ? undefined : { hover: s.hover }}
                      transition={{ type: "spring", stiffness: 300, damping: 14 }}
                    >
                      <s.icon className="w-5 h-5" aria-hidden="true" />
                    </motion.span>
                    <div>
                      <h3 className="font-semibold text-sm-graphite leading-tight">{s.title}</h3>
                      <p className="mt-0.5 text-sm text-sm-muted">{s.text}</p>
                    </div>
                  </motion.li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-sm-muted">
                ¿No ves lo que buscas?{" "}
                <a href={WA_AGENDA} target="_blank" rel="noopener" className="font-semibold text-sm-red hover:text-sm-red-hover">
                  Escríbenos y te cotizamos
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* ============ ESPECIALIDAD MAZDA + FLOTAS ============ */}
        <section id="flotas" className="mx-auto max-w-5xl px-4 pt-16 sm:pt-20 scroll-mt-20">
          <div className="grid md:grid-cols-2 gap-4 *:min-w-0">
            {/* Mazda — grafito */}
            <div className="bg-sm-graphite text-white rounded-2xl p-7 sm:p-8 flex flex-col justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  <Award className="w-3.5 h-3.5" aria-hidden="true" /> Especialidad Mazda
                </span>
                <h3 className="mt-4 font-heading font-bold uppercase text-2xl sm:text-[28px] leading-[1.08]">
                  Conocemos tu Mazda mejor que nadie
                </h3>
                <p className="mt-3 text-[15px] text-white/70 leading-relaxed">
                  Años de experiencia dedicada a la marca: diagnóstico específico, repuestos correctos
                  a la primera y mantenimiento según especificaciones de fábrica.
                </p>
              </div>
              <a
                href={WA_MAZDA}
                target="_blank"
                rel="noopener"
                className="self-start rounded-xl border border-white/25 hover:border-white/60 hover:bg-white/5 text-white px-5 py-3 font-semibold text-sm transition-colors"
              >
                Consultar por mi Mazda
              </a>
            </div>
            {/* Flotas — blanco */}
            <div className="bg-white border border-sm-border rounded-2xl p-7 sm:p-8 flex flex-col justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sm-bg border border-sm-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sm-muted">
                  <Building2 className="w-3.5 h-3.5" aria-hidden="true" /> Flotas empresariales
                </span>
                <h3 className="mt-4 font-heading font-bold uppercase text-2xl sm:text-[28px] leading-[1.08] text-sm-graphite">
                  Crédito y mantenimiento para tu flota
                </h3>
                <p className="mt-3 text-[15px] text-sm-muted leading-relaxed">
                  Planes de mantenimiento preventivo, prioridad de atención y crédito empresarial para
                  que tus vehículos nunca dejen de trabajar.
                </p>
              </div>
              <a
                href={WA_FLOTA}
                target="_blank"
                rel="noopener"
                className="self-start rounded-xl bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active text-white px-5 py-3 font-semibold text-sm transition-colors"
              >
                Solicitar plan para flotas
              </a>
            </div>
          </div>
        </section>

        {/* ============ EQUIPO ============ */}
        <section id="equipo" className="mt-16 sm:mt-20 bg-white border-y border-sm-border scroll-mt-20">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:py-16 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-12 items-center *:min-w-0">
            <div>
              <h2 className="font-heading font-bold uppercase text-[28px] sm:text-[34px] tracking-wide leading-[1.05]">
                8 técnicos, un solo estándar de calidad
              </h2>
              <p className="mt-3 text-sm-muted max-w-md">
                Cada reparación pasa por manos especializadas: mecánica, electricidad, aire
                acondicionado y control de calidad antes de la entrega.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {SPECIALTIES.map((sp) => (
                  <span
                    key={sp}
                    className="rounded-full border border-sm-border bg-sm-bg px-3.5 py-1.5 text-[13px] font-medium text-sm-muted"
                  >
                    {sp}
                  </span>
                ))}
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-3.5">
              {ROLES.map((role) => (
                <li key={role} className="flex items-center gap-2.5 text-sm font-medium text-sm-ink">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-sm-red" aria-hidden="true" />
                  {role}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ============ DIFERENCIA ============ */}
        <section className="mx-auto max-w-5xl px-4 pt-16 sm:pt-20">
          <h2 className="font-heading font-bold uppercase text-[28px] sm:text-[34px] tracking-wide text-center">
            Tu vehículo, siempre a la vista
          </h2>
          <div className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-7 *:min-w-0">
            {DIFERENCIA.map((d) => (
              <div key={d.title} className="flex gap-4">
                <div className="grid place-items-center w-11 h-11 shrink-0 rounded-xl bg-sm-graphite text-white" aria-hidden="true">
                  <d.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm-graphite">{d.title}</h3>
                  <p className="mt-1 text-sm text-sm-muted max-w-[42ch]">{d.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============ CONTACTO / CTA ============ */}
        <section id="contacto" className="mt-16 sm:mt-20 scroll-mt-20">
          <div className="bg-sm-graphite text-white">
            <div className="mx-auto max-w-5xl px-4 py-14 sm:py-16 grid lg:grid-cols-2 gap-10 items-center *:min-w-0">
              <div className="text-center lg:text-left">
                <h2 className="font-heading font-bold uppercase text-[30px] sm:text-[40px] tracking-wide leading-[1.05] text-balance">
                  ¿Tu vehículo necesita servicio?
                </h2>
                <p className="mt-3 text-white/70 max-w-md mx-auto lg:mx-0">
                  Tráelo al taller o escríbenos: te cotizamos sin compromiso y lo sigues en vivo desde
                  tu celular.
                </p>
                <div className="mt-6 flex flex-wrap justify-center lg:justify-start gap-3">
                  <a
                    href={WA_AGENDA}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 rounded-xl bg-sm-red hover:bg-sm-red-hover active:bg-sm-red-active text-white px-6 py-3 font-semibold transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" aria-hidden="true" /> Escríbenos por WhatsApp
                  </a>
                  <a
                    href={TEL_HREF}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 hover:border-white/50 hover:bg-white/5 text-white px-6 py-3 font-semibold transition-colors"
                  >
                    <Phone className="w-5 h-5" aria-hidden="true" /> Llámanos
                  </a>
                </div>
                <div className="mt-6 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-sm text-white/65">
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> {brand.address || "Guatemala"}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" aria-hidden="true" /> {brand.hours || "Lun–Sáb"}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-sm mx-auto lg:ml-auto lg:mr-0 space-y-3">
                <InstallButton
                  appName={brand.clientAppName}
                  label="Instala la app en tu celular"
                  tone="onDark"
                />
                <p className="flex items-center justify-center gap-1.5 text-xs text-white/45">
                  <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Tus datos solo son visibles con tu placa y código de acceso.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="bg-sm-graphite text-white/55">
        <div className="mx-auto max-w-5xl px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <img
            src="/logo/logo-mts96.png"
            alt="Multiservicios San Miguel 96"
            width={1458}
            height={381}
            className="h-7 w-auto select-none mix-blend-screen"
            draggable={false}
          />
          <nav className="flex gap-5" aria-label="Secciones del pie">
            <a href="#como-funciona" className="hover:text-white transition-colors">Cómo funciona</a>
            <a href="#servicios" className="hover:text-white transition-colors">Servicios</a>
            <a href="#contacto" className="hover:text-white transition-colors">Contacto</a>
          </nav>
        </div>
        <div className="border-t border-white/10 py-3 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Multiservicios San Miguel 96 · {brand.address}
        </div>
      </footer>
    </div>
  );
}
