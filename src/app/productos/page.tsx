"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveCompanyId } from "@/lib/supabase/company";
import { ProductIcon, ICON_CATEGORIES } from "@/lib/utils/product-icons";
import { formatCOP } from "@/lib/utils/format";
import { NumericKeypad } from "@/components/ui/NumericKeypad";
import { playSuccess, playAdd, playRemove } from "@/lib/utils/sounds";
import { toast } from "sonner";
import {
  MagnifyingGlass,
  Plus,
  ArrowLeft,
  TrashSimple,
  Check,
  X,
  Warning,
  PencilSimple,
  ArrowCounterClockwise,
  CaretUp,
  CaretDown,
  Circle,
  CookingPot,
  Palette,
  Trash,
  Backspace,
} from "@phosphor-icons/react";
import { SearchWithKeyboard } from "@/components/ui/SearchWithKeyboard";
import { TextInputWithKeyboard } from "@/components/ui/TextInputWithKeyboard";
import { useBackGesture } from "@/lib/hooks/useBackGesture";

// ── Types ──────────────────────────────────────────

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
  cost: number;
  description: string;
  icon: string;
  category_id: string;
  category_name?: string;
  available_in_pos: boolean;
  active: boolean;
  sort_order: number;
}

interface RecipeRow { id: string; ingredient_id: string; ingredient_name: string; quantity: number; unit: string; cost_per_unit: number; }
interface IngredientOption { id: string; name: string; unit: string; cost_per_unit: number; }

type View = "list" | "view" | "edit" | "new";
type SortKey = "name" | "price" | null;
type SortDir = "asc" | "desc";
type RightTab = "icon" | "recipe";

const EMPTY_PRODUCT: Omit<Product, "id" | "category_name"> = {
  ref: "",
  name: "",
  price: 0,
  cost: 0,
  description: "",
  icon: "IceCream",
  category_id: "",
  available_in_pos: true,
  active: true,
  sort_order: 0,
};

// ── Main Page ──────────────────────────────────────

export default function ProductosPage() {
  const supabase = createClient();

  const [view, setView] = useState<View>("list");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Ref auto-suggest
  const [refManual, setRefManual] = useState(false);
  const [refDuplicate, setRefDuplicate] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Recipe state
  const [rightTab, setRightTab] = useState<RightTab>("icon");
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [allIngredients, setAllIngredients] = useState<IngredientOption[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [addingIngredient, setAddingIngredient] = useState<IngredientOption | null>(null);
  const [addQty, setAddQty] = useState("");
  const [addIngCost, setAddIngCost] = useState("");
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeNumpadTarget, setRecipeNumpadTarget] = useState<"qty" | "cost">("qty");

  // Back gesture: swipe right from left edge
  useBackGesture(view !== "list" ? goBack : null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const companyId = getActiveCompanyId();
    if (!companyId) { setLoading(false); return; }
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from("categories").select("id, name, slug").eq("company_id", companyId).eq("type", "product").order("sort_order"),
      supabase.from("products").select("id, ref, name, price, cost, description, icon, category_id, available_in_pos, active, sort_order, category:categories(name)").eq("company_id", companyId).order("sort_order"),
    ]);
    setCategories(cats ?? []);
    setProducts(
      (prods ?? []).map((p) => ({
        ...p,
        cost: p.cost ?? 0,
        description: p.description ?? "",
        icon: p.icon ?? "IceCream",
        category_name: (p.category as unknown as { name: string } | null)?.name ?? "",
      }))
    );
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = products;
    if (!showInactive) list = list.filter((p) => p.active);
    if (filterCategory) list = list.filter((p) => p.category_id === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q));
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const mul = sortDir === "asc" ? 1 : -1;
        if (sortKey === "name") return mul * a.name.localeCompare(b.name);
        if (sortKey === "price") return mul * (a.price - b.price);
        return 0;
      });
    }
    return list;
  }, [products, showInactive, filterCategory, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 text-default-300 inline-flex flex-col leading-none"><CaretUp size={10} /><CaretDown size={10} className="-mt-0.5" /></span>;
    return sortDir === "asc" ? <CaretUp size={12} weight="bold" className="ml-1 text-primary" /> : <CaretDown size={12} weight="bold" className="ml-1 text-primary" />;
  }

  // Recipe functions
  async function fetchRecipe(productId: string) {
    const companyId = getActiveCompanyId();
    const { data } = await supabase
      .from("recipes")
      .select("id, ingredient_id, quantity, unit, ingredient:ingredients(name, cost_per_unit)")
      .eq("company_id", companyId)
      .eq("product_id", productId);
    setRecipeRows((data ?? []).map((r) => ({
      id: r.id, ingredient_id: r.ingredient_id, quantity: r.quantity, unit: r.unit,
      ingredient_name: (r.ingredient as unknown as { name: string })?.name ?? "",
      cost_per_unit: (r.ingredient as unknown as { cost_per_unit: number })?.cost_per_unit ?? 0,
    })));
  }

  async function fetchIngredients() {
    const companyId = getActiveCompanyId();
    const { data } = await supabase.from("ingredients").select("id, name, unit, cost_per_unit").eq("company_id", companyId).eq("active", true).order("name");
    setAllIngredients((data ?? []) as IngredientOption[]);
  }

  async function handleAddIngredient() {
    if (!addingIngredient || !editProduct || !addQty) return;
    const qty = parseFloat(addQty);
    if (isNaN(qty) || qty <= 0) return;

    const { error } = await supabase.from("recipes").upsert({
      product_id: editProduct.id, ingredient_id: addingIngredient.id, quantity: qty, unit: addingIngredient.unit, company_id: getActiveCompanyId(),
    }, { onConflict: "product_id,ingredient_id,company_id" });

    if (error) { toast.error("Error al agregar ingrediente"); return; }

    // If user edited the total cost, derive the new cost_per_unit and update ingredient
    const totalCost = parseInt(addIngCost) || 0;
    const suggestedTotal = Math.round(qty * addingIngredient.cost_per_unit);
    if (totalCost > 0 && totalCost !== suggestedTotal && qty > 0) {
      const newCostPerUnit = Math.round(totalCost / qty);
      if (newCostPerUnit !== addingIngredient.cost_per_unit) {
        await supabase.from("ingredients").update({ cost_per_unit: newCostPerUnit }).eq("id", addingIngredient.id);
      }
    }

    playAdd();
    toast.success("Ingrediente agregado");
    setAddingIngredient(null);
    setEditingRecipeId(null);
    setAddQty("");
    setAddIngCost("");
    await fetchRecipe(editProduct.id);
    await recalcCost(editProduct.id);
  }

  function startEditIngredient(row: RecipeRow) {
    setEditingRecipeId(row.id);
    setAddingIngredient({ id: row.ingredient_id, name: row.ingredient_name, unit: row.unit, cost_per_unit: row.cost_per_unit });
    setAddQty(String(row.quantity));
    setAddIngCost(String(row.cost_per_unit));
  }

  async function handleRemoveIngredient(recipeId: string) {
    if (!editProduct) return;
    const { error } = await supabase.from("recipes").delete().eq("id", recipeId).eq("company_id", getActiveCompanyId());
    if (error) { toast.error("Error al eliminar ingrediente"); return; }
    playRemove();
    toast.success("Ingrediente eliminado");
    await fetchRecipe(editProduct.id);
    await recalcCost(editProduct.id);
  }

  async function recalcCost(productId: string) {
    const companyId = getActiveCompanyId();
    const { data } = await supabase
      .from("recipes")
      .select("quantity, ingredient:ingredients(cost_per_unit)")
      .eq("company_id", companyId)
      .eq("product_id", productId) as unknown as { data: { quantity: number; ingredient: { cost_per_unit: number } | null }[] | null };
    const cost = (data ?? []).reduce((s, r) => s + r.quantity * (r.ingredient?.cost_per_unit ?? 0), 0);
    await supabase.from("products").update({ cost: Math.round(cost) }).eq("id", productId).eq("company_id", getActiveCompanyId());
    setForm((f) => ({ ...f, cost: Math.round(cost) }));
  }

  function openView(product: Product) {
    setEditProduct(product);
    setView("view");
    setRightTab("recipe");
    setAddingIngredient(null);
    setIngredientSearch("");
    fetchRecipe(product.id);
    fetchIngredients();
  }

  function openEdit(product?: Product) {
    const p = product || editProduct;
    if (!p) return;
    setEditProduct(p);
    setForm({ ref: p.ref, name: p.name, price: p.price, cost: p.cost, description: p.description, icon: p.icon, category_id: p.category_id, available_in_pos: p.available_in_pos, active: p.active, sort_order: p.sort_order });
    setView("edit");
    setConfirmDelete(false);
    setRightTab("icon");
    setAddingIngredient(null);
    setIngredientSearch("");
    setRefManual(true); // In edit mode, ref is already set
    setRefDuplicate(false);
    fetchRecipe(p.id);
    fetchIngredients();
  }

  // Words to skip when generating the ref code
  const STOP_WORDS = new Set(["de", "del", "con", "y", "la", "el", "las", "los", "en", "a", "por", "para", "un", "una"]);
  const SIZE_UNITS = new Set(["oz", "ml", "gr", "kg", "lt", "l", "und", "pers"]);

  function generateRef(name: string): string {
    const clean = name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Merge number + unit that are separated by space (e.g. "12 oz" → "12OZ")
    const merged = clean.replace(/(\d+)\s+(oz|ml|gr|kg|lt|l|und|pers)\b/gi, "$1$2");
    const tokens = merged.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return "";

    const parts: string[] = [];
    // Count meaningful words (not stop words, not pure numbers/sizes)
    const meaningful = tokens.filter(t => !STOP_WORDS.has(t.toLowerCase()) && !/^\d+$/i.test(t));

    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (STOP_WORDS.has(lower)) continue;
      // Keep size tokens (9oz, 12oz, x10, etc.) as-is
      if (/^\d+\w*$/.test(token) || /^x\d+/i.test(token)) {
        parts.push(token.toUpperCase());
      } else if (meaningful.length <= 2) {
        // Few words → take first 4 chars
        parts.push(token.substring(0, 4).toUpperCase());
      } else {
        // Many words → take first 3 chars for first word, first letter for rest
        parts.push(parts.length === 0 ? token.substring(0, 3).toUpperCase() : token[0].toUpperCase());
      }
    }

    return parts.join("-") || clean.substring(0, 6).toUpperCase();
  }

  function ensureUniqueRef(base: string): string {
    const existingRefs = new Set(products.map((p) => p.ref.toUpperCase()));
    // If editing, exclude the current product's ref
    if (editProduct) existingRefs.delete(editProduct.ref.toUpperCase());
    if (!existingRefs.has(base.toUpperCase())) return base;
    // Append -2, -3, etc.
    for (let i = 2; i <= 99; i++) {
      const candidate = `${base}-${i}`;
      if (!existingRefs.has(candidate.toUpperCase())) return candidate;
    }
    return base;
  }

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name }));
    // Auto-suggest ref only in new mode and if user hasn't manually edited
    if (view === "new" && !refManual) {
      const suggested = ensureUniqueRef(generateRef(name));
      setForm((f) => ({ ...f, name, ref: suggested }));
      setRefDuplicate(false);
    }
  }

  function handleRefChange(ref: string) {
    setRefManual(true);
    setForm((f) => ({ ...f, ref }));
    // Check uniqueness
    const existingRefs = new Set(products.map((p) => p.ref.toUpperCase()));
    if (editProduct) existingRefs.delete(editProduct.ref.toUpperCase());
    setRefDuplicate(existingRefs.has(ref.toUpperCase()));
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const companyId = getActiveCompanyId();

    const { data, error } = await supabase
      .from("categories")
      .insert({ name, slug, type: "product", sort_order: categories.length, company_id: companyId })
      .select("id, name, slug")
      .single();

    if (error) {
      toast.error(error.code === "23505" ? "Esta categoría ya existe" : "Error al crear categoría");
      return;
    }

    setCategories((prev) => [...prev, data]);
    setForm((f) => ({ ...f, category_id: data.id }));
    setNewCategoryName("");
    toast.success(`Categoría "${name}" creada`);
  }

  function openNew() {
    setEditProduct(null);
    setForm({ ...EMPTY_PRODUCT, category_id: categories[0]?.id ?? "" });
    setView("new");
    setConfirmDelete(false);
    setRightTab("icon");
    setRecipeRows([]);
    setRefManual(false);
    setRefDuplicate(false);
    setNewCategoryName("");
  }

  function goBack() {
    setView("list"); setEditProduct(null); setConfirmDelete(false); setRecipeRows([]); setAddingIngredient(null);
    fetchData();
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (!form.ref.trim()) { toast.error("El código es requerido"); return; }
    if (refDuplicate) { toast.error("Este código ya existe"); return; }
    if (!form.category_id) { toast.error("Selecciona una categoría"); return; }

    setSaving(true);
    const payload = { ref: form.ref, name: form.name, price: form.price, cost: form.cost, description: form.description, icon: form.icon, category_id: form.category_id, available_in_pos: form.available_in_pos, active: form.active, sort_order: form.sort_order };
    if (view === "edit" && editProduct) {
      const { error } = await supabase.from("products").update(payload).eq("id", editProduct.id).eq("company_id", getActiveCompanyId());
      if (error) { toast.error(error.code === "23505" ? "Este código ya existe" : `Error: ${error.message}`); setSaving(false); return; }
      playSuccess();
      toast.success("Producto actualizado");
      setSaving(false);
      setView("list");
      setEditProduct(null);
      fetchData();
    } else {
      // Create product, then open in edit mode so user can add ingredients
      const { data, error } = await supabase.from("products").insert({ ...payload, company_id: getActiveCompanyId() }).select("id, ref, name, price, cost, description, icon, category_id, available_in_pos, active, sort_order").single();
      if (error) { toast.error(error.code === "23505" ? "Este código ya existe" : `Error: ${error.message}`); setSaving(false); return; }
      await fetchData();
      setSaving(false);
      if (data) {
        const newProduct: Product = { ...data, cost: data.cost ?? 0, description: data.description ?? "", icon: data.icon ?? "IceCream", category_name: categories.find(c => c.id === data.category_id)?.name ?? "" };
        setEditProduct(newProduct);
        setView("edit");
        setRightTab("recipe");
        setRefManual(true);
        fetchRecipe(newProduct.id);
        fetchIngredients();
        playSuccess();
        toast.success("Producto creado — agrega ingredientes a la receta");
      }
    }
  }

  async function handleDeactivate() {
    if (!editProduct) return;
    setSaving(true);
    await supabase.from("products").update({ active: false }).eq("id", editProduct.id);
    playSuccess();
    toast.success("Producto desactivado");
    await fetchData();
    setSaving(false);
    goBack();
  }

  async function handleDelete() {
    if (!editProduct) return;
    setSaving(true);
    const companyId = getActiveCompanyId();
    // Delete recipes first (FK constraint)
    await supabase.from("recipes").delete().eq("product_id", editProduct.id).eq("company_id", companyId);
    const { error } = await supabase.from("products").delete().eq("id", editProduct.id).eq("company_id", companyId);
    if (error) {
      toast.error("No se puede eliminar: tiene ventas asociadas");
      setSaving(false);
      return;
    }
    playRemove();
    toast.success("Producto eliminado");
    await fetchData();
    setSaving(false);
    setView("list");
    setEditProduct(null);
  }

  async function handleReactivate(id: string) {
    await supabase.from("products").update({ active: true }).eq("id", id);
    playSuccess();
    toast.success("Producto reactivado");
    fetchData();
  }

  // ── VIEW MODE (read-only detail) ──────────────────

  if (view === "view" && editProduct) {
    const margin = editProduct.price > 0 && editProduct.cost > 0 ? ((editProduct.price - editProduct.cost) / editProduct.price * 100) : 0;
    const catName = editProduct.category_name || categories.find((c) => c.id === editProduct.category_id)?.name || "";

    return (
      <div className="flex h-full bg-gray-50">
        {/* LEFT — Product info */}
        <div className="w-[360px] shrink-0 flex flex-col border-r border-default-100 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-default-100">
            <button onClick={() => { setView("list"); setEditProduct(null); setRecipeRows([]); }} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all">
              <ArrowLeft size={22} className="text-default-600" />
            </button>
            <h1 className="text-lg font-bold text-default-800">Producto</h1>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            {/* Preview card */}
            <div className="rounded-2xl bg-default-50 border border-default-100 p-6 flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-default-100 text-default-500 mb-3">
                <ProductIcon name={editProduct.icon} size={40} />
              </div>
              <p className="text-xl font-bold text-default-900">{editProduct.name}</p>
              <p className="text-xs text-default-400 mt-0.5">{editProduct.ref}</p>
              <p className="text-2xl font-extrabold tabular-nums text-primary mt-2">{formatCOP(editProduct.price)}</p>
              {editProduct.cost > 0 && (
                <p className="text-xs text-default-400 tabular-nums mt-1">
                  Costo: {formatCOP(editProduct.cost)} · Margen: {margin.toFixed(0)}%
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3 justify-center">
                {catName && <span className="text-[10px] font-bold text-default-500 bg-default-100 px-2.5 py-1 rounded-full">{catName}</span>}
                {editProduct.active ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Activo</span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Inactivo</span>
                )}
                {editProduct.available_in_pos && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">En POS</span>
                )}
              </div>
            </div>
          </div>

          {/* Edit button */}
          <div className="p-4 border-t border-default-100 space-y-2">
            <button onClick={() => openEdit()} className="w-full h-14 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
              <PencilSimple size={20} weight="bold" /> Editar producto
            </button>
            <button onClick={() => { setView("list"); setEditProduct(null); setRecipeRows([]); }} className="w-full h-12 rounded-2xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 active:scale-[0.97] transition-all">
              Volver
            </button>
          </div>
        </div>

        {/* RIGHT — Recipe (read-only) */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-4">
              <CookingPot size={20} weight="duotone" className="text-default-400" />
              <p className="text-xs font-bold text-default-500 uppercase tracking-wider">Receta ({recipeRows.length} ingredientes)</p>
            </div>

            {recipeRows.length === 0 ? (
              <div className="rounded-2xl bg-default-50 border border-default-100 p-10 text-center text-default-400">
                <CookingPot size={40} weight="duotone" className="mx-auto mb-3" />
                <p className="text-sm">Este producto no tiene receta</p>
                <button onClick={() => openEdit()} className="mt-3 text-sm font-bold text-primary hover:underline">
                  Agregar receta
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Cost summary */}
                <div className="rounded-2xl bg-default-50 border border-default-100 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-default-400">Costo total</p>
                    <p className="text-xl font-extrabold tabular-nums text-default-900">{formatCOP(editProduct.cost)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-default-400">Margen</p>
                    <p className={`text-xl font-extrabold tabular-nums ${margin > 50 ? "text-emerald-600" : margin > 30 ? "text-amber-600" : "text-red-600"}`}>
                      {margin.toFixed(0)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-default-400">Ganancia</p>
                    <p className="text-xl font-extrabold tabular-nums text-default-700">{formatCOP(editProduct.price - editProduct.cost)}</p>
                  </div>
                </div>

                {/* Ingredients table */}
                <div className="rounded-2xl bg-white border border-default-100 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-default-50 text-[10px] font-bold text-default-500 uppercase tracking-wider">
                        <th className="text-left px-4 py-2">Ingrediente</th>
                        <th className="text-right px-4 py-2">Cantidad</th>
                        <th className="text-right px-4 py-2">Costo/ud</th>
                        <th className="text-right px-4 py-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipeRows.map((row, idx) => (
                        <tr key={row.id} className={`${idx > 0 ? "border-t border-default-50" : ""}`}>
                          <td className="px-4 py-2.5 text-sm font-medium text-default-800">{row.ingredient_name}</td>
                          <td className="px-4 py-2.5 text-sm tabular-nums text-default-600 text-right">{row.quantity} {row.unit}</td>
                          <td className="px-4 py-2.5 text-xs tabular-nums text-default-400 text-right">{formatCOP(row.cost_per_unit)}</td>
                          <td className="px-4 py-2.5 text-sm tabular-nums font-bold text-default-700 text-right">{formatCOP(Math.round(row.quantity * row.cost_per_unit))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT / NEW VIEW ──────────────────────────────

  if (view === "edit" || view === "new") {
    const nameEmpty = form.name.trim() === "";
    const refEmpty = form.ref.trim() === "";

    return (
      <div className="flex h-full bg-gray-50">
        {/* LEFT — Preview + Danger zone */}
        <div className="w-[320px] shrink-0 flex flex-col border-r border-default-100 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-default-100">
            <button onClick={goBack} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all">
              <ArrowLeft size={22} className="text-default-600" />
            </button>
            <h1 className="text-lg font-bold text-default-800">{view === "new" ? "Nuevo producto" : "Editar producto"}</h1>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            {/* Preview */}
            <div className="rounded-2xl bg-default-50 border border-default-100 p-6 flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <ProductIcon name={form.icon} size={40} />
              </div>
              <p className="text-lg font-bold text-default-900">{form.name || "Sin nombre"}</p>
              <p className="text-xs text-default-400 mt-0.5">{form.ref || "Sin código"}</p>
              <p className="text-2xl font-extrabold tabular-nums text-primary mt-2">{formatCOP(form.price)}</p>
              {form.cost > 0 && (
                <p className="text-xs text-default-400 tabular-nums mt-1">
                  Costo: {formatCOP(form.cost)}{form.price > 0 && form.cost > 0 ? ` · Margen: ${((form.price - form.cost) / form.price * 100).toFixed(0)}%` : ""}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                {form.active ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Activo</span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Inactivo</span>
                )}
                {form.available_in_pos && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">En POS</span>
                )}
              </div>
            </div>

            {/* Danger zone */}
            {!view.startsWith("new") && editProduct && (
              <div className="rounded-2xl bg-red-50/50 border border-red-200 p-5 space-y-2">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Zona de peligro</p>
                {editProduct.active && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-red-300 text-red-500 font-bold text-sm hover:bg-red-100 transition-colors active:scale-95"
                  >
                    <TrashSimple size={18} weight="duotone" />
                    Desactivar
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors active:scale-95 disabled:opacity-40"
                >
                  <Trash size={18} weight="bold" />
                  Eliminar permanentemente
                </button>
              </div>
            )}
          </div>

          {/* Bottom actions */}
          <div className="p-4 border-t border-default-100 space-y-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-14 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Check size={20} weight="bold" /> {view === "new" ? "Crear producto" : "Guardar"}</>
              )}
            </button>
            <button onClick={goBack} className="w-full h-12 rounded-2xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 active:scale-[0.97] transition-all">
              Cancelar
            </button>
          </div>
        </div>

        {/* CENTER — Form fields */}
        <div className="flex-1 overflow-auto p-6 border-r border-default-100">
          <div className="max-w-md space-y-6">
            {/* Name */}
            <TextInputWithKeyboard
              value={form.name}
              onChange={handleNameChange}
              label="Nombre *"
              placeholder="Ej: Ensalada de Frutas"
            />

            {/* Ref */}
            <TextInputWithKeyboard
              value={form.ref}
              onChange={handleRefChange}
              label="Código *"
              placeholder="Ej: ENS-001"
              uppercase
              error={refDuplicate ? "Este código ya existe" : undefined}
            />

            {/* Category */}
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-2 block">Categoría</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category_id: cat.id }))}
                    className={`h-11 px-5 rounded-xl text-sm font-bold transition-all active:scale-95
                      ${form.category_id === cat.id ? "bg-primary text-white shadow-sm" : "bg-default-100 text-default-600 hover:bg-default-200"}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              {/* Crear categoría inline */}
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                  placeholder="Nueva categoría..."
                  className="flex-1 h-10 px-3 rounded-xl border border-dashed border-default-300 bg-white text-sm outline-none focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim()}
                  className="h-10 px-4 rounded-xl bg-default-100 text-default-600 text-sm font-semibold hover:bg-default-200 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Plus size={14} weight="bold" /> Crear
                </button>
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-2 block">Precio</label>
              <NumericKeypad value={form.price} onChange={(n) => setForm((f) => ({ ...f, price: n }))} label="Precio del producto" />
            </div>
          </div>
        </div>

        {/* RIGHT — Tabs: Icono & Estado / Receta */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-default-100 rounded-xl p-1 mx-5 mt-5 shrink-0">
            <button onClick={() => setRightTab("icon")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all ${rightTab === "icon" ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}>
              <Palette size={16} weight={rightTab === "icon" ? "fill" : "regular"} />
              Icono & Estado
            </button>
            <button onClick={() => { setRightTab("recipe"); if (editProduct) { fetchRecipe(editProduct.id); fetchIngredients(); } }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all ${rightTab === "recipe" ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}>
              <CookingPot size={16} weight={rightTab === "recipe" ? "fill" : "regular"} />
              Receta
              {recipeRows.length > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{recipeRows.length}</span>}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            {rightTab === "icon" ? (
              <>
                {/* Icon picker */}
                <div>
                  <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-2 block">Ícono</label>
                  <IconPicker selected={form.icon} onSelect={(icon) => setForm((f) => ({ ...f, icon }))} />
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-default-500 uppercase tracking-wider">Estado</p>
                  <div className="flex items-center justify-between rounded-2xl bg-default-50 border border-default-100 p-4">
                    <div><p className="text-sm font-bold text-default-800">Activo</p><p className="text-[11px] text-default-400">Se muestra en el catálogo</p></div>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                      className={`relative w-14 h-8 rounded-full transition-colors ${form.active ? "bg-emerald-500" : "bg-default-300"}`}>
                      <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-default-50 border border-default-100 p-4">
                    <div><p className="text-sm font-bold text-default-800">En POS</p><p className="text-[11px] text-default-400">Aparece al vender</p></div>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, available_in_pos: !f.available_in_pos }))}
                      className={`relative w-14 h-8 rounded-full transition-colors ${form.available_in_pos ? "bg-emerald-500" : "bg-default-300"}`}>
                      <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${form.available_in_pos ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                </div>
              </>
            ) : view === "new" ? (
              /* Recipe not available for new products */
              <div className="flex flex-col items-center justify-center py-12 text-default-300">
                <CookingPot size={40} weight="duotone" className="mb-3" />
                <p className="text-sm text-default-400 text-center">Guarda el producto primero<br />para agregar su receta</p>
              </div>
            ) : (
              /* Recipe editor */
              <>
                {/* Cost summary */}
                {recipeRows.length > 0 && (
                  <div className="rounded-2xl bg-default-50 border border-default-100 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-default-500 uppercase tracking-wider">Costo receta</p>
                      <p className="text-lg font-extrabold tabular-nums text-default-900 mt-0.5">{formatCOP(form.cost)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-default-400">Margen</p>
                      <p className={`text-lg font-extrabold tabular-nums ${form.price > 0 && form.cost > 0 ? (((form.price - form.cost) / form.price * 100) > 50 ? "text-emerald-600" : ((form.price - form.cost) / form.price * 100) > 30 ? "text-amber-600" : "text-red-600") : "text-default-300"}`}>
                        {form.price > 0 && form.cost > 0 ? `${((form.price - form.cost) / form.price * 100).toFixed(0)}%` : "—"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Ingredient list */}
                <div>
                  <p className="text-xs font-bold text-default-500 uppercase tracking-wider mb-2">
                    Ingredientes ({recipeRows.length})
                  </p>
                  {recipeRows.length === 0 ? (
                    <div className="rounded-2xl bg-default-50 border border-default-100 p-6 text-center text-default-400">
                      <CookingPot size={32} weight="duotone" className="mx-auto mb-2" />
                      <p className="text-xs">Sin ingredientes aún</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-default-100 overflow-hidden">
                      {recipeRows.map((row, idx) => (
                        <div key={row.id} className={`flex items-center gap-3 px-3 py-2.5 ${idx > 0 ? "border-t border-default-50" : ""}`}>
                          <button onClick={() => startEditIngredient(row)} className="flex-1 min-w-0 text-left hover:bg-default-50 rounded-lg px-1 py-0.5 -mx-1 transition-colors">
                            <p className="text-xs font-semibold text-default-800 truncate">{row.ingredient_name}</p>
                            <p className="text-[10px] text-default-400 tabular-nums">{row.quantity} {row.unit} · {formatCOP(Math.round(row.quantity * row.cost_per_unit))} <span className="text-primary/60">· Editar</span></p>
                          </button>
                          <button onClick={() => handleRemoveIngredient(row.id)}
                            className="flex h-9 px-2.5 items-center justify-center gap-1 rounded-lg text-red-400 bg-red-50 border border-red-200 hover:bg-red-100 hover:text-red-600 active:scale-90 transition-all shrink-0 text-[11px] font-bold">
                            <Trash size={12} weight="bold" />
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add ingredient */}
                {addingIngredient ? (
                  <div className="rounded-2xl p-4 space-y-3 bg-primary/5 border border-primary/20">
                    <p className="text-xs font-bold text-primary">
                      {editingRecipeId ? "Editar" : "Agregar"}: {addingIngredient.name}
                    </p>
                    {/* Quantity + Cost displays */}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setRecipeNumpadTarget("qty")}
                        className={`rounded-xl border p-3 text-left transition-all ${recipeNumpadTarget === "qty" ? "border-primary bg-primary/5" : "border-default-200 bg-white"}`}>
                        <p className="text-[10px] text-default-400 font-semibold">Cantidad ({addingIngredient.unit})</p>
                        <p className={`text-lg font-extrabold tabular-nums mt-0.5 ${addQty ? "text-default-900" : "text-default-300"}`}>{addQty || "0"}</p>
                      </button>
                      <button onClick={() => setRecipeNumpadTarget("cost")}
                        className={`rounded-xl border p-3 text-left transition-all ${recipeNumpadTarget === "cost" ? "border-primary bg-primary/5" : "border-default-200 bg-white"}`}>
                        <p className="text-[10px] text-default-400 font-semibold">Costo total</p>
                        <p className={`text-lg font-extrabold tabular-nums mt-0.5 ${addIngCost ? "text-default-900" : "text-default-300"}`}>
                          {formatCOP(parseInt(addIngCost) || 0)}
                        </p>
                      </button>
                    </div>
                    {(() => {
                      const qty = parseFloat(addQty) || 0;
                      const suggestedCost = Math.round(qty * addingIngredient.cost_per_unit);
                      const actualCost = parseInt(addIngCost) || 0;
                      const diff = actualCost - suggestedCost;
                      if (qty <= 0) return null;
                      return (
                        <p className="text-[10px] tabular-nums">
                          <span className="text-default-500">{addQty} {addingIngredient.unit} × {formatCOP(addingIngredient.cost_per_unit)}/{addingIngredient.unit} = {formatCOP(suggestedCost)}</span>
                          {diff !== 0 && (
                            <span className={`font-bold ml-1.5 ${diff < 0 ? "text-red-500" : "text-emerald-600"}`}>
                              ({diff > 0 ? "+" : ""}{formatCOP(diff)})
                            </span>
                          )}
                        </p>
                      );
                    })()}
                    {/* Inline numpad */}
                    <RecipeNumpad value={recipeNumpadTarget === "qty" ? addQty : addIngCost} onChange={(v) => {
                      if (recipeNumpadTarget === "qty") {
                        setAddQty(v);
                        // Auto-update cost based on new quantity
                        const qty = parseFloat(v) || 0;
                        setAddIngCost(String(Math.round(qty * addingIngredient.cost_per_unit)));
                      } else {
                        setAddIngCost(v);
                      }
                    }} allowDecimal={recipeNumpadTarget === "qty"} />
                    <div className="flex gap-2">
                      <button onClick={handleAddIngredient} disabled={!addQty || parseFloat(addQty) <= 0}
                        className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-40">
                        {editingRecipeId ? "Guardar" : "Agregar"}
                      </button>
                      <button onClick={() => { setAddingIngredient(null); setEditingRecipeId(null); setAddQty(""); setAddIngCost(""); }}
                        className="h-10 px-4 rounded-xl bg-default-100 text-default-500 text-sm font-semibold active:scale-95 transition-all">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2">
                      <SearchWithKeyboard value={ingredientSearch} onChange={setIngredientSearch} placeholder="Buscar ingrediente..." />
                    </div>
                    <div className="rounded-2xl border border-default-100 overflow-hidden max-h-[200px] overflow-auto">
                      {allIngredients
                        .filter((i) => !ingredientSearch || i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
                        .filter((i) => !recipeRows.some((r) => r.ingredient_id === i.id))
                        .slice(0, 15)
                        .map((ing, idx) => (
                          <button key={ing.id} onClick={() => { setAddingIngredient(ing); setAddIngCost(String(ing.cost_per_unit)); setIngredientSearch(""); }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-default-50 active:bg-default-100 transition-colors text-xs ${idx > 0 ? "border-t border-default-50" : ""}`}>
                            <span className="font-semibold text-default-700 truncate">{ing.name}</span>
                            <span className="text-default-400 shrink-0 ml-2">{ing.unit}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
            <div className="animate-in zoom-in-95 fade-in duration-200 rounded-2xl bg-white p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
                  <Warning size={28} weight="duotone" className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-default-900 mb-1">Desactivar producto</h3>
                <p className="text-sm text-default-500 mb-5">"{editProduct?.name}" se ocultará del POS.</p>
                <div className="space-y-2 w-full">
                  <button
                    onClick={() => { setConfirmDelete(false); handleDeactivate(); }}
                    disabled={saving}
                    className="w-full h-14 rounded-xl text-base font-bold text-white bg-red-500 hover:bg-red-600 active:scale-[0.97] transition-all"
                  >
                    Si, desactivar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="w-full h-12 rounded-xl text-sm font-semibold text-default-500 bg-default-100 hover:bg-default-200 active:scale-[0.97] transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="shrink-0 border-b border-default-100 bg-white px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-default-800">Productos</h1>
            <p className="text-xs text-default-400 mt-0.5">{filtered.length} productos</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 h-12 px-6 rounded-2xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 hover:brightness-105 active:scale-95 transition-all"
          >
            <Plus size={18} weight="bold" />
            Nuevo Producto
          </button>
        </div>

        {/* Search */}
        <div className="mb-3">
          <SearchWithKeyboard value={search} onChange={setSearch} placeholder="Buscar por nombre o código..." />
        </div>

        {/* Category pills + inactive toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory(null)}
            className={`h-11 px-5 rounded-xl text-sm font-bold transition-all active:scale-95 ${filterCategory === null ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(filterCategory === cat.id ? null : cat.id)}
              className={`h-11 px-5 rounded-xl text-sm font-bold transition-all active:scale-95 ${filterCategory === cat.id ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}
            >
              {cat.name}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-default-400 font-semibold">Inactivos</span>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`relative w-14 h-8 rounded-full transition-colors ${showInactive ? "bg-primary" : "bg-default-300"}`}
            >
              <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${showInactive ? "translate-x-6" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-default-300">
            <MagnifyingGlass size={40} weight="duotone" className="mb-2" />
            <p className="text-sm text-default-400">No se encontraron productos</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-default-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-default-50 text-xs font-bold text-default-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 w-12">Icono</th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => toggleSort("name")} className="inline-flex items-center hover:text-default-700 transition-colors">
                      Nombre <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Código</th>
                  <th className="text-left px-4 py-3">Categoría</th>
                  <th className="text-right px-4 py-3">
                    <button onClick={() => toggleSort("price")} className="inline-flex items-center hover:text-default-700 transition-colors ml-auto">
                      Precio <SortIcon col="price" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 hidden lg:table-cell">Costo</th>
                  <th className="text-center px-4 py-3 hidden lg:table-cell">Margen</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-center px-4 py-3 hidden md:table-cell">POS</th>
                  <th className="text-right px-4 py-3 w-28">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => openView(product)}
                    className="border-t border-default-50 hover:bg-default-50/50 cursor-pointer transition-colors group h-12"
                  >
                    {/* Icono */}
                    <td className="px-4 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100 text-default-500 shrink-0">
                        <ProductIcon name={product.icon} size={20} />
                      </div>
                    </td>
                    {/* Nombre */}
                    <td className="px-4 py-2">
                      <span className="text-sm font-bold text-default-800">{product.name}</span>
                    </td>
                    {/* Código */}
                    <td className="px-4 py-2 hidden md:table-cell">
                      <span className="text-xs text-default-400">{product.ref}</span>
                    </td>
                    {/* Categoría */}
                    <td className="px-4 py-2">
                      <span className="text-[11px] font-semibold text-default-500 bg-default-100 px-2.5 py-1 rounded-full">
                        {product.category_name}
                      </span>
                    </td>
                    {/* Precio */}
                    <td className="px-4 py-2 text-right">
                      <span className="text-sm font-bold tabular-nums text-primary">{formatCOP(product.price)}</span>
                    </td>
                    {/* Costo */}
                    <td className="px-4 py-2 text-right hidden lg:table-cell">
                      <span className="text-xs tabular-nums font-semibold text-default-500">
                        {product.cost > 0 ? formatCOP(product.cost) : "—"}
                      </span>
                    </td>
                    {/* Margen */}
                    <td className="px-4 py-2 text-center hidden lg:table-cell">
                      {product.cost > 0 && product.price > 0 ? (
                        <span className={`text-[10px] tabular-nums font-bold px-2 py-0.5 rounded-full ${
                          ((product.price - product.cost) / product.price * 100) > 50 ? "text-emerald-700 bg-emerald-50" :
                          ((product.price - product.cost) / product.price * 100) > 30 ? "text-amber-700 bg-amber-50" :
                          "text-red-700 bg-red-50"
                        }`}>
                          {((product.price - product.cost) / product.price * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-default-300">—</span>
                      )}
                    </td>
                    {/* Estado */}
                    <td className="px-4 py-2 text-center">
                      {product.active ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Activo</span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Inactivo</span>
                      )}
                    </td>
                    {/* POS */}
                    <td className="px-4 py-2 text-center hidden md:table-cell">
                      {product.available_in_pos ? (
                        <Circle size={10} weight="fill" className="text-emerald-500 inline-block" />
                      ) : (
                        <Circle size={10} weight="fill" className="text-default-300 inline-block" />
                      )}
                    </td>
                    {/* Acciones */}
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {!product.active && (
                          <button
                            onClick={() => handleReactivate(product.id)}
                            className="flex items-center gap-1 h-9 px-3 rounded-lg text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-all"
                          >
                            <ArrowCounterClockwise size={12} weight="bold" />
                            Reactivar
                          </button>
                        )}
                        <button
                          onClick={() => openView(product)}
                          className="flex items-center justify-center h-9 w-9 rounded-lg text-default-300 hover:text-default-600 hover:bg-default-100 active:scale-95 transition-all"
                        >
                          <PencilSimple size={16} weight="bold" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Icon Picker with category tabs ──────────────────

function IconPicker({ selected, onSelect }: { selected: string; onSelect: (icon: string) => void }) {
  const [tab, setTab] = useState(0);
  const cat = ICON_CATEGORIES[tab];

  return (
    <div className="rounded-2xl border border-default-100 bg-default-50/50 overflow-hidden">
      {/* Category tabs */}
      <div className="flex gap-1 p-1.5 bg-default-100/50 overflow-x-auto">
        {ICON_CATEGORIES.map((c, i) => (
          <button
            key={c.label}
            onClick={() => setTab(i)}
            className={`shrink-0 h-9 px-3 rounded-lg text-[11px] font-bold transition-all active:scale-95
              ${tab === i ? "bg-white text-default-800 shadow-sm" : "text-default-500 hover:text-default-700"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Icons grid */}
      <div className="p-2.5">
        <div className="grid grid-cols-5 gap-2">
          {cat.icons.map((iconName) => (
            <button
              key={iconName}
              onClick={() => onSelect(iconName)}
              className={`flex flex-col items-center justify-center gap-1 h-[72px] rounded-xl transition-all active:scale-90
                ${selected === iconName
                  ? "bg-primary/10 text-primary ring-2 ring-primary"
                  : "bg-white text-default-400 hover:bg-default-100 hover:text-default-600 border border-default-100"
                }`}
              title={iconName}
            >
              <ProductIcon name={iconName} size={24} weight={selected === iconName ? "fill" : "duotone"} />
              <span className={`text-[9px] leading-none truncate w-full text-center ${selected === iconName ? "text-primary font-bold" : "text-default-400"}`}>{iconName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Recipe numpad (supports decimals for qty, integers for cost) ──

function RecipeNumpad({ value, onChange, allowDecimal }: { value: string; onChange: (v: string) => void; allowDecimal: boolean }) {
  function handleKey(key: string) {
    if (key === "DEL") { onChange(value.slice(0, -1)); return; }
    if (key === "." && (!allowDecimal || value.includes("."))) return;
    if (key === "C") { onChange(""); return; }
    const next = value + key;
    if (next.length > 8) return;
    onChange(next);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^[0-9]$/.test(e.key)) { handleKey(e.key); e.preventDefault(); }
      else if (e.key === "." && allowDecimal) { handleKey("."); e.preventDefault(); }
      else if (e.key === "Backspace") { handleKey("DEL"); e.preventDefault(); }
      else if (e.key === "Delete") { handleKey("C"); e.preventDefault(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const keys = allowDecimal
    ? ["1","2","3","4","5","6","7","8","9",".","0","DEL"]
    : ["1","2","3","4","5","6","7","8","9","C","0","DEL"];

  return (
    <div className="grid grid-cols-3 gap-1">
      {keys.map((k) => (
        <button key={k} onClick={() => handleKey(k)}
          className={`flex items-center justify-center h-11 rounded-xl text-sm font-bold transition-all active:scale-90 select-none
            ${k === "DEL" ? "bg-default-200 text-default-600" : k === "C" ? "bg-default-200 text-default-600" : k === "." ? "bg-default-100 text-default-600" : "bg-white border border-default-200 text-default-800 hover:bg-default-50"}`}>
          {k === "DEL" ? <Backspace size={18} weight="bold" /> : k === "C" ? "Borrar" : k}
        </button>
      ))}
    </div>
  );
}
