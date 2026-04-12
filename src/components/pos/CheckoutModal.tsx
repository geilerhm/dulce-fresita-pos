"use client";

import { formatCOP } from "@/lib/utils/format";
import { useCart } from "@/contexts/CartContext";
import { Money, DeviceMobile, Backspace, ArrowLeft, Prohibit, Check, CheckCircle, Printer } from "@phosphor-icons/react";
import { printReceipt, type ReceiptData } from "./Receipt";
import { useAuth } from "@/contexts/AuthContext";
import { VoidSaleModal } from "@/components/caja/VoidSaleModal";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/db/client";
import { playSuccess, playAdd, playClick, playError } from "@/lib/utils/sounds";
import { pickRandomBlessing } from "@/lib/utils/blessing-phrases";
import { toast } from "@/lib/utils/toast";
import { useCaja } from "@/contexts/CajaContext";
import { getActiveCompanyId } from "@/lib/db/company";
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

interface SuccessData {
  saleId: string;
  saleNumber: number;
  total: number;
  change: number;
  paymentMethod: PaymentMethod;
  received: number;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
}

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { items, total, clear, itemCount } = useCart();
  const { register } = useCaja();
  const { displayName, activeCompany } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [showVoid, setShowVoid] = useState(false);
  const blessing = useMemo(() => pickRandomBlessing(), []);

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
    if (paymentMethod === "efectivo" && receivedAmount < total) {
      toast.error(`Faltan ${formatCOP(total - receivedAmount)} para completar el pago`);
      return;
    }
    setProcessing(true);

    const saleItems = items.map((item) => ({
      product_id: item.product_id, product_name: item.name,
      quantity: item.quantity, unit_price: item.price, subtotal: item.price * item.quantity,
    }));

    try {
      const client = createClient();
      const { data: sale, error: saleError } = await client
        .from("sales")
        .insert({ total, payment_method: paymentMethod, status: "completed", register_id: register?.id ?? null, company_id: getActiveCompanyId() })
        .select("id, sale_number")
        .single();
      if (saleError) throw saleError;

      const dbItems = saleItems.map((item) => ({ sale_id: sale.id, company_id: getActiveCompanyId(), ...item }));
      const { error: itemsError } = await client.from("sale_items").insert(dbItems);
      if (itemsError) throw itemsError;

      await client.rpc("fn_deduct_inventory", { p_sale_id: sale.id });

      playSuccess();
      clear();
      setSuccess({
        saleId: sale.id, saleNumber: sale.sale_number, total, change: receivedAmount - total,
        paymentMethod, received: receivedAmount,
        items: saleItems.map(i => ({ name: i.product_name, quantity: i.quantity, unitPrice: i.unit_price, subtotal: i.subtotal })),
      });
      // No auto-close — user decides when to close (may want to print receipt or comanda)
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar la venta");
    }
    finally { setProcessing(false); }
  }, [items, total, paymentMethod, processing, clear, onClose, register, receivedAmount]);

  if (!isOpen) return null;

  function handlePrint() {
    if (!success) return;
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const receiptData: ReceiptData = {
      businessName: activeCompany?.name || "Dulce Fresita",
      saleNumber: success.saleNumber,
      date: `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`,
      time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      items: success.items,
      total: success.total,
      paymentMethod: success.paymentMethod,
      received: success.received,
      change: success.change,
      cashierName: register?.opened_by || displayName || undefined,
    };
    printReceipt(receiptData);
  }

  // Success fullscreen
  if (success) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center gap-4 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle size={48} weight="fill" className="text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-default-800">Venta #{success.saleNumber}</p>
            <p className="text-4xl font-extrabold text-emerald-600 tabular-nums">{formatCOP(success.total)}</p>
            {success.change > 0 && (
              <p className="text-xl text-default-500 tabular-nums">Cambio: {formatCOP(success.change)}</p>
            )}
            <p className="text-lg italic text-default-400 mt-2 max-w-xs">&ldquo;{blessing}&rdquo;</p>
            <div className="flex gap-3 mt-4">
              <button onClick={handlePrint}
                className="flex items-center gap-2 h-14 px-8 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all">
                <Printer size={22} weight="bold" /> Imprimir
              </button>
              <button onClick={() => { setSuccess(null); onClose(); }}
                className="flex items-center gap-2 h-14 px-8 rounded-2xl bg-default-100 text-default-600 text-base font-bold hover:bg-default-200 active:scale-[0.97] transition-all">
                Cerrar
              </button>
            </div>
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
              onClick={() => { setPaymentMethod(id); playClick(); }}
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
                  onClick={() => { setReceivedAmount(amt); playClick(); }}
                  className={`flex-1 h-14 rounded-2xl text-base font-bold transition-all active:scale-95
                    ${receivedAmount === amt ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}
                >
                  {amt >= 1000 ? `$${amt / 1000}K` : formatCOP(amt)}
                </button>
              ))}
              <button
                onClick={() => { setReceivedAmount(total); playClick(); }}
                className={`flex-1 h-14 rounded-2xl text-base font-bold transition-all active:scale-95
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
            <div className="grid grid-cols-3 gap-2 mb-3 shrink-0 flex-1">
              {NUMPAD_KEYS.flat().map((key) => (
                <button
                  key={key}
                  onClick={() => handleNumpadKey(key)}
                  className={`flex items-center justify-center rounded-2xl text-2xl font-bold transition-all active:scale-95 select-none min-h-[4.5rem]
                    ${key === "DEL"
                      ? "bg-default-200 text-default-600 hover:bg-default-300"
                      : "bg-white border border-default-200 text-default-800 hover:bg-default-50"
                    }`}
                >
                  {key === "DEL" ? <Backspace size={28} weight="bold" /> : key}
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
