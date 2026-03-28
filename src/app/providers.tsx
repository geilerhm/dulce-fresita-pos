"use client";

import { Toaster } from "sonner";
import { CajaProvider } from "@/contexts/CajaContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGate } from "@/components/layout/AuthGate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>
        <CajaProvider>
          {children}
          <Toaster position="top-center" richColors />
        </CajaProvider>
      </AuthGate>
    </AuthProvider>
  );
}
