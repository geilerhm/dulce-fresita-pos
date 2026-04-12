"use client";

import { useCloudSync } from "@/lib/hooks/useCloudSync";

/** Invisible component that runs cloud sync in background */
export function CloudSyncProvider() {
  useCloudSync();
  return null;
}
