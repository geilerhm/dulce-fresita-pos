"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";
import { formatCOP } from "@/lib/utils/format";
import { ProductIcon } from "@/lib/utils/product-icons";
import {
  ShoppingCart,
  Receipt,
  Money,
  DeviceMobile,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

interface TopProduct {
  product_name: string;
  icon: string | null;
  total_qty: number;
  total_revenue: number;
}

interface LowStockItem {
  id: string;
  name: string;
  stock_quantity: number;
  min_stock: number;
  unit: string;
}

interface WeekDay {
  day: string;
  total: number;
}

export default function DashboardPage() {
  const [totalSales, setTotalSales] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [nequiTotal, setNequiTotal] = useState(0);
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    async function fetchData() {
      const companyId = getActiveCompanyId();
      if (!companyId) { setLoading(false); return; }

      // --- Today's sales ---
      const { data: todaySales } = await supabase
        .from("sales")
        .select("total, payment_method")
        .eq("company_id", companyId)
        .eq("status", "completed")
        .gte("created_at", today);

      const sales = todaySales ?? [];
      setTotalSales(sales.reduce((s: any, r: any) => s + (r.total ?? 0), 0));
      setSalesCount(sales.length);

      const efectivo = sales
        .filter((r: any) => r.payment_method === "efectivo")
        .reduce((s: any, r: any) => s + (r.total ?? 0), 0);
      const nequi = sales
        .filter((r: any) => r.payment_method === "nequi")
        .reduce((s: any, r: any) => s + (r.total ?? 0), 0);

      setNequiTotal(nequi);

      // --- Open register initial cash ---
      const { data: openRegister } = await supabase
        .from("cash_registers")
        .select("initial_cash")
        .eq("company_id", companyId)
        .eq("status", "open")
        .limit(1)
        .maybeSingle();

      setCashTotal(efectivo + (openRegister?.initial_cash ?? 0));

      // --- Weekly sales (last 7 days) ---
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      const weekStartStr = weekStart.toISOString().split("T")[0];

      const { data: weekSales } = await supabase
        .from("sales")
        .select("total, created_at")
        .eq("company_id", companyId)
        .eq("status", "completed")
        .gte("created_at", weekStartStr);

      // Group by date
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - 6 + i);
        dayMap[d.toISOString().split("T")[0]] = 0;
      }
      (weekSales ?? []).forEach((s: any) => {
        const d = s.created_at?.split("T")[0];
        if (d && d in dayMap) dayMap[d] += s.total ?? 0;
      });

      setWeekData(
        Object.entries(dayMap).map(([dateStr, total]) => ({
          day: DAY_NAMES[new Date(dateStr + "T12:00:00").getDay()],
          total,
        }))
      );

      // --- Top 5 products today ---
      const { data: todayItems } = await supabase
        .from("sale_items")
        .select("product_name, product_id, quantity, subtotal, sales!inner(status, created_at, company_id)")
        .eq("sales.company_id", companyId)
        .gte("sales.created_at", today)
        .eq("sales.status", "completed");

      const productMap: Record<
        string,
        { product_name: string; product_id: string; total_qty: number; total_revenue: number }
      > = {};
      (todayItems ?? []).forEach((item: any) => {
        const key = item.product_id ?? item.product_name;
        if (!productMap[key]) {
          productMap[key] = {
            product_name: item.product_name,
            product_id: item.product_id,
            total_qty: 0,
            total_revenue: 0,
          };
        }
        productMap[key].total_qty += item.quantity ?? 0;
        productMap[key].total_revenue += item.subtotal ?? 0;
      });

      const sorted = Object.values(productMap)
        .sort((a, b) => b.total_qty - a.total_qty)
        .slice(0, 5);

      // Fetch icons for those products
      const productIds = sorted.map((p: any) => p.product_id).filter(Boolean);
      let iconMap: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, icon")
          .eq("company_id", companyId)
          .in("id", productIds);
        (prods ?? []).forEach((p: any) => {
          if (p.icon) iconMap[p.id] = p.icon;
        });
      }

      setTopProducts(
        sorted.map((p) => ({
          product_name: p.product_name,
          icon: iconMap[p.product_id] ?? null,
          total_qty: p.total_qty,
          total_revenue: p.total_revenue,
        }))
      );

      // --- Low stock ---
      const { data: lowStockData } = await supabase
        .from("ingredients")
        .select("id, name, stock_quantity, min_stock, unit")
        .eq("company_id", companyId)
        .eq("active", true)
        .gt("min_stock", 0);

      const alerts = (lowStockData ?? []).filter(
        (i: any) => i.stock_quantity <= i.min_stock
      );
      setLowStock(alerts);

      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 space-y-6">
      {/* Page title */}
      <h1 className="text-2xl font-extrabold text-default-800">
        Resumen del dia
      </h1>

      {/* Summary cards 2x2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryCard
          label="Ventas hoy"
          value={formatCOP(totalSales)}
          icon={<ShoppingCart size={24} weight="duotone" />}
          bgColor="bg-primary/10"
          iconColor="text-primary"
        />
        <SummaryCard
          label="# Ventas"
          value={String(salesCount)}
          icon={<Receipt size={24} weight="duotone" />}
          bgColor="bg-default-100"
          iconColor="text-default-600"
        />
        <SummaryCard
          label="Efectivo en caja"
          value={formatCOP(cashTotal)}
          icon={<Money size={24} weight="duotone" />}
          bgColor="bg-blue-50"
          iconColor="text-blue-700"
        />
        <SummaryCard
          label="Nequi hoy"
          value={formatCOP(nequiTotal)}
          icon={<DeviceMobile size={24} weight="duotone" />}
          bgColor="bg-purple-50"
          iconColor="text-purple-700"
        />
      </div>

      {/* Weekly sales chart */}
      <div className="rounded-2xl bg-white border border-default-100 p-5">
        <p className="text-xs font-bold text-default-500 uppercase tracking-wider mb-4">
          Ventas ultimos 7 dias
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekData} barCategoryGap="20%">
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#71717a" }}
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
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e4e4e7",
                  fontSize: 13,
                }}
              />
              <Bar
                dataKey="total"
                fill="#e84c65"
                radius={[8, 8, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="rounded-2xl bg-white border border-default-100 p-5">
          <p className="text-xs font-bold text-default-500 uppercase tracking-wider mb-4">
            Top 5 productos hoy
          </p>
          {topProducts.length === 0 ? (
            <p className="text-sm text-default-400 py-6 text-center">
              Sin ventas hoy
            </p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div
                  key={p.product_name}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-default-100 text-xs font-bold text-default-500">
                    {i + 1}
                  </span>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-default-50">
                    {p.icon ? (
                      <ProductIcon
                        name={p.icon}
                        size={20}
                        weight="duotone"
                        className="text-default-600"
                      />
                    ) : (
                      <span className="text-default-300 text-sm">-</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-default-800 truncate">
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
              ))}
            </div>
          )}
        </div>

        {/* Low stock alerts */}
        <div className="rounded-2xl bg-white border border-default-100 p-5">
          <p className="text-xs font-bold text-default-500 uppercase tracking-wider mb-4">
            Alertas de inventario
          </p>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-default-400">
              <CheckCircle size={36} weight="duotone" className="text-emerald-500" />
              <p className="text-sm font-medium">Todo bien con el inventario</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStock.map((item) => {
                const pct = Math.min(
                  (item.stock_quantity / item.min_stock) * 100,
                  100
                );
                const barColor =
                  pct < 25
                    ? "bg-red-500"
                    : pct < 50
                      ? "bg-amber-500"
                      : "bg-emerald-500";

                return (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Warning
                          size={16}
                          weight="duotone"
                          className={
                            pct < 25
                              ? "text-red-500"
                              : pct < 50
                                ? "text-amber-500"
                                : "text-emerald-500"
                          }
                        />
                        <p className="text-sm font-semibold text-default-800">
                          {item.name}
                        </p>
                      </div>
                      <p className="text-xs tabular-nums font-extrabold text-default-500">
                        {item.stock_quantity} / {item.min_stock} {item.unit}
                      </p>
                    </div>
                    <div className="h-2 w-full rounded-full bg-default-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary card sub-component (inline, not exported)                   */
/* ------------------------------------------------------------------ */
function SummaryCard({
  label,
  value,
  icon,
  bgColor,
  iconColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-default-100 p-5 flex items-center gap-4">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgColor} ${iconColor}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-xl tabular-nums font-extrabold text-default-800 mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}
