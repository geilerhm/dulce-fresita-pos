"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";
import { formatCOP } from "@/lib/utils/format";
import { ProductIcon } from "@/lib/utils/product-icons";
import { playAdd, playSuccess, playRemove } from "@/lib/utils/sounds";
import { toast } from "@/lib/utils/toast";
import {
  MagnifyingGlass,
  ArrowLeft,
  Plus,
  X,
  CookingPot,
  Trash,
  Check,
  Funnel,
} from "@phosphor-icons/react";
import { SearchWithKeyboard } from "@/components/ui/SearchWithKeyboard";

/* ────────────────────────── Types ────────────────────────── */

interface Product {
  id: string;
  ref: string;
  name: string;
  price: number;
  cost: number;
  icon: string;
  category_id: string | null;
}

interface Ingredient {
  id: string;
  ref: string;
  name: string;
  unit: string;
  cost_per_unit: number;
}

interface RecipeRow {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredient: Ingredient;
}

/* ────────────────────────── Page ─────────────────────────── */

export default function RecetasPage() {
  const supabase = createClient();

  /* ── State ── */
  const [products, setProducts] = useState<Product[]>([]);
  const [recipeCounts, setRecipeCounts] = useState<
    Record<string, { count: number; cost: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlySinReceta, setOnlySinReceta] = useState(false);

  // Detail view
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  // Add ingredient panel
  const [adding, setAdding] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [selectedIngredient, setSelectedIngredient] =
    useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── Fetch products + recipe summaries ── */
  const fetchProducts = useCallback(async () => {
    const companyId = getActiveCompanyId();
    const { data: prods } = await supabase
      .from("products")
      .select("id, ref, name, price, cost, icon, category_id")
      .eq("company_id", companyId)
      .order("name");

    setProducts((prods as Product[]) ?? []);

    // Get recipe summaries (count + cost per product)
    const { data: recipes } = await supabase
      .from("recipes")
      .select("product_id, quantity, ingredient:ingredients(cost_per_unit)")
      .eq("company_id", companyId);

    const counts: Record<string, { count: number; cost: number }> = {};
    if (recipes) {
      for (const r of recipes as unknown as Array<{
        product_id: string;
        quantity: number;
        ingredient: { cost_per_unit: number } | null;
      }>) {
        if (!counts[r.product_id]) {
          counts[r.product_id] = { count: 0, cost: 0 };
        }
        counts[r.product_id].count++;
        counts[r.product_id].cost +=
          r.quantity * (r.ingredient?.cost_per_unit ?? 0);
      }
    }
    setRecipeCounts(counts);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Fetch recipe detail for a product ── */
  const fetchRecipe = useCallback(
    async (productId: string) => {
      setLoadingRecipe(true);
      const companyId = getActiveCompanyId();
      const { data } = await supabase
        .from("recipes")
        .select("id, product_id, ingredient_id, quantity, unit, ingredient:ingredients(id, ref, name, unit, cost_per_unit)")
        .eq("company_id", companyId)
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      setRecipeRows((data as unknown as RecipeRow[]) ?? []);
      setLoadingRecipe(false);
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ── Fetch all ingredients (for add panel) ── */
  const fetchIngredients = useCallback(async () => {
    const companyId = getActiveCompanyId();
    const { data } = await supabase
      .from("ingredients")
      .select("id, ref, name, unit, cost_per_unit")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name");

    setIngredients((data as Ingredient[]) ?? []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Open product detail ── */
  const openDetail = useCallback(
    (product: Product) => {
      setSelectedProduct(product);
      setAdding(false);
      setSelectedIngredient(null);
      setQuantity("");
      setDeletingId(null);
      fetchRecipe(product.id);
    },
    [fetchRecipe]
  );

  /* ── Recalculate product cost ── */
  const recalcProductCost = useCallback(
    async (productId: string) => {
      const companyId = getActiveCompanyId();
      const { data } = await supabase
        .from("recipes")
        .select("quantity, ingredient:ingredients(cost_per_unit)")
        .eq("company_id", companyId)
        .eq("product_id", productId);

      let totalCost = 0;
      if (data) {
        for (const r of data as unknown as Array<{
          quantity: number;
          ingredient: { cost_per_unit: number } | null;
        }>) {
          totalCost += r.quantity * (r.ingredient?.cost_per_unit ?? 0);
        }
      }

      await supabase
        .from("products")
        .update({ cost: Math.round(totalCost) })
        .eq("id", productId);

      // Update local product state
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, cost: Math.round(totalCost) } : p
        )
      );
      if (selectedProduct?.id === productId) {
        setSelectedProduct((prev) =>
          prev ? { ...prev, cost: Math.round(totalCost) } : prev
        );
      }

      // Update recipe counts
      setRecipeCounts((prev) => ({
        ...prev,
        [productId]: {
          count: data?.length ?? prev[productId]?.count ?? 0,
          cost: Math.round(totalCost),
        },
      }));
    },
    [selectedProduct] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ── Add ingredient to recipe ── */
  const handleAdd = useCallback(async () => {
    if (!selectedProduct || !selectedIngredient || !quantity) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    const { error } = await supabase.from("recipes").upsert(
      {
        product_id: selectedProduct.id,
        ingredient_id: selectedIngredient.id,
        quantity: qty,
        unit: selectedIngredient.unit,
        company_id: getActiveCompanyId(),
      },
      { onConflict: "product_id,ingredient_id,company_id" }
    );

    if (error) {
      toast.error("Error al agregar ingrediente");
    } else {
      playAdd();
      toast.success("Ingrediente agregado");
      setSelectedIngredient(null);
      setQuantity("");
      await fetchRecipe(selectedProduct.id);
      await recalcProductCost(selectedProduct.id);
    }
  }, [
    supabase,
    selectedProduct,
    selectedIngredient,
    quantity,
    fetchRecipe,
    recalcProductCost,
  ]);

  /* ── Delete ingredient from recipe ── */
  const handleDelete = useCallback(
    async (recipeId: string) => {
      if (!selectedProduct) return;
      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipeId)
        .eq("company_id", getActiveCompanyId());

      if (error) {
        toast.error("Error al eliminar ingrediente");
      } else {
        playRemove();
        toast.success("Ingrediente eliminado");
        setDeletingId(null);
        await fetchRecipe(selectedProduct.id);
        await recalcProductCost(selectedProduct.id);
      }
    },
    [selectedProduct, fetchRecipe, recalcProductCost] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ── Filtered products ── */
  const filteredProducts = useMemo(() => {
    let list = products;
    if (onlySinReceta) {
      list = list.filter((p) => !recipeCounts[p.id] || recipeCounts[p.id].count === 0);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.ref.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, search, onlySinReceta, recipeCounts]);

  /* ── Filtered ingredients for add panel ── */
  const filteredIngredients = useMemo(() => {
    if (!ingredientSearch.trim()) return ingredients;
    const q = ingredientSearch.toLowerCase();
    return ingredients.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.ref.toLowerCase().includes(q)
    );
  }, [ingredients, ingredientSearch]);

  /* ── Recipe cost & margin helpers ── */
  const recipeTotalCost = useMemo(() => {
    return recipeRows.reduce(
      (sum, r) => sum + r.quantity * (r.ingredient?.cost_per_unit ?? 0),
      0
    );
  }, [recipeRows]);

  const marginPercent = useCallback(
    (price: number, cost: number) => {
      if (price <= 0) return 0;
      return ((price - cost) / price) * 100;
    },
    []
  );

  const marginColor = useCallback((margin: number) => {
    if (margin > 50) return "text-emerald-600";
    if (margin >= 30) return "text-amber-600";
    return "text-red-600";
  }, []);

  const marginBg = useCallback((margin: number) => {
    if (margin > 50) return "bg-emerald-50 text-emerald-700";
    if (margin >= 30) return "bg-amber-50 text-amber-700";
    return "bg-red-50 text-red-700";
  }, []);

  /* ────────────────────────── DETAIL VIEW ───────────────────── */

  if (selectedProduct) {
    const margin = marginPercent(selectedProduct.price, recipeTotalCost);

    return (
      <div className="flex h-full flex-col bg-gray-50">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-default-100 bg-white">
          <button
            onClick={() => {
              setSelectedProduct(null);
              fetchProducts();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-default-100 transition-colors"
          >
            <ArrowLeft size={22} weight="duotone" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ProductIcon
                name={selectedProduct.icon}
                size={24}
                weight="duotone"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-default-900">
                {selectedProduct.name}
              </h1>
              <p className="text-sm text-default-500">
                Receta y costeo del producto
              </p>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left column: Recipe ingredients */}
          <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-4">
            {/* Price / Cost / Margin summary */}
            <div className="rounded-2xl bg-white border border-default-100 p-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
                    Precio venta
                  </p>
                  <p className="text-xl tabular-nums font-extrabold text-default-900 mt-1">
                    {formatCOP(selectedProduct.price)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
                    Costo receta
                  </p>
                  <p className="text-xl tabular-nums font-extrabold text-default-900 mt-1">
                    {formatCOP(Math.round(recipeTotalCost))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
                    Margen
                  </p>
                  <p
                    className={`text-xl tabular-nums font-extrabold mt-1 ${marginColor(margin)}`}
                  >
                    {margin.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Ingredients list */}
            <div className="rounded-2xl bg-white border border-default-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
                  Ingredientes ({recipeRows.length})
                </p>
              </div>

              {loadingRecipe ? (
                <div className="flex items-center justify-center py-12 text-default-400">
                  <CookingPot
                    size={32}
                    weight="duotone"
                    className="animate-pulse"
                  />
                </div>
              ) : recipeRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-default-400 gap-2">
                  <CookingPot size={40} weight="duotone" />
                  <p className="text-sm">Sin ingredientes</p>
                  <p className="text-xs text-default-300">
                    Agrega ingredientes a esta receta
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {recipeRows.map((row) => {
                    const rowCost =
                      row.quantity *
                      (row.ingredient?.cost_per_unit ?? 0);
                    const isDeleting = deletingId === row.id;

                    return (
                      <div
                        key={row.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-default-50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-default-900 truncate">
                            {row.ingredient?.name}
                          </p>
                          <p className="text-xs text-default-400">
                            {row.quantity} {row.unit} ×{" "}
                            {formatCOP(
                              row.ingredient?.cost_per_unit ?? 0
                            )}
                            /{row.unit}
                          </p>
                        </div>
                        <p className="text-sm tabular-nums font-extrabold text-default-700">
                          {formatCOP(Math.round(rowCost))}
                        </p>
                        {isDeleting ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                              <Check size={16} weight="bold" />
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-default-100 text-default-500 hover:bg-default-200 transition-colors"
                            >
                              <X size={16} weight="bold" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(row.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-default-300 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash size={16} weight="duotone" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add ingredient button */}
              <button
                onClick={() => {
                  setAdding(true);
                  setSelectedIngredient(null);
                  setQuantity("");
                  setIngredientSearch("");
                  fetchIngredients();
                }}
                className="flex items-center justify-center gap-2 w-full h-11 mt-4 rounded-xl bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-colors"
              >
                <Plus size={18} weight="bold" />
                Agregar ingrediente
              </button>
            </div>
          </div>

          {/* Right column: Add panel or summary */}
          <div className="w-[420px] border-l border-default-100 overflow-y-auto bg-white p-6">
            {adding ? (
              /* ── Add ingredient panel ── */
              <div className="flex flex-col h-full gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
                    Seleccionar ingrediente
                  </p>
                  <button
                    onClick={() => {
                      setAdding(false);
                      setSelectedIngredient(null);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-default-100 transition-colors text-default-400"
                  >
                    <X size={18} weight="bold" />
                  </button>
                </div>

                {/* Search ingredients */}
                <SearchWithKeyboard value={ingredientSearch} onChange={setIngredientSearch} placeholder="Buscar ingrediente..." />

                {selectedIngredient ? (
                  /* ── Quantity input ── */
                  <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div>
                      <p className="font-semibold text-default-900">
                        {selectedIngredient.name}
                      </p>
                      <p className="text-xs text-default-500">
                        {formatCOP(selectedIngredient.cost_per_unit)} /{" "}
                        {selectedIngredient.unit}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-default-500 uppercase tracking-wider">
                        Cantidad ({selectedIngredient.unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Ej: 0.5"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full h-11 mt-1 px-4 rounded-xl border border-default-200 bg-white text-sm tabular-nums font-extrabold outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                        autoFocus
                      />
                      {quantity && parseFloat(quantity) > 0 && (
                        <p className="text-xs text-default-400 mt-1">
                          Costo:{" "}
                          {formatCOP(
                            Math.round(
                              parseFloat(quantity) *
                                selectedIngredient.cost_per_unit
                            )
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedIngredient(null)}
                        className="flex-1 h-11 rounded-xl border border-default-200 text-default-600 text-sm font-semibold hover:bg-default-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAdd}
                        disabled={
                          !quantity ||
                          parseFloat(quantity) <= 0 ||
                          isNaN(parseFloat(quantity))
                        }
                        className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Ingredient list ── */
                  <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
                    {filteredIngredients.map((ing) => {
                      const alreadyInRecipe = recipeRows.some(
                        (r) => r.ingredient_id === ing.id
                      );
                      return (
                        <button
                          key={ing.id}
                          onClick={() => {
                            setSelectedIngredient(ing);
                            // Pre-fill quantity if already exists
                            const existing = recipeRows.find(
                              (r) => r.ingredient_id === ing.id
                            );
                            if (existing) {
                              setQuantity(String(existing.quantity));
                            } else {
                              setQuantity("");
                            }
                          }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-default-50 transition-colors ${alreadyInRecipe ? "bg-primary/5" : ""}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-default-900 truncate">
                              {ing.name}
                              {alreadyInRecipe && (
                                <span className="ml-2 text-xs text-primary font-medium">
                                  (en receta)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-default-400">
                              {ing.unit} ·{" "}
                              {formatCOP(ing.cost_per_unit)}/{ing.unit}
                            </p>
                          </div>
                          <Plus
                            size={16}
                            weight="bold"
                            className="text-default-300"
                          />
                        </button>
                      );
                    })}
                    {filteredIngredients.length === 0 && (
                      <p className="text-sm text-default-400 text-center py-8">
                        No se encontraron ingredientes
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ── Summary panel ── */
              <div className="flex flex-col gap-6">
                <p className="text-xs font-bold text-default-500 uppercase tracking-wider">
                  Resumen de costos
                </p>

                {recipeRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-default-300 gap-2">
                    <CookingPot size={40} weight="duotone" />
                    <p className="text-sm">Sin ingredientes aún</p>
                  </div>
                ) : (
                  <>
                    {/* Cost breakdown */}
                    <div className="flex flex-col gap-2">
                      {recipeRows.map((row) => {
                        const rowCost =
                          row.quantity *
                          (row.ingredient?.cost_per_unit ?? 0);
                        const pct =
                          recipeTotalCost > 0
                            ? (rowCost / recipeTotalCost) * 100
                            : 0;
                        return (
                          <div key={row.id} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-default-700 truncate">
                                {row.ingredient?.name}
                              </p>
                              <p className="text-sm tabular-nums font-extrabold text-default-700">
                                {pct.toFixed(1)}%
                              </p>
                            </div>
                            <div className="h-1.5 rounded-full bg-default-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary/60 transition-all"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Totals */}
                    <div className="rounded-2xl border border-default-100 p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-default-500">Costo</p>
                        <p className="text-sm tabular-nums font-extrabold text-default-900">
                          {formatCOP(Math.round(recipeTotalCost))}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-default-500">Precio</p>
                        <p className="text-sm tabular-nums font-extrabold text-default-900">
                          {formatCOP(selectedProduct.price)}
                        </p>
                      </div>
                      <div className="border-t border-default-100 pt-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-default-700">
                          Margen
                        </p>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm tabular-nums font-extrabold ${marginBg(margin)}`}
                        >
                          {margin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ────────────────────────── MAIN LIST VIEW ────────────────── */

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-default-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CookingPot size={24} weight="duotone" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-default-900">Recetas</h1>
            <p className="text-sm text-default-500">
              Costeo y composición de productos
            </p>
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="px-6 py-4 flex items-center gap-3">
        <div className="max-w-md flex-1">
          <SearchWithKeyboard value={search} onChange={setSearch} placeholder="Buscar producto..." />
        </div>
        <button
          onClick={() => setOnlySinReceta((v) => !v)}
          className={`flex h-11 items-center gap-2 px-4 rounded-xl border text-sm font-semibold transition-colors ${
            onlySinReceta
              ? "border-primary bg-primary/10 text-primary"
              : "border-default-200 bg-white text-default-600 hover:bg-default-50"
          }`}
        >
          <Funnel size={18} weight={onlySinReceta ? "fill" : "duotone"} />
          Solo sin receta
        </button>
      </div>

      {/* Product table */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-default-400">
            <CookingPot
              size={40}
              weight="duotone"
              className="animate-pulse"
            />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-default-400 gap-2">
            <CookingPot size={48} weight="duotone" />
            <p className="text-sm">No se encontraron productos</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-default-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-default-50">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-default-500 w-12" />
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-default-500">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-default-500">
                    # Ingredientes
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-default-500">
                    Costo
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-default-500">
                    Precio
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-default-500">
                    Margen %
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const summary = recipeCounts[product.id];
                  const hasRecipe = summary && summary.count > 0;
                  const cost = summary?.cost ?? 0;
                  const margin = marginPercent(product.price, cost);

                  return (
                    <tr
                      key={product.id}
                      onClick={() => openDetail(product)}
                      className="border-t border-default-50 hover:bg-default-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <ProductIcon
                            name={product.icon}
                            size={20}
                            weight="duotone"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-default-900 truncate">
                          {product.name}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasRecipe ? (
                          <span className="text-sm tabular-nums font-medium text-default-700">
                            {summary.count}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600">
                            Sin receta
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm tabular-nums font-extrabold text-default-700">
                          {hasRecipe ? formatCOP(Math.round(cost)) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm tabular-nums font-extrabold text-default-700">
                          {formatCOP(product.price)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasRecipe ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs tabular-nums font-extrabold ${marginBg(margin)}`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-sm text-default-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
