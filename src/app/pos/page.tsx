"use client";

import { POSClient } from "./pos-client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { getCachedProducts, getCachedCategories, cacheProducts, cacheCategories, useOnlineStatus } from "@/lib/hooks/useOffline";
import { getActiveCompanyId } from "@/lib/supabase/company";
import { useCaja } from "@/contexts/CajaContext";
import { useRouter } from "next/navigation";
import { Wallet } from "@phosphor-icons/react";

interface Category { id: string; name: string; slug: string; }
interface Product { id: string; ref: string; name: string; price: number; image_url?: string; icon?: string; category_slug?: string; }

export default function POSPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const online = useOnlineStatus();
  const { register, loading: cajaLoading } = useCaja();
  const router = useRouter();

  useEffect(() => {
    // 1. Always load cache first (instant)
    const cachedCats = getCachedCategories() as Category[] | null;
    const cachedProds = getCachedProducts() as Product[] | null;
    if (cachedCats && cachedCats.length > 0) setCategories(cachedCats);
    if (cachedProds && cachedProds.length > 0) setProducts(cachedProds);
    if (cachedCats || cachedProds) setLoaded(true);

    // 2. If online, fetch fresh data
    if (!navigator.onLine) { setLoaded(true); return; }

    const supabase = createClient();
    const companyId = getActiveCompanyId();
    if (!companyId) { setLoaded(true); return; }

    Promise.all([
      supabase.from("categories").select("id, name, slug").eq("type", "product").eq("company_id", companyId).order("sort_order"),
      supabase.from("products").select("id, ref, name, price, image_url, icon, category:categories(slug)").eq("active", true).eq("available_in_pos", true).eq("company_id", companyId).order("sort_order"),
    ]).then(([catRes, prodRes]) => {
      const cats = (catRes.data ?? []) as Category[];
      const prods = (prodRes.data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string, ref: p.ref as string, name: p.name as string, price: p.price as number,
        image_url: p.image_url as string | undefined, icon: p.icon as string | undefined,
        category_slug: (p.category as { slug: string } | null)?.slug ?? undefined,
      }));

      setCategories(cats); cacheCategories(cats);
      setProducts(prods); cacheProducts(prods);
      setLoaded(true);
    }).catch(() => {
      // fetch failed — cache is already loaded above
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

  if (!register) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50 gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Wallet size={40} weight="duotone" className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-default-800">Caja cerrada</h2>
        <p className="text-sm text-default-400 text-center max-w-xs">Abre la caja antes de vender para registrar todas las transacciones</p>
        <button
          onClick={() => router.push("/caja")}
          className="h-14 px-8 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all flex items-center gap-2"
        >
          <Wallet size={20} weight="bold" />
          Abrir Caja
        </button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50 text-default-400 gap-4">
        {!online ? (
          <>
            <p className="text-lg font-bold text-default-600">Sin conexión</p>
            <p className="text-sm">Conecta al internet y recarga</p>
          </>
        ) : (
          <>
            <p className="text-lg font-bold text-default-600">No hay productos</p>
            <p className="text-sm text-center max-w-xs">Ve a Productos en el menú lateral para crear tus primeros productos</p>
          </>
        )}
      </div>
    );
  }

  return <POSClient categories={categories} products={products} />;
}
