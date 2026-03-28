"use client";

import { formatCOP } from "@/lib/utils/format";
import { useCart } from "@/contexts/CartContext";
import { Money, DeviceMobile, Backspace, ArrowLeft, Prohibit, Check, CheckCircle } from "@phosphor-icons/react";
import { VoidSaleModal } from "@/components/caja/VoidSaleModal";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { playSuccess, playAdd } from "@/lib/utils/sounds";
import { toast } from "sonner";
import { useCaja } from "@/contexts/CajaContext";
import { useOnlineStatus, queueSale } from "@/lib/hooks/useOffline";
import { getActiveCompanyId } from "@/lib/supabase/company";
import type { PaymentMethod } from "@/lib/utils/constants";

function isAddon(name: string, categorySlug?: string): boolean {
  return categorySlug === "extras-venta" ||
    name.toLowerCase().startsWith("topping") ||
    name.toLowerCase().startsWith("salsa") ||
    name.toLowerCase().startsWith("adición");
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];
const NUMPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["00", "0", "DEL"],
];

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { items, total, clear, itemCount } = useCart();
  const { register } = useCaja();
  const online = useOnlineStatus();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<{ saleId: string; saleNumber: number; total: number } | null>(null);
  const [showVoid, setShowVoid] = useState(false);

  const change = receivedAmount - total;
  const mainItems = items.filter((i) => !isAddon(i.name, i.category_slug));
  const addons = items.filter((i) => isAddon(i.name, i.category_slug));
  const digits = receivedAmount > 0 ? String(receivedAmount) : "";

  useEffect(() => {
    if (isOpen) {
      setReceivedAmount(0);
      setPaymentMethod("efectivo");
      setSuccess(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  function handleNumpadKey(key: string) {
    if (key === "DEL") {
      setReceivedAmount(parseInt(digits.slice(0, -1)) || 0);
      return;
    }
    const next = digits + key;
    if (next.length > 7) return;
    setReceivedAmount(parseInt(next) || 0);
    playAdd();
  }

  const handleConfirm = useCallback(async () => {
    if (items.length === 0 || processing) return;
    setProcessing(true);

    const saleItems = items.map((item) => ({
      product_id: item.product_id, product_name: item.name,
      quantity: item.quantity, unit_price: item.price, subtotal: item.price * item.quantity,
    }));

    if (!online) {
      // OFFLINE: queue sale locally
      queueSale({
        id: crypto.randomUUID(),
        total,
        payment_method: paymentMethod,
        items: saleItems,
        register_id: register?.id ?? null,
        created_at: new Date().toISOString(),
      });
      playSuccess();
      clear();
      setSuccess({ saleId: "offline", saleNumber: Math.floor(Math.random() * 9000) + 1000, total });
      setTimeout(() => { setSuccess(null); onClose(); }, 2000);
      setProcessing(false);
      return;
    }

    // ONLINE: normal flow
    try {
      const supabase = createClient();
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({ total, payment_method: paymentMethod, status: "completed", register_id: register?.id ?? null, company_id: getActiveCompanyId() })
        .select("id, sale_number")
        .single();
      if (saleError) throw saleError;

      const dbItems = saleItems.map((item) => ({ sale_id: sale.id, company_id: getActiveCompanyId(), ...item }));
      const { error: itemsError } = await supabase.from("sale_items").insert(dbItems);
      if (itemsError) throw itemsError;

      await supabase.rpc("fn_deduct_inventory", { p_sale_id: sale.id });

      playSuccess();
      clear();
      setSuccess({ saleId: sale.id, saleNumber: sale.sale_number, total });
      setTimeout(() => { setSuccess(null); onClose(); }, 2000);
    } catch (error) {
      // If online request fails, queue it offline
      console.error(error);
      queueSale({
        id: crypto.randomUUID(),
        total,
        payment_method: paymentMethod,
        items: saleItems,
        register_id: register?.id ?? null,
        created_at: new Date().toISOString(),
      });
      playSuccess();
      toast.warning("Sin conexión — venta guardada para sincronizar");
      clear();
      setSuccess({ saleId: "queued", saleNumber: Math.floor(Math.random() * 9000) + 1000, total });
      setTimeout(() => { setSuccess(null); onClose(); }, 2000);
    }
    finally { setProcessing(false); }
  }, [items, total, paymentMethod, processing, clear, onClose, register, online]);

  if (!isOpen) return null;

  // Success fullscreen
  if (success) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white" onClick={() => { setSuccess(null); onClose(); }}>
          <div className="animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center gap-4 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle size={48} weight="fill" className="text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-default-800">Venta #{success.saleNumber}</p>
            <p className="text-4xl font-extrabold text-emerald-600 tabular-nums">{formatCOP(success.total)}</p>
            {paymentMethod === "efectivo" && receivedAmount > 0 && change > 0 && (
              <p className="text-xl text-default-500 tabular-nums">Cambio: {formatCOP(change)}</p>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-white">
      {/* LEFT — Order summary */}
      <div className="w-[45%] flex flex-col border-r border-default-100 bg-gray-50">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-default-100 bg-white shrink-0">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-default-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-default-500" />
          </button>
          <h2 className="text-lg font-bold text-default-800">Resumen</h2>
          <span className="ml-auto text-xs font-bold text-default-400 bg-default-100 rounded-full px-2.5 py-1">
            {itemCount} items
          </span>
        </div>

        {/* Items — scrollable independently */}
        <div className="flex-1 overflow-auto p-5 space-y-1">
          {mainItems.map((item) => (
            <div key={item.product_id} className="flex items-start justify-between gap-3 py-1.5">
              <span className="text-sm font-medium text-default-700 line-clamp-1 flex-1 min-w-0">
                {item.quantity > 1 && <span className="text-default-400 tabular-nums">{item.quantity}× </span>}
                {item.name}
              </span>
              <span className="text-sm font-bold text-default-800 shrink-0 tabular-nums">
                {formatCOP(item.price * item.quantity)}
              </span>
            </div>
          ))}
          {addons.map((item) => (
            <div key={item.product_id} className="flex items-start justify-between gap-3 py-1 pl-3">
              <span className="text-xs text-default-400 line-clamp-1 flex-1 min-w-0">
                + {item.quantity > 1 && `${item.quantity}× `}{item.name}
              </span>
              <span className="text-xs text-default-500 shrink-0 tabular-nums">
                {formatCOP(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Total + Cancel — always visible at bottom */}
        <div className="border-t border-default-100 bg-white px-6 py-4 shrink-0 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-default-500">Total</span>
            <span className="text-3xl font-extrabold text-default-900 tabular-nums">{formatCOP(total)}</span>
          </div>
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 hover:text-default-700 active:scale-[0.97] transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* RIGHT — Payment + Numpad */}
      <div className="flex-1 flex flex-col p-6 overflow-auto">
        {/* Payment method */}
        <div className="grid grid-cols-2 gap-3 mb-5 shrink-0">
          {([
            { id: "efectivo" as PaymentMethod, label: "Efectivo", Icon: Money },
            { id: "nequi" as PaymentMethod, label: "Nequi", Icon: DeviceMobile },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPaymentMethod(id)}
              className={`flex items-center justify-center gap-3 rounded-2xl border-2 py-4 transition-all active:scale-95
                ${paymentMethod === id
                  ? "border-primary bg-primary/5"
                  : "border-default-200 hover:border-default-300"
                }`}
            >
              <Icon size={24} weight={paymentMethod === id ? "fill" : "duotone"} className={paymentMethod === id ? "text-primary" : "text-default-400"} />
              <span className={`text-sm font-bold ${paymentMethod === id ? "text-primary" : "text-default-600"}`}>{label}</span>
            </button>
          ))}
        </div>

        {/* Cash section */}
        {paymentMethod === "efectivo" && (
          <div className="flex-1 flex flex-col">
            {/* Quick amounts */}
            <div className="flex gap-2 mb-3 shrink-0">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setReceivedAmount(amt)}
                  className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all active:scale-95
                    ${receivedAmount === amt ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}
                >
                  {amt >= 1000 ? `$${amt / 1000}K` : formatCOP(amt)}
                </button>
              ))}
              <button
                onClick={() => setReceivedAmount(total)}
                className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all active:scale-95
                  ${receivedAmount === total ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}
              >
                Exacto
              </button>
            </div>

            {/* Display */}
            <button
              onClick={() => setReceivedAmount(0)}
              className="w-full rounded-2xl bg-default-50 border border-default-100 px-5 py-3 text-center mb-3 hover:bg-default-100 transition-colors shrink-0"
            >
              <p className="text-[10px] font-bold text-default-400 uppercase tracking-wider mb-0.5">Efectivo recibido</p>
              <p className={`text-3xl font-extrabold tabular-nums ${receivedAmount > 0 ? "text-default-900" : "text-default-300"}`}>
                {receivedAmount > 0 ? formatCOP(receivedAmount) : "$ 0"}
              </p>
            </button>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-1.5 mb-3 shrink-0">
              {NUMPAD_KEYS.flat().map((key) => (
                <button
                  key={key}
                  onClick={() => handleNumpadKey(key)}
                  className={`flex items-center justify-center h-14 rounded-xl text-lg font-bold transition-all active:scale-95 select-none
                    ${key === "DEL"
                      ? "bg-default-200 text-default-600 hover:bg-default-300"
                      : "bg-white border border-default-200 text-default-800 hover:bg-default-50"
                    }`}
                >
                  {key === "DEL" ? <Backspace size={22} weight="bold" /> : key}
                </button>
              ))}
            </div>

            {/* Change / Missing */}
            {receivedAmount >= total && receivedAmount > 0 && (
              <div className="flex justify-between items-center rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 mb-3 shrink-0">
                <span className="text-sm font-semibold text-emerald-700">Cambio</span>
                <span className="text-xl font-bold text-emerald-700 tabular-nums">{formatCOP(change)}</span>
              </div>
            )}
            {receivedAmount > 0 && receivedAmount < total && (
              <div className="flex justify-between items-center rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-3 shrink-0">
                <span className="text-sm font-semibold text-red-600">Falta</span>
                <span className="text-xl font-bold text-red-600 tabular-nums">{formatCOP(total - receivedAmount)}</span>
              </div>
            )}
          </div>
        )}

        {/* Nequi: just confirm, no numpad needed */}
        {paymentMethod === "nequi" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <DeviceMobile size={48} weight="duotone" className="text-primary mb-4" />
            <p className="text-lg font-bold text-default-800 mb-1">Pago por Nequi</p>
            <p className="text-sm text-default-400 mb-2">Confirma que recibiste el pago</p>
            <p className="text-3xl font-extrabold text-primary tabular-nums">{formatCOP(total)}</p>
          </div>
        )}

        {/* Confirm button — always at bottom */}
        <button
          onClick={handleConfirm}
          disabled={processing}
          className="w-full h-16 rounded-2xl bg-primary text-white text-xl font-bold shadow-lg shadow-primary/30 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shrink-0 mt-auto"
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Procesando...
            </span>
          ) : (
            <>
              <Check size={24} weight="bold" />
              Confirmar {formatCOP(total)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
