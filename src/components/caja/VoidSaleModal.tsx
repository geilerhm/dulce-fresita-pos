"use client";

import { formatCOP } from "@/lib/utils/format";
import { X, Check, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { playRemove } from "@/lib/utils/sounds";

interface VoidSaleModalProps {
  isOpen: boolean;
  sale: { id: string; sale_number: number; total: number } | null;
  onClose: () => void;
  onVoided: () => void;
}

const VOID_REASONS = [
  "Error de cajero",
  "Cliente cancelo",
  "Producto equivocado",
  "Cobro duplicado",
];

export function VoidSaleModal({ isOpen, sale, onClose, onVoided }: VoidSaleModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !sale) return null;

  async function handleVoid() {
    if (!selectedReason || !sale) return;
    setProcessing(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("sales")
        .update({ status: "voided", voided_reason: selectedReason })
        .eq("id", sale.id);

      if (updateError) throw updateError;

      // Reverse inventory deductions
      await supabase.rpc("fn_reverse_inventory", { p_sale_id: sale.id });

      playRemove();
      onVoided();
      onClose();
      setSelectedReason(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al anular");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="animate-in zoom-in-95 fade-in duration-200 w-full max-w-sm mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-default-100">
          <h2 className="text-lg font-bold text-default-800">Anular Venta</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-default-100 transition-colors">
            <X size={20} className="text-default-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <WarningCircle size={18} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Sale info */}
          <div className="rounded-2xl bg-default-50 border border-default-100 p-4 text-center">
            <p className="text-sm text-default-500">Venta #{sale.sale_number}</p>
            <p className="text-2xl font-extrabold text-default-900 tabular-nums">{formatCOP(sale.total)}</p>
          </div>

          {/* Reason selection */}
          <div>
            <p className="text-xs font-bold text-default-500 uppercase tracking-wider mb-3">Razon de anulacion</p>
            <div className="space-y-2">
              {VOID_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full h-12 rounded-xl text-sm font-semibold text-left px-4 transition-all active:scale-[0.97]
                    ${selectedReason === reason
                      ? "bg-red-50 border-2 border-red-300 text-red-700"
                      : "bg-white border border-default-200 text-default-600 hover:border-default-300"
                    }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-default-100 space-y-2 bg-default-50/30">
          <button
            onClick={handleVoid}
            disabled={processing || !selectedReason}
            className="w-full h-14 rounded-2xl bg-red-500 text-white text-lg font-bold shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {processing ? (
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check size={20} weight="bold" />
                Confirmar Anulacion
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 hover:text-default-700 active:scale-[0.97] transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
