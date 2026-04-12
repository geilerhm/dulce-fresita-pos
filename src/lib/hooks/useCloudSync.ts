"use client";

import { useEffect, useCallback, useRef } from "react";
import { supabaseCloud } from "@/lib/supabase-cloud";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";

const SYNC_INTERVAL = 30_000; // 30 seconds

/**
 * Syncs data between local SQLite and Supabase cloud:
 * - Push: products + categories → Supabase (so phone can read them)
 * - Pull: cloud orders → local SQLite (so local POS can process them)
 */
export function useCloudSync() {
  const syncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      const companyId = getActiveCompanyId();
      if (!companyId) return;

      const localDb = createClient();

      // ── PUSH: products + categories to Supabase ──
      const { data: categories } = await localDb
        .from("categories")
        .select("id, name, slug, icon, sort_order, type")
        .eq("company_id", companyId)
        .eq("type", "product");

      if (categories && categories.length > 0) {
        const rows = categories.map((c: any) => ({ ...c, company_id: companyId }));
        // Delete old and insert fresh
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
          id: p.id,
          name: p.name,
          price: p.price,
          icon: p.icon,
          category_slug: p.category?.slug ?? null,
          available_in_pos: true,
          active: true,
          sort_order: p.sort_order,
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
          // Fetch order items
          const { data: cloudItems } = await supabaseCloud
            .from("cloud_order_items")
            .select("*")
            .eq("order_id", order.id);

          // Insert order into local SQLite
          await localDb.from("orders").insert({
            id: order.id,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            delivery_address: order.delivery_address,
            scheduled_time: order.scheduled_time,
            status: order.status,
            payment_method: order.payment_method,
            total: order.total,
            notes: order.notes,
            created_by: order.created_by,
            company_id: order.company_id,
          });

          // Insert items
          if (cloudItems && cloudItems.length > 0) {
            for (const item of cloudItems) {
              await localDb.from("order_items").insert({
                id: item.id,
                order_id: item.order_id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal,
                notes: item.notes,
                company_id: item.company_id,
              });
            }
          }

          // Mark as synced in Supabase
          await supabaseCloud
            .from("cloud_orders")
            .update({ synced: true })
            .eq("id", order.id);
        }

        console.log(`[CloudSync] Pulled ${cloudOrders.length} new orders`);
      }
    } catch (err) {
      console.warn("[CloudSync] Error:", err);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  // Sync on mount + every 30s
  useEffect(() => {
    sync();
    const interval = setInterval(sync, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [sync]);

  return { sync };
}
