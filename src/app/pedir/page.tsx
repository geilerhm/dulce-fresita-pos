"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseCloud } from "@/lib/supabase-cloud";
import { formatCOP } from "@/lib/utils/format";
import { ProductIcon } from "@/lib/utils/product-icons";
import {
  Plus, Minus, ShoppingCart, Check, ArrowLeft,
  User, Phone, MapPin, Clock, NoteBlank,
  Money, DeviceMobile, MagnifyingGlass,
  CheckCircle, Strawberry,
} from "@phosphor-icons/react";
import { Strawberry as StrawberryIcon } from "@/lib/utils/fruit-icons";

interface Product {
  id: string;
  name: string;
  price: number;
  icon: string | null;
  category_slug: string | null;
  sort_order: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
}

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

type Step = "products" | "info" | "success";

export default function PedirPage() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("c");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>("products");
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Customer info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "nequi">("efectivo");
  const [saving, setSaving] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }

    async function load() {
      const [catRes, prodRes] = await Promise.all([
        supabaseCloud.from("categories_cache").select("*").eq("company_id", companyId).order("sort_order"),
        supabaseCloud.from("products_cache").select("*").eq("company_id", companyId).eq("active", true).order("sort_order"),
      ]);

      setCategories((catRes.data ?? []) as Category[]);
      setProducts((prodRes.data ?? []) as Product[]);
      setLoading(false);
    }
    load();
  }, [companyId]);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedCat) list = list.filter((p) => p.category_slug === selectedCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCat, search]);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  function addToCart(p: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.product_id === p.id);
      if (ex) return prev.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const item = prev.find((i) => i.product_id === productId);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter((i) => i.product_id !== productId);
      return prev.map((i) => i.product_id === productId ? { ...i, quantity: i.quantity - 1 } : i);
    });
  }

  function getQty(productId: string): number {
    return cart.find((i) => i.product_id === productId)?.quantity ?? 0;
  }

  const handleCreate = useCallback(async () => {
    if (!customerName.trim() || !companyId) return;

    setSaving(true);

    const { data: order, error } = await supabaseCloud
      .from("cloud_orders")
      .insert({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        delivery_address: deliveryAddress.trim() || null,
        scheduled_time: scheduledTime || null,
        status: "pending",
        payment_method: paymentMethod,
        total,
        notes: orderNotes.trim() || null,
        created_by: "Remoto",
        synced: false,
        company_id: companyId,
      })
      .select("id, order_number")
      .single();

    if (error || !order) { setSaving(false); alert("Error al crear pedido"); return; }

    const items = cart.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      company_id: companyId,
    }));

    await supabaseCloud.from("cloud_order_items").insert(items);

    setOrderNumber(order.order_number);
    setStep("success");
    setSaving(false);
  }, [customerName, customerPhone, deliveryAddress, scheduledTime, paymentMethod, total, orderNotes, cart, companyId]);

  // ── No company ──
  if (!companyId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <StrawberryIcon size={48} className="text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold text-default-800 mb-2">Link inválido</h1>
          <p className="text-sm text-default-400">Este link no tiene empresa asociada</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <span className="h-8 w-8 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ── Success ──
  if (step === "success") {
    return (
      <div className="flex h-screen items-center justify-center bg-white p-6">
        <div className="text-center space-y-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 mx-auto">
            <CheckCircle size={48} weight="fill" className="text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-default-800">Pedido #{orderNumber}</p>
          <p className="text-4xl font-extrabold text-emerald-600 tabular-nums">{formatCOP(total)}</p>
          <p className="text-base text-default-400">Tu pedido fue enviado al local</p>
          <button onClick={() => { setCart([]); setStep("products"); setCustomerName(""); setCustomerPhone(""); setDeliveryAddress(""); setScheduledTime(""); setOrderNotes(""); setOrderNumber(null); }}
            className="h-14 px-8 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all">
            Nuevo Pedido
          </button>
        </div>
      </div>
    );
  }

  // ── Customer Info ──
  if (step === "info") {
    return (
      <div className="flex h-screen flex-col bg-gray-50">
        <div className="bg-white border-b border-default-100 px-4 py-4 flex items-center gap-3">
          <button onClick={() => setStep("products")} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-default-100 active:scale-95 transition-all">
            <ArrowLeft size={20} className="text-default-600" />
          </button>
          <h1 className="text-base font-bold text-default-800">Datos de entrega</h1>
          <span className="ml-auto text-xs font-bold text-default-400 bg-default-100 rounded-full px-2.5 py-1">{formatCOP(total)}</span>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-md mx-auto space-y-3">
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1 block">Nombre *</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Tu nombre"
                  className="w-full h-14 pl-10 pr-4 rounded-2xl border-2 border-default-200 bg-white text-base outline-none focus:border-primary transition-all" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1 block">Teléfono</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="300 123 4567" type="tel"
                  className="w-full h-14 pl-10 pr-4 rounded-2xl border-2 border-default-200 bg-white text-base outline-none focus:border-primary transition-all" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1 block">Dirección</label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3 top-4 text-default-400" />
                <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Calle, barrio, referencia..." rows={2}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-default-200 bg-white text-base outline-none focus:border-primary transition-all resize-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1 block">Hora entrega</label>
                <div className="relative">
                  <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
                  <input value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} type="time"
                    className="w-full h-14 pl-10 pr-4 rounded-2xl border-2 border-default-200 bg-white text-base outline-none focus:border-primary transition-all" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1 block">Pago</label>
                <div className="flex gap-2">
                  <button onClick={() => setPaymentMethod("efectivo")}
                    className={`flex-1 h-14 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-1 transition-all active:scale-95
                      ${paymentMethod === "efectivo" ? "border-primary bg-primary/5 text-primary" : "border-default-200 text-default-500"}`}>
                    <Money size={18} /> Efectivo
                  </button>
                  <button onClick={() => setPaymentMethod("nequi")}
                    className={`flex-1 h-14 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-1 transition-all active:scale-95
                      ${paymentMethod === "nequi" ? "border-primary bg-primary/5 text-primary" : "border-default-200 text-default-500"}`}>
                    <DeviceMobile size={18} /> Nequi
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1 block">Notas</label>
              <div className="relative">
                <NoteBlank size={18} className="absolute left-3 top-4 text-default-400" />
                <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Instrucciones especiales..." rows={2}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-default-200 bg-white text-base outline-none focus:border-primary transition-all resize-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-t border-default-100 p-4 safe-bottom">
          <button onClick={handleCreate} disabled={saving || !customerName.trim()}
            className="w-full h-16 rounded-2xl bg-primary text-white text-xl font-bold shadow-lg shadow-primary/30 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? (
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Check size={24} weight="bold" /> Enviar Pedido — {formatCOP(total)}</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Product Selection (mobile-first) ──
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-default-100 px-4 py-3 space-y-2 shrink-0">
        <div className="flex items-center gap-3">
          <StrawberryIcon size={24} className="text-primary" />
          <h1 className="text-base font-bold text-default-800">Dulce Fresita</h1>
          <span className="text-xs text-default-400">Pedido</span>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-default-200 bg-default-50 text-sm outline-none focus:border-primary transition-all" />
        </div>

        {/* Categories */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setSelectedCat(null)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95
              ${!selectedCat ? "bg-primary text-white" : "bg-default-100 text-default-500"}`}>
            Todos
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCat(cat.slug)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95
                ${selectedCat === cat.slug ? "bg-primary text-white" : "bg-default-100 text-default-500"}`}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="flex-1 overflow-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-default-300">
            <MagnifyingGlass size={40} weight="duotone" className="mb-3" />
            <p className="text-sm text-default-400">No hay productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((p) => {
              const qty = getQty(p.id);
              return (
                <button key={p.id} onClick={() => addToCart(p)}
                  className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-2 transition-all active:scale-95 min-h-[110px]
                    ${qty > 0 ? "border-primary bg-primary/5" : "border-default-100 bg-white"}`}>
                  <ProductIcon name={p.icon || "ForkKnife"} size={24} weight={qty > 0 ? "fill" : "duotone"} />
                  <span className="text-xs font-bold text-default-800 text-center line-clamp-2">{p.name}</span>
                  <span className="text-xs font-bold text-primary tabular-nums">{formatCOP(p.price)}</span>
                  {qty > 0 && (
                    <div className="absolute -top-2 -right-2 flex items-center gap-0.5">
                      <button onClick={(e) => { e.stopPropagation(); removeFromCart(p.id); }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white active:scale-90">
                        <Minus size={12} weight="bold" />
                      </button>
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold px-1">
                        {qty}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white active:scale-90">
                        <Plus size={12} weight="bold" />
                      </button>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart bar */}
      {cart.length > 0 && (
        <div className="bg-white border-t border-default-100 p-3 safe-bottom">
          <button onClick={() => setStep("info")}
            className="w-full h-14 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/30 hover:brightness-105 active:scale-[0.97] transition-all flex items-center justify-center gap-3">
            <ShoppingCart size={22} weight="bold" />
            {itemCount} productos — {formatCOP(total)}
          </button>
        </div>
      )}
    </div>
  );
}
