"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseCloud } from "@/lib/supabase-cloud";
import { formatCOP } from "@/lib/utils/format";
import { ProductIcon } from "@/lib/utils/product-icons";
import { playAdd, playRemove, playClick } from "@/lib/utils/sounds";
import {
  Plus, Minus, ShoppingCart, Check, ArrowLeft,
  User, Phone, MapPin, Clock, NoteBlank,
  Money, DeviceMobile, MagnifyingGlass, CheckCircle, X,
  Storefront, Motorcycle,
} from "@phosphor-icons/react";
import { Strawberry } from "@/lib/utils/fruit-icons";

interface Product { id: string; name: string; price: number; icon: string | null; category_slug: string | null; }
interface Category { id: string; name: string; slug: string; }
interface CartItem { product_id: string; name: string; price: number; quantity: number; }
type Step = "products" | "info" | "success";

export default function PedirPage() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("c");
  const companyName = searchParams.get("n") || "Dulce Fresita";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (!companyId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6 text-center">
        <div><Strawberry size={48} className="text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold text-default-800 mb-2">Link inválido</h1>
          <p className="text-sm text-default-400">Este link no tiene empresa asociada</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50"><span className="h-8 w-8 border-2 border-default-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  return <PedirClient companyId={companyId} companyName={companyName} categories={categories} products={products} />;
}

function PedirClient({ companyId, companyName, categories, products }: { companyId: string; companyName: string; categories: Category[]; products: Product[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<Step>("products");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [orderType, setOrderType] = useState<"local" | "delivery">("delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "nequi">("efectivo");
  const [saving, setSaving] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedCategory && !search.trim()) list = list.filter((p) => p.category_slug === selectedCategory);
    if (search.trim()) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [products, selectedCategory, search]);

  // Group by category for section headers
  const grouped = useMemo(() => {
    if (search.trim() || selectedCategory) return [{ label: null, items: filtered }];
    const catMap = new Map<string | null, Product[]>();
    for (const p of filtered) {
      const key = p.category_slug;
      const list = catMap.get(key) ?? [];
      list.push(p);
      catMap.set(key, list);
    }
    return categories
      .filter((c) => catMap.has(c.slug))
      .map((c) => ({ label: c.name, items: catMap.get(c.slug)! }));
  }, [filtered, categories, search, selectedCategory]);

  function getQty(pid: string) { return cart.find((i) => i.product_id === pid)?.quantity ?? 0; }

  function addToCart(p: Product) {
    playAdd();
    setCart((prev) => {
      const ex = prev.find((i) => i.product_id === p.id);
      if (ex) return prev.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  }

  function increment(pid: string) { setCart((prev) => prev.map((i) => i.product_id === pid ? { ...i, quantity: i.quantity + 1 } : i)); }
  function decrement(pid: string) {
    playRemove();
    setCart((prev) => {
      const item = prev.find((i) => i.product_id === pid);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter((i) => i.product_id !== pid);
      return prev.map((i) => i.product_id === pid ? { ...i, quantity: i.quantity - 1 } : i);
    });
  }

  const handleCreate = useCallback(async () => {
    if (!customerName.trim()) return;
    setSaving(true);
    const { data: order, error } = await supabaseCloud.from("cloud_orders").insert({
      order_type: orderType, customer_name: customerName.trim(),
      customer_phone: orderType === "delivery" ? (customerPhone.trim() || null) : null,
      delivery_address: orderType === "delivery" ? (deliveryAddress.trim() || null) : null,
      scheduled_time: orderType === "delivery" ? (scheduledTime || null) : null,
      status: "pending", payment_method: paymentMethod, total,
      notes: orderNotes.trim() || null, created_by: "Remoto", synced: false, company_id: companyId,
    }).select("id, order_number").single();

    if (error || !order) { setSaving(false); alert("Error al crear pedido"); return; }

    await supabaseCloud.from("cloud_order_items").insert(
      cart.map((i) => ({ order_id: order.id, product_id: i.product_id, product_name: i.name, quantity: i.quantity, unit_price: i.price, subtotal: i.price * i.quantity, company_id: companyId }))
    );
    setOrderNumber(order.order_number);
    setStep("success");
    setSaving(false);
  }, [customerName, customerPhone, deliveryAddress, scheduledTime, paymentMethod, total, orderNotes, cart, companyId]);

  // ── Success ──
  if (step === "success") {
    return (
      <div className="flex h-screen items-center justify-center bg-white p-6 text-center">
        <div className="space-y-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mx-auto"><CheckCircle size={40} weight="fill" className="text-emerald-600" /></div>
          <p className="text-2xl font-bold text-default-800">Pedido #{orderNumber}</p>
          <p className="text-3xl font-extrabold text-emerald-600 tabular-nums">{formatCOP(total)}</p>
          <p className="text-sm text-default-400">Enviado al local</p>
          <button onClick={() => { setCart([]); setStep("products"); setCustomerName(""); setCustomerPhone(""); setDeliveryAddress(""); setScheduledTime(""); setOrderNotes(""); setOrderNumber(null); }}
            className="h-12 px-6 rounded-2xl bg-primary text-white text-sm font-bold active:scale-[0.97] transition-all mt-2">
            Nuevo Pedido
          </button>
        </div>
      </div>
    );
  }

  // ── Customer Info ──
  if (step === "info") {
    return (
      <div className="flex flex-col bg-gray-50" style={{ height: "100vh", height: "100dvh" }}>
        <div className="bg-white border-b border-default-100 px-3 py-2.5 flex items-center gap-2.5 shrink-0">
          <button onClick={() => setStep("products")} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-default-100 active:scale-95 transition-all"><ArrowLeft size={16} className="text-default-600" /></button>
          <span className="text-sm font-bold text-default-800 flex-1">{orderType === "local" ? "Pedido en local" : "Datos de entrega"}</span>
          <span className="text-xs font-bold text-primary tabular-nums">{formatCOP(total)}</span>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <div className="space-y-2.5">
            {/* Order type toggle */}
            <div className="flex gap-2">
              <button onClick={() => { setOrderType("local"); playClick(); }}
                className={`flex-1 h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95
                  ${orderType === "local" ? "bg-blue-50 text-blue-600 border-blue-200" : "border-default-200 text-default-400"}`}>
                <Storefront size={16} weight={orderType === "local" ? "fill" : "duotone"} /> Local
              </button>
              <button onClick={() => { setOrderType("delivery"); playClick(); }}
                className={`flex-1 h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95
                  ${orderType === "delivery" ? "bg-purple-50 text-purple-600 border-purple-200" : "border-default-200 text-default-400"}`}>
                <Motorcycle size={16} weight={orderType === "delivery" ? "fill" : "duotone"} /> Domicilio
              </button>
            </div>

            <Field icon={<User size={16} />} label="Nombre *" value={customerName} onChange={setCustomerName} placeholder="Nombre del cliente" />

            {orderType === "delivery" && (
              <>
                <Field icon={<Phone size={16} />} label="Teléfono" value={customerPhone} onChange={setCustomerPhone} placeholder="300 123 4567" type="tel" />
                <div>
                  <label className="text-[10px] font-bold text-default-500 uppercase tracking-wider mb-1 block">Dirección</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-3 text-default-400" />
                    <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Calle, barrio, referencia..." rows={2}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all resize-none" />
                  </div>
                </div>
                <Field icon={<Clock size={16} />} label="Hora de entrega" value={scheduledTime} onChange={setScheduledTime} type="time" />
              </>
            )}
            <div>
              <label className="text-[10px] font-bold text-default-500 uppercase tracking-wider mb-1 block">Método de pago</label>
              <div className="flex gap-2">
                <button onClick={() => { setPaymentMethod("efectivo"); playClick(); }}
                  className={`flex-1 h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${paymentMethod === "efectivo" ? "border-primary bg-primary/5 text-primary" : "border-default-200 text-default-500"}`}>
                  <Money size={16} /> Efectivo
                </button>
                <button onClick={() => { setPaymentMethod("nequi"); playClick(); }}
                  className={`flex-1 h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${paymentMethod === "nequi" ? "border-primary bg-primary/5 text-primary" : "border-default-200 text-default-500"}`}>
                  <DeviceMobile size={16} /> Nequi
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-default-500 uppercase tracking-wider mb-1 block">Notas</label>
              <div className="relative">
                <NoteBlank size={16} className="absolute left-3 top-3 text-default-400" />
                <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Instrucciones especiales..." rows={2}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all resize-none" />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white border-t border-default-100 p-3 shrink-0">
          <button onClick={handleCreate} disabled={saving || !customerName.trim()}
            className="w-full h-12 rounded-2xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 active:scale-[0.97] transition-all disabled:opacity-40 flex items-center justify-between px-5">
            {saving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : (
              <>
                <span className="flex items-center gap-2"><Check size={16} weight="bold" /> Enviar Pedido</span>
                <span className="tabular-nums">{formatCOP(total)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Product Selection ──
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Compact header */}
      <div className="border-b border-default-100 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-pink-400 shrink-0">
            <Strawberry size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-default-800 shrink-0">{companyName}</span>
          <div className="relative flex-1">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-default-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..."
              className="w-full h-8 pl-8 pr-8 rounded-lg bg-default-50 border border-default-200 text-xs outline-none focus:border-primary transition-all" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-default-400">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
          <button onClick={() => { setSelectedCategory(null); playClick(); }}
            className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-bold transition-all active:scale-95 ${!selectedCategory ? "bg-primary text-white" : "bg-default-100 text-default-500"}`}>
            Todo
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => { setSelectedCategory(c.slug); setSearch(""); playClick(); }}
              className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-bold transition-all active:scale-95 ${selectedCategory === c.slug ? "bg-primary text-white" : "bg-default-100 text-default-500"}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-default-300">
            <MagnifyingGlass size={32} weight="duotone" className="mb-2" />
            <p className="text-xs text-default-400">No hay productos</p>
          </div>
        ) : (
          <div>
            {grouped.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <div className="sticky top-0 z-10 bg-default-50 px-3 py-1.5 border-b border-default-100">
                    <p className="text-[10px] font-bold text-default-500 uppercase tracking-wider">{group.label}</p>
                  </div>
                )}
                {group.items.map((product) => {
                  const qty = getQty(product.id);
                  return (
                    <div key={product.id}
                      className="flex items-center gap-3 px-3 py-2.5 border-b border-default-50 active:bg-default-50 transition-colors">
                      {/* Icon */}
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${qty > 0 ? "bg-primary/10 text-primary" : "bg-default-50 text-default-400"}`}>
                        <ProductIcon name={product.icon || "ForkKnife"} size={20} weight={qty > 0 ? "fill" : "duotone"} />
                      </div>

                      {/* Name + Price — tappable to add */}
                      <button onClick={() => addToCart(product)} className="flex-1 min-w-0 text-left">
                        <p className={`text-sm font-medium leading-tight ${qty > 0 ? "text-default-900" : "text-default-700"}`}>{product.name}</p>
                        <p className="text-xs font-bold text-primary tabular-nums mt-0.5">{formatCOP(product.price)}</p>
                      </button>

                      {/* Quantity controls */}
                      {qty > 0 ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => decrement(product.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-default-200 text-default-500 active:scale-90 active:bg-default-100">
                            <Minus size={12} weight="bold" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-default-800 tabular-nums">{qty}</span>
                          <button onClick={() => increment(product.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white active:scale-90">
                            <Plus size={12} weight="bold" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(product)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary text-primary active:scale-90 active:bg-primary/10 shrink-0">
                          <Plus size={14} weight="bold" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Spacer for bottom bar */}
            {itemCount > 0 && <div className="h-16" />}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-default-100 px-3 py-2.5 z-30">
          <button onClick={() => setStep("info")}
            className="w-full h-12 rounded-2xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 active:scale-[0.97] transition-all flex items-center justify-between px-5">
            <span className="flex items-center gap-2">
              <ShoppingCart size={18} weight="bold" />
              Continuar
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">{itemCount}</span>
              {formatCOP(total)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ icon, label, value, onChange, placeholder, type }: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-default-500 uppercase tracking-wider mb-1 block">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400">{icon}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type || "text"}
          className="w-full h-11 pl-9 pr-3 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all" />
      </div>
    </div>
  );
}
