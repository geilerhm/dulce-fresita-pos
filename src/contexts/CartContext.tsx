"use client";

import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from "react";

export interface Topping {
  product_id: string;
  name: string;
  price: number;
  charge: boolean;
}

export interface CartItem {
  line_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  category_slug?: string;
  /** Snapshot of the product's included topping cupo when this line was
   *  added. Needed in edit mode to render the "X/N incluidos" badge with
   *  the same N the cashier saw when configuring it. */
  included_toppings_count?: number;
  toppings?: Topping[];
}

interface CartState {
  items: CartItem[];
  total: number;
}

type CartAction =
  | { type: "ADD_ITEM"; product: Omit<CartItem, "quantity" | "line_id">; line_id: string }
  | { type: "REMOVE_ITEM"; line_id: string }
  | { type: "INCREMENT"; line_id: string }
  | { type: "DECREMENT"; line_id: string }
  | { type: "UPDATE_TOPPINGS"; line_id: string; toppings: Topping[] | undefined }
  | { type: "CLEAR" }
  | { type: "RESTORE"; state: CartState };

function lineSubtotal(item: CartItem): number {
  const toppingsCharged = (item.toppings ?? []).reduce(
    (s, t) => s + (t.charge ? t.price : 0),
    0,
  );
  return (item.price + toppingsCharged) * item.quantity;
}

function calcTotal(items: CartItem[]) {
  return items.reduce((s, i) => s + lineSubtotal(i), 0);
}

function sameToppings(a: Topping[] | undefined, b: Topping[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  // Order-independent comparison
  const key = (t: Topping) => `${t.product_id}:${t.charge ? 1 : 0}`;
  const aKeys = aa.map(key).sort();
  const bKeys = bb.map(key).sort();
  return aKeys.every((k, i) => k === bKeys[i]);
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      // Consolidate only when the product has no toppings AND there's an
      // existing line for the same product also without toppings. Lines
      // with toppings stay distinct so two helados with different toppings
      // don't collapse into one line.
      const hasToppings = (action.product.toppings?.length ?? 0) > 0;
      const existing = !hasToppings
        ? state.items.find(
            (i) =>
              i.product_id === action.product.product_id &&
              sameToppings(i.toppings, action.product.toppings),
          )
        : undefined;

      const items = existing
        ? state.items.map((i) =>
            i.line_id === existing.line_id ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [...state.items, { ...action.product, line_id: action.line_id, quantity: 1 }];
      return { items, total: calcTotal(items) };
    }
    case "REMOVE_ITEM": {
      const items = state.items.filter((i) => i.line_id !== action.line_id);
      return { items, total: calcTotal(items) };
    }
    case "INCREMENT": {
      const items = state.items.map((i) =>
        i.line_id === action.line_id ? { ...i, quantity: i.quantity + 1 } : i,
      );
      return { items, total: calcTotal(items) };
    }
    case "DECREMENT": {
      const items = state.items
        .map((i) => (i.line_id === action.line_id ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
      return { items, total: calcTotal(items) };
    }
    case "UPDATE_TOPPINGS": {
      // Replace toppings of a specific line in-place. Don't consolidate with
      // other lines even if the result matches — editing should never merge
      // two distinct lines silently.
      const items = state.items.map((i) =>
        i.line_id === action.line_id
          ? { ...i, toppings: action.toppings && action.toppings.length > 0 ? action.toppings : undefined }
          : i,
      );
      return { items, total: calcTotal(items) };
    }
    case "CLEAR":
      return { items: [], total: 0 };
    case "RESTORE":
      return action.state;
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  total: number;
  addItem: (product: Omit<CartItem, "quantity" | "line_id">) => void;
  removeItem: (line_id: string) => void;
  increment: (line_id: string) => void;
  decrement: (line_id: string) => void;
  updateToppings: (line_id: string, toppings: Topping[] | undefined) => void;
  clear: () => void;
  itemCount: number;
  lastAdded: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

function makeLineId(): string {
  // Prefer crypto.randomUUID when available; fall back for older browsers.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0 });
  const lastAddedRef = useRef<string | null>(null);
  const lastAddedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const addItem = useCallback((product: Omit<CartItem, "quantity" | "line_id">) => {
    dispatch({ type: "ADD_ITEM", product, line_id: makeLineId() });
    lastAddedRef.current = product.product_id;
    clearTimeout(lastAddedTimerRef.current);
    lastAddedTimerRef.current = setTimeout(() => { lastAddedRef.current = null; }, 600);
  }, []);

  const value: CartContextValue = {
    items: state.items,
    total: state.total,
    addItem,
    removeItem: (line_id) => dispatch({ type: "REMOVE_ITEM", line_id }),
    increment: (line_id) => dispatch({ type: "INCREMENT", line_id }),
    decrement: (line_id) => dispatch({ type: "DECREMENT", line_id }),
    updateToppings: (line_id, toppings) => dispatch({ type: "UPDATE_TOPPINGS", line_id, toppings }),
    clear: () => dispatch({ type: "CLEAR" }),
    itemCount: state.items.reduce((s, i) => s + i.quantity, 0),
    lastAdded: lastAddedRef.current,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
