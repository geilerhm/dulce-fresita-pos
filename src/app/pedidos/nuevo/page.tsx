"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";
import { formatCOP } from "@/lib/utils/format";
import { toast } from "@/lib/utils/toast";
import { playAdd, playClick } from "@/lib/utils/sounds";
import { useRouter } from "next/navigation";
import { useCaja } from "@/contexts/CajaContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { SearchBar } from "@/components/pos/SearchBar";
import { VirtualKeyboard } from "@/components/pos/VirtualKeyboard";
import {
  ArrowLeft,
  Money,
  DeviceMobile,
  Check,
  User,
  Phone,
  MapPin,
  Clock,
  NoteBlank,
  ShoppingCart,
  Minus,
  Plus,
  Trash,
} from "@phosphor-icons/react";

interface Category { id: string; name: string; slug: string; icon?: string; }
interface Product { id: string; ref: string; name: string; price: number; image_url?: string; icon?: string; category_slug?: string; }

export default function NuevoPedidoPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const client = createClient();
      const companyId = getActiveCompanyId();
      if (!companyId) { setLoading(false); return; }

      const [catRes, prodRes] = await Promise.all([
        client.from("categories").select("id, name, slug, icon").eq("type", "product").eq("company_id", companyId).order("sort_order"),
        client.from("products").select("id, ref, name, price, image_url, icon, category:categories(slug)").eq("active", true).eq("available_in_pos", true).eq("company_id", companyId).order("sort_order"),
      ]);

      setCategories((catRes.data ?? []) as Category[]);
      setProducts((prodRes.data ?? []).map((p: any) => ({
        id: p.id, ref: p.ref ?? "", name: p.name, price: p.price,
        image_url: p.image_url, icon: p.icon,
        category_slug: p.category?.slug,
      })));
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <span className="h-8 w-8 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <CartProvider>
      <PedidoClient categories={categories} products={products} />
    </CartProvider>
  );
}

// ── Inner client (has access to CartProvider) ──

function PedidoClient({ categories, products }: { categories: Category[]; products: Product[] }) {
  const router = useRouter();
  const { register } = useCaja();
  const { items, total, itemCount, clear, increment, decrement, removeItem } = useCart();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [step, setStep] = useState<"products" | "info">("products");

  // Customer info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "nequi">("efectivo");
  const [saving, setSaving] = useState(false);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory && !search.trim()) result = result.filter((p) => p.category_slug === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q));
    }
    return result;
  }, [products, selectedCategory, search]);

  const handleCreate = useCallback(async () => {
    if (!customerName.trim()) { toast.error("Ingresa el nombre del cliente"); return; }
    if (items.length === 0) { toast.error("Agrega al menos un producto"); return; }

    setSaving(true);
    const client = createClient();
    const companyId = getActiveCompanyId();

    const { data: order, error } = await client
      .from("orders")
      .insert({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        delivery_address: deliveryAddress.trim() || null,
        scheduled_time: scheduledTime || null,
        status: "pending",
        payment_method: paymentMethod,
        total,
        notes: orderNotes.trim() || null,
        created_by: register?.opened_by || null,
        company_id: companyId,
      })
      .select("id, order_number")
      .single();

    if (error) { toast.error("Error al crear pedido"); setSaving(false); return; }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      notes: null,
      company_id: companyId,
    }));

    await client.from("order_items").insert(orderItems);
    clear();
    toast.success(`Pedido #${order.order_number} creado`);
    router.push("/pedidos");
  }, [customerName, customerPhone, deliveryAddress, scheduledTime, paymentMethod, total, orderNotes, items, register, clear, router]);

  // ── Step 2: Customer info ──
  if (step === "info") {
    return <CustomerInfoStep
      itemCount={itemCount} total={total} paymentMethod={paymentMethod}
      customerName={customerName} setCustomerName={setCustomerName}
      customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
      deliveryAddress={deliveryAddress} setDeliveryAddress={setDeliveryAddress}
      scheduledTime={scheduledTime} setScheduledTime={setScheduledTime}
      orderNotes={orderNotes} setOrderNotes={setOrderNotes}
      setPaymentMethod={setPaymentMethod}
      saving={saving} onBack={() => setStep("products")} onCreate={handleCreate}
    />;
  }

  // ── Step 1: Product selection (same layout as POS) ──
  return (
    <div className="flex h-full">
      {/* Products area — identical to POS */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-default-100 bg-white px-4 py-2.5 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/pedidos")} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-default-100 active:scale-95 transition-all shrink-0">
              <ArrowLeft size={20} className="text-default-500" />
            </button>
            <SearchBar
              value={search}
              onChange={setSearch}
              onFocus={() => { setKeyboardOpen(true); setSelectedCategory(null); }}
              isActive={keyboardOpen}
            />
          </div>
          {!keyboardOpen && (
            <CategoryTabs
              categories={categories}
              selected={selectedCategory}
              onSelect={(slug) => { setSelectedCategory(slug); setSearch(""); }}
            />
          )}
        </div>

        <div className="flex-1 overflow-auto bg-gray-50" onClick={() => keyboardOpen && setKeyboardOpen(false)}>
          <ProductGrid products={filteredProducts} />
        </div>

        {keyboardOpen && (
          <VirtualKeyboard
            onKey={(char) => setSearch((prev) => prev + char)}
            onDelete={() => setSearch((prev) => prev.slice(0, -1))}
            onClear={() => setSearch("")}
            onClose={() => setKeyboardOpen(false)}
          />
        )}
      </div>

      {/* Order sidebar — same style as Cart but with "Siguiente" instead of "Cobrar" */}
      <div className="hidden lg:flex w-[380px] shrink-0 h-full flex-col border-l border-default-100 bg-white">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-default-100">
          <ShoppingCart size={20} weight="duotone" className="text-amber-500" />
          <span className="font-bold text-default-800">Pedido</span>
          {itemCount > 0 && (
            <>
              <span className="ml-auto text-[11px] font-bold text-default-400 bg-default-100 rounded-full px-2.5 py-1 tabular-nums">
                {itemCount} items
              </span>
              <button onClick={clear}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-default-300 hover:text-red-500 hover:bg-red-50 transition-all">
                <Trash size={16} weight="bold" />
              </button>
            </>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-default-50 mb-4">
                <ShoppingCart size={32} weight="duotone" className="text-default-200" />
              </div>
              <p className="text-xs text-default-400 text-center leading-relaxed">
                Toca un producto<br />para agregarlo al pedido
              </p>
            </div>
          ) : (
            <div className="divide-y divide-default-100">
              {items.map((item) => (
                <div key={item.product_id} className="flex items-center gap-2 py-2.5 px-3">
                  <div className="flex-1 min-w-0 max-w-[140px]">
                    <p className="text-sm font-medium text-default-700 leading-tight line-clamp-2">{item.name}</p>
                    <p className="text-[11px] text-default-400 tabular-nums mt-0.5">{formatCOP(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => decrement(item.product_id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-default-200 bg-white text-default-500 hover:bg-default-100 active:scale-90 transition-all">
                      <Minus size={14} weight="bold" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-default-800 tabular-nums">{item.quantity}</span>
                    <button onClick={() => increment(item.product_id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-default-200 bg-white text-default-500 hover:bg-default-100 active:scale-90 transition-all">
                      <Plus size={14} weight="bold" />
                    </button>
                  </div>
                  <span className="w-[72px] text-right text-sm font-bold text-default-700 tabular-nums">
                    {formatCOP(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-default-100 p-4 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-default-400 tabular-nums">{itemCount} items</span>
              <span className="text-3xl font-extrabold text-default-900 tabular-nums tracking-tight">
                {formatCOP(total)}
              </span>
            </div>
            <button onClick={() => setStep("info")}
              className="w-full h-14 rounded-2xl bg-amber-500 text-white text-lg font-bold shadow-lg shadow-amber-500/25 hover:brightness-105 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
              Datos del Cliente →
            </button>
          </div>
        )}
      </div>

      {/* Mobile floating button */}
      {itemCount > 0 && (
        <button
          onClick={() => setStep("info")}
          className="fixed bottom-6 right-6 z-40 lg:hidden flex items-center gap-3 rounded-2xl bg-amber-500 text-white pl-5 pr-6 py-4 shadow-xl shadow-amber-500/30 hover:brightness-105 active:scale-95 transition-all"
        >
          <div className="relative">
            <ShoppingCart size={24} weight="fill" />
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-amber-500 text-[11px] font-bold">
              {itemCount}
            </span>
          </div>
          <span className="text-base font-bold tabular-nums">{formatCOP(total)}</span>
        </button>
      )}
    </div>
  );
}

// ── Customer Info Step (with virtual keyboard on desktop) ──

type FieldId = "name" | "phone" | "address" | "notes";

function CustomerInfoStep({
  itemCount, total, paymentMethod,
  customerName, setCustomerName,
  customerPhone, setCustomerPhone,
  deliveryAddress, setDeliveryAddress,
  scheduledTime, setScheduledTime,
  orderNotes, setOrderNotes,
  setPaymentMethod, saving, onBack, onCreate,
}: {
  itemCount: number; total: number; paymentMethod: "efectivo" | "nequi";
  customerName: string; setCustomerName: (v: string) => void;
  customerPhone: string; setCustomerPhone: (v: string) => void;
  deliveryAddress: string; setDeliveryAddress: (v: string) => void;
  scheduledTime: string; setScheduledTime: (v: string) => void;
  orderNotes: string; setOrderNotes: (v: string) => void;
  setPaymentMethod: (v: "efectivo" | "nequi") => void;
  saving: boolean; onBack: () => void; onCreate: () => void;
}) {
  const [activeField, setActiveField] = useState<FieldId | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const showKeyboard = isDesktop && activeField !== null;

  const fieldSetters: Record<FieldId, { get: string; set: (v: string) => void }> = {
    name: { get: customerName, set: setCustomerName },
    phone: { get: customerPhone, set: setCustomerPhone },
    address: { get: deliveryAddress, set: setDeliveryAddress },
    notes: { get: orderNotes, set: setOrderNotes },
  };

  function handleKey(char: string) {
    if (!activeField) return;
    const f = fieldSetters[activeField];
    f.set(f.get + char);
    playClick();
  }

  function handleDelete() {
    if (!activeField) return;
    const f = fieldSetters[activeField];
    f.set(f.get.slice(0, -1));
  }

  function handleClear() {
    if (!activeField) return;
    fieldSetters[activeField].set("");
  }

  function handleFocus(field: FieldId) {
    if (isDesktop) setActiveField(field);
  }

  const inputClass = (field: FieldId) =>
    `w-full h-14 pl-10 pr-4 rounded-2xl border-2 bg-white text-base font-medium outline-none transition-all ${
      activeField === field ? "border-primary ring-1 ring-primary/20" : "border-default-200"
    }`;

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="bg-white border-b border-default-100 px-6 py-4 flex items-center gap-3">
        <button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all">
          <ArrowLeft size={22} className="text-default-600" />
        </button>
        <h1 className="text-lg font-bold text-default-800">Datos del cliente</h1>
        <span className="ml-auto text-xs font-bold text-default-400 bg-default-100 rounded-full px-2.5 py-1">{itemCount} productos · {formatCOP(total)}</span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-md mx-auto space-y-4">
          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Nombre del cliente *</label>
            <div className="relative">
              <User size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
              <input value={customerName} onFocus={() => handleFocus("name")}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre completo" inputMode="text" autoComplete="name"
                className={inputClass("name")} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Teléfono</label>
            <div className="relative">
              <Phone size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
              <input value={customerPhone} onFocus={() => handleFocus("phone")}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="300 123 4567" type="tel" inputMode="tel" autoComplete="tel"
                className={inputClass("phone")} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Dirección de entrega</label>
            <div className="relative">
              <MapPin size={20} weight="duotone" className="absolute left-3 top-4 text-default-400" />
              <textarea value={deliveryAddress} onFocus={() => handleFocus("address")}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Calle, barrio, referencia..." rows={2} inputMode="text" autoComplete="street-address"
                className={`w-full pl-10 pr-4 py-3 rounded-2xl border-2 bg-white text-base font-medium outline-none transition-all resize-none ${
                  activeField === "address" ? "border-primary ring-1 ring-primary/20" : "border-default-200"
                }`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Hora de entrega</label>
              <div className="relative">
                <Clock size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
                <input value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} type="time"
                  onFocus={() => setActiveField(null)}
                  className="w-full h-14 pl-10 pr-4 rounded-2xl border-2 border-default-200 bg-white text-base font-medium outline-none focus:border-primary transition-all" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Método de pago</label>
              <div className="flex gap-2">
                <button onClick={() => { setPaymentMethod("efectivo"); playClick(); }}
                  className={`flex-1 h-14 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                    ${paymentMethod === "efectivo" ? "border-primary bg-primary/5 text-primary" : "border-default-200 text-default-500"}`}>
                  <Money size={20} /> Efectivo
                </button>
                <button onClick={() => { setPaymentMethod("nequi"); playClick(); }}
                  className={`flex-1 h-14 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                    ${paymentMethod === "nequi" ? "border-primary bg-primary/5 text-primary" : "border-default-200 text-default-500"}`}>
                  <DeviceMobile size={20} /> Nequi
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Notas</label>
            <div className="relative">
              <NoteBlank size={20} weight="duotone" className="absolute left-3 top-4 text-default-400" />
              <textarea value={orderNotes} onFocus={() => handleFocus("notes")}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Instrucciones especiales..." rows={2}
                className={`w-full pl-10 pr-4 py-3 rounded-2xl border-2 bg-white text-base font-medium outline-none transition-all resize-none ${
                  activeField === "notes" ? "border-primary ring-1 ring-primary/20" : "border-default-200"
                }`} />
            </div>
          </div>
        </div>
      </div>

      {/* Virtual keyboard (desktop only) */}
      {showKeyboard && (
        <VirtualKeyboard
          onKey={handleKey}
          onDelete={handleDelete}
          onClear={handleClear}
          onClose={() => setActiveField(null)}
        />
      )}

      {/* Create button */}
      {!showKeyboard && (
        <div className="bg-white border-t border-default-100 p-4">
          <button onClick={onCreate} disabled={saving || !customerName.trim()}
            className="w-full h-16 rounded-2xl bg-primary text-white text-xl font-bold shadow-lg shadow-primary/30 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? (
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Check size={24} weight="bold" /> Crear Pedido — {formatCOP(total)}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
