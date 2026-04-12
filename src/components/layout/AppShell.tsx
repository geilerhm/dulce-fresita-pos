"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, activeCompany } = useAuth();
  const pathname = usePathname();

  const isPublic = pathname === "/login" || pathname.startsWith("/pedir");
  const showShell = isAuthenticated && activeCompany && !isPublic;

  if (!showShell) {
    return <div className="flex-1 w-full overflow-auto">{children}</div>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-auto">
        <OfflineBanner />
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
      <KeyboardShortcuts />
      <ServiceWorkerRegister />
    </>
  );
}
