"use client";

import { useEffect, useState, useCallback } from "react";
import { useCaja } from "@/contexts/CajaContext";
import { createClient } from "@/lib/supabase/client";
import { getActiveCompanyId } from "@/lib/supabase/company";
import { formatCOP, formatTime } from "@/lib/utils/format";
import { VoidSaleModal } from "./VoidSaleModal";
import { Money, DeviceMobile, Receipt, Prohibit, ArrowsClockwise } from "@phosphor-icons/react";

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

export function SalesHistory() {
  const { register } = useCaja();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voidSale, setVoidSale] = useState<{ id: string; sale_number: number; total: number } | null>(null);

  const loadSales = useCallback(async () => {
    if (!register) { setSales([]); setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    const companyId = getActiveCompanyId();

    const { data } = await supabase
      .from("sales")
      .select("id, sale_number, total, payment_method, status, voided_reason, created_at")
      .eq("company_id", companyId)
      .eq("register_id", register.id)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Load items for each sale
    const salesWithItems: SaleRecord[] = [];
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

    for (const sale of data) {
      salesWithItems.push({ ...sale, items: itemsMap.get(sale.id) ?? [] });
    }

    setSales(salesWithItems);
    setLoading(false);
  }, [register]);

  useEffect(() => { loadSales(); }, [loadSales]);

  if (!register) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-default-300">
        <Receipt size={48} weight="duotone" className="mb-3" />
        <p className="text-sm text-default-400">Abre la caja para ver las ventas</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="h-6 w-6 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-default-500">{sales.length} ventas en este turno</p>
        <button
          onClick={loadSales}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-default-400 hover:bg-default-100 transition-all"
        >
          <ArrowsClockwise size={16} />
        </button>
      </div>

      {sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-default-300">
          <Receipt size={48} weight="duotone" className="mb-3" />
          <p className="text-sm text-default-400">No hay ventas aun</p>
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
                  {/* Payment icon */}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${isVoided ? "bg-red-100" : "bg-default-100"}`}>
                    {isVoided ? (
                      <Prohibit size={20} weight="bold" className="text-red-500" />
                    ) : sale.payment_method === "efectivo" ? (
                      <Money size={20} weight="duotone" className="text-default-500" />
                    ) : (
                      <DeviceMobile size={20} weight="duotone" className="text-default-500" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${isVoided ? "text-red-500 line-through" : "text-default-800"}`}>
                      Venta #{sale.sale_number}
                    </p>
                    <p className="text-xs text-default-400">
                      {formatTime(sale.created_at)} · {sale.payment_method === "efectivo" ? "Efectivo" : "Nequi"}
                      {isVoided && <span className="text-red-500 ml-1">· Anulada</span>}
                    </p>
                  </div>

                  {/* Total */}
                  <span className={`text-base font-bold tabular-nums shrink-0 ${isVoided ? "text-red-400 line-through" : "text-default-900"}`}>
                    {formatCOP(sale.total)}
                  </span>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-default-100 px-4 py-3 space-y-3 bg-default-50/30 animate-in fade-in duration-150">
                    {/* Items */}
                    <div className="space-y-1">
                      {sale.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-default-600">
                            {item.quantity > 1 && <span className="text-default-400">{item.quantity}× </span>}
                            {item.product_name}
                          </span>
                          <span className="text-default-600 tabular-nums">{formatCOP(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Voided reason */}
                    {isVoided && sale.voided_reason && (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-xs text-red-600">
                          <span className="font-bold">Razon:</span> {sale.voided_reason}
                        </p>
                      </div>
                    )}

                    {/* Void button */}
                    {!isVoided && (
                      <button
                        onClick={() => setVoidSale({ id: sale.id, sale_number: sale.sale_number, total: sale.total })}
                        className="w-full h-11 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                      >
                        <Prohibit size={16} weight="bold" />
                        Anular esta venta
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Void modal */}
      <VoidSaleModal
        isOpen={!!voidSale}
        sale={voidSale}
        onClose={() => setVoidSale(null)}
        onVoided={loadSales}
      />
    </div>
  );
}
