"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveCompanyId } from "@/lib/supabase/company";
import { formatCOP } from "@/lib/utils/format";
import { playSuccess, playRemove } from "@/lib/utils/sounds";
import { toast } from "sonner";
import {
  Package, MagnifyingGlass, ArrowLeft, Plus, Check, Warning,
  PencilSimple, Backspace, TrashSimple, CaretUp, CaretDown,
} from "@phosphor-icons/react";
import { SearchWithKeyboard } from "@/components/ui/SearchWithKeyboard";
import { TextInputWithKeyboard } from "@/components/ui/TextInputWithKeyboard";

interface Category { id: string; name: string; }

interface Ingredient {
  id: string; ref: string; name: string; category_id: string | null;
  unit: string; purchase_unit: string | null; cost_per_unit: number;
  stock_quantity: number; min_stock: number; active: boolean;
  category: { name: string } | null;
}

type View = "list" | "view" | "addStock" | "edit" | "new";
type SortKey = "name" | "stock" | "cost" | null;
type SortDir = "asc" | "desc";

const EMPTY_INGREDIENT = { ref: "", name: "", unit: "und", purchase_unit: "", cost_per_unit: 0, min_stock: 0, stock_quantity: 0, category_id: "" as string | null, active: true };

export default function InventarioPage() {
  const supabase = createClient();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Ingredient | null>(null);

  // Add stock
  const [addQty, setAddQty] = useState(0);
  const [addCost, setAddCost] = useState(0);
  const [costMode, setCostMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editNumpadTarget, setEditNumpadTarget] = useState<"cost" | "min" | "stock">("cost");
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [supplierPrices, setSupplierPrices] = useState<{ supplier_id: string; supplier_name: string; price: number; presentation_qty: number }[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());

  // Edit/New form
  const [form, setForm] = useState(EMPTY_INGREDIENT);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [refManual, setRefManual] = useState(false);
  const [refDuplicate, setRefDuplicate] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchData = useCallback(async () => {
    const companyId = getActiveCompanyId();
    if (!companyId) { setLoading(false); return; }
    const [ir, cr] = await Promise.all([
      supabase.from("ingredients").select("*, category:categories(name)").eq("company_id", companyId).order("stock_quantity", { ascending: true }),
      supabase.from("categories").select("id, name").eq("company_id", companyId).eq("type", "ingredient").order("name"),
    ]);
    const freshIngredients = (ir.data as Ingredient[]) ?? [];
    setIngredients(freshIngredients);
    setCategories((cr.data as Category[]) ?? []);
    // Sync selected ingredient with fresh data so detail views reflect updates
    setSelected(prev => prev ? freshIngredients.find(i => i.id === prev.id) ?? prev : null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = ingredients;
    if (!showInactive) list = list.filter((i) => i.active);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((i) => i.name.toLowerCase().includes(q)); }
    if (selectedCategory) list = list.filter((i) => i.category_id === selectedCategory);
    let result = [...list].sort((a, b) => {
      const aL = a.min_stock > 0 && a.stock_quantity <= a.min_stock ? 0 : 1;
      const bL = b.min_stock > 0 && b.stock_quantity <= b.min_stock ? 0 : 1;
      if (aL !== bL) return aL - bL;
      if (aL === 0) return a.stock_quantity - b.stock_quantity;
      return a.name.localeCompare(b.name);
    });
    if (sortKey) {
      result.sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") cmp = a.name.localeCompare(b.name);
        if (sortKey === "stock") cmp = a.stock_quantity - b.stock_quantity;
        if (sortKey === "cost") cmp = a.cost_per_unit - b.cost_per_unit;
        return sortDir === "desc" ? -cmp : cmp;
      });
    }
    return result;
  }, [ingredients, search, selectedCategory, showInactive, sortKey, sortDir]);

  const lowStockCount = ingredients.filter((i) => i.active && i.min_stock > 0 && i.stock_quantity <= i.min_stock).length;

  function goBack() {
    if (view === "edit" && selected) { setView("view"); setConfirmDeactivate(false); return; }
    if (view === "addStock" && selected) { setView("view"); return; }
    setView("list"); setSelected(null); setAddQty(0); setAddCost(0); setCostMode(false); setConfirmDeactivate(false);
  }

  function openView(ing: Ingredient) { setSelected(ing); setView("view"); }

  async function openAddStock(ing?: Ingredient) {
    const target = ing || selected;
    if (!target) return;
    setSelected(target); setAddQty(0); setAddCost(0); setCostMode(false); setSelectedSupplierId(null); setView("addStock");
    // Fetch suppliers and their prices for this ingredient
    const companyId = getActiveCompanyId();
    const { data: sups } = await supabase.from("suppliers").select("id, name").eq("company_id", companyId).eq("active", true).order("name");
    setSuppliers(sups ?? []);
    const { data: sp } = await supabase.from("supplier_prices").select("supplier_id, price, presentation_qty, supplier:suppliers(name)").eq("ingredient_id", target.id).eq("company_id", companyId);
    setSupplierPrices((sp ?? []).map((p: Record<string, unknown>) => ({
      supplier_id: p.supplier_id as string,
      supplier_name: (p.supplier as { name: string } | null)?.name ?? "",
      price: p.price as number,
      presentation_qty: p.presentation_qty as number,
    })));
  }

  async function openEdit(ing?: Ingredient) {
    const target = ing || selected;
    if (!target) return;
    setSelected(target);
    setForm({ ref: target.ref, name: target.name, unit: target.unit, purchase_unit: target.purchase_unit || "", cost_per_unit: target.cost_per_unit, min_stock: target.min_stock, stock_quantity: target.stock_quantity, category_id: target.category_id, active: target.active });
    setView("edit"); setConfirmDeactivate(false); setEditNumpadTarget("cost");
    setRefManual(true); setRefDuplicate(false);
    // Load suppliers
    const companyId = getActiveCompanyId();
    const { data: sups } = await supabase.from("suppliers").select("id, name").eq("company_id", companyId).eq("active", true).order("name");
    setSuppliers(sups ?? []);
    const { data: sp } = await supabase.from("supplier_prices").select("supplier_id, price, presentation_qty, supplier:suppliers(name)").eq("ingredient_id", target.id).eq("company_id", companyId);
    const prices = (sp ?? []).map((p: Record<string, unknown>) => ({
      supplier_id: p.supplier_id as string,
      supplier_name: (p.supplier as { name: string } | null)?.name ?? "",
      price: p.price as number,
      presentation_qty: p.presentation_qty as number,
    }));
    setSupplierPrices(prices);
    setSelectedSupplierIds(new Set(prices.map(p => p.supplier_id)));
  }

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

  const STOP_WORDS = new Set(["de", "del", "con", "y", "la", "el", "las", "los", "en", "a", "por", "para", "un", "una"]);

  function generateIngRef(name: string): string {
    const clean = name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const merged = clean.replace(/(\d+)\s+(oz|ml|gr|kg|lt|l|und)\b/gi, "$1$2");
    const tokens = merged.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return "";
    const parts: string[] = [];
    const meaningful = tokens.filter(t => !STOP_WORDS.has(t.toLowerCase()));
    for (const token of tokens) {
      if (STOP_WORDS.has(token.toLowerCase())) continue;
      if (/^\d+\w*$/.test(token) || /^x\d+/i.test(token)) { parts.push(token.toUpperCase()); continue; }
      parts.push(meaningful.length <= 2 ? token.substring(0, 4).toUpperCase() : (parts.length === 0 ? token.substring(0, 3).toUpperCase() : token[0].toUpperCase()));
    }
    return "ING-" + (parts.join("-") || clean.substring(0, 6).toUpperCase());
  }

  function ensureUniqueIngRef(base: string): string {
    const existing = new Set(ingredients.map((i) => i.ref.toUpperCase()));
    if (selected) existing.delete(selected.ref.toUpperCase());
    if (!existing.has(base.toUpperCase())) return base;
    for (let i = 2; i <= 99; i++) {
      const candidate = `${base}-${i}`;
      if (!existing.has(candidate.toUpperCase())) return candidate;
    }
    return base;
  }

  function handleIngNameChange(name: string) {
    setForm((f) => ({ ...f, name }));
    if (view === "new" && !refManual) {
      const suggested = ensureUniqueIngRef(generateIngRef(name));
      setForm((f) => ({ ...f, name, ref: suggested }));
      setRefDuplicate(false);
    }
  }

  function handleIngRefChange(ref: string) {
    setRefManual(true);
    setForm((f) => ({ ...f, ref }));
    const existing = new Set(ingredients.map((i) => i.ref.toUpperCase()));
    if (selected) existing.delete(selected.ref.toUpperCase());
    setRefDuplicate(existing.has(ref.toUpperCase()));
  }

  async function openNew() {
    setSelected(null);
    setForm({ ...EMPTY_INGREDIENT, category_id: categories[0]?.id ?? null });
    setView("new"); setConfirmDeactivate(false); setEditNumpadTarget("cost");
    setRefManual(false); setRefDuplicate(false);
    setSupplierPrices([]);
    setSelectedSupplierIds(new Set());
    const companyId = getActiveCompanyId();
    const { data: sups } = await supabase.from("suppliers").select("id, name").eq("company_id", companyId).eq("active", true).order("name");
    setSuppliers(sups ?? []);
  }

  // Numpad handler
  function numpadKey(key: string, value: number, setter: (n: number) => void) {
    if (key === "DEL") { setter(parseInt(String(value).slice(0, -1)) || 0); return; }
    const next = (value > 0 ? String(value) : "") + key;
    if (next.length > 7) return;
    setter(parseInt(next) || 0);
  }

  async function handleConfirmAddStock() {
    if (!selected || addQty === 0) return;
    setSaving(true);
    await supabase.from("ingredients").update({ stock_quantity: selected.stock_quantity + addQty }).eq("id", selected.id);
    await supabase.from("inventory_movements").insert({ ingredient_id: selected.id, type: "purchase", quantity: addQty, notes: addCost > 0 ? `Costo: ${formatCOP(addCost)}` : null, supplier_id: selectedSupplierId, company_id: getActiveCompanyId() });
    if (addCost > 0 && addQty > 0) {
      const newCostPerUnit = Math.round(addCost / addQty);
      await supabase.from("ingredients").update({ cost_per_unit: newCostPerUnit }).eq("id", selected.id);
    }
    playSuccess(); toast.success("Stock actualizado"); setSaving(false); goBack(); fetchData();
  }

  async function handleSaveIngredient() {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (!form.ref.trim()) { toast.error("El código es requerido"); return; }
    if (refDuplicate) { toast.error("Este código ya existe"); return; }

    setSaving(true);
    const payload = { ref: form.ref, name: form.name, unit: form.unit, purchase_unit: form.purchase_unit || null, cost_per_unit: form.cost_per_unit, min_stock: form.min_stock, category_id: form.category_id, active: form.active };
    const companyId = getActiveCompanyId();
    if (view === "edit" && selected) {
      const { error } = await supabase.from("ingredients").update(payload).eq("id", selected.id);
      if (error) { toast.error(error.code === "23505" ? "Este código o nombre ya existe" : `Error: ${error.message}`); setSaving(false); return; }
      // Sync supplier links
      const existingIds = new Set(supplierPrices.map(p => p.supplier_id));
      const toRemove = [...existingIds].filter(id => !selectedSupplierIds.has(id));
      const toAdd = [...selectedSupplierIds].filter(id => !existingIds.has(id));
      if (toRemove.length > 0) await supabase.from("supplier_prices").delete().eq("ingredient_id", selected.id).eq("company_id", companyId).in("supplier_id", toRemove);
      if (toAdd.length > 0) {
        await supabase.from("supplier_prices").insert(toAdd.map(sid => ({ supplier_id: sid, ingredient_id: selected.id, price: 0, presentation_qty: 1, presentation_unit: form.unit, company_id: companyId })));
      }
      toast.success("Insumo actualizado");
    } else {
      const { data, error } = await supabase.from("ingredients").insert({ ...payload, stock_quantity: form.stock_quantity, company_id: companyId }).select("id").single();
      if (error) { toast.error(error.code === "23505" ? "Este código o nombre ya existe" : `Error: ${error.message}`); setSaving(false); return; }
      if (data && selectedSupplierIds.size > 0) {
        await supabase.from("supplier_prices").insert([...selectedSupplierIds].map(sid => ({ supplier_id: sid, ingredient_id: data.id, price: 0, presentation_qty: 1, presentation_unit: form.unit, company_id: companyId })));
      }
      toast.success("Insumo creado");
    }
    playSuccess(); setSaving(false); goBack(); fetchData();
  }

  async function handleDeactivate() {
    if (!selected) return;
    setSaving(true);
    await supabase.from("ingredients").update({ active: false }).eq("id", selected.id);
    playRemove(); toast.success("Insumo desactivado"); setSaving(false); goBack(); fetchData();
  }

  async function handleReactivate(id: string) {
    await supabase.from("ingredients").update({ active: true }).eq("id", id);
    playSuccess(); toast.success("Insumo reactivado"); fetchData();
  }

  // ── LOADING ──
  if (loading) return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  // ── VIEW MODE (read-only detail) ──
  if (view === "view" && selected) {
    const barW = selected.min_stock > 0 ? Math.min((selected.stock_quantity / (selected.min_stock * 2)) * 100, 100) : 100;
    const barColor = selected.min_stock <= 0 ? "bg-default-300" : selected.stock_quantity <= selected.min_stock * 0.5 ? "bg-red-500" : selected.stock_quantity <= selected.min_stock ? "bg-amber-500" : "bg-emerald-500";
    const isLow = selected.min_stock > 0 && selected.stock_quantity <= selected.min_stock;

    return (
      <div className="flex h-full bg-gray-50">
        {/* LEFT — Info */}
        <div className="w-[360px] shrink-0 flex flex-col border-r border-default-100 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-default-100">
            <button onClick={() => { setView("list"); setSelected(null); }} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all">
              <ArrowLeft size={22} className="text-default-600" />
            </button>
            <h1 className="text-lg font-bold text-default-800">Insumo</h1>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            <div className="rounded-2xl bg-default-50 border border-default-100 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-default-200 text-default-500 mx-auto mb-3">
                <Package size={32} weight="duotone" />
              </div>
              <p className="text-xl font-bold text-default-900">{selected.name}</p>
              <p className="text-xs text-default-400 mt-0.5">{selected.ref}</p>
              {selected.category && <p className="text-xs text-default-400 mt-1">{selected.category.name}</p>}

              {/* Stock */}
              <div className="mt-4 rounded-xl bg-white border border-default-100 p-4">
                <p className="text-3xl font-extrabold tabular-nums text-default-900">{selected.stock_quantity} <span className="text-sm font-medium text-default-400">{selected.unit}</span></p>
                {selected.min_stock > 0 && <p className="text-xs text-default-400 tabular-nums mt-1">Mínimo: {selected.min_stock} {selected.unit}</p>}
                <div className="h-3 w-full rounded-full bg-default-200 overflow-hidden mt-2">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barW}%` }} />
                </div>
                {isLow && <p className="text-xs font-bold text-red-500 mt-2 flex items-center gap-1 justify-center"><Warning size={12} weight="fill" /> Stock bajo</p>}
              </div>

              {/* Details */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                <div className="rounded-xl bg-white border border-default-100 p-3">
                  <p className="text-[10px] text-default-400 font-bold uppercase">Costo / {selected.unit}</p>
                  <p className="text-sm font-bold tabular-nums text-default-800 mt-0.5">{selected.cost_per_unit > 0 ? formatCOP(selected.cost_per_unit) : "—"}</p>
                </div>
                <div className="rounded-xl bg-white border border-default-100 p-3">
                  <p className="text-[10px] text-default-400 font-bold uppercase">Unidad compra</p>
                  <p className="text-sm font-bold text-default-800 mt-0.5">{selected.purchase_unit || selected.unit}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-3 justify-center">
                {selected.active ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Activo</span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Inactivo</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-default-100 space-y-2">
            <button onClick={() => openAddStock()} className="w-full h-14 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
              <Plus size={20} weight="bold" /> Agregar stock
            </button>
            <button onClick={() => openEdit()} className="w-full h-12 rounded-2xl bg-default-100 text-default-600 text-sm font-semibold hover:bg-default-200 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
              <PencilSimple size={16} weight="bold" /> Editar insumo
            </button>
            <button onClick={() => { setView("list"); setSelected(null); }} className="w-full h-11 text-sm font-medium text-default-400 hover:text-default-600 transition-colors">
              Volver
            </button>
          </div>
        </div>

        {/* RIGHT — Movement history placeholder */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-lg">
            <p className="text-xs font-bold text-default-500 uppercase tracking-wider mb-4">Información</p>
            <div className="space-y-3">
              <div className="rounded-2xl bg-white border border-default-100 p-4 flex justify-between items-center">
                <span className="text-sm text-default-600">Stock actual</span>
                <span className="text-lg font-extrabold tabular-nums text-default-900">{selected.stock_quantity} {selected.unit}</span>
              </div>
              <div className="rounded-2xl bg-white border border-default-100 p-4 flex justify-between items-center">
                <span className="text-sm text-default-600">Costo unitario</span>
                <span className="text-lg font-extrabold tabular-nums text-default-900">{selected.cost_per_unit > 0 ? formatCOP(selected.cost_per_unit) : "Sin definir"}</span>
              </div>
              <div className="rounded-2xl bg-white border border-default-100 p-4 flex justify-between items-center">
                <span className="text-sm text-default-600">Stock mínimo</span>
                <span className="text-lg font-extrabold tabular-nums text-default-900">{selected.min_stock > 0 ? `${selected.min_stock} ${selected.unit}` : "Sin definir"}</span>
              </div>
              <div className="rounded-2xl bg-white border border-default-100 p-4 flex justify-between items-center">
                <span className="text-sm text-default-600">Unidad de compra</span>
                <span className="text-lg font-bold text-default-900">{selected.purchase_unit || selected.unit}</span>
              </div>
              <div className="rounded-2xl bg-white border border-default-100 p-4 flex justify-between items-center">
                <span className="text-sm text-default-600">Valor en stock</span>
                <span className="text-lg font-extrabold tabular-nums text-primary">{formatCOP(Math.round(selected.stock_quantity * selected.cost_per_unit))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ADD STOCK VIEW (2 columns) ──
  if (view === "addStock" && selected) {
    const newStock = selected.stock_quantity + addQty;
    return (
      <div className="flex h-full bg-gray-50">
        {/* LEFT — Info */}
        <div className="w-[320px] shrink-0 flex flex-col border-r border-default-100 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-default-100">
            <button onClick={goBack} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all">
              <ArrowLeft size={22} className="text-default-600" />
            </button>
            <h1 className="text-lg font-bold text-default-800">Agregar stock</h1>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            <div className="rounded-2xl bg-default-50 border border-default-100 p-5">
              <p className="text-sm font-bold text-default-900">{selected.name}</p>
              <p className="text-xs text-default-400 mt-0.5">{selected.category?.name}</p>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-default-500">Stock actual</span>
                  <span className="text-base font-bold tabular-nums text-default-800">{selected.stock_quantity} {selected.unit}</span>
                </div>
                {addQty > 0 && (
                  <>
                    <div className="flex justify-between items-center text-emerald-600">
                      <span className="text-xs font-semibold">+ Agregar</span>
                      <span className="text-base font-bold tabular-nums">+{addQty} {selected.unit}</span>
                    </div>
                    <div className="border-t border-dashed border-default-200 pt-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-default-600">Nuevo stock</span>
                      <span className="text-xl font-extrabold tabular-nums text-default-900">{newStock} {selected.unit}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {addCost > 0 && addQty > 0 && (
              <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Costo por unidad</p>
                <p className="text-lg font-extrabold text-blue-700 tabular-nums">{formatCOP(Math.round(addCost / addQty))} / {selected.unit}</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-default-100 space-y-2">
            <button onClick={handleConfirmAddStock} disabled={addQty === 0 || saving}
              className="w-full h-14 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2">
              {saving ? <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={20} weight="bold" /> Confirmar +{addQty} {selected.unit}</>}
            </button>
            <button onClick={goBack} className="w-full h-12 rounded-2xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 active:scale-[0.97] transition-all">Cancelar</button>
          </div>
        </div>

        {/* RIGHT — Numpad */}
        <div className="flex-1 overflow-auto p-6">
          {/* Supplier selector */}
          {suppliers.length > 0 && (
            <div className="mb-4 max-w-sm">
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Proveedor</label>
              <div className="flex flex-wrap gap-2">
                {suppliers.map(sup => {
                  const sp = supplierPrices.find(p => p.supplier_id === sup.id);
                  const isSelected = selectedSupplierId === sup.id;
                  return (
                    <button key={sup.id}
                      onClick={() => {
                        setSelectedSupplierId(isSelected ? null : sup.id);
                        if (!isSelected && sp && sp.presentation_qty > 0) {
                          setAddCost(sp.price);
                          setAddQty(sp.presentation_qty);
                        }
                      }}
                      className={`h-10 px-4 rounded-xl text-sm font-bold transition-all active:scale-95
                        ${isSelected ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}>
                      {sup.name}
                      {sp && <span className="ml-1.5 text-[10px] font-normal opacity-75">{formatCOP(sp.price)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toggle: Cantidad / Costo */}
          <div className="flex gap-1 bg-default-100 rounded-xl p-1 mb-4 max-w-sm">
            <button onClick={() => setCostMode(false)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${!costMode ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}>
              Cantidad ({selected.unit})
            </button>
            <button onClick={() => setCostMode(true)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${costMode ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}>
              Costo ($)
            </button>
          </div>

          {/* Display */}
          <button onClick={() => costMode ? setAddCost(0) : setAddQty(0)}
            className="w-full max-w-sm rounded-2xl bg-default-50 border border-default-100 px-5 py-3 text-center mb-3 hover:bg-default-100 transition-colors">
            <p className="text-[10px] font-bold text-default-400 uppercase tracking-wider mb-0.5">
              {costMode ? "Costo total" : `Cantidad (${selected.unit})`}
            </p>
            <p className={`text-3xl font-extrabold tabular-nums ${(costMode ? addCost : addQty) > 0 ? "text-default-900" : "text-default-300"}`}>
              {costMode ? (addCost > 0 ? formatCOP(addCost) : "$ 0") : (addQty > 0 ? `${addQty} ${selected.unit}` : "0")}
            </p>
          </button>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-1.5 max-w-sm">
            {["1","2","3","4","5","6","7","8","9","00","0","DEL"].map((key) => (
              <button key={key} onClick={() => numpadKey(key, costMode ? addCost : addQty, costMode ? setAddCost : setAddQty)}
                className={`flex items-center justify-center h-14 rounded-xl text-lg font-bold transition-all active:scale-95 select-none ${key === "DEL" ? "bg-default-200 text-default-600 hover:bg-default-300" : "bg-white border border-default-200 text-default-800 hover:bg-default-50"}`}>
                {key === "DEL" ? <Backspace size={22} weight="bold" /> : key}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT / NEW VIEW (2 columns) ──
  if ((view === "edit" || view === "new") && (selected || view === "new")) {
    const nameEmpty = !form.name.trim();
    const refEmpty = !form.ref.trim();

    return (
      <div className="flex h-full bg-gray-50">
        {/* LEFT — Preview */}
        <div className="w-[320px] shrink-0 flex flex-col border-r border-default-100 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-default-100">
            <button onClick={goBack} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all">
              <ArrowLeft size={22} className="text-default-600" />
            </button>
            <h1 className="text-lg font-bold text-default-800">{view === "new" ? "Nuevo insumo" : "Editar insumo"}</h1>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            <div className="rounded-2xl bg-default-50 border border-default-100 p-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-default-200 text-default-500 mx-auto mb-3">
                <Package size={28} weight="duotone" />
              </div>
              <p className="text-lg font-bold text-default-900">{form.name || "Sin nombre"}</p>
              <p className="text-xs text-default-400 mt-0.5">{form.ref || "Sin código"}</p>
              <div className="flex justify-center gap-3 mt-3 text-sm">
                <span className="tabular-nums font-bold text-default-600">{form.unit}</span>
                <span className="text-default-300">·</span>
                <span className="tabular-nums font-bold text-default-600">{formatCOP(form.cost_per_unit)}/{form.unit}</span>
              </div>
              <div className="mt-2">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${form.min_stock > 0 ? "text-blue-600 bg-blue-50" : "text-default-400 bg-default-100"}`}>
                  Mín: {form.min_stock} {form.unit}
                </span>
              </div>
            </div>

            {view === "edit" && selected && (
              <div className="rounded-2xl bg-red-50/50 border border-red-200 p-5">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Zona de peligro</p>
                <button onClick={() => setConfirmDeactivate(true)}
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-red-300 text-red-500 font-bold text-sm hover:bg-red-100 active:scale-95 transition-all">
                  <TrashSimple size={18} weight="duotone" /> Desactivar
                </button>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-default-100 space-y-2">
            <button onClick={handleSaveIngredient} disabled={saving}
              className="w-full h-14 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2">
              {saving ? <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={20} weight="bold" /> Guardar</>}
            </button>
            <button onClick={goBack} className="w-full h-12 rounded-2xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 active:scale-[0.97] transition-all">Cancelar</button>
          </div>
        </div>

        {/* CENTER — Form */}
        <div className="flex-1 overflow-auto p-6 border-r border-default-100">
          <div className="space-y-5">
            <TextInputWithKeyboard
              value={form.name}
              onChange={handleIngNameChange}
              label="Nombre *"
              placeholder="Ej: Fresa fresca"
            />

            <TextInputWithKeyboard
              value={form.ref}
              onChange={handleIngRefChange}
              label="Código *"
              placeholder="Ej: ING-FRESA"
              uppercase
              error={refDuplicate ? "Este código ya existe" : undefined}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Unidad de stock</label>
                <div className="flex flex-wrap gap-2">
                  {["und", "kg", "g", "L", "ml", "caja", "bolsa", "tarro", "paquete"].map((u) => (
                    <button key={u} onClick={() => setForm((f) => ({ ...f, unit: u }))}
                      className={`h-11 px-4 rounded-xl text-sm font-bold transition-all active:scale-95 ${form.unit === u ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Unidad de compra</label>
                <div className="flex flex-wrap gap-2">
                  {["und", "kg", "g", "L", "ml", "caja", "bolsa", "tarro", "paquete"].map((u) => (
                    <button key={u} onClick={() => setForm((f) => ({ ...f, purchase_unit: u }))}
                      className={`h-11 px-4 rounded-xl text-sm font-bold transition-all active:scale-95 ${form.purchase_unit === u ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-2 block">Categoría</label>
              <div className="grid grid-cols-5 gap-2">
                {categories.map((cat) => (
                  <button key={cat.id} onClick={() => setForm((f) => ({ ...f, category_id: cat.id }))}
                    className={`h-11 rounded-xl text-sm font-bold transition-all active:scale-95 truncate px-2 ${form.category_id === cat.id ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost + Min stock + Stock actual — with numpad */}
            <div className="flex flex-col items-center">
              <div className="grid grid-cols-3 gap-3 w-full">
                <button onClick={() => setEditNumpadTarget("cost")}
                  className={`rounded-xl border p-4 text-center transition-all ${editNumpadTarget === "cost" ? "border-primary bg-primary/5" : "border-default-200 bg-white"}`}>
                  <p className="text-[10px] text-default-400 font-bold uppercase tracking-wider">Costo / {form.unit}</p>
                  <p className={`text-xl font-extrabold tabular-nums mt-1 ${form.cost_per_unit > 0 ? "text-default-900" : "text-default-300"}`}>
                    {form.cost_per_unit > 0 ? formatCOP(form.cost_per_unit) : "$ 0"}
                  </p>
                </button>
                <button onClick={() => setEditNumpadTarget("min")}
                  className={`rounded-xl border p-4 text-center transition-all ${editNumpadTarget === "min" ? "border-primary bg-primary/5" : "border-default-200 bg-white"}`}>
                  <p className="text-[10px] text-default-400 font-bold uppercase tracking-wider">Stock mínimo</p>
                  <p className={`text-xl font-extrabold tabular-nums mt-1 ${form.min_stock > 0 ? "text-default-900" : "text-default-300"}`}>
                    {form.min_stock > 0 ? `${form.min_stock} ${form.unit}` : "0"}
                  </p>
                </button>
                <button onClick={() => setEditNumpadTarget("stock")}
                  className={`rounded-xl border p-4 text-center transition-all ${editNumpadTarget === "stock" ? "border-primary bg-primary/5" : "border-default-200 bg-white"}`}>
                  <p className="text-[10px] text-default-400 font-bold uppercase tracking-wider">Stock actual</p>
                  <p className={`text-xl font-extrabold tabular-nums mt-1 ${form.stock_quantity > 0 ? "text-emerald-600" : "text-default-300"}`}>
                    {form.stock_quantity > 0 ? `${form.stock_quantity} ${form.unit}` : "0"}
                  </p>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 w-full mt-3">
                {["1","2","3","4","5","6","7","8","9","00","0","DEL"].map((key) => (
                  <button key={key} onClick={() => {
                    const val = editNumpadTarget === "cost" ? form.cost_per_unit : editNumpadTarget === "min" ? form.min_stock : form.stock_quantity;
                    const setter = (n: number) => {
                      if (editNumpadTarget === "cost") setForm((f) => ({ ...f, cost_per_unit: n }));
                      else if (editNumpadTarget === "min") setForm((f) => ({ ...f, min_stock: n }));
                      else setForm((f) => ({ ...f, stock_quantity: n }));
                    };
                    numpadKey(key, val, setter);
                  }}
                    className={`flex items-center justify-center h-12 rounded-xl text-base font-bold transition-all active:scale-95 select-none ${key === "DEL" ? "bg-default-200 text-default-600" : "bg-white border border-default-200 text-default-800 hover:bg-default-50"}`}>
                    {key === "DEL" ? <Backspace size={20} weight="bold" /> : key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Proveedores + Estado */}
        <div className="w-[320px] shrink-0 overflow-auto p-5 space-y-5">
          {/* Proveedores */}
          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-2 block">Proveedores</label>
            {suppliers.length > 0 ? (
              <div className="space-y-1.5">
                {suppliers.map((sup) => {
                  const isSelected = selectedSupplierIds.has(sup.id);
                  return (
                    <button key={sup.id}
                      onClick={() => setSelectedSupplierIds(prev => {
                        const next = new Set(prev);
                        if (next.has(sup.id)) next.delete(sup.id);
                        else next.add(sup.id);
                        return next;
                      })}
                      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.97]
                        ${isSelected ? "bg-primary/5 border-primary" : "bg-default-50 border-default-100 hover:border-default-300"}`}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 shrink-0 transition-colors
                        ${isSelected ? "border-primary bg-primary" : "border-default-300"}`}>
                        {isSelected && <Check size={12} weight="bold" className="text-white" />}
                      </div>
                      <span className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-default-700"}`}>{sup.name}</span>
                    </button>
                  );
                })}
                <a href="/proveedores" className="block text-xs text-primary font-bold hover:underline text-center pt-1">Gestionar proveedores</a>
              </div>
            ) : (
              <div className="rounded-xl bg-default-50 border border-default-100 p-4 text-center">
                <p className="text-xs text-default-400 mb-2">No hay proveedores</p>
                <a href="/proveedores" className="text-xs text-primary font-bold hover:underline">Crear proveedor</a>
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div>
            <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-2 block">Estado</label>
            <div className="flex items-center justify-between rounded-2xl bg-default-50 border border-default-100 p-4">
              <div>
                <p className="text-sm font-bold text-default-800">{form.active ? "Activo" : "Inactivo"}</p>
                <p className="text-[11px] text-default-400">{form.active ? "Visible en inventario" : "Oculto del inventario"}</p>
              </div>
              <button onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                className={`relative w-14 h-8 rounded-full transition-colors ${form.active ? "bg-emerald-500" : "bg-default-300"}`}>
                <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-6" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="shrink-0 border-b border-default-100 bg-white px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-default-800">Inventario</h1>
            <p className="text-xs text-default-400 mt-0.5">
              {filtered.length} insumos
              {lowStockCount > 0 && <span className="text-red-500 font-bold ml-2">· {lowStockCount} con stock bajo</span>}
            </p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 h-12 px-6 rounded-2xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 hover:brightness-105 active:scale-95 transition-all">
            <Plus size={18} weight="bold" /> Nuevo
          </button>
        </div>

        <div className="flex items-center gap-3">
          <SearchWithKeyboard value={search} onChange={setSearch} placeholder="Buscar insumo..." />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-default-400 font-semibold">Inactivos</span>
            <button onClick={() => setShowInactive(!showInactive)}
              className={`relative w-12 h-7 rounded-full transition-colors ${showInactive ? "bg-primary" : "bg-default-300"}`}>
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${showInactive ? "translate-x-5" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setSelectedCategory(null)}
            className={`h-9 px-4 rounded-lg text-xs font-bold transition-all active:scale-95 ${selectedCategory === null ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}>
            Todos
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              className={`h-9 px-4 rounded-lg text-xs font-bold transition-all active:scale-95 ${selectedCategory === cat.id ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package size={48} weight="duotone" className="text-default-300 mb-3" />
            <p className="text-sm text-default-400">No se encontraron insumos</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-default-100 mx-6 my-4 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-default-50 text-[10px] font-bold text-default-500 uppercase tracking-wider">
                  <th className="w-[3px] p-0" />
                  <th className="text-left px-4 py-3">
                    <button onClick={() => toggleSort("name")} className="inline-flex items-center hover:text-default-700 transition-colors">
                      Nombre <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3">
                    <button onClick={() => toggleSort("stock")} className="inline-flex items-center hover:text-default-700 transition-colors ml-auto">
                      Stock <SortIcon col="stock" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">Barra</th>
                  <th className="text-right px-4 py-3">
                    <button onClick={() => toggleSort("cost")} className="inline-flex items-center hover:text-default-700 transition-colors ml-auto">
                      Costo <SortIcon col="cost" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-right px-4 py-3 w-28">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ing) => {
                  const isLow = ing.min_stock > 0 && ing.stock_quantity <= ing.min_stock;
                  const barW = ing.min_stock > 0 ? Math.min((ing.stock_quantity / (ing.min_stock * 2)) * 100, 100) : 100;
                  const barColor = ing.min_stock <= 0 ? "bg-default-200" : ing.stock_quantity <= ing.min_stock * 0.5 ? "bg-red-500" : ing.stock_quantity <= ing.min_stock ? "bg-amber-500" : "bg-emerald-500";

                  return (
                    <tr key={ing.id} onClick={() => openView(ing)}
                      className="border-t border-default-50 hover:bg-default-50/50 cursor-pointer transition-colors h-12">
                      {/* Indicador */}
                      <td className="p-0 w-[3px]">
                        <div className={`w-1 h-6 rounded-full ${barColor} mx-auto`} />
                      </td>

                      {/* Nombre */}
                      <td className="px-4 py-2">
                        <span className="text-sm font-bold text-default-800">{ing.name}</span>
                        {ing.category?.name && <p className="text-[11px] text-default-400">{ing.category.name}</p>}
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-2 text-right">
                        <p className="text-sm font-bold tabular-nums text-default-900">
                          {ing.stock_quantity} <span className="text-[10px] font-normal text-default-400">{ing.unit}</span>
                        </p>
                        {ing.min_stock > 0 && (
                          <p className="text-[10px] text-default-300 tabular-nums">mín {ing.min_stock}</p>
                        )}
                      </td>

                      {/* Barra */}
                      <td className="px-4 py-2">
                        <div className="w-[80px] h-2 rounded-full bg-default-100 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
                        </div>
                      </td>

                      {/* Costo */}
                      <td className="px-4 py-2 text-right">
                        <span className="text-xs tabular-nums font-semibold text-default-500">
                          {ing.cost_per_unit > 0 ? formatCOP(ing.cost_per_unit) : "—"}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-2 text-center">
                        {isLow && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                            <Warning size={10} weight="fill" /> Bajo
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {!ing.active ? (
                            <button onClick={() => handleReactivate(ing.id)}
                              className="min-h-9 px-3 rounded-lg text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-all">
                              Reactivar
                            </button>
                          ) : (
                            <>
                              <button onClick={() => openAddStock(ing)}
                                className="min-h-9 px-2.5 rounded-lg text-[11px] font-bold text-primary bg-primary/5 border border-primary/15 hover:bg-primary/10 active:scale-95 transition-all flex items-center gap-0.5">
                                <Plus size={12} weight="bold" />Stock
                              </button>
                              <button onClick={() => openEdit(ing)}
                                className="min-h-9 w-9 rounded-lg flex items-center justify-center text-default-300 hover:text-default-600 hover:bg-default-100 active:scale-95 transition-all">
                                <PencilSimple size={14} weight="bold" />
                              </button>
                            </>
                          )}
                        </div>
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
