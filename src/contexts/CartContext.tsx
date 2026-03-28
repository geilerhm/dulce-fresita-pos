"use client";

import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from "react";

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  category_slug?: string;
}

interface CartState {
  items: CartItem[];
  total: number;
}

type CartAction =
  | { type: "ADD_ITEM"; product: Omit<CartItem, "quantity"> }
  | { type: "REMOVE_ITEM"; product_id: string }
  | { type: "INCREMENT"; product_id: string }
  | { type: "DECREMENT"; product_id: string }
  | { type: "CLEAR" }
  | { type: "RESTORE"; state: CartState };

function calcTotal(items: CartItem[]) {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find((i) => i.product_id === action.product.product_id);
      const items = existing
        ? state.items.map((i) =>
            i.product_id === action.product.product_id ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [...state.items, { ...action.product, quantity: 1 }];
      return { items, total: calcTotal(items) };
    }
    case "REMOVE_ITEM": {
      const items = state.items.filter((i) => i.product_id !== action.product_id);
      return { items, total: calcTotal(items) };
    }
    case "INCREMENT": {
      const items = state.items.map((i) =>
        i.product_id === action.product_id ? { ...i, quantity: i.quantity + 1 } : i
      );
      return { items, total: calcTotal(items) };
    }
    case "DECREMENT": {
      const items = state.items
        .map((i) => (i.product_id === action.product_id ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
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
  addItem: (product: Omit<CartItem, "quantity">) => void;
  removeItem: (product_id: string) => void;
  increment: (product_id: string) => void;
  decrement: (product_id: string) => void;
  clear: () => void;
  itemCount: number;
  lastAdded: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0 });
  const lastAddedRef = useRef<string | null>(null);
  const lastAddedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const addItem = useCallback((product: Omit<CartItem, "quantity">) => {
    dispatch({ type: "ADD_ITEM", product });
    lastAddedRef.current = product.product_id;
    clearTimeout(lastAddedTimerRef.current);
    lastAddedTimerRef.current = setTimeout(() => { lastAddedRef.current = null; }, 600);
  }, []);

  const value: CartContextValue = {
    items: state.items,
    total: state.total,
    addItem,
    removeItem: (product_id) => dispatch({ type: "REMOVE_ITEM", product_id }),
    increment: (product_id) => dispatch({ type: "INCREMENT", product_id }),
    decrement: (product_id) => dispatch({ type: "DECREMENT", product_id }),
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
