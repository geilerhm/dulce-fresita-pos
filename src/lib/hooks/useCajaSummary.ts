"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";

export interface CajaSummary {
  totalSales: number;
  salesCount: number;
  efectivoTotal: number;
  efectivoCount: number;
  nequiTotal: number;
  nequiCount: number;
}

const EMPTY: CajaSummary = {
  totalSales: 0, salesCount: 0,
  efectivoTotal: 0, efectivoCount: 0,
  nequiTotal: 0, nequiCount: 0,
};

export function useCajaSummary(registerId: string | null) {
  const [summary, setSummary] = useState<CajaSummary>(EMPTY);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!registerId) { setSummary(EMPTY); return; }
    setLoading(true);

    const supabase = createClient();
    const companyId = getActiveCompanyId();
    const { data } = await supabase
      .from("sales")
      .select("total, payment_method")
      .eq("company_id", companyId)
      .eq("register_id", registerId)
      .eq("status", "completed");

    if (data) {
      const result = { ...EMPTY };
      for (const sale of data) {
        result.totalSales += sale.total;
        result.salesCount++;
        if (sale.payment_method === "efectivo") {
          result.efectivoTotal += sale.total;
          result.efectivoCount++;
        } else {
          result.nequiTotal += sale.total;
          result.nequiCount++;
        }
      }
      setSummary(result);
    }
    setLoading(false);
  }, [registerId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto refresh every 30s
  useEffect(() => {
    if (!registerId) return;
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [registerId, refresh]);

  return { summary, loading, refresh };
}
