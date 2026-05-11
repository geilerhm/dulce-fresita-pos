"use client";

/**
 * Kept as a redirect so existing bookmarks and links don't 404. The actual
 * order-creation flow lives in /pos now — same UI as selling on the spot,
 * with a "Datos del cliente" button that toggles to the customer info step.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NuevoPedidoRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pos");
  }, [router]);
  return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <span className="h-6 w-6 border-2 border-default-200 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
