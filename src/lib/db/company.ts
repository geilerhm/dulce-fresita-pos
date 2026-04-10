"use client";

/**
 * Get the active company ID from localStorage cache.
 * Used to filter all queries by company.
 */
export function getActiveCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("dulce-fresita-active-company");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
