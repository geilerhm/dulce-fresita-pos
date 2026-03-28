"use client";

import { useState, useMemo, useEffect } from "react";
import { CartProvider } from "@/contexts/CartContext";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { Cart, FloatingCartButton } from "@/components/pos/Cart";
import { SearchBar } from "@/components/pos/SearchBar";
import { VirtualKeyboard } from "@/components/pos/VirtualKeyboard";
import { ToastProvider } from "@heroui/react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
  id: string;
  ref: string;
  name: string;
  price: number;
  image_url?: string;
  icon?: string;
  category_slug?: string;
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

export function POSClient({ categories, products }: POSClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const debouncedSearch = useDebounce(search, 150);

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

  function handleOpenKeyboard() {
    setKeyboardOpen(true);
    setSelectedCategory(null);
  }

  function handleCloseKeyboard() {
    setKeyboardOpen(false);
    if (!search) setSearch("");
  }

  function handleKeyPress(char: string) {
    setSearch((prev) => prev + char);
  }

  function handleDelete() {
    setSearch((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setSearch("");
  }

  return (
    <CartProvider>
      <ToastProvider placement="top" />
      <div className="flex h-full">
        {/* Products area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
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
                onSelect={(slug) => {
                  setSelectedCategory(slug);
                  setSearch("");
                }}
              />
            )}
          </div>

          {/* Product grid — shrinks when keyboard is open */}
          <div className="flex-1 overflow-auto bg-gray-50">
            <ProductGrid products={filteredProducts} />
          </div>

          {/* Virtual keyboard — fixed at bottom */}
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
          <Cart />
        </div>

        {/* Floating cart — mobile */}
        <FloatingCartButton onClick={() => setShowMobileCart(true)} />

        {/* Mobile cart drawer */}
        {showMobileCart && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileCart(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-[90%] max-w-[400px] animate-in slide-in-from-right duration-200">
              <Cart />
            </div>
          </div>
        )}
      </div>
    </CartProvider>
  );
}
