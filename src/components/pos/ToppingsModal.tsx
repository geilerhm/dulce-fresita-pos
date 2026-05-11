"use client";

import { useState, useEffect, useMemo } from "react";
import { formatCOP } from "@/lib/utils/format";
import { ProductIcon } from "@/lib/utils/product-icons";
import { X, Check, Plus, Gift, CurrencyCircleDollar } from "@phosphor-icons/react";
import { playAdd, playClick } from "@/lib/utils/sounds";
import type { Topping } from "@/contexts/CartContext";

export interface ToppingOption {
  id: string;
  name: string;
  price: number;
  icon?: string;
  image_url?: string;
}

interface ToppingsModalProps {
  isOpen: boolean;
  productName: string;
  toppings: ToppingOption[];
  /** When editing an existing cart line, pass its current toppings so the
   *  modal opens with them pre-selected (and their charge state preserved). */
  initialSelection?: Topping[];
  /** How many toppings come included in the product's base price. Drives the
   *  "X/N incluidos" badge and the auto-charge behavior when a new topping is
   *  selected (selected after the cupo is filled → charge=true by default). */
  includedCount?: number;
  /** Edit mode flips the primary action label from "Agregar" to "Guardar"
   *  and the empty-selection button from "Sin toppings" to "Quitar toppings". */
  mode?: "add" | "edit";
  onCancel: () => void;
  onConfirm: (selected: Topping[]) => void;
}

interface Selection {
  charge: boolean;
}

export function ToppingsModal({
  isOpen,
  productName,
  toppings,
  initialSelection,
  includedCount = 0,
  mode = "add",
  onCancel,
  onConfirm,
}: ToppingsModalProps) {
  const [selected, setSelected] = useState<Record<string, Selection>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (initialSelection && initialSelection.length > 0) {
      const next: Record<string, Selection> = {};
      for (const t of initialSelection) {
        next[t.product_id] = { charge: t.charge };
      }
      setSelected(next);
    } else {
      setSelected({});
    }
  }, [isOpen, initialSelection]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  const selectedList = useMemo(
    () =>
      toppings
        .filter((t) => selected[t.id])
        .map((t) => ({
          product_id: t.id,
          name: t.name,
          price: t.price,
          charge: selected[t.id].charge,
        })),
    [toppings, selected],
  );

  const includedUsed = selectedList.filter((t) => !t.charge).length;
  const overCupo = Math.max(0, includedUsed - includedCount);

  if (!isOpen) return null;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        // Auto-charge: when the included cupo is already filled, new
        // selections default to "Cobrar" so the cashier doesn't have to
        // manually flip the toggle for the 4th topping of a "incluye 3"
        // product. They can still override either way after the fact.
        const includedAlreadyTaken = Object.entries(prev).filter(([, s]) => !s.charge).length;
        const autoCharge = includedAlreadyTaken >= includedCount;
        next[id] = { charge: autoCharge };
      }
      return next;
    });
    playClick();
  }

  function setCharge(id: string, charge: boolean) {
    setSelected((prev) => {
      if (!prev[id] || prev[id].charge === charge) return prev;
      return { ...prev, [id]: { charge } };
    });
    playClick();
  }

  function confirm() {
    playAdd();
    onConfirm(selectedList);
  }

  const count = selectedList.length;
  const extraCharge = selectedList.reduce((s, t) => s + (t.charge ? t.price : 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[92vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-default-100 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-default-400 uppercase tracking-wider">Toppings para</p>
            <p className="text-base font-bold text-default-800 line-clamp-1">{productName}</p>
          </div>
          {includedCount > 0 && (
            <div className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-bold tabular-nums shrink-0 transition-colors
              ${overCupo > 0
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : includedUsed === includedCount
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-default-100 text-default-600 border border-default-200"
              }`}>
              <Gift size={14} weight="fill" />
              {includedUsed}/{includedCount} incluidos
            </div>
          )}
          <button
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-default-100 transition-colors text-default-400"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto px-3 py-2">
          {toppings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-default-300">
              <p className="text-sm">No hay toppings disponibles</p>
              <p className="text-[11px] text-default-300 mt-1">Crea productos en la categoría &ldquo;Toppings&rdquo;</p>
            </div>
          ) : (
            <ul className="divide-y divide-default-100">
              {toppings.map((t) => {
                const sel = selected[t.id];
                const isSelected = !!sel;
                return (
                  <li key={t.id} className="py-1.5">
                    <div className="px-2 py-1">
                      {/* Top row: icon + name (whole row toggles selection) */}
                      <button
                        onClick={() => toggleSelect(t.id)}
                        className="flex items-center gap-3 w-full text-left active:scale-[0.99] transition-transform"
                      >
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 transition-colors
                          ${isSelected ? "bg-primary text-white" : "bg-default-50 text-default-400"}`}>
                          {isSelected ? (
                            <Check size={20} weight="bold" />
                          ) : (
                            <ProductIcon name={t.icon || "Cake"} size={22} weight="duotone" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold leading-tight line-clamp-1 ${isSelected ? "text-default-900" : "text-default-700"}`}>
                            {t.name}
                          </p>
                          {!isSelected && (
                            <p className="text-[11px] text-default-400 tabular-nums mt-0.5">{formatCOP(t.price)}</p>
                          )}
                        </div>
                      </button>

                      {/* Segmented control — only when selected. Both options
                          stay visible so the cashier can read the active
                          choice without having to tap to discover it. */}
                      {isSelected && (
                        <div className="mt-2 flex gap-1.5 pl-14">
                          <button
                            onClick={() => setCharge(t.id, false)}
                            className={`flex-1 h-10 rounded-xl text-[11px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5
                              ${!sel.charge
                                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                                : "bg-default-50 text-default-400 border border-default-100 hover:bg-default-100"
                              }`}
                          >
                            <Gift size={14} weight={!sel.charge ? "fill" : "duotone"} />
                            Incluido
                          </button>
                          <button
                            onClick={() => setCharge(t.id, true)}
                            className={`flex-1 h-10 rounded-xl text-[11px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5
                              ${sel.charge
                                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                                : "bg-default-50 text-default-400 border border-default-100 hover:bg-default-100"
                              }`}
                          >
                            <CurrencyCircleDollar size={14} weight={sel.charge ? "fill" : "duotone"} />
                            Cobrar +{formatCOP(t.price)}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-default-100 bg-white px-4 py-3 shrink-0 space-y-2">
          {includedCount > 0 && includedUsed < includedCount && selectedList.length > 0 && (
            <p className="text-[11px] text-default-400 px-1 italic">
              Aún puedes incluir {includedCount - includedUsed} sin costo
            </p>
          )}
          {extraCharge > 0 && (
            <div className="flex items-center justify-between text-xs text-default-500 px-1">
              <span>Toppings cobrados</span>
              <span className="font-bold text-default-700 tabular-nums">+{formatCOP(extraCharge)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { playClick(); onConfirm([]); }}
              className="flex-1 h-13 py-3.5 rounded-2xl bg-default-100 text-default-600 text-sm font-bold hover:bg-default-200 active:scale-[0.97] transition-all"
            >
              {mode === "edit" ? "Quitar toppings" : "Sin toppings"}
            </button>
            <button
              onClick={confirm}
              disabled={count === 0 && mode === "add"}
              className="flex-1 h-13 py-3.5 rounded-2xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              <Plus size={18} weight="bold" />
              {mode === "edit" ? "Guardar" : "Agregar"} {count > 0 ? `(${count})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
