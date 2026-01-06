/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from Epic sandbox
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fhir.epic.com',
      },
    ],
  },
};

export default nextConfig;
