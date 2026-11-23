import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '*.run.app',
    '**.run.app',
    '*.asia-southeast1.run.app',
    'ais-dev-xmm4hfltof2hi7ufasg37c-833837847338.asia-southeast1.run.app',
    'ais-pre-xmm4hfltof2hi7ufasg37c-833837847338.asia-southeast1.run.app',
    '*.scf.usercontent.goog',
    'aistudio.google.com',
    '*.google.com',
    'localhost',
    '127.0.0.1',
  ],
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
