"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";
import { formatCOP, formatDate, formatTime } from "@/lib/utils/format";
import { Clock, TrendUp, TrendDown, Minus, CheckCircle } from "@phosphor-icons/react";

interface HistoryItem {
  id: string;
  opened_at: string;
  closed_at: string;
  initial_cash: number;
  final_cash_expected: number;
  final_cash_actual: number;
  notes: string | null;
  total_sales: number;
  sales_count: number;
}

export function RegisterHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const companyId = getActiveCompanyId();

      // Get registers with sales count+total in a single batch
      const { data: registers } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(30);

      if (!registers || registers.length === 0) { setLoading(false); return; }

      // Batch: get all sales for these registers in one query
      const regIds = registers.map((r: any) => r.id);
      const { data: allSales } = await supabase
        .from("sales")
        .select("register_id, total")
        .eq("company_id", companyId)
        .in("register_id", regIds)
        .eq("status", "completed");

      // Group sales by register
      const salesMap = new Map<string, { total: number; count: number }>();
      for (const sale of allSales ?? []) {
        const existing = salesMap.get(sale.register_id) ?? { total: 0, count: 0 };
        existing.total += sale.total;
        existing.count++;
        salesMap.set(sale.register_id, existing);
      }

      const items: HistoryItem[] = registers.map((reg: any) => {
        const sales = salesMap.get(reg.id) ?? { total: 0, count: 0 };
        return { ...reg, total_sales: sales.total, sales_count: sales.count };
      });

      setHistory(items);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-6 w-6 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-default-300">
        <Clock size={48} weight="duotone" className="mb-3" />
        <p className="text-sm text-default-400">No hay registros anteriores</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item) => {
        const diff = item.final_cash_actual - item.final_cash_expected;
        return (
          <div key={item.id} className="rounded-2xl bg-white border border-default-100 p-5 hover:shadow-sm transition-shadow">
            {/* Date and time */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-default-800">{formatDate(item.closed_at)}</p>
              <p className="text-xs text-default-400 tabular-nums">
                {formatTime(item.opened_at)} — {formatTime(item.closed_at)}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1">
                <p className="text-xs text-default-400">Ventas</p>
                <p className="text-lg font-bold text-default-900 tabular-nums">{formatCOP(item.total_sales)}</p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-default-400">Base</p>
                <p className="text-sm font-semibold text-default-600 tabular-nums">{formatCOP(item.initial_cash)}</p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-default-400"># Ventas</p>
                <p className="text-sm font-semibold text-default-600 tabular-nums">{item.sales_count}</p>
              </div>
            </div>

            {/* Difference */}
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm
              ${diff === 0
                ? "bg-emerald-50 text-emerald-700"
                : diff > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-600"
              }`}>
              {diff === 0
                ? <CheckCircle size={16} weight="fill" />
                : diff > 0
                  ? <TrendUp size={16} weight="bold" />
                  : <TrendDown size={16} weight="bold" />
              }
              <span className="font-semibold">
                {diff === 0 ? "Cuadra perfecto" : diff > 0 ? `Sobrante ${formatCOP(diff)}` : `Faltante ${formatCOP(Math.abs(diff))}`}
              </span>
            </div>

            {item.notes && (
              <p className="mt-2 text-xs text-default-400 italic">{item.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
