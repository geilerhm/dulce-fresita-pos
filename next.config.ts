import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
