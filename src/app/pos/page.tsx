"use client";

import { POSClient } from "./pos-client";
import { createClient } from "@/lib/db/client";
import { useEffect, useState } from "react";
import { getActiveCompanyId } from "@/lib/db/company";
import { useCaja } from "@/contexts/CajaContext";

interface Category { id: string; name: string; slug: string; icon?: string; }
interface Product { id: string; ref: string; name: string; price: number; image_url?: string; icon?: string; category_slug?: string; included_toppings_count: number; }

export default function POSPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { loading: cajaLoading } = useCaja();

  useEffect(() => {
    const client = createClient();
    const companyId = getActiveCompanyId();
    if (!companyId) { setLoaded(true); return; }

    Promise.all([
      client.from("categories").select("id, name, slug, icon").eq("type", "product").eq("company_id", companyId).order("sort_order"),
      client.from("products").select("id, ref, name, price, image_url, icon, included_toppings_count, category:categories(slug)").eq("active", true).eq("available_in_pos", true).eq("company_id", companyId).order("sort_order"),
    ]).then(([catRes, prodRes]) => {
      const cats = (catRes.data ?? []) as Category[];
      const prods = (prodRes.data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string, ref: p.ref as string, name: p.name as string, price: p.price as number,
        image_url: p.image_url as string | undefined, icon: p.icon as string | undefined,
        included_toppings_count: (p.included_toppings_count as number | null) ?? 0,
        category_slug: (p.category as { slug: string } | null)?.slug ?? undefined,
      }));

      setCategories(cats);
      setProducts(prods);
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded || cajaLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // No hard block on "caja cerrada" anymore — POS is also the entry point
  // for creating deferred orders (which don't need a register). The Cart's
  // built-in NoCajaWarningModal still kicks in if the cashier hits "Cobrar"
  // without a register open.

  if (products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50 text-default-400 gap-4">
        <p className="text-lg font-bold text-default-600">No hay productos</p>
        <p className="text-sm text-center max-w-xs">Ve a Productos en el menú lateral para crear tus primeros productos</p>
      </div>
    );
  }

  return <POSClient categories={categories} products={products} />;
}
