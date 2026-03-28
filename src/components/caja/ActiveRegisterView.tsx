"use client";

import { useCaja } from "@/contexts/CajaContext";
import { useCajaSummary } from "@/lib/hooks/useCajaSummary";
import { formatCOP, formatTime } from "@/lib/utils/format";
import { CloseRegisterModal } from "./CloseRegisterModal";
import { Money, DeviceMobile, ShoppingCart, Wallet, Clock, ArrowsClockwise } from "@phosphor-icons/react";
import { useState } from "react";

export function ActiveRegisterView() {
  const { register } = useCaja();
  const { summary, loading, refresh } = useCajaSummary(register?.id ?? null);
  const [showClose, setShowClose] = useState(false);

  if (!register) return null;

  const expectedCash = register.initial_cash + summary.efectivoTotal;

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        {/* Status banner */}
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Caja abierta</p>
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <Clock size={12} />
                Desde {formatTime(register.opened_at)} — Base: {formatCOP(register.initial_cash)}
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-emerald-600 hover:bg-emerald-100 transition-all ${loading ? "animate-spin" : ""}`}
          >
            <ArrowsClockwise size={18} />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white border border-default-100 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 text-default-400 mb-3">
              <Money size={20} weight="duotone" />
              <span className="text-xs font-bold uppercase tracking-wider">Efectivo</span>
            </div>
            <p className="text-2xl font-extrabold text-default-900 tabular-nums">{formatCOP(summary.efectivoTotal)}</p>
            <p className="text-xs text-default-400 mt-1">{summary.efectivoCount} ventas</p>
          </div>

          <div className="rounded-2xl bg-white border border-default-100 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 text-default-400 mb-3">
              <DeviceMobile size={20} weight="duotone" />
              <span className="text-xs font-bold uppercase tracking-wider">Nequi</span>
            </div>
            <p className="text-2xl font-extrabold text-default-900 tabular-nums">{formatCOP(summary.nequiTotal)}</p>
            <p className="text-xs text-default-400 mt-1">{summary.nequiCount} ventas</p>
          </div>

          <div className="rounded-2xl bg-white border border-default-100 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 text-default-400 mb-3">
              <ShoppingCart size={20} weight="duotone" />
              <span className="text-xs font-bold uppercase tracking-wider">Total ventas</span>
            </div>
            <p className="text-2xl font-extrabold text-primary tabular-nums">{formatCOP(summary.totalSales)}</p>
            <p className="text-xs text-default-400 mt-1">{summary.salesCount} ventas</p>
          </div>

          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 text-blue-500 mb-3">
              <Wallet size={20} weight="duotone" />
              <span className="text-xs font-bold uppercase tracking-wider">En caja</span>
            </div>
            <p className="text-2xl font-extrabold text-blue-700 tabular-nums">{formatCOP(expectedCash)}</p>
            <p className="text-xs text-blue-500 mt-1 tabular-nums">Base + Efectivo</p>
          </div>
        </div>

        {/* Close button — neutral dark, not red */}
        <button
          onClick={() => setShowClose(true)}
          className="w-full h-14 rounded-2xl bg-default-900 text-white text-lg font-bold shadow-lg shadow-default-900/20 hover:bg-default-800 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
        >
          Cerrar Caja
        </button>
      </div>

      <CloseRegisterModal isOpen={showClose} onClose={() => setShowClose(false)} />
    </div>
  );
}
