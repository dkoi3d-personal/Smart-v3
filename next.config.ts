import type { NextConfig } from "next";
import path from "path";

// Get the directory of this config file (works in both ESM and CJS contexts in Next.js)
const projectRoot = path.resolve(__dirname || ".");

const nextConfig: NextConfig = {
  // Exclude heavy packages from bundling - use Node.js require instead
  serverExternalPackages: ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/claude-code', 'puppeteer'],
  // Ignore the old projects directory to prevent HMR issues
  webpack: (config, { isServer }) => {
    // Add projects directory to ignored paths
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/projects/**',
        '**/.git/**',
      ],
    };

    // Handle Node.js modules for quantum-circuit library (uses antlr4 which needs fs)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
  // Turbopack configuration (Next.js 16 uses Turbopack by default)
  turbopack: {
    // Set root to current directory to prevent Turbopack from detecting
    // cloned projects (which may also be Next.js apps) as part of this workspace
    root: projectRoot,
    resolveAlias: {
      // Stub out Node.js modules that quantum-circuit's antlr4 dependency tries to use
      fs: { browser: './lib/stubs/fs-stub.js' },
      path: { browser: './lib/stubs/path-stub.js' },
    },
  },
  // Experimental features
  experimental: {
    // Disable server component HMR for stability
    serverComponentsHmrCache: false,
    // Use system TLS certificates for Turbopack (fixes Google Fonts fetch errors)
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
