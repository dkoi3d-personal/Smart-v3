/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force clean build to avoid stale cache issues
  cleanDistDir: true,
  // Enable strict mode for better debugging
  reactStrictMode: true,
  // Transpile packages for proper ESM support
  transpilePackages: [],
  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};
export default nextConfig;
