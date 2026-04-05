import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: '/images/**' },
    ],
  },
};

export default nextConfig;
