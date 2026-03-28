"use client";

import { useState } from "react";
import { useCaja } from "@/contexts/CajaContext";
import { formatCOP } from "@/lib/utils/format";
import { Wallet, WarningCircle } from "@phosphor-icons/react";
import { playSuccess } from "@/lib/utils/sounds";

const QUICK_AMOUNTS = [50000, 100000, 200000, 300000];

export function OpenRegisterForm() {
  const { openRegister } = useCaja();
  const [amount, setAmount] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleOpen() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await openRegister(amount);
      playSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al abrir caja");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  function handleAmountChange(newAmount: number) {
    setAmount(newAmount);
    setConfirming(false);
  }

  return (
    <div className="flex h-full items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 px-8 pt-10 pb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Wallet size={32} weight="duotone" className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-default-800">Abrir Caja</h1>
          <p className="text-xs text-default-400 text-center">Ingresa el monto inicial de efectivo</p>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <WarningCircle size={18} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Quick amounts */}
          <div className="grid grid-cols-2 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => { handleAmountChange(amt); setCustomInput(""); }}
                className={`h-12 rounded-xl text-sm font-bold transition-all active:scale-95
                  ${amount === amt
                    ? "bg-primary text-white shadow-sm"
                    : "bg-default-100 text-default-600 hover:bg-default-200"
                  }`}
              >
                {formatCOP(amt)}
              </button>
            ))}
          </div>

          {/* Custom input — uses physical keyboard if available */}
          <input
            type="text"
            inputMode="none"
            placeholder="Usa los botones de arriba"
            value={customInput ? `$ ${parseInt(customInput).toLocaleString("es-CO")}` : ""}
            readOnly
            className="w-full h-14 rounded-xl border border-default-200 bg-white px-4 text-2xl font-bold text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all tabular-nums"
          />

          {/* Open / Confirm button */}
          <button
            onClick={handleOpen}
            disabled={loading || amount <= 0}
            className={`w-full h-14 rounded-2xl text-lg font-bold shadow-lg active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2
              ${confirming
                ? "bg-emerald-500 text-white shadow-emerald-500/25 hover:bg-emerald-600"
                : "bg-primary text-white shadow-primary/25 hover:brightness-105"
              }`}
          >
            {loading ? (
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : confirming ? (
              `Confirmar con ${formatCOP(amount)}`
            ) : amount > 0 ? (
              `Abrir Caja — ${formatCOP(amount)}`
            ) : (
              "Abrir Caja"
            )}
          </button>

          {confirming && (
            <button
              onClick={() => setConfirming(false)}
              className="w-full h-11 rounded-xl bg-default-100 text-default-500 text-sm font-semibold hover:bg-default-200 active:scale-[0.97] transition-all"
            >
              Cambiar monto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
