"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";
import { formatCOP } from "@/lib/utils/format";
import { toast } from "@/lib/utils/toast";
import {
  Truck, Plus, ArrowLeft, Check, Trash, PencilSimple, Phone, MagnifyingGlass,
  Package, X, Warning,
} from "@phosphor-icons/react";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  _priceCount?: number;
}

interface SupplierPrice {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  price: number;
  presentation_qty: number;
  presentation_unit: string;
  lead_days: number;
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
}

type View = "list" | "new" | "edit";

export default function ProveedoresPage() {
  const supabase = createClient();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Form
  const [view, setView] = useState<View>("list");
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Prices (edit view)
  const [prices, setPrices] = useState<SupplierPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [allIngredients, setAllIngredients] = useState<IngredientOption[]>([]);
  const [addingPrice, setAddingPrice] = useState(false);
  const [ingSearch, setIngSearch] = useState("");
  const [selectedIng, setSelectedIng] = useState<IngredientOption | null>(null);
  const [priceVal, setPriceVal] = useState("");
  const [presQty, setPresQty] = useState("1");
  const [presUnit, setPresUnit] = useState("und");
  const [leadDays, setLeadDays] = useState("1");

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const companyId = getActiveCompanyId();
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, phone, active")
      .eq("company_id", companyId)
      .order("name");

    if (!data) { setLoading(false); return; }

    // Count prices per supplier
    const { data: sp } = await supabase.from("supplier_prices").select("supplier_id").eq("company_id", companyId);
    const countMap: Record<string, number> = {};
    for (const p of sp ?? []) {
      countMap[p.supplier_id] = (countMap[p.supplier_id] ?? 0) + 1;
    }

    setSuppliers(data.map((s: any) => ({ ...s, _priceCount: countMap[s.id] ?? 0 })));
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const fetchPrices = useCallback(async (supplierId: string) => {
    setLoadingPrices(true);
    const companyId = getActiveCompanyId();
    const { data } = await supabase
      .from("supplier_prices")
      .select("id, ingredient_id, price, presentation_qty, presentation_unit, lead_days, ingredient:ingredients(name, unit)")
      .eq("supplier_id", supplierId)
      .eq("company_id", companyId);

    setPrices((data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      ingredient_id: p.ingredient_id as string,
      price: p.price as number,
      presentation_qty: p.presentation_qty as number,
      presentation_unit: p.presentation_unit as string,
      lead_days: p.lead_days as number,
      ingredient_name: (p.ingredient as { name: string } | null)?.name ?? "",
      ingredient_unit: (p.ingredient as { unit: string } | null)?.unit ?? "",
    })));
    setLoadingPrices(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchIngredients = useCallback(async () => {
    const companyId = getActiveCompanyId();
    const { data } = await supabase
      .from("ingredients")
      .select("id, name, unit")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name");
    setAllIngredients((data as IngredientOption[]) ?? []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s => s.name.toLowerCase().includes(q) || s.phone?.includes(q));
  }, [suppliers, search]);

  function openNew() {
    setEditSupplier(null);
    setFormName("");
    setFormPhone("");
    setPrices([]);
    setAddingPrice(false);
    setView("new");
  }

  function openEdit(supplier: Supplier) {
    setEditSupplier(supplier);
    setFormName(supplier.name);
    setFormPhone(supplier.phone || "");
    setAddingPrice(false);
    setView("edit");
    fetchPrices(supplier.id);
    fetchIngredients();
  }

  function goBack() {
    setView("list");
    setEditSupplier(null);
    fetchSuppliers();
  }

  async function handleSave() {
    if (!formName.trim()) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    const companyId = getActiveCompanyId();
    const payload = { name: formName.trim(), phone: formPhone.trim() || null };

    if (view === "edit" && editSupplier) {
      const { error } = await supabase.from("suppliers").update(payload).eq("id", editSupplier.id).eq("company_id", companyId);
      if (error) { toast.error(`Error: ${error.message}`); setSaving(false); return; }
      toast.success("Proveedor actualizado");
    } else {
      const { data, error } = await supabase.from("suppliers").insert({ ...payload, company_id: companyId }).select("id, name, phone, active").single();
      if (error) { toast.error(`Error: ${error.message}`); setSaving(false); return; }
      toast.success("Proveedor creado");
      // Switch to edit to add prices
      if (data) {
        setEditSupplier(data);
        setView("edit");
        setPrices([]);
        fetchIngredients();
        setSaving(false);
        return;
      }
    }
    setSaving(false);
  }

  async function handleDelete(supplier: Supplier) {
    if ((supplier._priceCount ?? 0) > 0) {
      // Delete prices first
      await supabase.from("supplier_prices").delete().eq("supplier_id", supplier.id).eq("company_id", getActiveCompanyId());
    }
    const { error } = await supabase.from("suppliers").delete().eq("id", supplier.id).eq("company_id", getActiveCompanyId());
    if (error) { toast.error("No se puede eliminar: tiene movimientos asociados"); setDeletingId(null); return; }
    toast.success(`"${supplier.name}" eliminado`);
    setDeletingId(null);
    fetchSuppliers();
  }

  async function handleAddPrice() {
    if (!selectedIng || !priceVal || !editSupplier) return;
    const price = parseInt(priceVal);
    if (isNaN(price) || price <= 0) { toast.error("Precio inválido"); return; }

    const { error } = await supabase.from("supplier_prices").upsert({
      supplier_id: editSupplier.id,
      ingredient_id: selectedIng.id,
      price,
      presentation_qty: parseFloat(presQty) || 1,
      presentation_unit: presUnit,
      lead_days: parseInt(leadDays) || 1,
      company_id: getActiveCompanyId(),
    }, { onConflict: "supplier_id,ingredient_id,company_id" });

    if (error) { toast.error(`Error: ${error.message}`); return; }
    toast.success(`Precio de "${selectedIng.name}" agregado`);
    setSelectedIng(null);
    setPriceVal("");
    setPresQty("1");
    setPresUnit("und");
    setLeadDays("1");
    setAddingPrice(false);
    fetchPrices(editSupplier.id);
  }

  async function handleDeletePrice(priceId: string) {
    await supabase.from("supplier_prices").delete().eq("id", priceId).eq("company_id", getActiveCompanyId());
    toast.success("Precio eliminado");
    if (editSupplier) fetchPrices(editSupplier.id);
  }

  const filteredIngredients = useMemo(() => {
    const existing = new Set(prices.map(p => p.ingredient_id));
    let list = allIngredients.filter(i => !existing.has(i.id));
    if (ingSearch.trim()) {
      const q = ingSearch.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q));
    }
    return list.slice(0, 20);
  }, [allIngredients, prices, ingSearch]);

  // ── CREATE / EDIT VIEW ──
  if (view === "new" || view === "edit") {
    return (
      <div className="flex h-full bg-gray-50">
        {/* Left — Info + Actions */}
        <div className="w-[320px] shrink-0 flex flex-col border-r border-default-100 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-default-100">
            <button onClick={goBack} className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all">
              <ArrowLeft size={22} className="text-default-600" />
            </button>
            <h1 className="text-lg font-bold text-default-800">{view === "new" ? "Nuevo proveedor" : "Editar proveedor"}</h1>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            {/* Preview */}
            <div className="rounded-2xl bg-default-50 border border-default-100 p-6 flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <Truck size={40} weight="duotone" />
              </div>
              <p className="text-lg font-bold text-default-900">{formName || "Sin nombre"}</p>
              {formPhone && <p className="text-sm text-default-400 mt-1">{formPhone}</p>}
              {view === "edit" && <p className="text-xs text-default-400 mt-2">{prices.length} ingredientes</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-default-100 space-y-2">
            <button onClick={handleSave} disabled={saving}
              className="w-full h-14 rounded-2xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {saving ? <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={20} weight="bold" /> {view === "new" ? "Crear" : "Guardar"}</>}
            </button>
            <button onClick={goBack} className="w-full h-12 rounded-2xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 active:scale-[0.97] transition-all">
              Cancelar
            </button>
          </div>
        </div>

        {/* Right — Form + Prices */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-6">
            {/* Name + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Nombre *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ej: Fruver El Campo" autoFocus
                  className="w-full h-12 px-4 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1.5 block">Teléfono</label>
                <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Ej: 3001234567"
                  className="w-full h-12 px-4 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
            </div>

            {/* Prices table — only in edit mode */}
            {view === "edit" && editSupplier && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-default-500 uppercase tracking-wider">Precios de ingredientes</label>
                  <button onClick={() => { setAddingPrice(true); setSelectedIng(null); setIngSearch(""); }}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 active:scale-95 transition-all">
                    <Plus size={14} weight="bold" /> Agregar
                  </button>
                </div>

                {/* Add price form */}
                {addingPrice && (
                  <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 mb-4 space-y-3">
                    {selectedIng ? (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-default-900">{selectedIng.name} <span className="text-default-400 font-normal">({selectedIng.unit})</span></p>
                          <button onClick={() => setSelectedIng(null)} className="h-7 w-7 rounded-lg text-default-400 hover:bg-default-100 flex items-center justify-center">
                            <X size={14} weight="bold" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-default-400 uppercase">Precio</label>
                            <input type="number" value={priceVal} onChange={(e) => setPriceVal(e.target.value)} placeholder="$"
                              className="w-full h-10 px-3 rounded-lg border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all" autoFocus />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-default-400 uppercase">Cant.</label>
                            <input type="number" value={presQty} onChange={(e) => setPresQty(e.target.value)} step="any"
                              className="w-full h-10 px-3 rounded-lg border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-default-400 uppercase">Unidad</label>
                            <select value={presUnit} onChange={(e) => setPresUnit(e.target.value)}
                              className="w-full h-10 px-2 rounded-lg border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all">
                              {["und", "kg", "g", "L", "ml", "caja", "bolsa", "tarro", "paquete"].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-default-400 uppercase">Días entrega</label>
                            <input type="number" value={leadDays} onChange={(e) => setLeadDays(e.target.value)} min="1"
                              className="w-full h-10 px-3 rounded-lg border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all" />
                          </div>
                        </div>
                        {priceVal && presQty && parseFloat(presQty) > 0 && (
                          <p className="text-[10px] text-default-500">
                            Costo unitario: <span className="font-bold text-default-700">{formatCOP(Math.round(parseInt(priceVal) / parseFloat(presQty)))}/{selectedIng.unit}</span>
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={handleAddPrice} disabled={!priceVal || parseInt(priceVal) <= 0}
                            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-40">
                            Agregar precio
                          </button>
                          <button onClick={() => { setAddingPrice(false); setSelectedIng(null); }}
                            className="h-10 px-4 rounded-xl bg-default-100 text-default-500 text-sm font-semibold active:scale-95 transition-all">
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <input type="text" value={ingSearch} onChange={(e) => setIngSearch(e.target.value)} placeholder="Buscar ingrediente..."
                          className="w-full h-10 px-3 rounded-lg border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all" autoFocus />
                        <div className="max-h-48 overflow-auto space-y-0.5">
                          {filteredIngredients.map(ing => (
                            <button key={ing.id} onClick={() => { setSelectedIng(ing); setPresUnit(ing.unit); }}
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-default-50 rounded-lg text-sm transition-colors">
                              <span className="font-medium text-default-700">{ing.name}</span>
                              <span className="text-xs text-default-400">{ing.unit}</span>
                            </button>
                          ))}
                          {filteredIngredients.length === 0 && <p className="text-xs text-default-400 text-center py-4">No se encontraron ingredientes</p>}
                        </div>
                        <button onClick={() => setAddingPrice(false)} className="w-full h-9 rounded-lg bg-default-100 text-default-500 text-xs font-semibold active:scale-95 transition-all">
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Prices list */}
                {loadingPrices ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="h-6 w-6 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : prices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-default-300 gap-2">
                    <Package size={40} weight="duotone" />
                    <p className="text-sm text-default-400">Sin precios registrados</p>
                    <p className="text-xs text-default-300">Agrega los ingredientes que vende este proveedor</p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white border border-default-100 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-default-50">
                          <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-default-500">Ingrediente</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-default-500">Precio</th>
                          <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-default-500">Presentación</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-default-500">Costo/Und</th>
                          <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-default-500">Días</th>
                          <th className="px-4 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {prices.map(p => {
                          const costPerUnit = p.presentation_qty > 0 ? Math.round(p.price / p.presentation_qty) : p.price;
                          return (
                            <tr key={p.id} className="border-t border-default-50 hover:bg-default-50/50 transition-colors">
                              <td className="px-4 py-2.5">
                                <p className="text-sm font-semibold text-default-900">{p.ingredient_name}</p>
                                <p className="text-[10px] text-default-400">{p.ingredient_unit}</p>
                              </td>
                              <td className="px-4 py-2.5 text-right text-sm font-bold text-default-700 tabular-nums">{formatCOP(p.price)}</td>
                              <td className="px-4 py-2.5 text-center text-xs text-default-500">{p.presentation_qty} {p.presentation_unit}</td>
                              <td className="px-4 py-2.5 text-right text-sm font-bold text-primary tabular-nums">{formatCOP(costPerUnit)}/{p.ingredient_unit}</td>
                              <td className="px-4 py-2.5 text-center text-xs text-default-500">{p.lead_days}d</td>
                              <td className="px-4 py-2.5">
                                <button onClick={() => handleDeletePrice(p.id)}
                                  className="h-7 w-7 rounded-lg text-default-300 hover:bg-red-50 hover:text-red-500 flex items-center justify-center active:scale-95 transition-all">
                                  <Trash size={14} weight="bold" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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
            <Truck size={24} weight="duotone" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-default-900">Proveedores</h1>
            <p className="text-sm text-default-500">{suppliers.length} proveedores registrados</p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 hover:brightness-105 active:scale-95 transition-all">
          <Plus size={16} weight="bold" /> Nuevo
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-4">
        <div className="relative max-w-md">
          <MagnifyingGlass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-default-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="h-6 w-6 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-default-400 gap-2">
            <Truck size={48} weight="duotone" />
            <p className="text-sm">{search ? "No se encontraron proveedores" : "No hay proveedores registrados"}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-default-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-default-50">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-default-500">Proveedor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-default-500">Teléfono</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-default-500">Ingredientes</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-default-500 w-28">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(supplier => (
                  <tr key={supplier.id} className="border-t border-default-50 hover:bg-default-50/50 transition-colors cursor-pointer" onClick={() => openEdit(supplier)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                          <Truck size={20} weight="duotone" />
                        </div>
                        <span className="text-sm font-semibold text-default-900">{supplier.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {supplier.phone ? (
                        <span className="flex items-center gap-1.5 text-sm text-default-600">
                          <Phone size={14} weight="duotone" /> {supplier.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-default-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${(supplier._priceCount ?? 0) > 0 ? "bg-primary/10 text-primary" : "bg-default-100 text-default-400"}`}>
                        {supplier._priceCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {deletingId === supplier.id ? (
                          <>
                            <button onClick={() => handleDelete(supplier)} className="h-8 w-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 active:scale-95">
                              <Check size={14} weight="bold" />
                            </button>
                            <button onClick={() => setDeletingId(null)} className="h-8 w-8 rounded-lg bg-default-100 text-default-500 flex items-center justify-center hover:bg-default-200 active:scale-95">
                              <X size={14} weight="bold" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(supplier)}
                              className="h-8 w-8 rounded-lg text-default-400 hover:bg-default-100 hover:text-default-600 flex items-center justify-center active:scale-95 transition-all">
                              <PencilSimple size={14} weight="bold" />
                            </button>
                            <button onClick={() => setDeletingId(supplier.id)}
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
