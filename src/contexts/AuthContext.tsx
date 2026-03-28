"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface Company {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

interface CachedUser {
  id: string;
  username: string;
  password: string;
  display_name: string;
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

// localStorage keys — only used as offline cache
const CACHE = {
  session: "dulce-fresita-session",
  users: "dulce-fresita-users-cache",
  companies: "dulce-fresita-companies-cache",
  activeCompany: "dulce-fresita-active-company",
};

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

  // Fetch companies from Supabase for a given user, cache them
  const fetchCompanies = useCallback(async (userId: string): Promise<Company[]> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, owner_id, created_at")
        .eq("owner_id", userId)
        .order("created_at");

      if (error) throw error;
      const comps = data ?? [];
      cacheSet(CACHE.companies, comps);
      return comps;
    } catch {
      // Offline — use cache
      return cacheGet<Company[]>(CACHE.companies) ?? [];
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const cached = cacheGet<Session>(CACHE.session);
    if (cached?.id) {
      setSession(cached);

      // Load companies (try Supabase, fallback cache)
      fetchCompanies(cached.id).then((comps) => {
        setCompanies(comps);
        const activeId = cacheGet<string>(CACHE.activeCompany);
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
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, username, password, display_name")
        .eq("username", user.toLowerCase())
        .single();

      if (error || !data) return { success: false, error: "Usuario no encontrado" };
      if (data.password !== pass) return { success: false, error: "Contraseña incorrecta" };

      // Cache user for offline login
      const cachedUsers = cacheGet<CachedUser[]>(CACHE.users) ?? [];
      const idx = cachedUsers.findIndex((u) => u.username === data.username);
      const cachedUser: CachedUser = { id: data.id, username: data.username, password: data.password, display_name: data.display_name };
      if (idx >= 0) cachedUsers[idx] = cachedUser;
      else cachedUsers.push(cachedUser);
      cacheSet(CACHE.users, cachedUsers);

      const sess: Session = { id: data.id, username: data.username, displayName: data.display_name };
      setSession(sess);
      cacheSet(CACHE.session, sess);

      const comps = await fetchCompanies(data.id);
      setCompanies(comps);

      if (comps.length === 1) {
        setActiveCompany(comps[0]);
        cacheSet(CACHE.activeCompany, comps[0].id);
      }

      return { success: true };
    } catch {
      // Offline — try cached users
      const cachedUsers = cacheGet<CachedUser[]>(CACHE.users) ?? [];
      const found = cachedUsers.find((u) => u.username === user.toLowerCase() && u.password === pass);
      if (!found) return { success: false, error: "Sin conexión y usuario no encontrado en cache" };

      const sess: Session = { id: found.id, username: found.username, displayName: found.display_name };
      setSession(sess);
      cacheSet(CACHE.session, sess);

      const comps = cacheGet<Company[]>(CACHE.companies)?.filter((c) => c.owner_id === found.id) ?? [];
      setCompanies(comps);

      if (comps.length === 1) {
        setActiveCompany(comps[0]);
        cacheSet(CACHE.activeCompany, comps[0].id);
      }

      return { success: true };
    }
  }, [fetchCompanies]);

  const register = useCallback(async (user: string, pass: string, name: string): Promise<{ success: boolean; error?: string }> => {
    if (!user.trim() || !pass.trim() || !name.trim()) return { success: false, error: "Todos los campos son requeridos" };
    if (pass.length < 4) return { success: false, error: "La contraseña debe tener al menos 4 caracteres" };

    try {
      const supabase = createClient();
      const { data, error } = await supabase
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
      cacheSet(CACHE.session, sess);
      setCompanies([]);
      cacheSet(CACHE.companies, []);

      return { success: true };
    } catch {
      return { success: false, error: "Sin conexión. Necesitas internet para registrarte." };
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setActiveCompany(null);
    setCompanies([]);
    cacheRemove(CACHE.session);
    cacheRemove(CACHE.activeCompany);
  }, []);

  const addCompany = useCallback(async (name: string): Promise<Company> => {
    if (!session) throw new Error("No autenticado");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("companies")
      .insert({ name, owner_id: session.id })
      .select("id, name, owner_id, created_at")
      .single();

    if (error) throw error;

    const comps = await fetchCompanies(session.id);
    setCompanies(comps);

    return data;
  }, [session, fetchCompanies]);

  const selectCompany = useCallback((id: string) => {
    const company = companies.find((c) => c.id === id);
    if (company) {
      setActiveCompany(company);
      cacheSet(CACHE.activeCompany, id);
    }
  }, [companies]);

  const deleteCompany = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("companies").delete().eq("id", id);

    if (session) {
      const comps = await fetchCompanies(session.id);
      setCompanies(comps);

      if (activeCompany?.id === id) {
        const next = comps[0] ?? null;
        setActiveCompany(next);
        if (next) cacheSet(CACHE.activeCompany, next.id);
        else cacheRemove(CACHE.activeCompany);
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
