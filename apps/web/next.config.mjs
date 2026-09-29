/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Shared logic is shipped as TypeScript source (no build step) - Next compiles it.
  transpilePackages: ['@youmart/shared-client'],
  // Live WordPress URLs -> clean routes, so existing links and search results keep working.
  async redirects() {
    return [
      { source: '/terms-conditions', destination: '/terms', permanent: true },
      { source: '/shipping-details', destination: '/shipping', permanent: true },
      { source: '/offers-and-coupons', destination: '/offers', permanent: true },
      { source: '/ordernotify', destination: '/order-notify', permanent: true },
    ];
  },
};

export default nextConfig;
