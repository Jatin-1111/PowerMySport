import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/community",
  reactStrictMode: true,
  reactCompiler: true,
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
};

export default nextConfig;
