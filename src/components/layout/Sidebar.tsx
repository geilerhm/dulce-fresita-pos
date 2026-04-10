"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Storefront,
  Wallet,
  ChartBar,
  Receipt,
  Package,
  Tag,
  GearSix,
  ArrowsOut,
  ArrowsIn,
  WifiHigh,
  WifiSlash,
  SquaresFour,
  Truck,
} from "@phosphor-icons/react";
import { useOnlineStatus } from "@/lib/hooks/useOffline";
import { playClick } from "@/lib/utils/sounds";
import { useCaja } from "@/contexts/CajaContext";
import { useAuth } from "@/contexts/AuthContext";
import { SignOut } from "@phosphor-icons/react";
import { Strawberry } from "@/lib/utils/fruit-icons";

const NAV_TOP = [
  { href: "/pos", label: "Vender", Icon: Storefront },
  { href: "/caja", label: "Caja", Icon: Wallet },
  { href: "/productos", label: "Productos", Icon: Tag },
  { href: "/inventario", label: "Inventario", Icon: Package },
  { href: "/categorias", label: "Categorías", Icon: SquaresFour },
  { href: "/proveedores", label: "Proveedores", Icon: Truck },
];

const NAV_BOTTOM = [
  { href: "/reportes", label: "Reportes", Icon: Receipt },
  { href: "/dashboard", label: "Resumen", Icon: ChartBar },
];

export function Sidebar() {
  const pathname = usePathname();
  const { register } = useCaja();

  function renderItem(item: (typeof NAV_TOP)[number]) {
    const isActive = pathname.startsWith(item.href);
    const showCajaDot = item.href === "/caja" && register !== null;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={playClick}
        className={`relative flex flex-col items-center justify-center gap-1 h-14 w-full rounded-2xl transition-all duration-200 select-none
          ${isActive
            ? "bg-primary/10 text-primary"
            : "text-default-400 hover:bg-default-50 hover:text-default-600"
          }`}
      >
        <item.Icon size={20} weight={isActive ? "fill" : "duotone"} />
        <span className={`text-[10px] font-semibold leading-none ${isActive ? "text-primary" : "text-default-400"}`}>
          {item.label}
        </span>
        {showCajaDot && (
          <span className="absolute top-1.5 right-2.5 flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
      </Link>
    );
  }

  return (
    <aside className="flex h-screen w-[72px] flex-col items-center border-r border-default-100 bg-white py-4">
      <Link href="/pos" className="mb-5 group">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-pink-400 shadow-md shadow-primary/25 group-hover:shadow-lg group-hover:shadow-primary/30 transition-shadow">
          <Strawberry size={22} className="text-white" />
        </div>
      </Link>

      <nav className="flex flex-col gap-0.5 w-full px-1.5">
        {NAV_TOP.map(renderItem)}
      </nav>

      <div className="w-8 h-px bg-default-200 my-2" />

      <nav className="flex flex-col gap-0.5 w-full px-1.5">
        {NAV_BOTTOM.map(renderItem)}
      </nav>

      <div className="flex-1" />
      <nav className="w-full px-1.5 mb-2 space-y-0.5">
        <OnlineIndicator />
        <FullscreenButton />
        {renderItem({ href: "/settings", label: "Config", Icon: GearSix })}
        <LogoutButton />
      </nav>
    </aside>
  );
}

function FullscreenButton() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggle() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  return (
    <button onClick={toggle} title={isFs ? "Salir de pantalla completa" : "Pantalla completa"}
      className="flex flex-col items-center justify-center gap-1 h-14 w-full rounded-2xl text-default-400 hover:bg-default-50 hover:text-default-600 transition-all select-none">
      {isFs ? <ArrowsIn size={20} weight="duotone" /> : <ArrowsOut size={20} weight="duotone" />}
      <span className="text-[10px] font-semibold leading-none">{isFs ? "Salir" : "Full"}</span>
    </button>
  );
}

function OnlineIndicator() {
  const online = useOnlineStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <div className="flex items-center justify-center h-10 w-full text-default-300"><WifiHigh size={16} weight="fill" /></div>;
  }

  if (online) {
    return (
      <div className="flex items-center justify-center h-10 w-full text-emerald-500" title="Conectado">
        <WifiHigh size={16} weight="fill" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-0.5 h-14 w-full rounded-2xl text-default-400" title="Base de datos local">
      <WifiSlash size={18} weight="fill" />
      <span className="text-[10px] font-bold leading-none">Local</span>
    </div>
  );
}

function LogoutButton() {
  const { logout, activeCompany } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <button onClick={handleLogout} title="Cerrar sesión"
      className="flex flex-col items-center justify-center gap-1 h-14 w-full rounded-2xl text-default-400 hover:bg-red-50 hover:text-red-500 transition-all select-none">
      <SignOut size={20} weight="duotone" />
      <span className="text-[10px] font-semibold leading-none">Salir</span>
    </button>
  );
}
