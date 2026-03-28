"use client";

import { useMemo, useState } from "react";
import { formatCOP } from "@/lib/utils/format";
import { useCart } from "@/contexts/CartContext";
import { playAdd } from "@/lib/utils/sounds";
import { ProductIcon } from "@/lib/utils/product-icons";
import { ArrowLeft } from "@phosphor-icons/react";
import { ScrollShadow } from "@heroui/react";

interface Product {
  id: string;
  ref: string;
  name: string;
  price: number;
  icon?: string;
  category_slug?: string;
}

interface SearchViewProps {
  products: Product[];
  onClose: () => void;
  onFilter: (query: string) => void;
}

export function SearchView({ products, onClose, onFilter }: SearchViewProps) {
  const { addItem, items } = useCart();
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    products.forEach((p) => {
      const first = p.name.charAt(0).toUpperCase();
      if (/[A-ZÁ-Ú]/.test(first)) letters.add(first);
    });
    return Array.from(letters).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!activeLetter) return [];
    return products.filter((p) => p.name.charAt(0).toUpperCase() === activeLetter);
  }, [products, activeLetter]);

  function handleSelectProduct(product: Product) {
    addItem({
      product_id: product.id,
      name: product.name,
      price: product.price,
      category_slug: product.category_slug,
    });
    playAdd();
  }

  function handleBack() {
    setActiveLetter(null);
    onFilter("");
    onClose();
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-default-100 shrink-0">
        <button
          onClick={handleBack}
          className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all"
        >
          <ArrowLeft size={22} className="text-default-600" />
        </button>
        <h2 className="text-base font-bold text-default-800">
          {activeLetter ? `Productos con "${activeLetter}"` : "Buscar producto"}
        </h2>
        {activeLetter && (
          <button
            onClick={() => setActiveLetter(null)}
            className="ml-auto text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-xl hover:bg-primary/5"
          >
            Ver letras
          </button>
        )}
      </div>

      <ScrollShadow className="flex-1 overflow-auto">
        {/* Letter grid — shown when no letter is selected */}
        {!activeLetter && (
          <div className="p-5">
            <p className="text-xs font-bold text-default-400 uppercase tracking-wider mb-4">Toca una letra</p>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {availableLetters.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setActiveLetter(letter)}
                  className="flex items-center justify-center h-16 rounded-2xl bg-white border border-default-200 text-xl font-bold text-default-700 hover:border-primary/30 hover:text-primary hover:shadow-md active:scale-95 transition-all select-none"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Product results — shown when a letter is selected */}
        {activeLetter && (
          <div className="p-4">
            {filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-default-300">
                <p className="text-sm">No hay productos con "{activeLetter}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredProducts.map((product) => {
                  const qty = items.find((i) => i.product_id === product.id)?.quantity ?? 0;
                  const inCart = qty > 0;
                  return (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className={`relative flex flex-col items-center rounded-2xl border bg-white p-4 transition-all active:scale-[0.93] select-none
                        ${inCart
                          ? "border-primary/30 shadow-md shadow-primary/10"
                          : "border-default-100 shadow hover:shadow-lg hover:border-default-200"
                        }`}
                    >
                      {inCart && (
                        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[11px] font-bold shadow-md z-10">
                          {qty}
                        </div>
                      )}
                      <div className={`flex h-14 w-14 items-center justify-center rounded-xl mb-2 ${inCart ? "bg-primary/10 text-primary" : "bg-default-50 text-default-400"}`}>
                        <ProductIcon name={product.icon || "ForkKnife"} size={26} weight={inCart ? "fill" : "duotone"} />
                      </div>
                      <p className="w-full text-center text-xs font-medium text-default-600 line-clamp-2 min-h-[2.4em] mb-1">
                        {product.name}
                      </p>
                      <p className="text-sm font-bold text-primary tabular-nums">{formatCOP(product.price)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ScrollShadow>
    </div>
  );
}
