"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveCompanyId } from "@/lib/supabase/company";
import { ProductIcon, ICON_CATEGORIES } from "@/lib/utils/product-icons";
import { toast } from "sonner";
import {
  Plus, PencilSimple, Trash, Check, X, CaretUp, CaretDown, SquaresFour, Lightning, ArrowLeft,
} from "@phosphor-icons/react";

const SUGGESTED_CATEGORIES: Record<"product" | "ingredient", { name: string; icon: string }[]> = {
  product: [
    { name: "Frutas", icon: "Strawberry" }, { name: "Bebidas", icon: "Coffee" }, { name: "Waffles", icon: "GridFour" },
    { name: "Crepas", icon: "Bread" }, { name: "Malteadas", icon: "PintGlass" }, { name: "Obleas", icon: "Cookie" },
    { name: "Helados", icon: "IceCream" }, { name: "Especiales", icon: "Sparkle" }, { name: "Salado", icon: "Hamburger" },
    { name: "Extras", icon: "PlusCircle" }, { name: "Toppings", icon: "Cake" },
  ],
  ingredient: [
    { name: "Frutas", icon: "Strawberry" }, { name: "Lácteos", icon: "Drop" }, { name: "Helados", icon: "IceCream" },
    { name: "Salsas/Cremas", icon: "Jar" }, { name: "Insumos secos", icon: "Grains" }, { name: "Toppings", icon: "Cake" },
    { name: "Bebidas", icon: "Coffee" }, { name: "Snacks", icon: "Popcorn" }, { name: "Empaque", icon: "Package" },
  ],
};

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  type: "product" | "ingredient";
  sort_order: number;
  _count?: number;
}

type View = "list" | "new" | "edit";

export default function CategoriasPage() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [catType, setCatType] = useState<"product" | "ingredient">("product");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form
  const [view, setView] = useState<View>("list");
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("SquaresFour");
  const [saving, setSaving] = useState(false);
  const [iconTab, setIconTab] = useState(0);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const companyId = getActiveCompanyId();

    const { data: cats } = await supabase
      .from("categories")
      .select("id, name, slug, icon, type, sort_order")
      .eq("company_id", companyId)
      .order("sort_order");

    if (!cats) { setLoading(false); return; }

    const [{ data: prods }, { data: ings }] = await Promise.all([
      supabase.from("products").select("category_id").eq("company_id", companyId),
      supabase.from("ingredients").select("category_id").eq("company_id", companyId),
    ]);

    const countMap: Record<string, number> = {};
    for (const item of [...(prods ?? []), ...(ings ?? [])]) {
      if (item.category_id) countMap[item.category_id] = (countMap[item.category_id] ?? 0) + 1;
    }

    setCategories(cats.map((c) => ({ ...c, _count: countMap[c.id] ?? 0 })) as Category[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const filtered = categories.filter((c) => c.type === catType);

  function openNew() {
    setEditCat(null);
    setFormName("");
    setFormIcon("SquaresFour");
    setIconTab(0);
    setView("new");
  }

  function openEdit(cat: Category) {
    setEditCat(cat);
    setFormName(cat.name);
    setFormIcon(cat.icon || "SquaresFour");
    setIconTab(0);
    setView("edit");
  }

  function goBack() {
    setView("list");
    setEditCat(null);
  }

  async function handleSave() {
    if (!formName.trim()) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    const slug = formName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s/]+/g, "-").replace(/[^a-z0-9-]/g, "");
    const companyId = getActiveCompanyId();

    if (view === "edit" && editCat) {
      const { error } = await supabase.from("categories").update({ name: formName.trim(), slug, icon: formIcon }).eq("id", editCat.id).eq("company_id", companyId);
      if (error) { toast.error(error.code === "23505" ? "Esta categoría ya existe" : `Error: ${error.message}`); setSaving(false); return; }
      toast.success("Categoría actualizada");
    } else {
      const { error } = await supabase.from("categories").insert({ name: formName.trim(), slug, icon: formIcon, type: catType, sort_order: filtered.length, company_id: companyId });
      if (error) { toast.error(error.code === "23505" ? "Esta categoría ya existe" : `Error: ${error.message}`); setSaving(false); return; }
      toast.success("Categoría creada");
    }
    setSaving(false);
    setView("list");
    fetchCategories();
  }

  async function handleDelete(cat: Category) {
    if (cat._count && cat._count > 0) {
      toast.error(`No se puede eliminar: tiene ${cat._count} ${cat.type === "product" ? "productos" : "insumos"}`);
      setDeletingId(null);
      return;
    }
    await supabase.from("categories").delete().eq("id", cat.id).eq("company_id", getActiveCompanyId());
    toast.success(`"${cat.name}" eliminada`);
    setDeletingId(null);
    fetchCategories();
  }

  async function handleSeedSuggested() {
    const companyId = getActiveCompanyId();
    const suggestions = SUGGESTED_CATEGORIES[catType];
    const existingNames = new Set(categories.filter(c => c.type === catType).map(c => c.name.toLowerCase()));
    const newRows = suggestions
      .filter(s => !existingNames.has(s.name.toLowerCase()))
      .map((s, i) => ({
        name: s.name,
        slug: s.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s/]+/g, "-").replace(/[^a-z0-9-]/g, ""),
        icon: s.icon,
        type: catType,
        sort_order: filtered.length + i,
        company_id: companyId,
      }));

    if (newRows.length === 0) { toast.info("Todas las categorías sugeridas ya existen"); return; }
    const { error } = await supabase.from("categories").insert(newRows);
    if (error) { toast.error("Error al crear categorías"); return; }
    toast.success(`${newRows.length} categorías creadas`);
    fetchCategories();
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const idx = filtered.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= filtered.length) return;
    const a = filtered[idx];
    const b = filtered[swapIdx];
    await Promise.all([
      supabase.from("categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    fetchCategories();
  }

  // ── CREATE / EDIT VIEW ──
  if (view === "new" || view === "edit") {
    const iconCat = ICON_CATEGORIES[iconTab];
    return (
      <div className="flex h-full bg-gray-50">
        {/* Left — Preview */}
        <div className="w-[320px] shrink-0 flex flex-col border-r border-default-100 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-default-100">
            <button onClick={goBack} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all">
              <ArrowLeft size={22} className="text-default-600" />
            </button>
            <h1 className="text-lg font-bold text-default-800">{view === "new" ? "Nueva categoría" : "Editar categoría"}</h1>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            {/* Preview card */}
            <div className="rounded-2xl bg-default-50 border border-default-100 p-6 flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <ProductIcon name={formIcon} size={40} />
              </div>
              <p className="text-lg font-bold text-default-900">{formName || "Sin nombre"}</p>
              <p className="text-xs text-default-400 mt-1">{catType === "product" ? "Productos" : "Insumos"}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-default-100 space-y-2">
            <button onClick={handleSave} disabled={saving}
              className="w-full h-14 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2">
              {saving ? <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={20} weight="bold" /> {view === "new" ? "Crear" : "Guardar"}</>}
            </button>
            <button onClick={goBack} className="w-full h-12 rounded-2xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 active:scale-[0.97] transition-all">
              Cancelar
            </button>
          </div>
        </div>

        {/* Right — Form */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-lg space-y-6">
            {/* Name */}
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Nombre *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Frutas"
                autoFocus
                className="w-full h-12 px-4 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            {/* Icon picker */}
            <div>
              <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-2 block">Icono</label>
              <div className="rounded-2xl border border-default-100 bg-default-50/50 overflow-hidden">
                {/* Tabs */}
                <div className="flex gap-1 p-1.5 bg-default-100/50 overflow-x-auto">
                  {ICON_CATEGORIES.map((c, i) => (
                    <button key={c.label} onClick={() => setIconTab(i)}
                      className={`shrink-0 h-9 px-3 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${iconTab === i ? "bg-white text-default-800 shadow-sm" : "text-default-500 hover:text-default-700"}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
                {/* Grid */}
                <div className="p-2.5">
                  <div className="grid grid-cols-6 gap-2">
                    {iconCat.icons.map((iconName) => (
                      <button key={iconName} onClick={() => setFormIcon(iconName)}
                        className={`flex flex-col items-center justify-center gap-1 h-[72px] rounded-xl transition-all active:scale-90
                          ${formIcon === iconName ? "bg-primary/10 text-primary ring-2 ring-primary" : "bg-white text-default-400 hover:bg-default-100 hover:text-default-600 border border-default-100"}`}>
                        <ProductIcon name={iconName} size={24} weight={formIcon === iconName ? "fill" : "duotone"} />
                        <span className={`text-[9px] leading-none truncate w-full text-center ${formIcon === iconName ? "text-primary font-bold" : "text-default-400"}`}>{iconName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-default-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SquaresFour size={24} weight="duotone" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-default-900">Categorías</h1>
            <p className="text-sm text-default-500">Organiza productos e insumos</p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 hover:brightness-105 active:scale-95 transition-all">
          <Plus size={16} weight="bold" /> Nueva
        </button>
      </div>

      {/* Type tabs */}
      <div className="px-6 py-4">
        <div className="flex gap-1 bg-default-100 rounded-2xl p-1 w-fit">
          <button onClick={() => setCatType("product")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${catType === "product" ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}>
            Productos ({categories.filter(c => c.type === "product").length})
          </button>
          <button onClick={() => setCatType("ingredient")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${catType === "ingredient" ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}>
            Insumos ({categories.filter(c => c.type === "ingredient").length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="h-6 w-6 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <SquaresFour size={48} weight="duotone" className="text-default-300" />
            <p className="text-sm text-default-400">No hay categorías de {catType === "product" ? "productos" : "insumos"}</p>

            <div className="w-full max-w-md rounded-2xl bg-white border border-default-100 p-5 space-y-4">
              <p className="text-xs font-bold text-default-500 uppercase tracking-wider">Sugerencias</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_CATEGORIES[catType].map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-default-100 text-xs font-medium text-default-600">
                    <ProductIcon name={s.icon} size={14} /> {s.name}
                  </span>
                ))}
              </div>
              <button onClick={handleSeedSuggested}
                className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Lightning size={18} weight="fill" /> Crear todas ({SUGGESTED_CATEGORIES[catType].length})
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-default-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-default-50">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-default-500 w-12">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-default-500 w-14">Icono</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-default-500">Nombre</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-default-500">
                    {catType === "product" ? "Productos" : "Insumos"}
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-default-500 w-16">Orden</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-default-500 w-28">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat, idx) => (
                  <tr key={cat.id} className="border-t border-default-50 hover:bg-default-50/50 transition-colors cursor-pointer" onClick={() => openEdit(cat)}>
                    <td className="px-4 py-3 text-sm text-default-400 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ProductIcon name={cat.icon || "SquaresFour"} size={20} weight="duotone" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-default-900">{cat.name}</span>
                      <p className="text-[10px] text-default-400 font-mono">{cat.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${(cat._count ?? 0) > 0 ? "bg-primary/10 text-primary" : "bg-default-100 text-default-400"}`}>
                        {cat._count ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => handleMove(cat.id, "up")} disabled={idx === 0}
                          className="h-7 w-7 rounded-lg text-default-400 hover:bg-default-100 flex items-center justify-center disabled:opacity-20 active:scale-90 transition-all">
                          <CaretUp size={14} weight="bold" />
                        </button>
                        <button onClick={() => handleMove(cat.id, "down")} disabled={idx === filtered.length - 1}
                          className="h-7 w-7 rounded-lg text-default-400 hover:bg-default-100 flex items-center justify-center disabled:opacity-20 active:scale-90 transition-all">
                          <CaretDown size={14} weight="bold" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {deletingId === cat.id ? (
                          <>
                            <button onClick={() => handleDelete(cat)} className="h-8 w-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 active:scale-95">
                              <Check size={14} weight="bold" />
                            </button>
                            <button onClick={() => setDeletingId(null)} className="h-8 w-8 rounded-lg bg-default-100 text-default-500 flex items-center justify-center hover:bg-default-200 active:scale-95">
                              <X size={14} weight="bold" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(cat)}
                              className="h-8 w-8 rounded-lg text-default-400 hover:bg-default-100 hover:text-default-600 flex items-center justify-center active:scale-95 transition-all">
                              <PencilSimple size={14} weight="bold" />
                            </button>
                            <button onClick={() => setDeletingId(cat.id)}
                              className="h-8 w-8 rounded-lg text-default-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center active:scale-95 transition-all">
                              <Trash size={14} weight="bold" />
                            </button>
                          </>
                        )}
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
