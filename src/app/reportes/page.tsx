"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";
import { formatCOP, formatDate, formatTime, localDayToUtcRange } from "@/lib/utils/format";
import {
  ChartLine,
  Receipt,
  Money,
  DeviceMobile,
  TrendUp,
  Trophy,
  CalendarBlank,
  XCircle,
} from "@phosphor-icons/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Sale {
  id: string;
  sale_number: number;
  total: number;
  payment_method: "efectivo" | "nequi";
  status: "completed" | "voided";
  created_at: string;
}

interface SaleItem {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface ChartPoint {
  label: string;
  total: number;
}

interface TopProduct {
  product_name: string;
  total_qty: number;
  total_revenue: number;
}

interface SaleRow {
  id: string;
  sale_number: number;
  total: number;
  payment_method: string;
  status: string;
  created_at: string;
  item_count: number;
}

type DateRange = "hoy" | "semana" | "mes" | "ultimo_mes";

const DATE_RANGE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "ultimo_mes", label: "Ultimo mes" },
];

/* ------------------------------------------------------------------ */
/* Date range helper                                                   */
/* ------------------------------------------------------------------ */

/** Local date → "YYYY-MM-DD" (avoids the UTC shift of toISOString). */
function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  const today = toLocalDateStr(now);

  if (range === "hoy") return { from: today, to: today };
  if (range === "semana") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { from: toLocalDateStr(weekAgo), to: today };
  }
  if (range === "mes") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toLocalDateStr(monthStart), to: today };
  }
  // ultimo mes
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    from: toLocalDateStr(lastMonthStart),
    to: toLocalDateStr(lastMonthEnd),
  };
}

/* ------------------------------------------------------------------ */
/* Page component                                                      */
/* ------------------------------------------------------------------ */

export default function ReportesPage() {
  const [range, setRange] = useState<DateRange>("hoy");
  const [loading, setLoading] = useState(true);

  // Overview
  const [totalVentas, setTotalVentas] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [voidedCount, setVoidedCount] = useState(0);

  // Chart
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  // Payment breakdown
  const [cashTotal, setCashTotal] = useState(0);
  const [nequiTotal, setNequiTotal] = useState(0);

  // Top products
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  // Sales table
  const [salesRows, setSalesRows] = useState<SaleRow[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const companyId = getActiveCompanyId();
    if (!companyId) { setLoading(false); return; }
    const { from, to } = getDateRange(range);
    // Convert local day boundaries to UTC range matching SQLite's created_at
    const { start: fromTs } = localDayToUtcRange(from);
    const { end: toTs } = localDayToUtcRange(to);

    // --- Fetch all sales in range ---
    const { data: salesData } = await supabase
      .from("sales")
      .select("id, sale_number, total, payment_method, status, created_at")
      .eq("company_id", companyId)
      .gte("created_at", fromTs)
      .lte("created_at", toTs)
      .order("created_at", { ascending: false });

    const sales: Sale[] = (salesData ?? []) as Sale[];
    const completed = sales.filter((s) => s.status === "completed");
    const voided = sales.filter((s) => s.status === "voided");

    // Overview
    const total = completed.reduce((sum, s) => sum + (s.total ?? 0), 0);
    setTotalVentas(total);
    setSalesCount(completed.length);
    setVoidedCount(voided.length);

    // Payment breakdown
    const cash = completed
      .filter((s) => s.payment_method === "efectivo")
      .reduce((sum, s) => sum + (s.total ?? 0), 0);
    const nequi = completed
      .filter((s) => s.payment_method === "nequi")
      .reduce((sum, s) => sum + (s.total ?? 0), 0);
    setCashTotal(cash);
    setNequiTotal(nequi);

    // --- Chart data ---
    if (range === "hoy") {
      // Hourly breakdown
      const hourMap: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourMap[h] = 0;
      completed.forEach((s) => {
        const hour = new Date(s.created_at).getHours();
        hourMap[hour] += s.total ?? 0;
      });
      // Only show hours from 6am to 10pm for readability
      const points: ChartPoint[] = [];
      for (let h = 6; h <= 22; h++) {
        points.push({
          label: `${h}:00`,
          total: hourMap[h] ?? 0,
        });
      }
      setChartData(points);
    } else {
      // Daily breakdown
      const dayMap: Record<string, number> = {};
      const start = new Date(from + "T12:00:00");
      const end = new Date(to + "T12:00:00");
      for (
        let d = new Date(start);
        d <= end;
        d.setDate(d.getDate() + 1)
      ) {
        dayMap[d.toISOString().split("T")[0]] = 0;
      }
      completed.forEach((s) => {
        const d = s.created_at?.split("T")[0];
        if (d && d in dayMap) dayMap[d] += s.total ?? 0;
      });
      setChartData(
        Object.entries(dayMap).map(([dateStr, val]) => {
          const dt = new Date(dateStr + "T12:00:00");
          const day = dt.getDate();
          const month = dt.toLocaleDateString("es-CO", { month: "short" });
          return { label: `${day} ${month}`, total: val };
        })
      );
    }

    // --- Top 10 products ---
    const { data: itemsData } = await supabase
      .from("sale_items")
      .select(
        "product_name, quantity, subtotal, sales!inner(status, created_at, company_id)"
      )
      .eq("sales.company_id", companyId)
      .gte("sales.created_at", fromTs)
      .lte("sales.created_at", toTs)
      .eq("sales.status", "completed");

    const productMap: Record<
      string,
      { product_name: string; total_qty: number; total_revenue: number }
    > = {};
    ((itemsData ?? []) as SaleItem[]).forEach((item) => {
      const key = item.product_name;
      if (!productMap[key]) {
        productMap[key] = {
          product_name: item.product_name,
          total_qty: 0,
          total_revenue: 0,
        };
      }
      productMap[key].total_qty += item.quantity ?? 0;
      productMap[key].total_revenue += item.subtotal ?? 0;
    });
    const sorted = Object.values(productMap)
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, 10);
    setTopProducts(sorted);

    // --- Sales table rows ---
    // Count items per sale
    const saleIds = sales.map((s) => s.id);
    let itemCountMap: Record<string, number> = {};
    if (saleIds.length > 0) {
      const { data: countData } = await supabase
        .from("sale_items")
        .select("sale_id, quantity, sales!inner(company_id)")
        .eq("sales.company_id", companyId)
        .in("sale_id", saleIds);
      ((countData ?? []) as { sale_id: string; quantity: number }[]).forEach(
        (row) => {
          itemCountMap[row.sale_id] =
            (itemCountMap[row.sale_id] ?? 0) + (row.quantity ?? 1);
        }
      );
    }
    setSalesRows(
      sales.map((s) => ({
        id: s.id,
        sale_number: s.sale_number,
        total: s.total,
        payment_method: s.payment_method,
        status: s.status,
        created_at: s.created_at,
        item_count: itemCountMap[s.id] ?? 0,
      }))
    );

    setLoading(false);
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------------------------------------------------------------- */
  /* Loading state                                                     */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const avgSale = salesCount > 0 ? Math.round(totalVentas / salesCount) : 0;
  const grandTotal = cashTotal + nequiTotal;
  const cashPct = grandTotal > 0 ? Math.round((cashTotal / grandTotal) * 100) : 0;
  const nequiPct = grandTotal > 0 ? 100 - cashPct : 0;

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-default-800">Reportes</h1>

        {/* Date range pills */}
        <div className="flex flex-wrap gap-2">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`h-11 px-4 rounded-xl text-sm font-semibold transition-colors ${
                range === opt.key
                  ? "bg-primary text-white"
                  : "bg-default-100 text-default-600 active:bg-default-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview cards 2x2 */}
      <div className="grid grid-cols-2 gap-4">
        <OverviewCard
          label="Total ventas"
          value={formatCOP(totalVentas)}
          icon={<Money size={24} weight="duotone" />}
          accent="primary"
        />
        <OverviewCard
          label="# Ventas"
          value={String(salesCount)}
          icon={<Receipt size={24} weight="duotone" />}
          accent="default"
        />
        <OverviewCard
          label="Promedio por venta"
          value={formatCOP(avgSale)}
          icon={<TrendUp size={24} weight="duotone" />}
          accent="default"
        />
        <OverviewCard
          label="Ventas anuladas"
          value={String(voidedCount)}
          icon={<XCircle size={24} weight="duotone" />}
          accent={voidedCount > 0 ? "red" : "default"}
        />
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl bg-white border border-default-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ChartLine size={18} weight="duotone" className="text-default-400" />
          <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
            {range === "hoy" ? "Ventas por hora" : "Ventas por dia"}
          </p>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-default-400 py-12 text-center">
            Sin datos en este periodo
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e84c65" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#e84c65" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f4f4f5"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
                width={40}
              />
              <Tooltip
                formatter={(value) => [formatCOP(Number(value ?? 0)), "Ventas"]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  fontSize: 13,
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#e84c65"
                strokeWidth={2.5}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Payment breakdown + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment method breakdown */}
        <div className="rounded-2xl bg-white border border-default-100 p-5">
          <p className="text-xs font-bold text-default-500 uppercase tracking-wider mb-4">
            Metodos de pago
          </p>
          <div className="space-y-4">
            {/* Efectivo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Money
                    size={20}
                    weight="duotone"
                    className="text-emerald-600"
                  />
                  <span className="text-sm font-semibold text-default-700">
                    Efectivo
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums font-extrabold text-default-800">
                    {formatCOP(cashTotal)}
                  </span>
                  <span className="text-xs tabular-nums font-bold text-default-400">
                    {cashPct}%
                  </span>
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-default-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${cashPct}%` }}
                />
              </div>
            </div>

            {/* Nequi */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DeviceMobile
                    size={20}
                    weight="duotone"
                    className="text-purple-600"
                  />
                  <span className="text-sm font-semibold text-default-700">
                    Nequi
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums font-extrabold text-default-800">
                    {formatCOP(nequiTotal)}
                  </span>
                  <span className="text-xs tabular-nums font-bold text-default-400">
                    {nequiPct}%
                  </span>
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-default-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${nequiPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top 10 products */}
        <div className="rounded-2xl bg-white border border-default-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy
              size={18}
              weight="duotone"
              className="text-default-400"
            />
            <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
              Top 10 productos
            </p>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-default-400 py-6 text-center">
              Sin ventas en este periodo
            </p>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, i) => {
                const rank = i + 1;
                const isTop3 = rank <= 3;
                const rankColors = [
                  "bg-amber-100 text-amber-700",
                  "bg-gray-100 text-gray-600",
                  "bg-orange-100 text-orange-700",
                ];
                return (
                  <div
                    key={p.product_name}
                    className="flex items-center gap-3"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isTop3
                          ? rankColors[rank - 1]
                          : "bg-default-100 text-default-500"
                      }`}
                    >
                      {rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm truncate ${
                          isTop3
                            ? "font-bold text-default-800"
                            : "font-semibold text-default-700"
                        }`}
                      >
                        {p.product_name}
                      </p>
                      <p className="text-xs text-default-400">
                        {p.total_qty} uds
                      </p>
                    </div>
                    <p className="text-sm tabular-nums font-extrabold text-default-700">
                      {formatCOP(p.total_revenue)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sales table */}
      <div className="rounded-2xl bg-white border border-default-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarBlank
            size={18}
            weight="duotone"
            className="text-default-400"
          />
          <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
            Detalle de ventas
          </p>
        </div>
        {salesRows.length === 0 ? (
          <p className="text-sm text-default-400 py-6 text-center">
            Sin ventas en este periodo
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-default-100">
                  <th className="text-left px-5 py-2 text-xs font-bold text-default-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-default-500 uppercase tracking-wider">
                    Fecha / Hora
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-default-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-default-500 uppercase tracking-wider">
                    Metodo
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-default-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-center px-5 py-2 text-xs font-bold text-default-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((sale) => {
                  const isVoided = sale.status === "voided";
                  return (
                    <tr
                      key={sale.id}
                      className={`border-b border-default-50 ${
                        isVoided ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-5 py-2.5 tabular-nums font-semibold text-default-600">
                        {sale.sale_number}
                      </td>
                      <td className="px-3 py-2.5 text-default-600">
                        <span className="block">
                          {formatDate(sale.created_at)}
                        </span>
                        <span className="text-xs text-default-400">
                          {formatTime(sale.created_at)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-default-600">
                        {sale.item_count}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
                            sale.payment_method === "nequi"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {sale.payment_method === "nequi" ? (
                            <DeviceMobile size={14} weight="duotone" />
                          ) : (
                            <Money size={14} weight="duotone" />
                          )}
                          {sale.payment_method === "nequi"
                            ? "Nequi"
                            : "Efectivo"}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-extrabold ${
                          isVoided
                            ? "text-red-500 line-through"
                            : "text-default-800"
                        }`}
                      >
                        {formatCOP(sale.total)}
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        {isVoided ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                            <XCircle size={14} weight="duotone" />
                            Anulada
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                            Completada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview card sub-component                                         */
/* ------------------------------------------------------------------ */

function OverviewCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "primary" | "default" | "red";
}) {
  const styles = {
    primary: {
      bg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-primary",
    },
    default: {
      bg: "bg-default-100",
      iconColor: "text-default-600",
      valueColor: "text-default-800",
    },
    red: {
      bg: "bg-red-50",
      iconColor: "text-red-600",
      valueColor: "text-red-600",
    },
  };

  const s = styles[accent];

  return (
    <div className="rounded-2xl bg-white border border-default-100 p-5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg} ${s.iconColor} mb-3`}
      >
        {icon}
      </div>
      <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-xl tabular-nums font-extrabold mt-0.5 ${s.valueColor}`}
      >
        {value}
      </p>
    </div>
  );
}
