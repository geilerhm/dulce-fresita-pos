"use client";

/**
 * Same UX as the POS CheckoutModal but for a pending order: pre-loads items
 * and total from the order, lets the cashier change the payment method,
 * collects cash + computes change, then calls fn_complete_order which:
 *   1. Creates the sale + sale_items
 *   2. Deducts inventory
 *   3. Marks the order as delivered
 * After that, the printable receipt is shown (same path as POS).
 *
 * This is the "skip the whole preparing/ready/delivering dance" path the
 * cashier asked for: from a pending order to a printed receipt in 2 clicks.
 */

import { formatCOP } from "@/lib/utils/format";
import { Money, DeviceMobile, Backspace, ArrowLeft, Check, CheckCircle, Printer } from "@phosphor-icons/react";
import { printReceipt, type ReceiptData, type ReceiptItem } from "@/components/pos/Receipt";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/db/client";
import { playSuccess, playAdd, playClick } from "@/lib/utils/sounds";
import { pickRandomBlessing } from "@/lib/utils/blessing-phrases";
import { toast } from "@/lib/utils/toast";
import { useCaja } from "@/contexts/CajaContext";
import type { PaymentMethod } from "@/lib/utils/constants";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface OrderForCheckout {
  id: string;
  order_number: number;
  customer_name: string;
  payment_method: string;
  total: number;
  items: OrderItem[];
}

interface OrderCheckoutModalProps {
  isOpen: boolean;
  order: OrderForCheckout | null;
  onClose: () => void;
  /** Called after the sale completes successfully (close + refresh list). */
  onCompleted: () => void;
}

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];
const NUMPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["00", "0", "DEL"],
];

interface SuccessData {
  saleNumber: number;
  total: number;
  change: number;
  paymentMethod: PaymentMethod;
  received: number;
  receiptItems: ReceiptItem[];
}

export function OrderCheckoutModal({ isOpen, order, onClose, onCompleted }: OrderCheckoutModalProps) {
  const { register } = useCaja();
  const { displayName, activeCompany } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const blessing = useMemo(() => pickRandomBlessing(), []);

  const total = order?.total ?? 0;
  const itemCount = (order?.items ?? []).reduce((s, i) => s + i.quantity, 0);
  const change = receivedAmount - total;
  const digits = receivedAmount > 0 ? String(receivedAmount) : "";

  // Initial state per-open. Re-seed payment method from the order's recorded
  // choice so the cashier sees what the customer originally said, but they
  // can change it before confirming.
  useEffect(() => {
    if (isOpen && order) {
      setReceivedAmount(0);
      setPaymentMethod((order.payment_method as PaymentMethod) || "efectivo");
      setSuccess(null);
    }
  }, [isOpen, order]);

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
    if (!order || processing) return;
    if (paymentMethod === "efectivo" && receivedAmount < total) {
      toast.error(`Faltan ${formatCOP(total - receivedAmount)} para completar el pago`);
      return;
    }
    setProcessing(true);

    try {
      const client = createClient();

      // If the cashier changed the payment method, persist it before the RPC
      // so fn_complete_order copies the right value onto the sale.
      if (paymentMethod !== order.payment_method) {
        await client.from("orders").update({ payment_method: paymentMethod }).eq("id", order.id);
      }

      const { data: rpcData, error } = await client.rpc("fn_complete_order", { p_order_id: order.id });
      if (error || !rpcData) throw new Error(error?.message || "RPC failed");

      const { saleNumber } = rpcData as { saleId: string; saleNumber: number };

      const receiptItems: ReceiptItem[] = order.items.map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        subtotal: i.subtotal,
      }));

      playSuccess();
      setSuccess({
        saleNumber,
        total,
        change: receivedAmount - total,
        paymentMethod,
        received: receivedAmount,
        receiptItems,
      });
    } catch (e) {
      console.error(e);
      toast.error("Error al cobrar el pedido");
    } finally {
      setProcessing(false);
    }
  }, [order, total, paymentMethod, processing, receivedAmount]);

  async function handlePrint() {
    if (!success || printing) return;
    setPrinting(true);
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const receiptData: ReceiptData = {
      businessName: activeCompany?.name || "Dulce Fresita",
      saleNumber: success.saleNumber,
      date: `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`,
      time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      items: success.receiptItems,
      total: success.total,
      paymentMethod: success.paymentMethod,
      received: success.received,
      change: success.change,
      cashierName: register?.opened_by || displayName || undefined,
    };
    try {
      await printReceipt(receiptData);
    } finally {
      setPrinting(false);
      setSuccess(null);
      onCompleted();
    }
  }

  if (!isOpen || !order) return null;

  // Success fullscreen — same as POS so the cashier feels at home.
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center gap-4 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle size={48} weight="fill" className="text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-default-800">Venta #{success.saleNumber}</p>
          <p className="text-sm font-medium text-default-400">Pedido #{order.order_number} · {order.customer_name}</p>
          <p className="text-4xl font-extrabold text-emerald-600 tabular-nums">{formatCOP(success.total)}</p>
          {success.change > 0 && (
            <p className="text-xl text-default-500 tabular-nums">Cambio: {formatCOP(success.change)}</p>
          )}
          <p className="text-lg italic text-default-400 mt-2 max-w-xs">&ldquo;{blessing}&rdquo;</p>
          <div className="flex gap-3 mt-4">
            <button onClick={handlePrint} disabled={printing}
              className="flex items-center gap-2 h-14 px-8 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-60 disabled:pointer-events-none">
              {printing ? (
                <>
                  <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Imprimiendo...
                </>
              ) : (
                <>
                  <Printer size={22} weight="bold" /> Imprimir
                </>
              )}
            </button>
            <button onClick={() => { setSuccess(null); onCompleted(); }} disabled={printing}
              className="flex items-center gap-2 h-14 px-8 rounded-2xl bg-default-100 text-default-600 text-base font-bold hover:bg-default-200 active:scale-[0.97] transition-all disabled:opacity-60 disabled:pointer-events-none">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-white">
      {/* LEFT — Order summary */}
      <div className="w-[45%] flex flex-col border-r border-default-100 bg-gray-50">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-default-100 bg-white shrink-0">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-default-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-default-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-default-400 uppercase tracking-wider">Cobrar pedido</p>
            <h2 className="text-lg font-bold text-default-800 line-clamp-1">#{order.order_number} · {order.customer_name}</h2>
          </div>
          <span className="ml-auto text-xs font-bold text-default-400 bg-default-100 rounded-full px-2.5 py-1">
            {itemCount} items
          </span>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto p-5 space-y-1">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 py-1.5">
              <span className="text-sm font-medium text-default-700 line-clamp-1 flex-1 min-w-0">
                {item.quantity > 1 && <span className="text-default-400 tabular-nums">{item.quantity}× </span>}
                {item.product_name}
              </span>
              <span className="text-sm font-bold text-default-800 shrink-0 tabular-nums">
                {formatCOP(item.subtotal)}
              </span>
            </div>
          ))}
        </div>

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

        {paymentMethod === "efectivo" && (
          <div className="flex-1 flex flex-col">
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

            <button
              onClick={() => setReceivedAmount(0)}
              className="w-full rounded-2xl bg-default-50 border border-default-100 px-5 py-3 text-center mb-3 hover:bg-default-100 transition-colors shrink-0"
            >
              <p className="text-[10px] font-bold text-default-400 uppercase tracking-wider mb-0.5">Efectivo recibido</p>
              <p className={`text-3xl font-extrabold tabular-nums ${receivedAmount > 0 ? "text-default-900" : "text-default-300"}`}>
                {receivedAmount > 0 ? formatCOP(receivedAmount) : "$ 0"}
              </p>
            </button>

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

        {paymentMethod === "nequi" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <DeviceMobile size={48} weight="duotone" className="text-primary mb-4" />
            <p className="text-lg font-bold text-default-800 mb-1">Pago por Nequi</p>
            <p className="text-sm text-default-400 mb-2">Confirma que recibiste el pago</p>
            <p className="text-3xl font-extrabold text-primary tabular-nums">{formatCOP(total)}</p>
          </div>
        )}

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
              Cobrar {formatCOP(total)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
