"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveCompanyId } from "@/lib/supabase/company";
import { toast } from "sonner";
import {
  Plus, PencilSimple, Trash, Check, X, CaretUp, CaretDown, SquaresFour, Lightning,
} from "@phosphor-icons/react";

const SUGGESTED_CATEGORIES: Record<"product" | "ingredient", string[]> = {
  product: ["Frutas", "Bebidas", "Waffles", "Crepas", "Malteadas", "Obleas", "Helados", "Especiales", "Salado", "Extras", "Toppings"],
  ingredient: ["Frutas", "Lácteos", "Helados", "Salsas/Cremas", "Insumos secos", "Toppings", "Bebidas", "Snacks", "Empaque"],
};

interface Category {
  id: string;
  name: string;
  slug: string;
  type: "product" | "ingredient";
  sort_order: number;
  _count?: number;
}

export default function CategoriasPage() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [catType, setCatType] = useState<"product" | "ingredient">("product");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const companyId = getActiveCompanyId();

    const { data: cats } = await supabase
      .from("categories")
      .select("id, name, slug, type, sort_order")
      .eq("company_id", companyId)
      .order("sort_order");

    if (!cats) { setLoading(false); return; }

    // Count items per category
    const table = catType === "product" ? "products" : "ingredients";
    const { data: items } = await supabase
      .from(table)
      .select("category_id")
      .eq("company_id", companyId);

    const countMap: Record<string, number> = {};
    for (const item of items ?? []) {
      if (item.category_id) countMap[item.category_id] = (countMap[item.category_id] ?? 0) + 1;
    }

    setCategories(cats.map((c) => ({ ...c, _count: countMap[c.id] ?? 0 })) as Category[]);
    setLoading(false);
  }, [supabase, catType]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const filtered = categories.filter((c) => c.type === catType);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const companyId = getActiveCompanyId();

    const { error } = await supabase
      .from("categories")
      .insert({ name, slug, type: catType, sort_order: filtered.length, company_id: companyId });

    if (error) {
      toast.error(error.code === "23505" ? "Esta categoría ya existe" : "Error al crear");
      return;
    }
    setNewName("");
    toast.success(`Categoría "${name}" creada`);
    fetchCategories();
  }

  async function handleRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const { error } = await supabase
      .from("categories")
      .update({ name, slug })
      .eq("id", id)
      .eq("company_id", getActiveCompanyId());

    if (error) { toast.error("Error al renombrar"); return; }
    setEditingId(null);
    setEditName("");
    toast.success("Categoría renombrada");
    fetchCategories();
  }

  async function handleDelete(cat: Category) {
    if (cat._count && cat._count > 0) {
      toast.error(`No se puede eliminar: tiene ${cat._count} ${catType === "product" ? "productos" : "ingredientes"}`);
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
    const names = SUGGESTED_CATEGORIES[catType];
    const rows = names.map((name, i) => ({
      name,
      slug: name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s/]+/g, "-").replace(/[^a-z0-9-]/g, ""),
      type: catType,
      sort_order: i,
      company_id: companyId,
    }));

    // Filter out categories that already exist
    const existingNames = new Set(categories.filter(c => c.type === catType).map(c => c.name.toLowerCase()));
    const newRows = rows.filter(r => !existingNames.has(r.name.toLowerCase()));

    if (newRows.length === 0) {
      toast.info("Todas las categorías sugeridas ya existen");
      return;
    }

    const { error } = await supabase.from("categories").insert(newRows);
    if (error) {
      toast.error("Error al crear categorías");
      return;
    }
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
            <p className="text-sm text-default-500">Organiza productos e ingredientes</p>
          </div>
        </div>
      </div>

      {/* Type tabs + create */}
      <div className="px-6 py-4 flex items-center gap-3">
        <div className="flex gap-1 bg-default-100 rounded-2xl p-1">
          <button
            onClick={() => setCatType("product")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${catType === "product" ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}
          >
            Productos
          </button>
          <button
            onClick={() => setCatType("ingredient")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${catType === "ingredient" ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}
          >
            Ingredientes
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Nueva categoría..."
            className="h-11 w-56 px-4 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            <Plus size={16} weight="bold" /> Crear
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
            <p className="text-sm text-default-400">No hay categorías de {catType === "product" ? "productos" : "ingredientes"}</p>

            <div className="w-full max-w-md rounded-2xl bg-white border border-default-100 p-5 space-y-4">
              <p className="text-xs font-bold text-default-500 uppercase tracking-wider">Sugerencias</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_CATEGORIES[catType].map((name) => (
                  <span key={name} className="px-3 py-1.5 rounded-full bg-default-100 text-xs font-medium text-default-600">{name}</span>
                ))}
              </div>
              <button
                onClick={handleSeedSuggested}
                className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
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
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-default-500">Nombre</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-default-500">Slug</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-default-500">
                    {catType === "product" ? "Productos" : "Ingredientes"}
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-default-500 w-16">Orden</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-default-500 w-28">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat, idx) => (
                  <tr key={cat.id} className="border-t border-default-50 hover:bg-default-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-default-400 tabular-nums">{idx + 1}</td>

                    {/* Name - inline edit */}
                    <td className="px-4 py-3">
                      {editingId === cat.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRename(cat.id); if (e.key === "Escape") { setEditingId(null); setEditName(""); } }}
                            autoFocus
                            className="h-9 w-full px-3 rounded-lg border border-primary bg-white text-sm outline-none"
                          />
                          <button onClick={() => handleRename(cat.id)} className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 hover:brightness-105 active:scale-95">
                            <Check size={14} weight="bold" />
                          </button>
                          <button onClick={() => { setEditingId(null); setEditName(""); }} className="h-8 w-8 rounded-lg bg-default-100 text-default-500 flex items-center justify-center shrink-0 hover:bg-default-200 active:scale-95">
                            <X size={14} weight="bold" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-default-900">{cat.name}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-xs text-default-400 font-mono">{cat.slug}</span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${(cat._count ?? 0) > 0 ? "bg-primary/10 text-primary" : "bg-default-100 text-default-400"}`}>
                        {cat._count ?? 0}
                      </span>
                    </td>

                    {/* Sort */}
                    <td className="px-4 py-3">
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

                    {/* Actions */}
                    <td className="px-4 py-3">
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
                            <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
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
