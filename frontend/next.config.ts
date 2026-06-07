import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal standalone server (server.js + traced deps) so the runtime
  // image does not need the full node_modules. Started via `node server.js`.
  output: "standalone",
};

export default nextConfig;
