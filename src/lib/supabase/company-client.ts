"use client";

import { createClient } from "./client";
import { getActiveCompanyId } from "./company";

/**
 * Creates a Supabase client with helper methods that auto-filter by company_id.
 * Use this instead of createClient() for all data queries.
 */
export function createCompanyClient() {
  const supabase = createClient();
  const companyId = getActiveCompanyId();

  return {
    /** Raw supabase client for special cases */
    raw: supabase,

    /** Company ID */
    companyId,

    /** SELECT with company_id filter */
    from(table: string) {
      const query = supabase.from(table);
      return {
        select: (...args: Parameters<typeof query.select>) => {
          const q = query.select(...args);
          if (companyId) return q.eq("company_id", companyId);
          return q;
        },
        insert: (data: Record<string, unknown> | Record<string, unknown>[]) => {
          const rows = Array.isArray(data) ? data.map((r) => ({ ...r, company_id: companyId })) : { ...data, company_id: companyId };
          return query.insert(rows);
        },
        update: (data: Record<string, unknown>) => {
          return query.update(data);
        },
        upsert: (data: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) => {
          const rows = Array.isArray(data) ? data.map((r) => ({ ...r, company_id: companyId })) : { ...data, company_id: companyId };
          return query.upsert(rows, options);
        },
        delete: () => query.delete(),
      };
    },

    /** RPC calls */
    rpc: supabase.rpc.bind(supabase),
  };
}
