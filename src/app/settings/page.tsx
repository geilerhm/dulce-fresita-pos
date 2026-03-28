"use client";

import { useState, useEffect } from "react";
import { SOUND_PACKS, getSavedPackId, savePackId, type SoundPack } from "@/lib/utils/sounds";
import { SpeakerHigh, Check, ShoppingCart, Trash, CashRegister } from "@phosphor-icons/react";

export default function SettingsPage() {
  const [selectedPack, setSelectedPack] = useState("crystal");

  useEffect(() => {
    setSelectedPack(getSavedPackId());
  }, []);

  function handleSelect(pack: SoundPack) {
    setSelectedPack(pack.id);
    savePackId(pack.id);
    pack.add(); // preview on select
  }

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      <div className="max-w-xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-default-800">Configuracion</h1>
          <p className="text-sm text-default-400 mt-1">Personaliza tu experiencia</p>
        </div>

        {/* Sound packs */}
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
                  {/* Main row */}
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

                  {/* Preview buttons — only when selected and not silent */}
                  {isActive && pack.id !== "silent" && (
                    <div className="border-t border-default-100 bg-default-50/50 px-4 py-3">
                      <p className="text-[10px] font-bold text-default-400 uppercase tracking-wider mb-2">Probar sonidos</p>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); pack.add(); }}
                          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-default-200 text-default-600 text-xs font-semibold hover:bg-default-100 active:scale-95 transition-all"
                        >
                          <ShoppingCart size={16} weight="duotone" />
                          Agregar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); pack.remove(); }}
                          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-default-200 text-default-600 text-xs font-semibold hover:bg-default-100 active:scale-95 transition-all"
                        >
                          <Trash size={16} weight="duotone" />
                          Eliminar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); pack.success(); }}
                          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-default-200 text-default-600 text-xs font-semibold hover:bg-default-100 active:scale-95 transition-all"
                        >
                          <CashRegister size={16} weight="duotone" />
                          Venta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
