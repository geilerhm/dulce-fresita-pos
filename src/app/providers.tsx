"use client";

import { Toaster } from "sonner";
import { CajaProvider } from "@/contexts/CajaContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGate } from "@/components/layout/AuthGate";
import { CloudSyncProvider } from "@/components/layout/CloudSyncProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>
        <CajaProvider>
          <CloudSyncProvider />
          {children}
          <Toaster
            position="top-center"
            richColors
            toastOptions={{
              style: {
                fontSize: "1.25rem",
                padding: "20px 24px",
                borderRadius: "20px",
                minHeight: "68px",
                lineHeight: "1.4",
              },
            }}
          />
        </CajaProvider>
      </AuthGate>
    </AuthProvider>
  );
}
