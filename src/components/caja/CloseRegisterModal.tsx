"use client";

import { useCaja } from "@/contexts/CajaContext";
import { useCajaSummary } from "@/lib/hooks/useCajaSummary";
import { formatCOP, formatTime } from "@/lib/utils/format";
import { playSuccess } from "@/lib/utils/sounds";
import { Money, DeviceMobile, ShoppingCart, Check, ArrowLeft, Backspace, Clock, WarningCircle } from "@phosphor-icons/react";
import { useState, useEffect, useCallback } from "react";

interface CloseRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NUMPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["00", "0", "DEL"],
];

export function CloseRegisterModal({ isOpen, onClose }: CloseRegisterModalProps) {
  const { register, closeRegister } = useCaja();
  const { summary } = useCajaSummary(register?.id ?? null);
  const [actualCash, setActualCash] = useState(0);
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedCash = (register?.initial_cash ?? 0) + summary.efectivoTotal;
  const difference = actualCash - expectedCash;
  const digits = actualCash > 0 ? String(actualCash) : "";

  useEffect(() => {
    if (isOpen) {
      setActualCash(0);
      setNotes("");
      setError(null);
    }
  }, [isOpen]);

  function handleNumpadKey(key: string) {
    if (key === "DEL") {
      setActualCash(parseInt(digits.slice(0, -1)) || 0);
      return;
    }
    const next = digits + key;
    if (next.length > 7) return;
    setActualCash(parseInt(next) || 0);
  }

  const handleClose = useCallback(async () => {
    if (!register || processing) return;
    setProcessing(true);
    setError(null);
    try {
      await closeRegister({
        final_cash_expected: expectedCash,
        final_cash_actual: actualCash,
        notes: notes || undefined,
      });
      playSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cerrar caja");
    } finally {
      setProcessing(false);
    }
  }, [register, processing, expectedCash, actualCash, notes, closeRegister, onClose]);

  if (!isOpen || !register) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-white">
      {/* LEFT — Summary */}
      <div className="w-[45%] flex flex-col border-r border-default-100 bg-gray-50">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-default-100 bg-white shrink-0">
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-default-100 active:scale-95 transition-all"
          >
            <ArrowLeft size={22} className="text-default-600" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-default-800">Cerrar Caja</h2>
            <p className="text-xs text-default-400 flex items-center gap-1">
              <Clock size={12} />
              Abierta desde {formatTime(register.opened_at)}
            </p>
          </div>
        </div>

        {/* Sales summary */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <WarningCircle size={18} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Cards */}
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-2xl bg-white border border-default-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-default-500">
                <Money size={18} weight="duotone" />
                <span className="text-sm">Ventas efectivo</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-default-900 tabular-nums">{formatCOP(summary.efectivoTotal)}</span>
                <span className="text-xs text-default-400 ml-2">{summary.efectivoCount}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-default-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-default-500">
                <DeviceMobile size={18} weight="duotone" />
                <span className="text-sm">Ventas Nequi</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-default-900 tabular-nums">{formatCOP(summary.nequiTotal)}</span>
                <span className="text-xs text-default-400 ml-2">{summary.nequiCount}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-default-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-default-600">
                <ShoppingCart size={18} weight="duotone" />
                <span className="text-sm font-semibold">Total ventas</span>
              </div>
              <span className="text-xl font-extrabold text-primary tabular-nums">{formatCOP(summary.totalSales)}</span>
            </div>
          </div>

          {/* Expected cash */}
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Efectivo esperado en caja</p>
            <p className="text-2xl font-extrabold text-blue-700 tabular-nums">{formatCOP(expectedCash)}</p>
            <p className="text-xs text-blue-500 mt-1 tabular-nums">
              Base {formatCOP(register.initial_cash)} + Ventas {formatCOP(summary.efectivoTotal)}
            </p>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-bold text-default-500 uppercase tracking-wider mb-2">Notas (opcional)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones del turno..."
              rows={2}
              className="w-full rounded-xl border border-default-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>
        </div>

        {/* Cancel — always at bottom */}
        <div className="border-t border-default-100 bg-white px-6 py-4 shrink-0">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 hover:text-default-700 active:scale-[0.97] transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* RIGHT — Numpad + Confirm */}
      <div className="flex-1 flex flex-col p-6 overflow-auto">
        {/* Quick amounts */}
        <div className="flex gap-2 mb-3 shrink-0">
          {[50000, 100000, 200000, 500000].map((amt) => (
            <button
              key={amt}
              onClick={() => setActualCash(amt)}
              className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all active:scale-95
                ${actualCash === amt ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}
            >
              {formatCOP(amt)}
            </button>
          ))}
          <button
            onClick={() => setActualCash(expectedCash)}
            className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all active:scale-95
              ${actualCash === expectedCash && expectedCash > 0 ? "bg-primary text-white" : "bg-default-100 text-default-600 hover:bg-default-200"}`}
          >
            Exacto
          </button>
        </div>

        {/* Display */}
        <button
          onClick={() => setActualCash(0)}
          className="w-full rounded-2xl bg-default-50 border border-default-100 px-5 py-3 text-center mb-3 hover:bg-default-100 transition-colors shrink-0"
        >
          <p className="text-[10px] font-bold text-default-400 uppercase tracking-wider mb-0.5">Efectivo contado</p>
          <p className={`text-3xl font-extrabold tabular-nums ${actualCash > 0 ? "text-default-900" : "text-default-300"}`}>
            {actualCash > 0 ? formatCOP(actualCash) : "$ 0"}
          </p>
        </button>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-1.5 mb-3 shrink-0">
          {NUMPAD_KEYS.flat().map((key) => (
            <button
              key={key}
              onClick={() => handleNumpadKey(key)}
              className={`flex items-center justify-center h-14 rounded-xl text-lg font-bold transition-all active:scale-95 select-none
                ${key === "DEL"
                  ? "bg-default-200 text-default-600 hover:bg-default-300"
                  : "bg-white border border-default-200 text-default-800 hover:bg-default-50"
                }`}
            >
              {key === "DEL" ? <Backspace size={22} weight="bold" /> : key}
            </button>
          ))}
        </div>

        {/* Difference */}
        {actualCash > 0 && (
          <div className={`flex justify-between items-center rounded-xl px-4 py-3 mb-3 shrink-0
            ${difference === 0
              ? "bg-emerald-50 border border-emerald-200"
              : difference > 0
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-red-50 border border-red-200"
            }`}>
            <span className={`text-sm font-semibold ${difference >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {difference === 0 ? "Cuadra perfecto" : difference > 0 ? "Sobrante" : "Faltante"}
            </span>
            {difference !== 0 && (
              <span className={`text-xl font-bold tabular-nums ${difference > 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatCOP(Math.abs(difference))}
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Confirm */}
        <button
          onClick={handleClose}
          disabled={processing || actualCash <= 0}
          className="w-full h-16 rounded-2xl bg-default-900 text-white text-xl font-bold shadow-lg shadow-default-900/20 hover:bg-default-800 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 shrink-0 mt-auto"
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Cerrando...
            </span>
          ) : (
            <>
              <Check size={22} weight="bold" />
              Cerrar Caja
            </>
          )}
        </button>
      </div>
    </div>
  );
}
