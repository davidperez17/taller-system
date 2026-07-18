"use client";

import { useId, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import {
  updateOrderItemAction, deleteOrderItemAction, updateQuoteItemAction, deleteQuoteItemAction,
} from "@/app/admin/actions";
import { formatMoney } from "@/lib/status";
import { type DiscountType } from "@/lib/totals";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/admin/ui";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmSubmitButton from "@/components/admin/ConfirmSubmitButton";
import DiscountEditor from "@/components/admin/DiscountEditor";

export type EditableItem = {
  id: number;
  kind: string;
  description: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  part_id: number | null;
  stock: number | null; // existencias que quedan del repuesto (null si es libre/servicio)
};

type EditorMode = "order" | "quote";

// Presupuesto de la orden. Hasta md se pintan tarjetas apiladas (la tabla
// obligaba a scroll lateral en el teléfono y cortaba columnas); desde md se
// recupera la tabla, que en pantalla ancha alinea mejor las cifras. Ambas vistas
// comparten el mismo formulario de edición.
// mode="quote": edita quote_items de un presupuesto pre-orden (sin tope de
// stock: las piezas no se reservan al cotizar). readOnly congela un presupuesto
// ya decidido (historial): sin editar ni quitar.
export default function OrderItemsEditor({
  orderId,
  items,
  isAdmin,
  subtotal,
  discount,
  discountType,
  discountValue,
  total,
  profit,
  canDiscount = false,
  maxDiscountAmount = 0,
  mode = "order",
  readOnly = false,
}: {
  // Id de la orden o del presupuesto, según mode.
  orderId: number;
  items: EditableItem[];
  isAdmin: boolean;
  subtotal: number;
  discount: number;
  discountType: DiscountType | null;
  discountValue: number;
  // Ya descontado; profit = total − costo de los conceptos.
  total: number;
  profit: number;
  // Admin y asesor pueden descontar; el mecánico no.
  canDiscount?: boolean;
  maxDiscountAmount?: number;
  mode?: EditorMode;
  readOnly?: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  if (items.length === 0) return null;

  const profitCls = (n: number) => (n < -0.009 ? "text-red-600" : "text-accent-700");
  const colSpan = isAdmin ? 8 : 6;
  const showBreak = discount > 0.009;
  const discountLabel =
    discountType === "porcentaje" ? `Descuento (${discountValue}%)` : "Descuento";


  return (
    <>
      {/* Móvil: tarjetas, sin scroll lateral */}
      <ul className="mt-3 space-y-2 md:hidden">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl border border-slate-200 p-3">
            {editingId === it.id ? (
              <ItemEditForm
                item={it}
                orderId={orderId}
                isAdmin={isAdmin}
                mode={mode}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 break-words">{it.description}</p>
                    <p className="mt-0.5 text-xs capitalize text-slate-400">{it.kind}</p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {formatMoney(it.qty * it.unit_price)}
                  </p>
                </div>
                <p className="mt-1.5 text-sm tabular-nums text-slate-500">
                  {it.qty} × {formatMoney(it.unit_price)}
                </p>
                {isAdmin && (
                  <p className="mt-0.5 text-xs tabular-nums text-slate-400">
                    Costo {formatMoney(it.unit_cost)} · Ganancia{" "}
                    <span className={profitCls(it.qty * (it.unit_price - it.unit_cost))}>
                      {formatMoney(it.qty * (it.unit_price - it.unit_cost))}
                    </span>
                  </p>
                )}
                {!readOnly && (
                  <div className="mt-2 flex justify-end gap-1 border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(it.id)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-sm-red cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
                    </button>
                    <DeleteItemForm item={it} orderId={orderId} mode={mode} withLabel />
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 md:hidden">
        {showBreak && (
          <>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-medium text-accent-700">
              <span>{discountLabel}</span>
              <span className="tabular-nums">- {formatMoney(discount)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800">Total</span>
          <div className="text-right">
            <p className="font-bold tabular-nums text-slate-900">{formatMoney(total)}</p>
            {isAdmin && (
              <p className={`text-xs font-medium tabular-nums ${profitCls(profit)}`}>
                Ganancia {formatMoney(profit)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Escritorio: tabla */}
      <table className="mt-3 hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
            <th className="py-2 pr-2 font-semibold">Concepto</th>
            <th className="hidden px-2 py-2 font-semibold lg:table-cell">Tipo</th>
            <th className="px-2 py-2 text-right font-semibold">Cant.</th>
            {isAdmin && <th className="px-2 py-2 text-right font-semibold">Costo unit.</th>}
            <th className="px-2 py-2 text-right font-semibold">P. venta</th>
            <th className="px-2 py-2 text-right font-semibold">Importe</th>
            {isAdmin && <th className="px-2 py-2 text-right font-semibold">Ganancia</th>}
            <th className="py-2 pl-2" aria-label="Acciones" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map((it) =>
            editingId === it.id ? (
              <tr key={it.id}>
                <td colSpan={colSpan} className="py-3">
                  <ItemEditForm
                    item={it}
                    orderId={orderId}
                    isAdmin={isAdmin}
                    mode={mode}
                    onClose={() => setEditingId(null)}
                  />
                </td>
              </tr>
            ) : (
              <tr key={it.id}>
                <td className="py-2.5 pr-2 text-slate-700">{it.description}</td>
                <td className="hidden px-2 py-2.5 capitalize text-slate-500 lg:table-cell">
                  {it.kind}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">{it.qty}</td>
                {isAdmin && (
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">
                    {formatMoney(it.unit_cost)}
                  </td>
                )}
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">
                  {formatMoney(it.unit_price)}
                </td>
                <td className="px-2 py-2.5 text-right font-medium tabular-nums text-slate-700">
                  {formatMoney(it.qty * it.unit_price)}
                </td>
                {isAdmin && (
                  <td
                    className={`px-2 py-2.5 text-right font-medium tabular-nums ${profitCls(
                      it.qty * (it.unit_price - it.unit_cost)
                    )}`}
                  >
                    {formatMoney(it.qty * (it.unit_price - it.unit_cost))}
                  </td>
                )}
                <td className="py-2.5 pl-2">
                  {!readOnly && (
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(it.id)}
                        aria-label={`Editar ${it.description}`}
                        className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-50 hover:text-sm-red cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <DeleteItemForm item={it} orderId={orderId} mode={mode} />
                    </div>
                  )}
                </td>
              </tr>
            )
          )}
        </tbody>
        <tfoot>
          {showBreak && (
            <FootRow first isAdmin={isAdmin} label="Subtotal" amount={formatMoney(subtotal)} />
          )}
          {showBreak && (
            <FootRow
              isAdmin={isAdmin}
              label={discountLabel}
              amount={`- ${formatMoney(discount)}`}
              tone="font-medium text-accent-700"
            />
          )}
          <FootRow
            first={!showBreak}
            strong
            isAdmin={isAdmin}
            label="Total"
            amount={formatMoney(total)}
            profitCell={<span className={profitCls(profit)}>{formatMoney(profit)}</span>}
          />
        </tfoot>
      </table>

      {canDiscount && !readOnly && (
        <DiscountEditor
          id={orderId}
          mode={mode}
          type={discountType}
          value={discountValue}
          maxAmount={maxDiscountAmount}
        />
      )}
    </>
  );
}

// Una fila del pie de la tabla. Las celdas vacías están calibradas a mano contra
// el <thead> (Concepto | Tipo(lg) | Cant. | [Costo] | P. venta | Importe |
// [Ganancia] | acciones) y con el desglose harían falta tres veces, así que
// viven aquí una sola vez.
//
// No sirve un colSpan para tragarlas: la columna "Tipo" es hidden lg:table-cell,
// o sea que entre md y lg la tabla tiene una columna menos y un colSpan fijo
// pintaría una columna fantasma. Las celdas explícitas son la única forma
// correcta.
function FootRow({
  label,
  amount,
  isAdmin,
  tone,
  strong,
  profitCell,
  first,
}: {
  label: string;
  amount: string;
  isAdmin: boolean;
  tone?: string;
  strong?: boolean;
  profitCell?: React.ReactNode;
  first?: boolean;
}) {
  return (
    <tr className={first ? "border-t border-slate-200" : undefined}>
      <td className={strong ? "py-3 font-semibold text-slate-800" : "py-1 text-slate-500"}>
        {label}
      </td>
      <td className="hidden lg:table-cell" />
      <td />
      {isAdmin && <td />}
      <td />
      <td
        className={
          strong
            ? "py-3 text-right font-bold tabular-nums text-slate-900"
            : `py-1 text-right tabular-nums ${tone ?? "text-slate-500"}`
        }
      >
        {amount}
      </td>
      {isAdmin && <td className="py-3 text-right font-bold tabular-nums">{profitCell}</td>}
      <td />
    </tr>
  );
}

function DeleteItemForm({
  item,
  orderId,
  mode,
  withLabel,
}: {
  item: EditableItem;
  orderId: number;
  mode: EditorMode;
  withLabel?: boolean;
}) {
  const isQuote = mode === "quote";
  return (
    <form action={isQuote ? deleteQuoteItemAction : deleteOrderItemAction} className="inline">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name={isQuote ? "quote_id" : "order_id"} value={orderId} />
      <ConfirmSubmitButton
        ariaLabel={`Eliminar ${item.description}`}
        className={
          withLabel
            ? "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"
            : "rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 cursor-pointer"
        }
        confirmTitle="¿Eliminar concepto?"
        confirmMessage={
          isQuote
            ? `Se quita "${item.description}" del presupuesto.`
            : `Se quita "${item.description}" de la orden.${
                item.part_id ? " El repuesto vuelve al inventario." : ""
              }`
        }
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {withLabel && "Quitar"}
      </ConfirmSubmitButton>
    </form>
  );
}

// Un ítem de inventario no puede consumir más piezas de las que quedan en stock:
// el tope es lo que ya tiene reservado más lo que queda en bodega. En modo
// quote no hay tope (el stock no se reserva al cotizar).
function ItemEditForm({
  item,
  orderId,
  isAdmin,
  mode,
  onClose,
}: {
  item: EditableItem;
  orderId: number;
  isAdmin: boolean;
  mode: EditorMode;
  onClose: () => void;
}) {
  const uid = useId();
  const isQuote = mode === "quote";
  const maxQty =
    !isQuote && item.part_id !== null && item.stock !== null ? item.qty + item.stock : undefined;

  return (
    <form
      action={async (fd) => {
        await (isQuote ? updateQuoteItemAction(fd) : updateOrderItemAction(fd));
        onClose();
      }}
      className="grid grid-cols-2 gap-3"
    >
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name={isQuote ? "quote_id" : "order_id"} value={orderId} />

      <div className="col-span-2">
        <label htmlFor={`${uid}-desc`} className={labelCls}>
          Concepto *
        </label>
        <input
          id={`${uid}-desc`}
          name="description"
          required
          defaultValue={item.description}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor={`${uid}-qty`} className={labelCls}>
          Cant. *
        </label>
        <input
          id={`${uid}-qty`}
          name="qty"
          type="number"
          step="0.5"
          min="0.5"
          max={maxQty}
          required
          inputMode="decimal"
          defaultValue={item.qty}
          className={inputCls}
        />
        {maxQty !== undefined && (
          <p className="mt-1 text-xs text-slate-400">Máx. {maxQty} (stock disponible)</p>
        )}
      </div>

      {isAdmin && (
        <div>
          <label htmlFor={`${uid}-cost`} className={labelCls}>
            Costo unit.
          </label>
          <input
            id={`${uid}-cost`}
            name="unit_cost"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={item.unit_cost || ""}
            className={inputCls}
          />
        </div>
      )}

      <div className={isAdmin ? "col-span-2" : undefined}>
        <label htmlFor={`${uid}-price`} className={labelCls}>
          Precio venta
        </label>
        <input
          id={`${uid}-price`}
          name="unit_price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          defaultValue={item.unit_price || ""}
          className={inputCls}
        />
      </div>

      <div className="col-span-2 flex gap-2">
        <SubmitButton className={`${btnPrimary} flex-1`} pendingText="Guardando…">
          Guardar
        </SubmitButton>
        <button type="button" onClick={onClose} className={btnSecondary}>
          <X className="h-4 w-4" aria-hidden="true" /> Cancelar
        </button>
      </div>
      {isAdmin && (
        <p className="col-span-2 -mt-1 text-xs text-slate-400">
          El costo es solo tuyo (rentabilidad); el cliente solo ve el precio de venta.
        </p>
      )}
    </form>
  );
}
