import type { NextConfig } from "next";

const pkg = require("./package.json");

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Native modules must not be bundled — loaded at runtime via require
  serverExternalPackages: ["usb", "node-thermal-printer", "better-sqlite3", "@thiagoelg/node-printer"],
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
