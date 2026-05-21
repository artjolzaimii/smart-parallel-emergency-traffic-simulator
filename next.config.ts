import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['leaflet', 'react-leaflet', '@react-leaflet/core'],
};

export default nextConfig;
