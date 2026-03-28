"use client";

import { ForkKnife } from "@phosphor-icons/react";
import { ProductIcon } from "@/lib/utils/product-icons";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface CategoryTabsProps {
  categories: Category[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {/* "Todos" */}
      <button
        onClick={() => onSelect(null)}
        className={`flex flex-col items-center justify-center gap-1 rounded-2xl w-[76px] h-[76px] transition-all duration-150 active:scale-95 select-none
          ${selected === null
            ? "bg-primary text-white shadow-lg shadow-primary/20"
            : "bg-default-50 text-default-400 border border-default-100 hover:bg-default-100 hover:text-default-600"
          }`}
      >
        <ForkKnife size={24} weight={selected === null ? "fill" : "duotone"} />
        <span className="text-[10px] font-bold leading-none">Todos</span>
      </button>

      {categories.map((cat) => {
        const isActive = selected === cat.slug;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.slug)}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl w-[76px] h-[76px] transition-all duration-150 active:scale-95 select-none
              ${isActive
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "bg-default-50 text-default-400 border border-default-100 hover:bg-default-100 hover:text-default-600"
              }`}
          >
            <ProductIcon name={cat.icon || "SquaresFour"} size={24} weight={isActive ? "fill" : "duotone"} />
            <span className="text-[10px] font-bold leading-none">{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
