"use client";

import { useEffect, useState, useCallback } from "react";
import { useCaja } from "@/contexts/CajaContext";
import { createClient } from "@/lib/supabase/client";
import { getActiveCompanyId } from "@/lib/supabase/company";
import { formatCOP, formatTime } from "@/lib/utils/format";
import { VoidSaleModal } from "./VoidSaleModal";
import { Money, DeviceMobile, Receipt, Prohibit, ArrowsClockwise, CaretLeft, CaretRight, CalendarBlank } from "@phosphor-icons/react";

interface SaleRecord {
  id: string;
  sale_number: number;
  total: number;
  payment_method: string;
  status: string;
  voided_reason: string | null;
  created_at: string;
  items: { product_name: string; quantity: number; subtotal: number }[];
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const todayStr = toLocalDateStr(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === todayStr) return "Hoy";
  if (dateStr === toLocalDateStr(yesterday)) return "Ayer";
  return date.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}

export function SalesHistory() {
  const { register } = useCaja();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voidSale, setVoidSale] = useState<{ id: string; sale_number: number; total: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()));

  const loadSales = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const companyId = getActiveCompanyId();

    const startOfDay = `${selectedDate}T00:00:00`;
    const endOfDay = `${selectedDate}T23:59:59`;

    let query = supabase
      .from("sales")
      .select("id, sale_number, total, payment_method, status, voided_reason, created_at")
      .eq("company_id", companyId)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false });

    if (register && selectedDate === toLocalDateStr(new Date())) {
      query = query.eq("register_id", register.id);
    }

    const { data } = await query;
    if (!data || data.length === 0) { setSales([]); setLoading(false); return; }

    const saleIds = data.map((s) => s.id);
    const { data: allItems } = await supabase
      .from("sale_items")
      .select("sale_id, product_name, quantity, subtotal")
      .eq("company_id", companyId)
      .in("sale_id", saleIds);

    const itemsMap = new Map<string, { product_name: string; quantity: number; subtotal: number }[]>();
    for (const item of allItems ?? []) {
      const list = itemsMap.get(item.sale_id) ?? [];
      list.push(item);
      itemsMap.set(item.sale_id, list);
    }

    setSales(data.map((sale) => ({ ...sale, items: itemsMap.get(sale.id) ?? [] })));
    setLoading(false);
  }, [register, selectedDate]);

  useEffect(() => { loadSales(); }, [loadSales]);

  function goDay(offset: number) {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offset);
    setSelectedDate(toLocalDateStr(date));
  }

  const isToday = selectedDate === toLocalDateStr(new Date());
  const completedSales = sales.filter((s) => s.status === "completed");
  const totalSales = completedSales.reduce((s, sale) => s + sale.total, 0);

  return (
    <div className="space-y-4">
      {/* Date nav + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => goDay(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl text-default-400 hover:bg-default-100 transition-all">
            <CaretLeft size={16} weight="bold" />
          </button>
          <button
            onClick={() => setSelectedDate(toLocalDateStr(new Date()))}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${isToday ? "bg-primary/10 text-primary" : "text-default-700 hover:bg-default-100"}`}
          >
            {formatDateLabel(selectedDate)}
          </button>
          <button onClick={() => goDay(1)} disabled={isToday} className="flex h-9 w-9 items-center justify-center rounded-xl text-default-400 hover:bg-default-100 transition-all disabled:opacity-20">
            <CaretRight size={16} weight="bold" />
          </button>

          <label className="relative flex h-9 items-center rounded-xl border border-default-200 bg-white px-3 hover:border-primary transition-all cursor-pointer">
            <CalendarBlank size={14} weight="bold" className="text-default-400 mr-1.5" />
            <input
              type="date"
              value={selectedDate}
              max={toLocalDateStr(new Date())}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="text-xs font-medium text-default-600 bg-transparent outline-none cursor-pointer"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-default-400">{completedSales.length} ventas · <span className="font-bold text-default-700">{formatCOP(totalSales)}</span></span>
          <button onClick={loadSales} className="flex h-9 w-9 items-center justify-center rounded-xl text-default-400 hover:bg-default-100 transition-all">
            <ArrowsClockwise size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="h-6 w-6 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-default-300">
          <Receipt size={48} weight="duotone" className="mb-3" />
          <p className="text-sm text-default-400">No hay ventas {isToday ? "en este turno" : `el ${formatDateLabel(selectedDate)}`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sales.map((sale) => {
            const isVoided = sale.status === "voided";
            const isExpanded = expandedId === sale.id;

            return (
              <div key={sale.id} className={`rounded-2xl border overflow-hidden transition-all ${isVoided ? "bg-red-50/50 border-red-200" : "bg-white border-default-100"}`}>
                {/* Sale row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-default-50/50 transition-colors"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${isVoided ? "bg-red-100" : "bg-default-100"}`}>
                    {isVoided ? (
                      <Prohibit size={20} weight="bold" className="text-red-500" />
                    ) : sale.payment_method === "efectivo" ? (
                      <Money size={20} weight="duotone" className="text-default-500" />
                    ) : (
                      <DeviceMobile size={20} weight="duotone" className="text-default-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${isVoided ? "text-red-500 line-through" : "text-default-800"}`}>
                      Venta #{sale.sale_number}
                    </p>
                    <p className="text-xs text-default-400">
                      {formatTime(sale.created_at)} · {sale.payment_method === "efectivo" ? "Efectivo" : "Nequi"}
                      {isVoided && <span className="text-red-500 ml-1">· Anulada</span>}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-base font-bold tabular-nums ${isVoided ? "text-red-400 line-through" : "text-default-900"}`}>
                      {formatCOP(sale.total)}
                    </span>
                    <p className="text-[10px] text-default-400">{sale.items.length} productos</p>
                  </div>
                </button>

                {/* Expanded — same style as checkout summary */}
                {isExpanded && (
                  <div className="border-t border-default-100 bg-default-50/30 animate-in fade-in duration-150">
                    <div className="p-4 space-y-1">
                      {sale.items.map((item, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 py-1.5">
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

                    {/* Total */}
                    <div className="border-t border-default-100 px-4 py-3 flex justify-between items-center">
                      <span className="text-sm text-default-500">Total</span>
                      <span className="text-xl font-extrabold text-default-900 tabular-nums">{formatCOP(sale.total)}</span>
                    </div>

                    {/* Voided reason */}
                    {isVoided && sale.voided_reason && (
                      <div className="px-4 pb-3">
                        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-xs text-red-600">
                            <span className="font-bold">Razón:</span> {sale.voided_reason}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Void button */}
                    {!isVoided && (
                      <div className="px-4 pb-3">
                        <button
                          onClick={() => setVoidSale({ id: sale.id, sale_number: sale.sale_number, total: sale.total })}
                          className="w-full h-11 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                        >
                          <Prohibit size={16} weight="bold" />
                          Anular esta venta
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <VoidSaleModal
        isOpen={!!voidSale}
        sale={voidSale}
        onClose={() => setVoidSale(null)}
        onVoided={loadSales}
      />
    </div>
  );
}
