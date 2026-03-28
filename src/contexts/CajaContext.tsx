"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveCompanyId } from "@/lib/supabase/company";

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

const REGISTER_CACHE_KEY = "dulce-fresita-register-cache";

function cacheRegister(reg: OpenRegister | null) {
  try {
    if (reg) localStorage.setItem(REGISTER_CACHE_KEY, JSON.stringify(reg));
    else localStorage.removeItem(REGISTER_CACHE_KEY);
  } catch {}
}

function getCachedRegister(): OpenRegister | null {
  try {
    const data = localStorage.getItem(REGISTER_CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

const CajaContext = createContext<CajaContextValue | null>(null);

export function CajaProvider({ children }: { children: ReactNode }) {
  const [register, setRegister] = useState<OpenRegister | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const companyId = getActiveCompanyId();
      if (!companyId) { setRegister(null); setLoading(false); return; }

      const { data } = await supabase
        .from("cash_registers")
        .select("id, opened_at, initial_cash")
        .eq("status", "open")
        .eq("company_id", companyId)
        .order("opened_at", { ascending: false })
        .limit(1);

      const row = data?.[0] ?? null;
      const reg = row ? { id: row.id, opened_at: row.opened_at, initial_cash: row.initial_cash } : null;
      setRegister(reg);
      cacheRegister(reg);
    } catch {
      // Offline — use cached register
      const cached = getCachedRegister();
      setRegister(cached);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const cached = getCachedRegister();
    if (cached) { setRegister(cached); setLoading(false); }
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
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("cash_registers")
      .select("id")
      .eq("status", "open")
      .limit(1);

    if (existing && existing.length > 0) {
      await refresh();
      throw new Error("Ya hay una caja abierta");
    }

    const { data, error } = await supabase
      .from("cash_registers")
      .insert({ initial_cash: initialCash, status: "open", company_id: getActiveCompanyId() })
      .select("id, opened_at, initial_cash")
      .single();

    if (error) throw error;
    const reg = { id: data.id, opened_at: data.opened_at, initial_cash: data.initial_cash };
    setRegister(reg);
    cacheRegister(reg);
  }, [refresh]);

  const closeRegister = useCallback(async (closeData: { final_cash_expected: number; final_cash_actual: number; notes?: string }) => {
    if (!register) return;
    const supabase = createClient();
    const { error } = await supabase
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
    cacheRegister(null);
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
