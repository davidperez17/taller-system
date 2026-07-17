"use client";

import { useMemo, useState } from "react";
import { Boxes, Hammer, PenLine } from "lucide-react";
import { addOrderItemAction, addQuoteItemAction } from "@/app/admin/actions";
import { btnPrimary, inputCls, labelCls } from "@/components/admin/ui";
import SubmitButton from "@/components/admin/SubmitButton";

export type PickerPart = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  unit_price: number;
  cost: number;
};
export type PickerService = {
  id: number;
  name: string;
  category: string | null;
  price: number;
  est_cost: number;
};

type Tab = "repuesto" | "servicio" | "libre";

// Selector de ítems del presupuesto: repuesto de inventario (descuenta stock),
// servicio del catálogo, o ítem libre. Precio y costo se pueden sobreescribir;
// el campo de costo solo lo ve el admin (rentabilidad). Si se deja vacío, el
// server action toma el costo del catálogo/inventario como respaldo.
// mode="quote": el mismo selector alimenta un presupuesto pre-orden
// (quote_items); ahí el stock NO se toca ni se bloquea — se descuenta al
// aprobarse y generarse la orden.
export default function ItemPicker({
  orderId,
  parts,
  services,
  isAdmin,
  mode = "order",
}: {
  // Id de la orden o del presupuesto, según mode.
  orderId: number;
  parts: PickerPart[];
  services: PickerService[];
  isAdmin: boolean;
  mode?: "order" | "quote";
}) {
  const isQuote = mode === "quote";
  const [tab, setTab] = useState<Tab>(services.length > 0 ? "servicio" : "libre");
  const [partId, setPartId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [partQuery, setPartQuery] = useState("");

  const filteredParts = useMemo(() => {
    const q = partQuery.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [parts, partQuery]);

  const selectedPart = parts.find((p) => String(p.id) === partId);
  const selectedService = services.find((s) => String(s.id) === serviceId);

  const tabs: { id: Tab; label: string; icon: typeof Boxes }[] = [
    { id: "servicio", label: "Servicio", icon: Hammer },
    { id: "repuesto", label: "Inventario", icon: Boxes },
    { id: "libre", label: "Libre", icon: PenLine },
  ];

  // Ayuda contextual según la pestaña y el rol. El costo solo lo ve el admin.
  const hint =
    tab === "repuesto"
      ? `Deja precio vacío para usar el de inventario; ${
          isQuote
            ? "el stock se descuenta al aprobarse el presupuesto, no al cotizar."
            : "se descuenta del stock al agregar."
        }${isAdmin ? " El costo se rellena del inventario si lo dejas vacío." : ""}`
      : tab === "servicio"
        ? `Deja precio vacío para usar el del catálogo.${
            isAdmin ? " El costo se rellena del catálogo si lo dejas vacío." : ""
          }`
        : isAdmin
          ? "El costo es solo tuyo (rentabilidad); el cliente solo ve el precio de venta."
          : "";

  return (
    <div className="mt-4">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="w-4 h-4" aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      <form
        action={isQuote ? addQuoteItemAction : addOrderItemAction}
        className={`mt-3 grid grid-cols-2 gap-2 items-end ${
          isAdmin
            ? "sm:grid-cols-[1fr_5rem_7rem_7rem_auto]"
            : "sm:grid-cols-[1fr_5rem_7rem_auto]"
        }`}
      >
        <input type="hidden" name={isQuote ? "quote_id" : "order_id"} value={orderId} />

        {tab === "repuesto" && (
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <div>
              <label htmlFor="part-search" className={labelCls}>
                Buscar repuesto
              </label>
              <input
                id="part-search"
                value={partQuery}
                onChange={(e) => setPartQuery(e.target.value)}
                placeholder="Nombre o SKU…"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="part-select" className={labelCls}>
                Repuesto *
              </label>
              <select
                id="part-select"
                name="part_id"
                required
                value={partId}
                onChange={(e) => setPartId(e.target.value)}
                className={inputCls}
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                {filteredParts.map((p) => (
                  <option key={p.id} value={p.id} disabled={!isQuote && p.stock <= 0}>
                    {p.name}
                    {p.sku ? ` (${p.sku})` : ""} · stock {p.stock}
                  </option>
                ))}
              </select>
              {!isQuote && selectedPart && selectedPart.stock <= 0 && (
                <p className="text-xs text-red-600 mt-1">Sin stock disponible.</p>
              )}
            </div>
          </div>
        )}

        {tab === "servicio" && (
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="service-select" className={labelCls}>
              Servicio *
            </label>
            <select
              id="service-select"
              name="service_id"
              required
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className={inputCls}
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category ? `${s.category} · ` : ""}
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {tab === "libre" && (
          <>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="item-desc" className={labelCls}>
                Concepto *
              </label>
              <input
                id="item-desc"
                name="description"
                required
                placeholder="Ej. Soldadura de escape"
                className={inputCls}
              />
            </div>
            <input type="hidden" name="kind" value="servicio" />
          </>
        )}

        <div>
          <label htmlFor="item-qty" className={labelCls}>
            Cant.
          </label>
          <input
            id="item-qty"
            name="qty"
            type="number"
            step="0.5"
            min="0.5"
            defaultValue={1}
            className={inputCls}
          />
        </div>
        {isAdmin && (
          <div>
            <label htmlFor="item-cost" className={labelCls}>
              Costo
            </label>
            <input
              id="item-cost"
              name="unit_cost"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder={
                tab === "repuesto" && selectedPart
                  ? String(selectedPart.cost)
                  : tab === "servicio" && selectedService
                    ? String(selectedService.est_cost)
                    : undefined
              }
              className={inputCls}
            />
          </div>
        )}
        <div className={isAdmin ? "col-span-2 sm:col-span-1" : undefined}>
          <label htmlFor="item-price" className={labelCls}>
            Precio venta
          </label>
          <input
            id="item-price"
            name="unit_price"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder={
              tab === "repuesto" && selectedPart
                ? String(selectedPart.unit_price)
                : tab === "servicio" && selectedService
                  ? String(selectedService.price)
                  : undefined
            }
            className={inputCls}
          />
        </div>
        <SubmitButton
          className={`${btnPrimary} col-span-2 sm:col-span-1`}
          pendingText="Agregando…"
        >
          Agregar
        </SubmitButton>
        {hint && (
          <p
            className={`col-span-2 text-xs text-slate-400 ${
              isAdmin ? "sm:col-span-5" : "sm:col-span-4"
            }`}
          >
            {hint}
          </p>
        )}
      </form>
    </div>
  );
}
