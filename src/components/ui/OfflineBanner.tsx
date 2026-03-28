"use client";

import { useOnlineStatus } from "@/lib/hooks/useOffline";
import { WifiSlash } from "@phosphor-icons/react";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-700">
      <WifiSlash size={16} weight="fill" />
      <span className="text-xs font-bold">Sin conexión — los datos pueden no estar actualizados</span>
    </div>
  );
}
