"use client";

import { useEffect, useState } from "react";
import { formatCOP } from "@/lib/utils/format";
import { playClick } from "@/lib/utils/sounds";
import { VirtualKeyboard } from "@/components/pos/VirtualKeyboard";
import {
  ArrowLeft,
  Money,
  DeviceMobile,
  Check,
  User,
  Phone,
  MapPin,
  Clock,
  NoteBlank,
} from "@phosphor-icons/react";

export type FieldId = "name" | "phone" | "address" | "notes";

export interface OrderInfo {
  orderType: "local" | "delivery";
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  scheduledTime: string;
  orderNotes: string;
  paymentMethod: "efectivo" | "nequi";
}

interface OrderInfoStepProps {
  itemCount: number;
  total: number;
  saving: boolean;
  info: OrderInfo;
  setInfo: (next: OrderInfo) => void;
  onBack: () => void;
  onCreate: () => void;
}

/**
 * Form to capture customer + delivery info before saving an order. Lifted out
 * of /pedidos/nuevo so the unified POS flow can use it too.
 *
 * The virtual keyboard only appears on desktop widths (≥1024px) — on a tablet
 * with a real keyboard or on a phone the native input handles itself.
 */
export function OrderInfoStep({
  itemCount,
  total,
  saving,
  info,
  setInfo,
  onBack,
  onCreate,
}: OrderInfoStepProps) {
  const [activeField, setActiveField] = useState<FieldId | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const showKeyboard = isDesktop && activeField !== null;

  function set<K extends keyof OrderInfo>(key: K, value: OrderInfo[K]) {
    setInfo({ ...info, [key]: value });
  }

  const fieldGetters: Record<FieldId, string> = {
    name: info.customerName,
    phone: info.customerPhone,
    address: info.deliveryAddress,
    notes: info.orderNotes,
  };
  const fieldKeys: Record<FieldId, keyof OrderInfo> = {
    name: "customerName",
    phone: "customerPhone",
    address: "deliveryAddress",
    notes: "orderNotes",
  };

  function handleKey(char: string) {
    if (!activeField) return;
    set(fieldKeys[activeField], (fieldGetters[activeField] + char) as never);
    playClick();
  }

  function handleDelete() {
    if (!activeField) return;
    set(fieldKeys[activeField], fieldGetters[activeField].slice(0, -1) as never);
  }

  function handleClear() {
    if (!activeField) return;
    set(fieldKeys[activeField], "" as never);
  }

  function handleFocus(field: FieldId) {
    if (isDesktop) setActiveField(field);
  }

  const inputClass = (field: FieldId) =>
    `w-full h-14 pl-10 pr-4 rounded-2xl border-2 bg-white text-base font-medium outline-none transition-all ${
      activeField === field ? "border-primary ring-1 ring-primary/20" : "border-default-200"
    }`;

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="bg-white border-b border-default-100 px-6 py-4 flex items-center gap-3">
        <button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all">
          <ArrowLeft size={22} className="text-default-600" />
        </button>
        <h1 className="text-lg font-bold text-default-800">{info.orderType === "local" ? "Pedido en local" : "Datos de entrega"}</h1>
        <span className="ml-auto text-xs font-bold text-default-400 bg-default-100 rounded-full px-2.5 py-1">
          {itemCount} productos · {formatCOP(total)}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-md mx-auto space-y-4">
          {/* Order type toggle */}
          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Tipo de pedido</label>
            <div className="flex gap-2">
              <button onClick={() => { set("orderType", "local"); playClick(); }}
                className={`flex-1 h-14 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                  ${info.orderType === "local" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-default-200 text-default-500"}`}>
                Local
              </button>
              <button onClick={() => { set("orderType", "delivery"); playClick(); }}
                className={`flex-1 h-14 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                  ${info.orderType === "delivery" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-default-200 text-default-500"}`}>
                Domicilio
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Nombre del cliente *</label>
            <div className="relative">
              <User size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
              <input value={info.customerName} onFocus={() => handleFocus("name")}
                onChange={(e) => set("customerName", e.target.value)}
                placeholder="Nombre completo" inputMode="text" autoComplete="name"
                className={inputClass("name")} />
            </div>
          </div>

          {info.orderType === "delivery" && (
            <>
              <div>
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Teléfono</label>
                <div className="relative">
                  <Phone size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
                  <input value={info.customerPhone} onFocus={() => handleFocus("phone")}
                    onChange={(e) => set("customerPhone", e.target.value)}
                    placeholder="300 123 4567" type="tel" inputMode="tel" autoComplete="tel"
                    className={inputClass("phone")} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Dirección de entrega</label>
                <div className="relative">
                  <MapPin size={20} weight="duotone" className="absolute left-3 top-4 text-default-400" />
                  <textarea value={info.deliveryAddress} onFocus={() => handleFocus("address")}
                    onChange={(e) => set("deliveryAddress", e.target.value)}
                    placeholder="Calle, barrio, referencia..." rows={2} inputMode="text" autoComplete="street-address"
                    className={`w-full pl-10 pr-4 py-3 rounded-2xl border-2 bg-white text-base font-medium outline-none transition-all resize-none ${
                      activeField === "address" ? "border-primary ring-1 ring-primary/20" : "border-default-200"
                    }`} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Hora de entrega</label>
                <div className="relative">
                  <Clock size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
                  <input value={info.scheduledTime} onChange={(e) => set("scheduledTime", e.target.value)} type="time"
                    onFocus={() => setActiveField(null)}
                    className="w-full h-14 pl-10 pr-4 rounded-2xl border-2 border-default-200 bg-white text-base font-medium outline-none focus:border-primary transition-all" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Método de pago</label>
            <p className="text-[11px] text-default-400 mb-2">Lo puedes cambiar al cobrar el pedido.</p>
            <div className="flex gap-2">
              <button onClick={() => { set("paymentMethod", "efectivo"); playClick(); }}
                className={`flex-1 h-14 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                  ${info.paymentMethod === "efectivo" ? "border-primary bg-primary/5 text-primary" : "border-default-200 text-default-500"}`}>
                <Money size={20} /> Efectivo
              </button>
              <button onClick={() => { set("paymentMethod", "nequi"); playClick(); }}
                className={`flex-1 h-14 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                  ${info.paymentMethod === "nequi" ? "border-primary bg-primary/5 text-primary" : "border-default-200 text-default-500"}`}>
                <DeviceMobile size={20} /> Nequi
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Notas</label>
            <div className="relative">
              <NoteBlank size={20} weight="duotone" className="absolute left-3 top-4 text-default-400" />
              <textarea value={info.orderNotes} onFocus={() => handleFocus("notes")}
                onChange={(e) => set("orderNotes", e.target.value)}
                placeholder="Instrucciones especiales..." rows={2}
                className={`w-full pl-10 pr-4 py-3 rounded-2xl border-2 bg-white text-base font-medium outline-none transition-all resize-none ${
                  activeField === "notes" ? "border-primary ring-1 ring-primary/20" : "border-default-200"
                }`} />
            </div>
          </div>
        </div>
      </div>

      {showKeyboard && (
        <VirtualKeyboard
          onKey={handleKey}
          onDelete={handleDelete}
          onClear={handleClear}
          onClose={() => setActiveField(null)}
        />
      )}

      {!showKeyboard && (
        <div className="bg-white border-t border-default-100 p-4">
          <button onClick={onCreate} disabled={saving || !info.customerName.trim()}
            className="w-full h-16 rounded-2xl bg-primary text-white text-xl font-bold shadow-lg shadow-primary/30 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? (
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Check size={24} weight="bold" /> Crear Pedido — {formatCOP(total)}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
