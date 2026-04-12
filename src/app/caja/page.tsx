"use client";

import { useCaja } from "@/contexts/CajaContext";
import { OpenRegisterForm } from "@/components/caja/OpenRegisterForm";
import { ActiveRegisterView } from "@/components/caja/ActiveRegisterView";
import { RegisterHistory } from "@/components/caja/RegisterHistory";
import { SalesHistory } from "@/components/caja/SalesHistory";
import { useState } from "react";
import { Wallet, ClockCounterClockwise, Receipt } from "@phosphor-icons/react";

const TABS = [
  { id: "actual", label: "Caja", Icon: Wallet },
  { id: "ventas", label: "Ventas", Icon: Receipt },
  { id: "historial", label: "Historial Caja", Icon: ClockCounterClockwise },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CajaPage() {
  const { register, loading } = useCaja();
  const [tab, setTab] = useState<TabId>("actual");

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <span className="h-8 w-8 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-default-100 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-default-800">Caja</h1>
          {register && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-3 py-1.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Abierta
            </span>
          )}
        </div>

        {/* Pill tabs */}
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
        {tab === "actual" && (
          register ? <ActiveRegisterView /> : <OpenRegisterForm />
        )}
        {tab === "ventas" && (
          <div className="max-w-2xl mx-auto p-6">
            <SalesHistory />
          </div>
        )}
        {tab === "historial" && (
          <div className="max-w-2xl mx-auto p-6">
            <RegisterHistory />
          </div>
        )}
      </div>
    </div>
  );
}
