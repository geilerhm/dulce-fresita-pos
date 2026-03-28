"use client";

import { RouterProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { CajaProvider } from "@/contexts/CajaContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGate } from "@/components/layout/AuthGate";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <RouterProvider navigate={router.push}>
      <AuthProvider>
        <AuthGate>
          <CajaProvider>
            {children}
            <Toaster position="top-center" richColors />
          </CajaProvider>
        </AuthGate>
      </AuthProvider>
    </RouterProvider>
  );
}
