import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Enable Turbopack for Next.js 16+ (empty config is fine)
  turbopack: {},
  
  // Configure webpack to reduce file watching
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // watchOptions to reduce number of watched files
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/dist/**',
          '**/build/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/coverage/**',
          '**/*.md',
          '**/README*',
          '**/.env*',
        ],
        // Use polling as fallback (lower perf but more stable)
        poll: process.env.NEXT_DEV_POLL === 'true' ? 1000 : undefined,
      };
    }
    return config;
  },
};

export default nextConfig;
