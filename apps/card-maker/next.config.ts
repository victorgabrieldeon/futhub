import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@dreamfut/database'],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
