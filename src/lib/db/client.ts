/* eslint-disable @typescript-eslint/no-explicit-any */
import { FromBuilder } from "./query-builder";

/**
 * Drop-in replacement for Supabase's createClient().
 * Returns an object with .from() and .rpc() that use local SQLite via /api/db.
 */
export function createClient() {
  return {
    from(table: string) {
      return new FromBuilder(table);
    },

    async rpc(name: string, params: any): Promise<{ data: any; error: any }> {
      try {
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rpc", rpcName: name, rpcParams: params }),
        });
        return res.json();
      } catch (e: any) {
        return { data: null, error: { message: e.message } };
      }
    },
  };
}
