"use client";

import { Warning } from "@phosphor-icons/react";

interface ConfirmClearModalProps {
  isOpen: boolean;
  itemCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmClearModal({ isOpen, itemCount, onConfirm, onCancel }: ConfirmClearModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="animate-in zoom-in-95 fade-in duration-200 w-full max-w-sm mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + message */}
        <div className="flex flex-col items-center gap-4 px-8 pt-8 pb-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Warning size={32} weight="duotone" className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-default-800">Vaciar orden?</h3>
            <p className="text-sm text-default-500 mt-1">
              Se eliminaran {itemCount} items de la orden actual
            </p>
          </div>
        </div>

        {/* Buttons — BIG for touch */}
        <div className="p-4 space-y-2">
          <button
            onClick={onConfirm}
            className="w-full h-14 rounded-xl bg-danger text-white text-base font-bold hover:bg-danger/90 active:scale-[0.97] transition-all flex items-center justify-center"
          >
            Si, vaciar todo
          </button>
          <button
            onClick={onCancel}
            className="w-full h-14 rounded-xl bg-default-100 text-default-700 text-base font-semibold hover:bg-default-200 active:scale-[0.97] transition-all flex items-center justify-center"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
