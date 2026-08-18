import path from "path";
import { fileURLToPath } from "url";

import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // `next dev` and `next build` both write to `.next`, so verifying a build
  // while a dev server is running overwrites the manifests that server holds
  // open — it then fails with "Could not find the module … in the React Client
  // Manifest", which reads like a bundler bug and is really a collision.
  // Development gets its own directory; production keeps `.next`, which is what
  // `output: 'standalone'` and the Dockerfiles expect.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

  transpilePackages: ["@core/ui", "@core/config", "@core/shared"],
  outputFileTracingRoot: path.join(__dirname, "../../../"),
  experimental: {
    optimizePackageImports: ["@core/ui", "lucide-react"],
  },
};

export default nextConfig;
