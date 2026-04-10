"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";

interface OpenRegister {
  id: string;
  opened_at: string;
  initial_cash: number;
}

interface CajaContextValue {
  register: OpenRegister | null;
  loading: boolean;
  openRegister: (initialCash: number) => Promise<void>;
  closeRegister: (data: { final_cash_expected: number; final_cash_actual: number; notes?: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const CajaContext = createContext<CajaContextValue | null>(null);

export function CajaProvider({ children }: { children: ReactNode }) {
  const [register, setRegister] = useState<OpenRegister | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const client = createClient();
    const companyId = getActiveCompanyId();
    if (!companyId) { setRegister(null); setLoading(false); return; }

    const { data } = await client
      .from("cash_registers")
      .select("id, opened_at, initial_cash")
      .eq("status", "open")
      .eq("company_id", companyId)
      .order("opened_at", { ascending: false })
      .limit(1);

    const row = data?.[0] ?? null;
    const reg = row ? { id: row.id, opened_at: row.opened_at, initial_cash: row.initial_cash } : null;
    setRegister(reg);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-refresh when company changes (detected via storage event or polling)
  useEffect(() => {
    let lastCompanyId = getActiveCompanyId();
    const interval = setInterval(() => {
      const current = getActiveCompanyId();
      if (current !== lastCompanyId) {
        lastCompanyId = current;
        refresh();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [refresh]);

  const openRegister = useCallback(async (initialCash: number) => {
    const client = createClient();

    const companyId = getActiveCompanyId();
    const { data: existing } = await client
      .from("cash_registers")
      .select("id")
      .eq("status", "open")
      .eq("company_id", companyId)
      .limit(1);

    if (existing && existing.length > 0) {
      await refresh();
      throw new Error("Ya hay una caja abierta");
    }

    const { data, error } = await client
      .from("cash_registers")
      .insert({ initial_cash: initialCash, status: "open", company_id: getActiveCompanyId() })
      .select("id, opened_at, initial_cash")
      .single();

    if (error) throw error;
    const reg = { id: data.id, opened_at: data.opened_at, initial_cash: data.initial_cash };
    setRegister(reg);
  }, [refresh]);

  const closeRegister = useCallback(async (closeData: { final_cash_expected: number; final_cash_actual: number; notes?: string }) => {
    if (!register) return;
    const client = createClient();
    const { error } = await client
      .from("cash_registers")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        final_cash_expected: closeData.final_cash_expected,
        final_cash_actual: closeData.final_cash_actual,
        notes: closeData.notes || null,
      })
      .eq("id", register.id);

    if (error) throw error;
    setRegister(null);
  }, [register]);

  return (
    <CajaContext.Provider value={{ register, loading, openRegister, closeRegister, refresh }}>
      {children}
    </CajaContext.Provider>
  );
}

export function useCaja() {
  const ctx = useContext(CajaContext);
  if (!ctx) throw new Error("useCaja must be used within CajaProvider");
  return ctx;
}
