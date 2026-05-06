import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NEXT_PUBLIC_READ_ONLY !== "true") return [];
    return [{ source: "/", destination: "/graph" }];
  },
};

export default nextConfig;
