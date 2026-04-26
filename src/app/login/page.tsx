"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Warning, ArrowRight } from "@phosphor-icons/react";
import { toast } from "@/lib/utils/toast";
import { Strawberry } from "@/lib/utils/fruit-icons";
import { TextInputWithKeyboard } from "@/components/ui/TextInputWithKeyboard";

export default function LoginPage() {
  const { login, register, logout, isAuthenticated, activeCompany, addCompany, selectCompany, userId } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"auth" | "needsCompany">("auth");
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");

  // Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");

  // Register
  const [regName, setRegName] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regCompany, setRegCompany] = useState("");

  useEffect(() => {
    if (registering) return; // Don't interfere during registration
    if (isAuthenticated && activeCompany) router.push("/pos");
    else if (isAuthenticated && !activeCompany) setStep("needsCompany");
  }, [isAuthenticated, activeCompany, router, registering]);

  async function handleLogin() {
    setError("");
    if (!username || !password) { setError("Completa todos los campos"); return; }
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (!result.success) setError(result.error || "Usuario o contraseña incorrectos");
    // If no company, useEffect will set step to "needsCompany"
  }

  async function handleCreateCompany() {
    if (!newCompanyName.trim()) { setError("El nombre es requerido"); return; }
    setLoading(true);
    try {
      const company = await addCompany(newCompanyName.trim(), userId ?? undefined);
      selectCompany(company.id, company);
      toast.success(`¡Bienvenido a ${newCompanyName.trim()}!`);
      router.push("/pos");
    } catch (e) {
      console.error(e);
      setError("Error al crear empresa");
    }
    setLoading(false);
  }

  async function handleRegister() {
    setError("");
    if (!regName || !regUser || !regPass) { setError("Completa todos los campos"); return; }
    setLoading(true);
    const result = await register(regUser, regPass, regName);
    setLoading(false);
    if (!result.success) { setError(result.error || "Error al registrar"); return; }
    // useEffect will redirect to "needsCompany" step
  }

  return (
    <div className="flex h-screen w-screen">
      {/* Left — Branding */}
      <div className="hidden lg:flex w-[45%] bg-gradient-to-br from-primary via-pink-500 to-rose-400 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-40 h-40 rounded-full bg-white/20" />
          <div className="absolute bottom-20 right-10 w-60 h-60 rounded-full bg-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-white/5" />
        </div>
        <div className="relative z-10 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm mx-auto mb-8 shadow-2xl">
            <Strawberry size={52} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3">Dulce Fresita</h1>
          <p className="text-lg text-white/80 max-w-xs">Punto de venta diseñado para tu negocio</p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
        <div data-keyboard-form className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-pink-400 shadow-lg shadow-primary/25 mb-3">
              <Strawberry size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-extrabold text-default-900">Dulce Fresita</h1>
          </div>

          {step === "needsCompany" ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-default-900">Crea tu empresa</h2>
                <p className="text-sm text-default-400 mt-1">Necesitas una empresa para comenzar</p>
              </div>
              <TextInputWithKeyboard value={newCompanyName} onChange={(v) => { setNewCompanyName(v); setError(""); }}
                label="Nombre de tu empresa" placeholder="Ej: Dulce Fresita" />
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <Warning size={18} weight="fill" className="text-red-500 shrink-0" />
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}
              <button onClick={handleCreateCompany} disabled={loading}
                className="w-full h-14 rounded-2xl bg-primary text-white text-lg font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? "Cargando..." : "Comenzar"} {!loading && <ArrowRight size={20} weight="bold" />}
              </button>
              <button onClick={() => { logout(); setStep("auth"); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-default-400 hover:text-red-500 hover:bg-red-50 transition-all">
                Cerrar sesión
              </button>
            </div>
          ) : (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 bg-default-100 rounded-2xl p-1">
              <button onClick={() => { setMode("login"); setError(""); }}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${mode === "login" ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}>
                Ingresar
              </button>
              <button onClick={() => { setMode("register"); setError(""); }}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${mode === "register" ? "bg-white text-default-800 shadow-sm" : "text-default-400"}`}>
                Registrarse
              </button>
            </div>

            {mode === "login" ? (
              <div className="space-y-4">
                <TextInputWithKeyboard value={username} onChange={(v) => { setUsername(v); setError(""); }}
                  label="Usuario" placeholder="tu usuario" />
                <TextInputWithKeyboard value={password} onChange={(v) => { setPassword(v); setError(""); }}
                  label="Contraseña" placeholder="tu contraseña" password />
              </div>
            ) : (
              <div className="space-y-4">
                <TextInputWithKeyboard value={regName} onChange={(v) => { setRegName(v); setError(""); }}
                  label="Tu nombre" placeholder="Ej: Alejandra" />
                <TextInputWithKeyboard value={regUser} onChange={(v) => { setRegUser(v.toLowerCase().replace(/\s/g, "")); setError(""); }}
                  label="Usuario" placeholder="sin espacios" />
                <TextInputWithKeyboard value={regPass} onChange={(v) => { setRegPass(v); setError(""); }}
                  label="Contraseña" placeholder="mínimo 4 caracteres" password />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 animate-in fade-in duration-200">
                <Warning size={18} weight="fill" className="text-red-500 shrink-0" />
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <button onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading}
              className="w-full h-14 rounded-2xl bg-primary text-white text-lg font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? "Cargando..." : mode === "login" ? "Ingresar" : "Crear cuenta"} {!loading && <ArrowRight size={20} weight="bold" />}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
