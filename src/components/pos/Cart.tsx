"use client";

import { useCart } from "@/contexts/CartContext";
import { formatCOP } from "@/lib/utils/format";
import { Minus, Plus, Trash, ShoppingCart } from "@phosphor-icons/react";
import { playRemove } from "@/lib/utils/sounds";
import { useState } from "react";
import { SwipeableRow } from "@/components/ui/SwipeableRow";
import { useCaja } from "@/contexts/CajaContext";
import { CheckoutModal } from "./CheckoutModal";
import { ConfirmClearModal } from "./ConfirmClearModal";
import { NoCajaWarningModal } from "./NoCajaWarningModal";

function isAddon(name: string, categorySlug?: string): boolean {
  return categorySlug === "extras-venta" ||
    name.toLowerCase().startsWith("topping") ||
    name.toLowerCase().startsWith("salsa") ||
    name.toLowerCase().startsWith("adición");
}


export function Cart() {
  const { items, total, increment, decrement, removeItem, clear, itemCount } = useCart();
  const { register } = useCaja();
  const [showCheckout, setShowCheckout] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showNoCajaWarning, setShowNoCajaWarning] = useState(false);

  return (
    <>
      <div className="flex h-full flex-col border-l border-default-100 bg-white">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-default-100">
          <ShoppingCart size={20} weight="duotone" className="text-primary" />
          <span className="font-bold text-default-800">Orden</span>
          {itemCount > 0 && (
            <>
              <span className="ml-auto text-[11px] font-bold text-default-400 bg-default-100 rounded-full px-2.5 py-1 tabular-nums">
                {itemCount} items
              </span>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-default-300 hover:text-danger hover:bg-danger/10 transition-all"
              >
                <Trash size={16} weight="bold" />
              </button>
            </>
          )}
        </div>

        <ConfirmClearModal
          isOpen={showClearConfirm}
          itemCount={itemCount}
          onConfirm={() => { clear(); setShowClearConfirm(false); }}
          onCancel={() => setShowClearConfirm(false)}
        />

        {/* Items */}
        <div className="flex-1 overflow-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-default-50 mb-4">
                <ShoppingCart size={32} weight="duotone" className="text-default-200" />
              </div>
              <p className="text-xs text-default-400 text-center leading-relaxed">
                Toca un producto<br />para agregarlo a la orden
              </p>
            </div>
          ) : (
            <div className="divide-y divide-default-100">
              {items.map((item) => {
                const addon = isAddon(item.name, item.category_slug);

                return (
                  <SwipeableRow key={item.product_id} onDelete={() => { removeItem(item.product_id); playRemove(); }}>
                    <div className={`flex items-center gap-2 py-2.5 px-3 ${addon ? "pl-6" : ""}`}>
                      {addon && <span className="text-xs text-default-300">+</span>}

                      <div className="flex-1 min-w-0 max-w-[140px]">
                        <p className={`font-medium text-default-700 leading-tight ${addon ? "text-xs truncate" : "text-sm line-clamp-2"}`}>
                          {item.name}
                        </p>
                        {!addon && (
                          <p className="text-[11px] text-default-400 tabular-nums mt-0.5">{formatCOP(item.price)}</p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => decrement(item.product_id)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-default-200 bg-white text-default-500 hover:bg-default-100 active:scale-90 transition-all"
                        >
                          <Minus size={14} weight="bold" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-default-800 tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => increment(item.product_id)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-default-200 bg-white text-default-500 hover:bg-default-100 active:scale-90 transition-all"
                        >
                          <Plus size={14} weight="bold" />
                        </button>
                      </div>

                      {/* Subtotal */}
                      <span className={`w-[72px] text-right font-bold tabular-nums ${addon ? "text-xs text-default-500" : "text-sm text-default-700"}`}>
                        {formatCOP(item.price * item.quantity)}
                      </span>
                    </div>
                  </SwipeableRow>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-default-100 p-4 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-default-400 tabular-nums">{itemCount} items</span>
              <span className="text-3xl font-extrabold text-default-900 tabular-nums tracking-tight">
                {formatCOP(total)}
              </span>
            </div>
            <button
              onClick={() => {
                if (!register) { setShowNoCajaWarning(true); return; }
                setShowCheckout(true);
              }}
              className="w-full h-14 rounded-2xl bg-primary text-white text-lg font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            >
              Cobrar {formatCOP(total)}
            </button>
          </div>
        )}
      </div>

      <CheckoutModal isOpen={showCheckout} onClose={() => setShowCheckout(false)} />
      <NoCajaWarningModal
        isOpen={showNoCajaWarning}
        onClose={() => setShowNoCajaWarning(false)}
        onContinue={() => { setShowNoCajaWarning(false); setShowCheckout(true); }}
      />
    </>
  );
}

export function FloatingCartButton({ onClick }: { onClick: () => void }) {
  const { itemCount, total } = useCart();
  if (itemCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 lg:hidden flex items-center gap-3 rounded-2xl bg-primary text-white pl-5 pr-6 py-4 shadow-xl shadow-primary/30 hover:brightness-105 active:scale-95 transition-all"
    >
      <div className="relative">
        <ShoppingCart size={24} weight="fill" />
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary text-[11px] font-bold">
          {itemCount}
        </span>
      </div>
      <span className="text-base font-bold tabular-nums">{formatCOP(total)}</span>
    </button>
  );
}
