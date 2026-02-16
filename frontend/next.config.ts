import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: ['laptop-vpnchdqf-1.tail84384c.ts.net', '*.tail84384c.ts.net'],
};

export default nextConfig;
