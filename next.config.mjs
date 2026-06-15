/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Build with strict type checking and lint enforcement enabled.
  // If you ever need a temporary escape hatch, scope it to local dev only:
  //   eslint: { ignoreDuringBuilds: process.env.NODE_ENV === 'development' },
  experimental: {
    // Keep server actions on a stable body size; helps prevent accidental
    // oversize uploads hitting the edge runtime.
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
