import type { NextConfig } from 'next';

const apiOrigin = process.env.API_ORIGIN?.replace(/\/$/, '');
const managementOrigin = process.env.MANAGEMENT_ORIGIN?.replace(/\/$/, '');

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@nsabores/config',
    '@nsabores/ui',
    '@nsabores/validation',
  ],
  async rewrites() {
    return [
      ...(apiOrigin
        ? [
            {
              source: '/v1/:path*',
              destination: `${apiOrigin}/v1/:path*`,
            },
          ]
        : []),
      ...(managementOrigin
        ? [
            {
              source: '/gestao/:path*',
              destination: `${managementOrigin}/gestao/:path*`,
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
