"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, TextField, Input, Label } from "@heroui/react";
import { Warning, Plus, Trash, Storefront, ArrowRight, SignOut } from "@phosphor-icons/react";
import { Strawberry } from "@/lib/utils/fruit-icons";

export default function LoginPage() {
  const { login, register, logout, isAuthenticated, companies, activeCompany, addCompany, selectCompany, deleteCompany } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"auth" | "company">("auth");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [regName, setRegName] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regPass, setRegPass] = useState("");

  const [newCompanyName, setNewCompanyName] = useState("");

  useEffect(() => {
    if (isAuthenticated && activeCompany) router.push("/pos");
    else if (isAuthenticated) setStep("company");
  }, [isAuthenticated, activeCompany, router]);

  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    if (!username || !password) { setError("Completa todos los campos"); return; }
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (!result.success) setError(result.error || "Usuario o contraseña incorrectos");
  }

  async function handleRegister() {
    setError("");
    if (!regName || !regUser || !regPass) { setError("Completa todos los campos"); return; }
    setLoading(true);
    const result = await register(regUser, regPass, regName);
    setLoading(false);
    if (!result.success) setError(result.error || "Error al registrar");
  }

  function handleSelectCompany(id: string) { selectCompany(id); router.push("/pos"); }

  async function handleAddCompany() {
    if (!newCompanyName.trim()) return;
    setLoading(true);
    try {
      const c = await addCompany(newCompanyName.trim());
      setNewCompanyName("");
      selectCompany(c.id);
      router.push("/pos");
    } catch {
      setError("Error al crear empresa. ¿Tienes conexión?");
    }
    setLoading(false);
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
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-pink-400 shadow-lg shadow-primary/25 mb-3">
              <Strawberry size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-extrabold text-default-900">Dulce Fresita</h1>
          </div>

          {step === "auth" ? (
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
                  <TextField className="space-y-1.5">
                    <Label className="text-xs font-bold text-default-500 uppercase tracking-wider">Usuario</Label>
                    <Input value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder="tu usuario" autoFocus
                      className="h-14 rounded-2xl border-2 border-default-200 bg-white px-4 text-base outline-none focus:border-primary transition-all w-full" />
                  </TextField>

                  <TextField className="space-y-1.5">
                    <Label className="text-xs font-bold text-default-500 uppercase tracking-wider">Contraseña</Label>
                    <Input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder="tu contraseña"
                      className="h-14 rounded-2xl border-2 border-default-200 bg-white px-4 text-base outline-none focus:border-primary transition-all w-full" />
                  </TextField>
                </div>
              ) : (
                <div className="space-y-4">
                  <TextField className="space-y-1.5">
                    <Label className="text-xs font-bold text-default-500 uppercase tracking-wider">Nombre completo</Label>
                    <Input value={regName} onChange={(e) => { setRegName(e.target.value); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                      placeholder="Ej: Alejandra Hipia" autoFocus
                      className="h-14 rounded-2xl border-2 border-default-200 bg-white px-4 text-base outline-none focus:border-primary transition-all w-full" />
                  </TextField>

                  <TextField className="space-y-1.5">
                    <Label className="text-xs font-bold text-default-500 uppercase tracking-wider">Usuario</Label>
                    <Input value={regUser} onChange={(e) => { setRegUser(e.target.value.toLowerCase().replace(/\s/g, "")); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                      placeholder="sin espacios"
                      className="h-14 rounded-2xl border-2 border-default-200 bg-white px-4 text-base outline-none focus:border-primary transition-all w-full" />
                  </TextField>

                  <TextField className="space-y-1.5">
                    <Label className="text-xs font-bold text-default-500 uppercase tracking-wider">Contraseña</Label>
                    <Input type="password" value={regPass} onChange={(e) => { setRegPass(e.target.value); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                      placeholder="mínimo 4 caracteres"
                      className="h-14 rounded-2xl border-2 border-default-200 bg-white px-4 text-base outline-none focus:border-primary transition-all w-full" />
                  </TextField>
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
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-default-900">Tu empresa</h2>
                <p className="text-sm text-default-400 mt-1">
                  {companies.length > 0 ? "Selecciona o crea una empresa" : "Crea tu primera empresa para empezar"}
                </p>
              </div>

              {companies.length > 0 && (
                <div className="space-y-2">
                  {companies.map((company) => (
                    <Card key={company.id} className="hover:shadow-md transition-all">
                      <CardContent className="flex items-center gap-3 p-4">
                        <button onClick={() => handleSelectCompany(company.id)} className="flex-1 flex items-center gap-3 text-left">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                            <Storefront size={24} weight="duotone" />
                          </div>
                          <div className="flex-1">
                            <p className="text-base font-bold text-default-800">{company.name}</p>
                            <p className="text-xs text-default-400">{new Date(company.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}</p>
                          </div>
                          <ArrowRight size={18} className="text-default-300" />
                        </button>
                        <button onClick={() => deleteCompany(company.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-default-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0">
                          <Trash size={16} weight="bold" />
                        </button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <TextField className="space-y-1.5">
                <Label className="text-xs font-bold text-default-500 uppercase tracking-wider">Nueva empresa</Label>
                <div className="flex gap-2">
                  <Input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCompany()}
                    placeholder="Nombre de tu empresa..."
                    className="flex-1 h-14 rounded-2xl border-2 border-default-200 bg-white px-4 text-sm outline-none focus:border-primary transition-all" />
                  <button onClick={handleAddCompany} disabled={!newCompanyName.trim()}
                    className="h-14 px-5 rounded-2xl bg-primary text-white font-bold hover:brightness-105 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0">
                    <Plus size={18} weight="bold" /> Crear
                  </button>
                </div>
              </TextField>

              <button onClick={() => { logout(); setStep("auth"); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-default-400 hover:text-red-500 hover:bg-red-50 transition-all">
                <SignOut size={18} weight="bold" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
