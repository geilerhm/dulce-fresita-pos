"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/db/client";

interface Company {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

interface Session {
  id: string;
  username: string;
  displayName: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  activeCompany: Company | null;
  companies: Company[];
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addCompany: (name: string) => Promise<Company>;
  selectCompany: (id: string) => void;
  deleteCompany: (id: string) => Promise<void>;
}

const SESSION_KEY = "dulce-fresita-session";
const ACTIVE_COMPANY_KEY = "dulce-fresita-active-company";

function cacheSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function cacheGet<T>(key: string): T | null {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}

function cacheRemove(key: string) {
  try { localStorage.removeItem(key); } catch {}
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchCompanies = useCallback(async (userId: string): Promise<Company[]> => {
    const client = createClient();
    const { data, error } = await client
      .from("companies")
      .select("id, name, owner_id, created_at")
      .eq("owner_id", userId)
      .order("created_at");

    if (error) return [];
    return data ?? [];
  }, []);

  // Restore session on mount
  useEffect(() => {
    const cached = cacheGet<Session>(SESSION_KEY);
    if (cached?.id) {
      setSession(cached);

      fetchCompanies(cached.id).then((comps) => {
        setCompanies(comps);
        const activeId = cacheGet<string>(ACTIVE_COMPANY_KEY);
        if (activeId) {
          const active = comps.find((c) => c.id === activeId);
          if (active) setActiveCompany(active);
        }
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
  }, [fetchCompanies]);

  const login = useCallback(async (user: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const client = createClient();

    const { data, error } = await client
      .from("users")
      .select("id, username, password, display_name")
      .eq("username", user.toLowerCase())
      .single();

    if (error || !data) return { success: false, error: "Usuario no encontrado" };
    if (data.password !== pass) return { success: false, error: "Contraseña incorrecta" };

    const sess: Session = { id: data.id, username: data.username, displayName: data.display_name };
    setSession(sess);
    cacheSet(SESSION_KEY, sess);

    const comps = await fetchCompanies(data.id);
    setCompanies(comps);

    if (comps.length === 1) {
      setActiveCompany(comps[0]);
      cacheSet(ACTIVE_COMPANY_KEY, comps[0].id);
    }

    return { success: true };
  }, [fetchCompanies]);

  const register = useCallback(async (user: string, pass: string, name: string): Promise<{ success: boolean; error?: string; userId?: string }> => {
    if (!user.trim() || !pass.trim() || !name.trim()) return { success: false, error: "Todos los campos son requeridos" };
    if (pass.length < 4) return { success: false, error: "La contraseña debe tener al menos 4 caracteres" };

    const client = createClient();
    const { data, error } = await client
      .from("users")
      .insert({ username: user.toLowerCase(), password: pass, display_name: name })
      .select("id, username, display_name")
      .single();

    if (error) {
      if (error.code === "23505") return { success: false, error: "Este usuario ya existe" };
      return { success: false, error: error.message };
    }

    const sess: Session = { id: data.id, username: data.username, displayName: data.display_name };
    setSession(sess);
    cacheSet(SESSION_KEY, sess);
    setCompanies([]);

    return { success: true, userId: data.id };
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setActiveCompany(null);
    setCompanies([]);
    cacheRemove(SESSION_KEY);
    cacheRemove(ACTIVE_COMPANY_KEY);
  }, []);

  const addCompany = useCallback(async (name: string, overrideUserId?: string): Promise<Company> => {
    const userId = overrideUserId || session?.id;
    if (!userId) throw new Error("No autenticado");

    const client = createClient();
    const { data, error } = await client
      .from("companies")
      .insert({ name, owner_id: userId })
      .select("id, name, owner_id, created_at")
      .single();

    if (error) throw error;

    const comps = await fetchCompanies(userId);
    setCompanies(comps);

    return data;
  }, [session, fetchCompanies]);

  const selectCompany = useCallback((id: string, companyObj?: Company) => {
    const company = companyObj || companies.find((c) => c.id === id);
    if (company) {
      setActiveCompany(company);
      cacheSet(ACTIVE_COMPANY_KEY, id);
    }
  }, [companies]);

  const deleteCompany = useCallback(async (id: string) => {
    const client = createClient();
    await client.from("companies").delete().eq("id", id);

    if (session) {
      const comps = await fetchCompanies(session.id);
      setCompanies(comps);

      if (activeCompany?.id === id) {
        const next = comps[0] ?? null;
        setActiveCompany(next);
        if (next) cacheSet(ACTIVE_COMPANY_KEY, next.id);
        else cacheRemove(ACTIVE_COMPANY_KEY);
      }
    }
  }, [session, activeCompany, fetchCompanies]);

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!session,
      userId: session?.id ?? null,
      username: session?.username ?? null,
      displayName: session?.displayName ?? null,
      activeCompany,
      companies,
      login, register, logout, addCompany, selectCompany, deleteCompany,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
