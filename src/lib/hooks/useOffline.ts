"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Offline detection ──

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

// ── Product cache (for offline POS) ──
// Cache keys include company_id so switching companies doesn't show stale data

import { getActiveCompanyId } from "@/lib/supabase/company";

function getProductsCacheKey() {
  const companyId = getActiveCompanyId();
  return companyId ? `dulce-fresita-products-cache-${companyId}` : "dulce-fresita-products-cache";
}

function getCategoriesCacheKey() {
  const companyId = getActiveCompanyId();
  return companyId ? `dulce-fresita-categories-cache-${companyId}` : "dulce-fresita-categories-cache";
}

export function cacheProducts(products: unknown[]) {
  try { localStorage.setItem(getProductsCacheKey(), JSON.stringify(products)); } catch {}
}

export function getCachedProducts(): unknown[] | null {
  try {
    const data = localStorage.getItem(getProductsCacheKey());
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function cacheCategories(categories: unknown[]) {
  try { localStorage.setItem(getCategoriesCacheKey(), JSON.stringify(categories)); } catch {}
}

export function getCachedCategories(): unknown[] | null {
  try {
    const data = localStorage.getItem(getCategoriesCacheKey());
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

// ── Offline sales queue ──

interface QueuedSale {
  id: string;
  total: number;
  payment_method: string;
  items: { product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number }[];
  register_id: string | null;
  created_at: string;
}

const QUEUE_KEY = "dulce-fresita-offline-queue";

function getQueue(): QueuedSale[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveQueue(queue: QueuedSale[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

export function queueSale(sale: QueuedSale) {
  const queue = getQueue();
  queue.push(sale);
  saveQueue(queue);
}

export function getPendingSales(): QueuedSale[] {
  return getQueue();
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

// ── Sync queue to Supabase when back online ──

export function useOfflineSync() {
  const online = useOnlineStatus();

  const sync = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return 0;

    const supabase = createClient();
    let synced = 0;

    for (const sale of queue) {
      try {
        // Insert sale
        const { data, error } = await supabase
          .from("sales")
          .insert({
            total: sale.total,
            payment_method: sale.payment_method,
            status: "completed",
            register_id: sale.register_id,
            created_at: sale.created_at,
          })
          .select("id")
          .single();

        if (error) continue;

        // Insert items
        const items = sale.items.map((item) => ({
          sale_id: data.id,
          ...item,
        }));
        await supabase.from("sale_items").insert(items);

        // Deduct inventory
        await supabase.rpc("fn_deduct_inventory", { p_sale_id: data.id });

        synced++;
      } catch {
        // If one fails, stop and keep remaining in queue
        break;
      }
    }

    // Remove synced sales from queue
    if (synced > 0) {
      const remaining = queue.slice(synced);
      saveQueue(remaining);
    }

    return synced;
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (online) {
      sync();
    }
  }, [online, sync]);

  return { online, sync, pendingCount: getQueue().length };
}
