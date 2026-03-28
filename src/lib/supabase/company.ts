"use client";

/**
 * Get the active company ID from localStorage.
 * Used to filter all Supabase queries by company.
 */
export function getActiveCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const activeId = localStorage.getItem("dulce-fresita-active-company");
    if (!activeId) return null;

    const companies = localStorage.getItem("dulce-fresita-companies-v2");
    if (!companies) return null;

    const list = JSON.parse(companies);
    const company = list.find((c: { id: string }) => c.id === activeId);
    return company?.id ?? null;
  } catch {
    return null;
  }
}
