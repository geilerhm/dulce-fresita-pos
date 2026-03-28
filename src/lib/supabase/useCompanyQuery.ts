"use client";

import { createClient } from "./client";
import { getActiveCompanyId } from "./company";

/**
 * Returns a Supabase client and the active company ID.
 * All queries should filter by company_id.
 */
export function useCompanySupabase() {
  const supabase = createClient();
  const companyId = getActiveCompanyId();
  return { supabase, companyId };
}

/**
 * Shorthand: get supabase + companyId for use in callbacks/effects.
 */
export function getCompanySupabase() {
  const supabase = createClient();
  const companyId = getActiveCompanyId();
  return { supabase, companyId };
}
