import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  images: {
    remotePatterns: [
      { hostname: 'pub-de315f4652054008be5f90bf09919f80.r2.dev' },
      { hostname: 'fal.media' },
      { hostname: '*.fal.media' },
      { hostname: 'storage.googleapis.com' },
      { hostname: 'replicate.delivery' },
      { hostname: 'blob.vercel-storage.com' },
      { hostname: '*.r2.cloudflarestorage.com' },
      { hostname: '1a011a0b69a1fdbbc132a89b181d2f80.r2.cloudflarestorage.com' },
    ],
  },
};

export default nextConfig;
