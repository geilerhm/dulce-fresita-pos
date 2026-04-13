"use client";

import { useState, useEffect } from "react";
import { SOUND_PACKS, getSavedPackId, savePackId, type SoundPack } from "@/lib/utils/sounds";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/utils/toast";
import { Strawberry } from "@/lib/utils/fruit-icons";
import { SpeakerHigh, Check, ShoppingCart, Trash, CashRegister, User, Storefront, SignOut, Receipt, Printer, Sparkle, ArrowsClockwise, Info } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { getReceiptConfig, saveReceiptConfig, type ReceiptConfig } from "@/lib/utils/receipt-config";
import { DEFAULT_BLESSINGS } from "@/lib/utils/blessing-phrases";
import { printReceipt, type ReceiptData } from "@/components/pos/Receipt";
import { formatCOP } from "@/lib/utils/format";

const SAMPLE_RECEIPT: Omit<ReceiptData, "businessName" | "cashierName"> = {
  saleNumber: 42,
  date: (() => {
    const n = new Date();
    const p = (v: number) => String(v).padStart(2, "0");
    return `${p(n.getDate())}/${p(n.getMonth() + 1)}/${n.getFullYear()}`;
  })(),
  time: (() => {
    const n = new Date();
    const p = (v: number) => String(v).padStart(2, "0");
    return `${p(n.getHours())}:${p(n.getMinutes())}`;
  })(),
  items: [
    { name: "Fresas con crema 12 oz", quantity: 2, unitPrice: 12000, subtotal: 24000 },
    { name: "Waffle Nutella Bliss", quantity: 1, unitPrice: 16000, subtotal: 16000 },
    { name: "Malteada Oreo", quantity: 1, unitPrice: 15000, subtotal: 15000 },
    { name: "Topping Oreo", quantity: 2, unitPrice: 2000, subtotal: 4000 },
  ],
  total: 59000,
  paymentMethod: "efectivo",
  received: 100000,
  change: 41000,
};

const TABS = [
  { id: "perfil", label: "Perfil", Icon: User },
  { id: "recibo", label: "Recibo", Icon: Receipt },
  { id: "sonidos", label: "Sonidos", Icon: SpeakerHigh },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const { username, displayName, activeCompany, companies, selectCompany, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("perfil");
  const [selectedPack, setSelectedPack] = useState("crystal");
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig>({
    address: "",
    phone: "",
    nit: "",
    footerMessage: "",
    showLogo: true,
    showBlessing: true,
    blessingPhrases: DEFAULT_BLESSINGS,
  });

  useEffect(() => {
    setSelectedPack(getSavedPackId());
    setReceiptConfig(getReceiptConfig());
  }, []);

  function updateReceiptConfig(partial: Partial<ReceiptConfig>) {
    const updated = { ...receiptConfig, ...partial };
    setReceiptConfig(updated);
    saveReceiptConfig(updated);
  }

  function handleTestPrint() {
    printReceipt({
      ...SAMPLE_RECEIPT,
      businessName: activeCompany?.name || "Dulce Fresita",
      cashierName: displayName || undefined,
    });
  }

  function handleSelect(pack: SoundPack) {
    setSelectedPack(pack.id);
    savePackId(pack.id);
    pack.add();
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function handleResetBlessings() {
    updateReceiptConfig({ blessingPhrases: DEFAULT_BLESSINGS });
    toast.success("Frases restauradas");
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header with pill tabs — matches /caja style */}
      <div className="bg-white border-b border-default-100 px-6 py-5">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-default-800">Configuración</h1>
          <p className="text-xs text-default-400 mt-0.5">Tu perfil, recibo y sonidos</p>
        </div>

        <div className="flex gap-1 bg-default-100 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all
                ${tab === t.id
                  ? "bg-white text-default-800 shadow-sm"
                  : "text-default-400 hover:text-default-600"
                }`}
            >
              <t.Icon size={18} weight={tab === t.id ? "fill" : "regular"} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-xl mx-auto p-6">
          {/* ═══════════ PERFIL ═══════════ */}
          {tab === "perfil" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-default-100 overflow-hidden">
                <div className="flex items-center gap-4 p-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-pink-400 shadow-lg shadow-primary/20">
                    <Strawberry size={32} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-default-900">{displayName}</p>
                    <p className="text-sm text-default-400">@{username}</p>
                  </div>
                </div>

                <div className="border-t border-default-100 px-5 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-default-500">
                      <Storefront size={16} weight="duotone" />
                      <span className="font-medium">{activeCompany?.name}</span>
                    </div>
                    {companies.length > 1 && (
                      <select
                        value={activeCompany?.id ?? ""}
                        onChange={(e) => { selectCompany(e.target.value); router.push("/pos"); }}
                        className="text-xs font-medium text-primary bg-primary/10 rounded-lg px-3 py-1.5 outline-none cursor-pointer"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(activeCompany?.id ?? ""); toast.success("ID copiado"); }}
                    className="text-[10px] text-default-300 font-mono hover:text-primary transition-colors text-left"
                  >
                    ID: {activeCompany?.id}
                  </button>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl border-2 border-red-200 text-red-500 font-bold hover:bg-red-50 active:scale-[0.97] transition-all"
              >
                <SignOut size={20} weight="bold" /> Cerrar sesión
              </button>

              {/* Version + Update */}
              <UpdateChecker />
            </div>
          )}

          {/* ═══════════ RECIBO ═══════════ */}
          {tab === "recibo" && (
            <div className="space-y-4">
              {/* Datos del negocio */}
              <div className="rounded-2xl bg-white border border-default-100 p-5 space-y-4">
                <h3 className="text-sm font-bold text-default-800">Datos del negocio</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1 block">Teléfono</label>
                    <input
                      value={receiptConfig.phone}
                      onChange={(e) => updateReceiptConfig({ phone: e.target.value })}
                      placeholder="300 123 4567"
                      className="w-full h-10 px-3 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1 block">NIT</label>
                    <input
                      value={receiptConfig.nit}
                      onChange={(e) => updateReceiptConfig({ nit: e.target.value })}
                      placeholder="900.123.456-7"
                      className="w-full h-10 px-3 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-default-500 uppercase tracking-wider mb-1 block">Dirección</label>
                  <input
                    value={receiptConfig.address}
                    onChange={(e) => updateReceiptConfig({ address: e.target.value })}
                    placeholder="Cra 5 #12-34, Barranquilla"
                    className="w-full h-10 px-3 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-sm font-bold text-default-800">Mostrar logo</p>
                    <p className="text-[11px] text-default-400">Imprime el logo de Dulce Fresita arriba</p>
                  </div>
                  <button
                    onClick={() => updateReceiptConfig({ showLogo: !receiptConfig.showLogo })}
                    className={`relative w-14 h-8 rounded-full transition-colors ${receiptConfig.showLogo ? "bg-emerald-500" : "bg-default-300"}`}
                  >
                    <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${receiptConfig.showLogo ? "translate-x-6" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Mensaje de pie */}
              <div className="rounded-2xl bg-white border border-default-100 p-5 space-y-3">
                <h3 className="text-sm font-bold text-default-800">Mensaje de agradecimiento</h3>
                <p className="text-[11px] text-default-400">Se imprime justo antes de la frase aleatoria</p>
                <textarea
                  value={receiptConfig.footerMessage}
                  onChange={(e) => updateReceiptConfig({ footerMessage: e.target.value })}
                  placeholder="¡Gracias por tu compra!"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all resize-none font-mono"
                />
              </div>

              {/* Frases motivacionales */}
              <div className="rounded-2xl bg-white border border-default-100 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Sparkle size={16} weight="fill" className="text-primary" />
                      <h3 className="text-sm font-bold text-default-800">Frase aleatoria</h3>
                    </div>
                    <p className="text-[11px] text-default-400">Una frase distinta en cada ticket, elegida al azar</p>
                  </div>
                  <button
                    onClick={() => updateReceiptConfig({ showBlessing: !receiptConfig.showBlessing })}
                    className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${receiptConfig.showBlessing ? "bg-emerald-500" : "bg-default-300"}`}
                  >
                    <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${receiptConfig.showBlessing ? "translate-x-6" : ""}`} />
                  </button>
                </div>

                {receiptConfig.showBlessing && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-default-500 uppercase tracking-wider mb-1 block">
                        Una frase por línea · {receiptConfig.blessingPhrases.length} frases
                      </label>
                      <textarea
                        value={receiptConfig.blessingPhrases.join("\n")}
                        onChange={(e) => updateReceiptConfig({
                          blessingPhrases: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                        })}
                        rows={10}
                        className="w-full px-3 py-2 rounded-xl border border-default-200 bg-white text-sm outline-none focus:border-primary transition-all resize-none font-mono"
                      />
                    </div>
                    <button
                      onClick={handleResetBlessings}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Restaurar frases por defecto
                    </button>
                  </>
                )}
              </div>

              {/* Preview */}
              <div className="rounded-2xl bg-white border border-default-100 p-5">
                <p className="text-xs font-bold text-default-500 uppercase tracking-wider mb-3">Vista previa</p>
                <div
                  className="mx-auto bg-white border border-default-200 rounded-xl p-4 shadow-sm"
                  style={{ width: "302px", fontFamily: "'Courier New', monospace", fontSize: "12px" }}
                >
                  <div style={{ textAlign: "center", marginBottom: "8px" }}>
                    {receiptConfig.showLogo && <div className="flex justify-center mb-1"><Strawberry size={28} className="text-black" /></div>}
                    <div style={{ fontSize: "14px", fontWeight: "bold" }}>{activeCompany?.name || "Dulce Fresita"}</div>
                    {receiptConfig.phone && <div style={{ fontSize: "9px", color: "#888" }}>Tel: {receiptConfig.phone}</div>}
                  </div>
                  <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                    <span>Factura: #42</span><span>{SAMPLE_RECEIPT.date}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                    <span>Cajero: {displayName}</span><span>{SAMPLE_RECEIPT.time}</span>
                  </div>
                  <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
                  {SAMPLE_RECEIPT.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "1px 0" }}>
                      <span>{item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}</span>
                      <span>{formatCOP(item.subtotal)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "2px solid #000", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "bold" }}>
                    <span>TOTAL</span><span>{formatCOP(SAMPLE_RECEIPT.total)}</span>
                  </div>
                  <div style={{ borderTop: "2px solid #000", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                    <span>Pago:</span><span>Efectivo</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                    <span>Recibido:</span><span>{formatCOP(SAMPLE_RECEIPT.received!)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                    <span>Cambio:</span><span>{formatCOP(SAMPLE_RECEIPT.change!)}</span>
                  </div>
                  <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
                  <div style={{ textAlign: "center", fontSize: "9px", color: "#888" }}>
                    {receiptConfig.footerMessage.split("\n").map((l, i) => <p key={i}>{l}</p>)}
                  </div>
                  {receiptConfig.showBlessing && receiptConfig.blessingPhrases.length > 0 && (
                    <div style={{ textAlign: "center", fontSize: "9px", color: "#aaa", fontStyle: "italic", marginTop: "4px" }}>
                      {receiptConfig.blessingPhrases[0]}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleTestPrint}
                className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Printer size={18} weight="bold" /> Imprimir prueba
              </button>
            </div>
          )}

          {/* ═══════════ SONIDOS ═══════════ */}
          {tab === "sonidos" && (
            <div className="space-y-2">
              {SOUND_PACKS.map((pack) => {
                const isActive = selectedPack === pack.id;
                return (
                  <div
                    key={pack.id}
                    className={`rounded-2xl border-2 bg-white overflow-hidden transition-all cursor-pointer
                      ${isActive ? "border-primary" : "border-default-100 hover:border-default-200"}`}
                    onClick={() => handleSelect(pack)}
                  >
                    <div className="flex items-center gap-3 p-4">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0 transition-colors
                        ${isActive ? "border-primary bg-primary" : "border-default-300"}`}>
                        {isActive && <Check size={14} weight="bold" className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-default-800">{pack.name}</p>
                        <p className="text-xs text-default-400">{pack.description}</p>
                      </div>
                    </div>

                    {isActive && pack.id !== "silent" && (
                      <div className="border-t border-default-100 bg-default-50/50 px-4 py-3">
                        <p className="text-[10px] font-bold text-default-400 uppercase tracking-wider mb-2">Probar sonidos</p>
                        <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); pack.add(); }}
                            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-default-200 text-default-600 text-xs font-semibold hover:bg-default-100 active:scale-95 transition-all">
                            <ShoppingCart size={16} weight="duotone" /> Agregar
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); pack.remove(); }}
                            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-default-200 text-default-600 text-xs font-semibold hover:bg-default-100 active:scale-95 transition-all">
                            <Trash size={16} weight="duotone" /> Eliminar
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); pack.success(); }}
                            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-default-200 text-default-600 text-xs font-semibold hover:bg-default-100 active:scale-95 transition-all">
                            <CashRegister size={16} weight="duotone" /> Venta
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UpdateChecker() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

  async function checkForUpdates() {
    setChecking(true);
    setStatus(null);
    try {
      const res = await fetch("/api/update-check", { method: "POST" });
      const data = await res.json();
      if (data.updateAvailable) {
        setStatus(`Nueva versión ${data.version} disponible — descargando...`);
      } else {
        setStatus("Estás en la última versión");
      }
    } catch {
      setStatus("No se pudo verificar (modo desarrollo)");
    }
    setChecking(false);
  }

  return (
    <div className="rounded-2xl bg-white border border-default-100 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-default-50">
            <Info size={20} weight="duotone" className="text-default-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-default-800">Dulce Fresita</p>
            <p className="text-xs text-default-400">Versión {version}</p>
          </div>
        </div>
        <button
          onClick={checkForUpdates}
          disabled={checking}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-default-100 text-default-600 text-xs font-bold hover:bg-default-200 active:scale-95 transition-all disabled:opacity-50"
        >
          <ArrowsClockwise size={14} className={checking ? "animate-spin" : ""} />
          {checking ? "Verificando..." : "Buscar actualización"}
        </button>
      </div>
      {status && (
        <p className="text-xs text-default-500 mt-3 bg-default-50 rounded-xl px-3 py-2">{status}</p>
      )}
    </div>
  );
}
