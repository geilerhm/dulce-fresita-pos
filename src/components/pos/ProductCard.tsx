"use client";

import { formatCOP } from "@/lib/utils/format";
import { useCart } from "@/contexts/CartContext";
import { ProductIcon } from "@/lib/utils/product-icons";
import { playAdd } from "@/lib/utils/sounds";
import { useState } from "react";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  icon?: string;
  category_slug?: string;
  onAdded?: () => void;
}

export function ProductCard({ id, name, price, image_url, icon, category_slug, onAdded }: ProductCardProps) {
  const { addItem, items } = useCart();
  const qty = items.find((i) => i.product_id === id)?.quantity ?? 0;
  const inCart = qty > 0;
  const [animating, setAnimating] = useState(false);

  function handleAdd() {
    addItem({ product_id: id, name, price, image_url, category_slug });
    playAdd();
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
  }

  return (
    <button
      onClick={handleAdd}
      className={`group relative flex flex-col items-center rounded-2xl border bg-white p-5 transition-all duration-150 active:scale-[0.93] select-none w-full min-h-[170px]
        ${animating ? "animate-pulse-add" : ""}
        ${inCart
          ? "border-primary/30 shadow-md shadow-primary/10"
          : "border-default-100 shadow hover:shadow-lg hover:border-default-200"
        }`}
    >
      {/* Quantity badge */}
      {inCart && (
        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[11px] font-bold shadow-md z-10">
          {qty}
        </div>
      )}

      {/* Icon or Image */}
      <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-2xl mb-3 transition-transform group-hover:scale-105 group-active:scale-90
        ${inCart ? "bg-primary/10 text-primary" : "bg-default-50 text-default-400"}`}>
        {image_url ? (
          <img src={image_url} alt={name} className="h-full w-full rounded-2xl object-cover" />
        ) : (
          <ProductIcon
            name={icon || "ForkKnife"}
            size={32}
            weight={inCart ? "fill" : "duotone"}
          />
        )}
      </div>

      {/* Name */}
      <p className="w-full text-center text-sm font-semibold leading-snug text-default-700 line-clamp-2 min-h-[2.6em] mb-2">
        {name}
      </p>

      {/* Price */}
      <p className="text-base font-bold text-primary tabular-nums">
        {formatCOP(price)}
      </p>
    </button>
  );
}
