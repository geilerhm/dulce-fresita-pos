"use client";

import { useState, useEffect } from "react";
import { SOUND_PACKS, getSavedPackId, savePackId, type SoundPack } from "@/lib/utils/sounds";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/utils/toast";
import { Strawberry } from "@/lib/utils/fruit-icons";
import { SpeakerHigh, Check, ShoppingCart, Trash, CashRegister, User, Storefront, SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { username, displayName, activeCompany, companies, selectCompany, logout } = useAuth();
  const router = useRouter();
  const [selectedPack, setSelectedPack] = useState("crystal");

  useEffect(() => {
    setSelectedPack(getSavedPackId());
  }, []);

  function handleSelect(pack: SoundPack) {
    setSelectedPack(pack.id);
    savePackId(pack.id);
    pack.add();
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      <div className="max-w-xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-xl font-bold text-default-800">Configuración</h1>
          <p className="text-sm text-default-400 mt-1">Tu perfil, empresa y preferencias</p>
        </div>

        {/* ── Profile ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <User size={20} weight="duotone" className="text-primary" />
            <h2 className="text-base font-bold text-default-800">Perfil</h2>
          </div>

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
              <button onClick={() => { navigator.clipboard.writeText(activeCompany?.id ?? ""); toast.success("ID copiado"); }}
                className="text-[10px] text-default-300 font-mono hover:text-primary transition-colors text-left">
                ID: {activeCompany?.id} 📋
              </button>
            </div>
          </div>
        </div>

        {/* ── Sound packs ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <SpeakerHigh size={20} weight="duotone" className="text-primary" />
            <h2 className="text-base font-bold text-default-800">Sonidos</h2>
          </div>

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
        </div>

        {/* ── Cerrar sesión ── */}
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl border-2 border-red-200 text-red-500 font-bold hover:bg-red-50 active:scale-[0.97] transition-all">
          <SignOut size={20} weight="bold" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
