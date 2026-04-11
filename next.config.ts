import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  // Native modules must not be bundled — loaded at runtime via require
  serverExternalPackages: ["usb", "node-thermal-printer", "better-sqlite3"],
  experimental: {
    optimizePackageImports: [
      "@phosphor-icons/react",
      "lucide-react",
      "recharts",
      "framer-motion",
    ],
  },
};

export default nextConfig;
