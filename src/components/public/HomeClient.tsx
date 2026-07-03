"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Search,
  Car,
  Bike,
  Truck,
  BellRing,
  ClipboardList,
  MapPin,
  Phone,
  Clock,
  ChevronRight,
  X,
  Download,
  ShieldCheck,
} from "lucide-react";
import {
  getSavedVehicles,
  removeVehicle,
  registerSW,
  type SavedVehicle,
} from "./pwa";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

export default function HomeClient() {
  const router = useRouter();
  const [plate, setPlate] = useState("");
  const [saved, setSaved] = useState<SavedVehicle[]>([]);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaved(getSavedVehicles());
    registerSW();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
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
      {/* Header */}
      <header className="bg-blue-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-blue-600 rounded-xl p-2" aria-hidden="true">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <p className="font-heading font-bold text-lg leading-tight tracking-wide">
              MULTISERVICIOS SAN MIGUEL 96
            </p>
            <p className="text-blue-200 text-xs">
              Taller mecánico · Autos · Motos · Camiones
            </p>
          </div>
        </div>
      </header>

      {/* Hero + buscador */}
      <section className="bg-blue-950 text-white pb-16 pt-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-wide">
            SIGUE TU REPARACIÓN <span className="text-blue-400">EN VIVO</span>
          </h1>
          <p className="mt-3 text-blue-200 max-w-md mx-auto">
            Consulta el avance de tu auto, moto o camión en tiempo real. Solo
            necesitas tu placa.
          </p>

          <form onSubmit={submit} className="mt-8 max-w-md mx-auto">
            <label htmlFor="plate" className="sr-only">
              Placa del vehículo
            </label>
            <div className="flex rounded-2xl overflow-hidden shadow-lg ring-1 ring-blue-800 focus-within:ring-2 focus-within:ring-blue-400">
              <input
                ref={inputRef}
                id="plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="ABC-1234"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={12}
                className="plate-badge flex-1 min-w-0 bg-white text-slate-900 text-center text-2xl py-4 px-4 placeholder:text-slate-300 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors px-6 flex items-center gap-2 font-semibold cursor-pointer"
              >
                <Search className="w-5 h-5" aria-hidden="true" />
                <span className="hidden sm:inline">Consultar</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-blue-300">
              Escribe la placa tal como aparece en tu vehículo, sin importar
              guiones o espacios.
            </p>
          </form>
        </div>
      </section>

      <main className="flex-1 -mt-8 px-4 pb-12">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Vehículos guardados */}
          {saved.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-slide-up">
              <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
                MIS VEHÍCULOS
              </h2>
              <ul className="mt-2 divide-y divide-slate-100">
                {saved.map((v) => (
                  <li key={v.plate} className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        router.push(
                          `/seguimiento/${v.plate}${v.code ? `?code=${v.code}` : ""}`,
                        )
                      }
                      className="flex-1 flex items-center gap-3 py-3 text-left cursor-pointer group min-w-0"
                    >
                      <span className="plate-badge bg-slate-100 border border-slate-300 rounded-lg px-3 py-1 text-slate-800">
                        {v.plate}
                      </span>
                      <span className="text-sm text-slate-500 truncate flex-1">
                        {v.label}
                      </span>
                      <ChevronRight
                        className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors shrink-0"
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
            </section>
          )}

          {/* Cómo funciona */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-heading font-semibold text-lg text-slate-800 tracking-wide">
              ¿CÓMO FUNCIONA?
            </h2>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: ClipboardList,
                  title: "1. Deja tu vehículo",
                  text: "Al recibirlo te entregamos un folio y un código de acceso.",
                },
                {
                  icon: Search,
                  title: "2. Consulta con tu placa",
                  text: "Ingresa tu placa aquí y mira cada avance con anotaciones del mecánico.",
                },
                {
                  icon: BellRing,
                  title: "3. Recibe notificaciones",
                  text: "Activa las alertas y te avisamos en tu celular con cada cambio.",
                },
              ].map((s) => (
                <li key={s.title} className="flex sm:flex-col gap-3">
                  <div
                    className="bg-blue-50 text-blue-700 rounded-xl p-2.5 h-fit w-fit"
                    aria-hidden="true"
                  >
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">
                      {s.title}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Servicios */}
          <section className="grid grid-cols-3 gap-3">
            {[
              { icon: Car, label: "Autos" },
              { icon: Bike, label: "Motos" },
              { icon: Truck, label: "Camiones" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col items-center gap-2"
              >
                <s.icon className="w-7 h-7 text-blue-700" aria-hidden="true" />
                <span className="text-sm font-medium text-slate-700">
                  {s.label}
                </span>
              </div>
            ))}
          </section>

          {/* Instalar app */}
          {installEvt && (
            <button
              onClick={async () => {
                await installEvt.prompt();
                setInstallEvt(null);
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors text-white rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 font-semibold shadow-sm cursor-pointer"
            >
              <Download className="w-5 h-5" aria-hidden="true" />
              Instalar la app en tu celular
            </button>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            Tus datos solo son visibles con tu placa y código de acceso.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-blue-950 text-blue-200 text-sm">
        <div className="max-w-3xl mx-auto px-4 py-6 grid gap-3 sm:grid-cols-3">
          <p className="flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />{" "}
            Chimaltenango, Guatemala
          </p>
          <p className="flex items-center gap-2">
            <Phone className="w-4 h-4 shrink-0" aria-hidden="true" /> Atención
            en el taller
          </p>
          <p className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" aria-hidden="true" /> Lun–Sáb ·
            8:00–18:00
          </p>
        </div>
        <div className="border-t border-blue-900 py-3 text-center text-xs text-blue-400">
          © {new Date().getFullYear()} Multiservicios San Miguel 96
        </div>
      </footer>
    </div>
  );
}
