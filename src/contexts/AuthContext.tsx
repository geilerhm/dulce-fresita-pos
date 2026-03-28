"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface Company {
  id: string;
  name: string;
  owner: string; // username
  createdAt: string;
}

interface UserAccount {
  username: string;
  password: string;
  displayName: string;
  createdAt: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  username: string | null;
  displayName: string | null;
  activeCompany: Company | null;
  companies: Company[]; // only this user's companies
  login: (username: string, password: string) => boolean;
  register: (username: string, password: string, displayName: string) => { success: boolean; error?: string };
  logout: () => void;
  addCompany: (name: string) => Company;
  selectCompany: (id: string) => void;
  deleteCompany: (id: string) => void;
}

const AUTH_KEY = "dulce-fresita-auth";
const USERS_KEY = "dulce-fresita-users";
const COMPANIES_KEY = "dulce-fresita-companies-v2";
const ACTIVE_COMPANY_KEY = "dulce-fresita-active-company";

function loadUsers(): UserAccount[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) {
      const defaults: UserAccount[] = [
        { username: "dulcefresita", password: "123456", displayName: "Dulce Fresita", createdAt: new Date().toISOString() },
        { username: "dulcefresita_test", password: "123456", displayName: "Dulce Fresita (Test)", createdAt: new Date().toISOString() },
      ];
      localStorage.setItem(USERS_KEY, JSON.stringify(defaults));

      // Seed test company for dulcefresita_test
      const existingCompanies = localStorage.getItem(COMPANIES_KEY);
      if (!existingCompanies) {
        const seedCompanies: Company[] = [
          { id: "test-dulcefresita", name: "Dulce Fresita Test", owner: "dulcefresita_test", createdAt: new Date().toISOString() },
        ];
        localStorage.setItem(COMPANIES_KEY, JSON.stringify(seedCompanies));
      }

      return defaults;
    }
    return JSON.parse(data);
  } catch { return []; }
}

function saveUsers(users: UserAccount[]) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {}
}

function loadAllCompanies(): Company[] {
  try { const d = localStorage.getItem(COMPANIES_KEY); return d ? JSON.parse(d) : []; } catch { return []; }
}

function saveAllCompanies(companies: Company[]) {
  try { localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies)); } catch {}
}

function loadAuth(): { username: string; displayName: string } | null {
  try { const d = localStorage.getItem(AUTH_KEY); return d ? JSON.parse(d) : null; } catch { return null; }
}

function loadActiveCompanyId(): string | null {
  try { return localStorage.getItem(ACTIVE_COMPANY_KEY); } catch { return null; }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loaded, setLoaded] = useState(false);

  function loadUserCompanies(user: string) {
    const all = loadAllCompanies();
    return all.filter((c) => c.owner === user);
  }

  useEffect(() => {
    const auth = loadAuth();
    if (auth?.username) {
      setIsAuthenticated(true);
      setUsername(auth.username);
      setDisplayName(auth.displayName);

      const comps = loadUserCompanies(auth.username);
      setUserCompanies(comps);

      const activeId = loadActiveCompanyId();
      if (activeId) {
        const active = comps.find((c) => c.id === activeId);
        if (active) setActiveCompany(active);
      }
    }
    // Ensure default users exist
    loadUsers();
    setLoaded(true);
  }, []);

  const login = useCallback((user: string, pass: string): boolean => {
    const users = loadUsers();
    const found = users.find((u) => u.username.toLowerCase() === user.toLowerCase() && u.password === pass);
    if (!found) return false;

    setIsAuthenticated(true);
    setUsername(found.username);
    setDisplayName(found.displayName);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ username: found.username, displayName: found.displayName }));

    const comps = loadUserCompanies(found.username);
    setUserCompanies(comps);

    // Auto-select if only one company
    if (comps.length === 1) {
      setActiveCompany(comps[0]);
      localStorage.setItem(ACTIVE_COMPANY_KEY, comps[0].id);
    }

    return true;
  }, []);

  const register = useCallback((user: string, pass: string, name: string): { success: boolean; error?: string } => {
    if (!user.trim() || !pass.trim() || !name.trim()) return { success: false, error: "Todos los campos son requeridos" };
    if (pass.length < 4) return { success: false, error: "La contraseña debe tener al menos 4 caracteres" };

    const users = loadUsers();
    if (users.some((u) => u.username.toLowerCase() === user.toLowerCase())) {
      return { success: false, error: "Este usuario ya existe" };
    }

    const newUser: UserAccount = { username: user.toLowerCase(), password: pass, displayName: name, createdAt: new Date().toISOString() };
    users.push(newUser);
    saveUsers(users);

    setIsAuthenticated(true);
    setUsername(newUser.username);
    setDisplayName(newUser.displayName);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ username: newUser.username, displayName: newUser.displayName }));

    setUserCompanies([]);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUsername(null);
    setDisplayName(null);
    setActiveCompany(null);
    setUserCompanies([]);
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
  }, []);

  const addCompany = useCallback((name: string): Company => {
    if (!username) throw new Error("Not authenticated");
    const company: Company = { id: crypto.randomUUID(), name, owner: username, createdAt: new Date().toISOString() };

    const all = loadAllCompanies();
    all.push(company);
    saveAllCompanies(all);

    const comps = all.filter((c) => c.owner === username);
    setUserCompanies(comps);

    return company;
  }, [username]);

  const selectCompany = useCallback((id: string) => {
    const company = userCompanies.find((c) => c.id === id);
    if (company) {
      setActiveCompany(company);
      localStorage.setItem(ACTIVE_COMPANY_KEY, id);
    }
  }, [userCompanies]);

  const deleteCompany = useCallback((id: string) => {
    const all = loadAllCompanies().filter((c) => c.id !== id);
    saveAllCompanies(all);

    const comps = all.filter((c) => c.owner === username);
    setUserCompanies(comps);

    if (activeCompany?.id === id) {
      const next = comps[0] || null;
      setActiveCompany(next);
      if (next) localStorage.setItem(ACTIVE_COMPANY_KEY, next.id);
      else localStorage.removeItem(ACTIVE_COMPANY_KEY);
    }
  }, [username, activeCompany]);

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{
      isAuthenticated, username, displayName, activeCompany,
      companies: userCompanies,
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
