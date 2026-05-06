import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    if (process.env.NEXT_PUBLIC_READ_ONLY !== "true") return [];
    return [{ source: "/", destination: "/graph", permanent: false }];
  },
};

export default nextConfig;
