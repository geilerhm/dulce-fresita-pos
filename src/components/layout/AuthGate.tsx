"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, activeCompany } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/login") return;

    if (!isAuthenticated || !activeCompany) {
      router.push("/login");
    }
  }, [isAuthenticated, activeCompany, pathname, router]);

  // Login page doesn't need protection
  if (pathname === "/login") return <>{children}</>;

  // Not authenticated — show nothing while redirecting
  if (!isAuthenticated || !activeCompany) return null;

  return <>{children}</>;
}
