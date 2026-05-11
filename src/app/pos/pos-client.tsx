"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CartProvider, useCart, type Topping, type CartItem } from "@/contexts/CartContext";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { Cart, FloatingCartButton } from "@/components/pos/Cart";
import { SearchBar } from "@/components/pos/SearchBar";
import { VirtualKeyboard } from "@/components/pos/VirtualKeyboard";
import { ToppingsModal, type ToppingOption } from "@/components/pos/ToppingsModal";
import { OrderInfoStep, type OrderInfo } from "@/components/pedidos/OrderInfoStep";
import { playAdd } from "@/lib/utils/sounds";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";
import { useCaja } from "@/contexts/CajaContext";
import { toast } from "@/lib/utils/toast";
import { buildKitchenTicket, printKitchenTicket } from "@/components/pos/KitchenTicket";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface Product {
  id: string;
  ref: string;
  name: string;
  price: number;
  image_url?: string;
  icon?: string;
  category_slug?: string;
  included_toppings_count?: number;
}

interface POSClientProps {
  categories: Category[];
  products: Product[];
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function isAddon(name: string, categorySlug?: string): boolean {
  return categorySlug === "extras-venta" ||
    categorySlug === "toppings" ||
    name.toLowerCase().startsWith("topping") ||
    name.toLowerCase().startsWith("salsa") ||
    name.toLowerCase().startsWith("adición");
}

type ModalState =
  | { mode: "add"; product: Product }
  | { mode: "edit"; line: CartItem };

const EMPTY_ORDER_INFO: OrderInfo = {
  orderType: "delivery",
  customerName: "",
  customerPhone: "",
  deliveryAddress: "",
  scheduledTime: "",
  orderNotes: "",
  paymentMethod: "efectivo",
};

/**
 * Flatten a cart line + its toppings into rows for order_items / sale_items.
 * Toppings become their own rows so fn_deduct_inventory (used by both POS
 * and fn_complete_order) picks them up naturally. Toppings flagged as
 * "included" carry unit_price=0; the base product keeps its own price.
 */
function flattenLineForDb(item: CartItem) {
  const rows = [
    {
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
    },
  ];
  for (const t of item.toppings ?? []) {
    const unit = t.charge ? t.price : 0;
    rows.push({
      product_id: t.product_id,
      product_name: t.name,
      quantity: item.quantity,
      unit_price: unit,
      subtotal: unit * item.quantity,
    });
  }
  return rows;
}

function POSInner({ categories, products }: POSClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useCaja();
  const { items, total, itemCount, addItem, updateToppings, clear } = useCart();

  // ── Routing-driven mode ─────────────────────────────────────
  // /pos        → cashier intends to sell on the spot
  // /pos?mode=order → cashier is building a deferred order (no register required)
  const initialModeIsOrder = searchParams.get("mode") === "order";

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [step, setStep] = useState<"products" | "info">("products");
  const [orderInfo, setOrderInfo] = useState<OrderInfo>(EMPTY_ORDER_INFO);
  const [saving, setSaving] = useState(false);
  const debouncedSearch = useDebounce(search, 150);

  // Auto-open info step if the cashier landed with ?mode=order and the cart
  // has items already (e.g. via deep-link from /pedidos). For an empty cart
  // we stay on products so they can add stuff first.
  useEffect(() => {
    if (initialModeIsOrder && items.length > 0 && step === "products") {
      // intentionally not auto-jumping; let the cashier hit "Datos del cliente"
    }
  }, [initialModeIsOrder, items.length, step]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory && !debouncedSearch.trim()) {
      result = result.filter((p) => p.category_slug === selectedCategory);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, selectedCategory, debouncedSearch]);

  const availableToppings: ToppingOption[] = useMemo(
    () =>
      products
        .filter((p) => p.category_slug === "toppings")
        .map((p) => ({ id: p.id, name: p.name, price: p.price, icon: p.icon, image_url: p.image_url })),
    [products],
  );

  function handleProductTap(p: Product) {
    const opensModal =
      !isAddon(p.name, p.category_slug)
      && availableToppings.length > 0
      && (p.included_toppings_count ?? 0) > 0;

    if (!opensModal) {
      addItem({
        product_id: p.id,
        name: p.name,
        price: p.price,
        image_url: p.image_url,
        category_slug: p.category_slug,
        included_toppings_count: p.included_toppings_count,
      });
      playAdd();
      return;
    }
    setModal({ mode: "add", product: p });
  }

  function handleEditLine(line: CartItem) {
    setModal({ mode: "edit", line });
  }

  function handleConfirmToppings(selected: Topping[]) {
    if (!modal) return;
    if (modal.mode === "add") {
      addItem({
        product_id: modal.product.id,
        name: modal.product.name,
        price: modal.product.price,
        image_url: modal.product.image_url,
        category_slug: modal.product.category_slug,
        included_toppings_count: modal.product.included_toppings_count,
        toppings: selected.length > 0 ? selected : undefined,
      });
    } else {
      updateToppings(modal.line.line_id, selected.length > 0 ? selected : undefined);
    }
    setModal(null);
  }

  // ── Save as deferred order ─────────────────────────────────
  const handleCreateOrder = useCallback(async () => {
    if (!orderInfo.customerName.trim()) { toast.error("Ingresa el nombre del cliente"); return; }
    if (items.length === 0) { toast.error("Agrega al menos un producto"); return; }

    setSaving(true);
    try {
      const client = createClient();
      const companyId = getActiveCompanyId();

      const { data: order, error } = await client
        .from("orders")
        .insert({
          order_type: orderInfo.orderType,
          customer_name: orderInfo.customerName.trim(),
          customer_phone: orderInfo.orderType === "delivery" ? (orderInfo.customerPhone.trim() || null) : null,
          delivery_address: orderInfo.orderType === "delivery" ? (orderInfo.deliveryAddress.trim() || null) : null,
          scheduled_time: orderInfo.orderType === "delivery" ? (orderInfo.scheduledTime || null) : null,
          status: "pending",
          payment_method: orderInfo.paymentMethod,
          total,
          notes: orderInfo.orderNotes.trim() || null,
          created_by: register?.opened_by || null,
          company_id: companyId,
        })
        .select("id, order_number")
        .single();

      if (error || !order) { toast.error("Error al crear pedido"); setSaving(false); return; }

      // Flatten cart lines (base + toppings) into order_items rows so the
      // future fn_complete_order copies them into sale_items intact.
      const orderItems = items
        .flatMap(flattenLineForDb)
        .map((row) => ({
          order_id: order.id,
          ...row,
          notes: null,
          company_id: companyId,
        }));

      await client.from("order_items").insert(orderItems);

      // Auto-print kitchen ticket (fire-and-forget).
      try {
        const ticket = await buildKitchenTicket(
          order.order_number,
          items.map((i) => ({ name: i.name, product_id: i.product_id, quantity: i.quantity })),
        );
        ticket.kind = "order";
        ticket.customerName = orderInfo.customerName.trim();
        ticket.orderType = orderInfo.orderType;
        if (orderInfo.orderType === "delivery") {
          if (orderInfo.deliveryAddress.trim()) ticket.deliveryAddress = orderInfo.deliveryAddress.trim();
          if (orderInfo.scheduledTime) ticket.scheduledTime = orderInfo.scheduledTime;
        }
        if (orderInfo.orderNotes.trim()) ticket.notes = orderInfo.orderNotes.trim();
        printKitchenTicket(ticket);
      } catch (err) {
        console.warn("[/pos save-order] kitchen ticket failed:", err);
      }

      clear();
      toast.success(`Pedido #${order.order_number} creado`);
      router.push("/pedidos");
    } finally {
      setSaving(false);
    }
  }, [orderInfo, items, total, register, clear, router]);

  // ── Step navigation ────────────────────────────────────────
  function goToInfo() {
    if (items.length === 0) { toast.error("Agrega al menos un producto"); return; }
    setStep("info");
  }
  function backToProducts() {
    setStep("products");
  }

  function handleOpenKeyboard() {
    setKeyboardOpen(true);
    setSelectedCategory(null);
  }

  function handleCloseKeyboard() {
    setKeyboardOpen(false);
    if (!search) setSearch("");
  }

  function handleKeyPress(char: string) { setSearch((prev) => prev + char); }
  function handleDelete() { setSearch((prev) => prev.slice(0, -1)); }
  function handleClear() { setSearch(""); }

  const modalProductName =
    modal?.mode === "add" ? modal.product.name :
    modal?.mode === "edit" ? modal.line.name : "";
  const modalInitial = modal?.mode === "edit" ? modal.line.toppings : undefined;
  const modalIncludedCount =
    modal?.mode === "add" ? (modal.product.included_toppings_count ?? 0) :
    modal?.mode === "edit" ? (modal.line.included_toppings_count ?? 0) : 0;

  // ── Info step screen ───────────────────────────────────────
  if (step === "info") {
    return (
      <OrderInfoStep
        itemCount={itemCount}
        total={total}
        saving={saving}
        info={orderInfo}
        setInfo={setOrderInfo}
        onBack={backToProducts}
        onCreate={handleCreateOrder}
      />
    );
  }

  // ── Products step (main POS layout) ────────────────────────
  return (
    <>
      <div className="flex h-full">
        {/* Products area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-default-100 bg-white px-4 py-2.5 space-y-2 shrink-0">
            <SearchBar
              value={search}
              onChange={setSearch}
              onFocus={handleOpenKeyboard}
              isActive={keyboardOpen}
            />
            {!keyboardOpen && (
              <CategoryTabs
                categories={categories}
                selected={selectedCategory}
                onSelect={(slug) => { setSelectedCategory(slug); setSearch(""); }}
              />
            )}
          </div>

          <div className="flex-1 overflow-auto bg-gray-50" onClick={() => keyboardOpen && handleCloseKeyboard()}>
            <ProductGrid products={filteredProducts} onProductTap={handleProductTap} />
          </div>

          {keyboardOpen && (
            <VirtualKeyboard
              onKey={handleKeyPress}
              onDelete={handleDelete}
              onClear={handleClear}
              onClose={handleCloseKeyboard}
            />
          )}
        </div>

        {/* Cart sidebar — desktop */}
        <div className="hidden lg:block w-[380px] shrink-0">
          <Cart
            onEditLine={handleEditLine}
            secondaryAction={{ label: "Datos del cliente →", onClick: goToInfo }}
          />
        </div>

        <FloatingCartButton onClick={() => setShowMobileCart(true)} />

        {showMobileCart && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileCart(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-[90%] max-w-[400px] animate-in slide-in-from-right duration-200">
              <Cart
                onEditLine={handleEditLine}
                secondaryAction={{ label: "Datos del cliente →", onClick: () => { setShowMobileCart(false); goToInfo(); } }}
              />
            </div>
          </div>
        )}
      </div>

      <ToppingsModal
        isOpen={!!modal}
        productName={modalProductName}
        toppings={availableToppings}
        initialSelection={modalInitial}
        includedCount={modalIncludedCount}
        mode={modal?.mode === "edit" ? "edit" : "add"}
        onCancel={() => setModal(null)}
        onConfirm={handleConfirmToppings}
      />
    </>
  );
}

export function POSClient({ categories, products }: POSClientProps) {
  return (
    <CartProvider>
      <POSInner categories={categories} products={products} />
    </CartProvider>
  );
}
