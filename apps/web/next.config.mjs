/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Shared logic is shipped as TypeScript source (no build step) - Next compiles it.
  transpilePackages: ['@youmart/shared-client'],
};

export default nextConfig;
