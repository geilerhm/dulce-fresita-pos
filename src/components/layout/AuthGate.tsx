"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, activeCompany } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/login" || pathname.startsWith("/pedir")) return;

    if (!isAuthenticated || !activeCompany) {
      router.push("/login");
    }
  }, [isAuthenticated, activeCompany, pathname, router]);

  // Public pages don't need protection
  if (pathname === "/login" || pathname.startsWith("/pedir")) return <>{children}</>;

  // Not authenticated — show nothing while redirecting
  if (!isAuthenticated || !activeCompany) return null;

  return <>{children}</>;
}
