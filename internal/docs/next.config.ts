import path from "path";
import { fileURLToPath } from "url";

import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@core/ui", "@core/config"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    optimizePackageImports: ["@core/ui", "lucide-react"],
  },
};

export default nextConfig;
