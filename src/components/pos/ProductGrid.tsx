"use client";

import { ProductCard } from "./ProductCard";
import { MagnifyingGlass } from "@phosphor-icons/react";

interface Product {
  id: string;
  ref: string;
  name: string;
  price: number;
  image_url?: string;
  icon?: string;
  category_slug?: string;
}

interface ProductGridProps {
  products: Product[];
  onProductAdded?: () => void;
}

export function ProductGrid({ products, onProductAdded }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-default-300">
        <MagnifyingGlass size={48} weight="duotone" className="mb-3" />
        <p className="text-base font-medium text-default-400">No hay productos aqui</p>
      </div>
    );
  }

  return (
    <div className="h-full p-4 overflow-auto">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            price={product.price}
            image_url={product.image_url ?? undefined}
            icon={product.icon ?? undefined}
            category_slug={product.category_slug}
            onAdded={onProductAdded}
          />
        ))}
      </div>
    </div>
  );
}
