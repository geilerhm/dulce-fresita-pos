"use client";

import { useEffect, useCallback, useRef } from "react";
import { supabaseCloud } from "@/lib/supabase-cloud";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";
import { playNewOrderAlert } from "@/lib/utils/sounds";
import { toast } from "sonner";

const SYNC_INTERVAL = 10_000;
let _syncing = false;

/** Standalone sync function — can be called from anywhere */
export async function cloudSync(): Promise<number> {
  if (_syncing) return 0;
  _syncing = true;

  let pulled = 0;

  try {
    const companyId = getActiveCompanyId();
    if (!companyId) return 0;

    const localDb = createClient();

    // ── PUSH: products + categories to Supabase ──
    const { data: categories } = await localDb
      .from("categories")
      .select("id, name, slug, icon, sort_order, type")
      .eq("company_id", companyId)
      .eq("type", "product");

    if (categories && categories.length > 0) {
      const rows = categories.map((c: any) => ({ ...c, company_id: companyId }));
      await supabaseCloud.from("categories_cache").delete().eq("company_id", companyId);
      await supabaseCloud.from("categories_cache").insert(rows);
    }

    const { data: products } = await localDb
      .from("products")
      .select("id, name, price, icon, category:categories(slug), available_in_pos, active, sort_order")
      .eq("company_id", companyId)
      .eq("active", true)
      .eq("available_in_pos", true);

    if (products && products.length > 0) {
      const rows = products.map((p: any) => ({
        id: p.id, name: p.name, price: p.price, icon: p.icon,
        category_slug: p.category?.slug ?? null,
        available_in_pos: true, active: true, sort_order: p.sort_order,
        company_id: companyId,
      }));
      await supabaseCloud.from("products_cache").delete().eq("company_id", companyId);
      await supabaseCloud.from("products_cache").insert(rows);
    }

    // ── PULL: cloud orders to local SQLite ──
    const { data: cloudOrders } = await supabaseCloud
      .from("cloud_orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("synced", false)
      .order("created_at", { ascending: true });

    if (cloudOrders && cloudOrders.length > 0) {
      for (const order of cloudOrders) {
        try {
          const { data: cloudItems } = await supabaseCloud
            .from("cloud_order_items")
            .select("*")
            .eq("order_id", order.id);

          const { error: insertErr } = await localDb.from("orders").insert({
            id: order.id, order_type: order.order_type || "delivery", customer_name: order.customer_name,
            customer_phone: order.customer_phone, delivery_address: order.delivery_address,
            scheduled_time: order.scheduled_time, status: order.status,
            payment_method: order.payment_method, total: order.total,
            notes: order.notes, created_by: order.created_by, company_id: order.company_id,
          });

          // Skip if already exists locally (duplicate)
          if (insertErr) {
            await supabaseCloud.from("cloud_orders").update({ synced: true }).eq("id", order.id);
            continue;
          }

          if (cloudItems && cloudItems.length > 0) {
            for (const item of cloudItems) {
              await localDb.from("order_items").insert({
                id: item.id, order_id: item.order_id, product_id: item.product_id,
                product_name: item.product_name, quantity: item.quantity,
                unit_price: item.unit_price, subtotal: item.subtotal,
                notes: item.notes, company_id: item.company_id,
              });
            }
          }

          await supabaseCloud.from("cloud_orders").update({ synced: true }).eq("id", order.id);
          pulled++;
        } catch (e) {
          console.warn("[CloudSync] Error pulling order:", order.id, e);
          // Mark as synced anyway to avoid infinite retry
          await supabaseCloud.from("cloud_orders").update({ synced: true }).eq("id", order.id);
        }
      }

      if (pulled > 0) {
        console.log(`[CloudSync] Pulled ${pulled} new orders`);
        // Announce each new order by type
        const lastOrder = cloudOrders[cloudOrders.length - 1];
        const orderType = lastOrder?.order_type === "local" ? "local" : "delivery";
        playNewOrderAlert(orderType);
        const label = orderType === "local" ? "para local" : "a domicilio";
        toast(`🔔 ${pulled === 1 ? `Nuevo pedido ${label}` : `${pulled} pedidos nuevos`}`, {
          duration: 8000,
          style: { fontSize: "1.3rem", padding: "20px 24px", borderRadius: "20px", background: "#fef3c7", border: "2px solid #f59e0b", color: "#92400e" },
        });
      }
    }
  } catch (err) {
    console.warn("[CloudSync] Error:", err);
  } finally {
    _syncing = false;
  }

  return pulled;
}

/** Hook that runs sync on mount + every 30s */
export function useCloudSync() {
  const sync = useCallback(() => cloudSync(), []);

  useEffect(() => {
    sync();
    const interval = setInterval(sync, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [sync]);

  return { sync };
}
