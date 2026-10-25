import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: '/images/**' },
    ],
  },
  // /bienvenue (manifeste + mode d'emploi, page statique publique) :
  // sert public/bienvenue/index.html sans avoir à taper le nom du fichier.
  async rewrites() {
    return [
      { source: '/bienvenue', destination: '/bienvenue/index.html' },
    ];
  },
};

export default nextConfig;
