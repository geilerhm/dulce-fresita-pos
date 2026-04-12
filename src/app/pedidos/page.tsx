"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";
import { formatCOP, formatTime } from "@/lib/utils/format";
import { toast } from "@/lib/utils/toast";
import { playClick } from "@/lib/utils/sounds";
import { useRouter } from "next/navigation";
import {
  Plus,
  Phone,
  MapPin,
  Clock,
  ArrowsClockwise,
  CheckCircle,
  XCircle,
  Motorcycle,
  CookingPot,
  Package,
  HourglassSimple,
  CaretRight,
  LinkSimple,
  ListDashes,
} from "@phosphor-icons/react";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
}

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string | null;
  delivery_address: string | null;
  scheduled_time: string | null;
  status: string;
  payment_method: string;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  items?: OrderItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof HourglassSimple }> = {
  pending: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", Icon: HourglassSimple },
  preparing: { label: "Preparando", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", Icon: CookingPot },
  ready: { label: "Listo", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", Icon: Package },
  delivering: { label: "En camino", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", Icon: Motorcycle },
  delivered: { label: "Entregado", color: "text-default-500", bg: "bg-default-50", border: "border-default-200", Icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", Icon: XCircle },
};

const NEXT_STATUS: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
  ready: "delivering",
  delivering: "delivered",
};

const NEXT_LABEL: Record<string, string> = {
  pending: "Preparar",
  preparing: "Marcar Listo",
  ready: "Enviar",
  delivering: "Entregado",
};

const FILTER_TABS = [
  { id: "all", label: "Todos", Icon: ListDashes },
  { id: "pending", label: "Pendientes", Icon: HourglassSimple },
  { id: "preparing", label: "Preparando", Icon: CookingPot },
  { id: "ready", label: "Listos", Icon: Package },
  { id: "delivering", label: "En camino", Icon: Motorcycle },
  { id: "delivered", label: "Entregados", Icon: CheckCircle },
  { id: "cancelled", label: "Cancelados", Icon: XCircle },
];

export default function PedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const client = createClient();
    const companyId = getActiveCompanyId();
    if (!companyId) return;

    const { data: ordersData } = await client
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!ordersData) { setLoading(false); return; }

    // Batch load all order items
    const orderIds = ordersData.map((o: any) => o.id);
    let allItems: OrderItem[] = [];
    if (orderIds.length > 0) {
      const { data: itemsData } = await client
        .from("order_items")
        .select("id, order_id, product_name, quantity, unit_price, subtotal, notes")
        .eq("company_id", companyId)
        .in("order_id", orderIds);
      allItems = (itemsData ?? []) as any[];
    }

    // Group items by order
    const itemsMap = new Map<string, OrderItem[]>();
    for (const item of allItems) {
      const list = itemsMap.get((item as any).order_id) ?? [];
      list.push(item);
      itemsMap.set((item as any).order_id, list);
    }

    setOrders(ordersData.map((o: any) => ({ ...o, items: itemsMap.get(o.id) ?? [] })));
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function handleAdvanceStatus(order: Order) {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;

    setProcessing(order.id);
    try {
      const client = createClient();
      if (nextStatus === "delivered") {
        const { error } = await client.rpc("fn_complete_order", { p_order_id: order.id });
        if (error) { toast.error("Error al completar pedido"); return; }
        toast.success(`Pedido #${order.order_number} entregado — Venta creada`);
      } else {
        const { error } = await client.from("orders").update({ status: nextStatus }).eq("id", order.id);
        if (error) { toast.error("Error al actualizar pedido"); return; }
        toast.success(`Pedido #${order.order_number} → ${STATUS_CONFIG[nextStatus].label}`);
      }
      await fetchOrders();
    } finally {
      setProcessing(null);
      setExpandedId(null);
    }
  }

  async function handleCancel(order: Order) {
    setProcessing(order.id);
    try {
      const client = createClient();
      const { error } = await client.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      if (error) { toast.error("Error al cancelar"); return; }
      toast.success(`Pedido #${order.order_number} cancelado`);
      await fetchOrders();
    } finally {
      setProcessing(null);
      setExpandedId(null);
    }
  }

  // Count per status for badges
  const counts: Record<string, number> = {};
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;

  const displayOrders = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const activeCount = orders.filter((o) => ["pending", "preparing", "ready", "delivering"].includes(o.status)).length;

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-default-100 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-default-800">Pedidos</h1>
            <p className="text-xs text-default-400 mt-0.5">
              {activeCount} activos · {orders.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchOrders} className="flex h-11 w-11 items-center justify-center rounded-2xl text-default-400 hover:bg-default-100 transition-all">
              <ArrowsClockwise size={20} />
            </button>
            <button
              onClick={() => {
                const companyId = getActiveCompanyId();
                const url = `${window.location.origin}/pedir?c=${companyId}`;
                navigator.clipboard.writeText(url);
                toast.success("Link copiado — compártelo con el domiciliario");
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-default-400 hover:bg-default-100 transition-all"
              title="Copiar link remoto"
            >
              <LinkSimple size={20} />
            </button>
            <button
              onClick={() => router.push("/pedidos/nuevo")}
              className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all"
            >
              <Plus size={18} weight="bold" /> Nuevo
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => {
            const count = tab.id === "all" ? orders.length : (counts[tab.id] ?? 0);
            const isActive = filter === tab.id;
            const cfg = tab.id !== "all" ? STATUS_CONFIG[tab.id] : null;

            return (
              <button
                key={tab.id}
                onClick={() => { setFilter(tab.id); playClick(); }}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95
                  ${isActive
                    ? cfg ? `${cfg.bg} ${cfg.color} ${cfg.border} border` : "bg-default-800 text-white"
                    : "bg-default-100 text-default-500 hover:bg-default-200"
                  }`}
              >
                <tab.Icon size={16} weight={isActive ? "fill" : "duotone"} />
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center
                    ${isActive ? "bg-white/30" : "bg-default-200 text-default-600"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="h-6 w-6 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
            </div>
          ) : displayOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-default-300">
              <Motorcycle size={48} weight="duotone" className="mb-3" />
              <p className="text-sm text-default-400">No hay pedidos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                const isExpanded = expandedId === order.id;
                const isActive = !!NEXT_STATUS[order.status];

                return (
                  <div key={order.id} className={`rounded-2xl border-2 overflow-hidden transition-all ${cfg.border} bg-white`}>
                    {/* Order header */}
                    <button
                      onClick={() => { setExpandedId(isExpanded ? null : order.id); playClick(); }}
                      className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-black/5 transition-colors"
                    >
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${cfg.bg} ${cfg.color} shrink-0`}>
                        <cfg.Icon size={28} weight="fill" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-lg font-bold text-default-800">#{order.order_number}</p>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-base font-medium text-default-600 truncate">{order.customer_name}</p>
                        <div className="flex items-center gap-3 text-xs text-default-400 mt-0.5">
                          {order.scheduled_time && (
                            <span className="flex items-center gap-1"><Clock size={12} weight="bold" /> {order.scheduled_time}</span>
                          )}
                          <span>{formatTime(order.created_at)}</span>
                          <span>{order.items?.length ?? 0} productos</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-extrabold text-default-900 tabular-nums">{formatCOP(order.total)}</p>
                        <p className="text-xs text-default-400 mt-0.5">{order.payment_method === "efectivo" ? "Efectivo" : "Nequi"}</p>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-default-100 animate-in fade-in duration-150">
                        {/* Customer info */}
                        {(order.customer_phone || order.delivery_address || order.notes) && (
                          <div className="px-4 py-3 space-y-1.5 bg-default-50/50">
                            {order.customer_phone && (
                              <a href={`tel:${order.customer_phone}`} className="text-sm text-primary font-medium flex items-center gap-2">
                                <Phone size={14} weight="bold" /> {order.customer_phone}
                              </a>
                            )}
                            {order.delivery_address && (
                              <p className="text-sm text-default-600 flex items-center gap-2">
                                <MapPin size={14} className="text-default-400 shrink-0" /> {order.delivery_address}
                              </p>
                            )}
                            {order.notes && (
                              <p className="text-sm text-default-400 italic">{order.notes}</p>
                            )}
                          </div>
                        )}

                        {/* Items */}
                        <div className="border-t border-default-100 px-4 py-3 space-y-1">
                          {(order.items ?? []).map((item) => (
                            <div key={item.id} className="flex items-start justify-between gap-3 py-2">
                              <span className="text-base font-medium text-default-700 flex-1 min-w-0">
                                {item.quantity > 1 && <span className="text-default-400 tabular-nums font-bold">{item.quantity}x </span>}
                                {item.product_name}
                                {item.notes && <span className="text-xs text-default-400 italic ml-1">({item.notes})</span>}
                              </span>
                              <span className="text-base font-bold text-default-800 shrink-0 tabular-nums">{formatCOP(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Total row */}
                        <div className="border-t border-default-100 px-4 py-3 flex justify-between items-center">
                          <span className="text-sm text-default-500">Total</span>
                          <span className="text-2xl font-extrabold text-default-900 tabular-nums">{formatCOP(order.total)}</span>
                        </div>

                        {/* Action buttons */}
                        {isActive && (
                          <div className="border-t border-default-100 px-4 py-3 flex gap-2">
                            <button
                              onClick={() => handleAdvanceStatus(order)}
                              disabled={processing === order.id}
                              className="flex-1 h-16 rounded-2xl bg-primary text-white text-lg font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              {processing === order.id ? (
                                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>{NEXT_LABEL[order.status]} <CaretRight size={20} weight="bold" /></>
                              )}
                            </button>
                            <button
                              onClick={() => handleCancel(order)}
                              disabled={processing === order.id}
                              className="h-16 px-6 rounded-2xl border-2 border-red-200 text-red-500 font-bold text-lg hover:bg-red-50 active:scale-[0.97] transition-all"
                            >
                              <XCircle size={24} weight="bold" />
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
        </div>
      </div>
    </div>
  );
}
