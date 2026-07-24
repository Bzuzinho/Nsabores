import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@nsabores/config',
    '@nsabores/ui',
    '@nsabores/validation',
  ],
};

export default nextConfig;
