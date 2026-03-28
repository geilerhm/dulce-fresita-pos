"use client";

import { Wallet } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

interface NoCajaWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export function NoCajaWarningModal({ isOpen, onClose, onContinue }: NoCajaWarningModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="animate-in zoom-in-95 fade-in duration-200 w-full max-w-sm mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-4 px-8 pt-8 pb-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
            <Wallet size={32} weight="duotone" className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-default-800">No hay caja abierta</h3>
            <p className="text-sm text-default-500 mt-1">
              Abre la caja para llevar el cuadre del dia
            </p>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={() => router.push("/caja")}
            className="w-full h-14 rounded-xl bg-primary text-white text-base font-bold hover:brightness-105 active:scale-[0.97] transition-all flex items-center justify-center"
          >
            Ir a abrir caja
          </button>
          <button
            onClick={onContinue}
            className="w-full h-12 rounded-xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 active:scale-[0.97] transition-all flex items-center justify-center"
          >
            Vender sin caja
          </button>
        </div>
      </div>
    </div>
  );
}
