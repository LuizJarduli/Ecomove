import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Static export (`out/`) so the landing page deploys at $0 on Firebase Hosting or Vercel. */
  output: "export",
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
