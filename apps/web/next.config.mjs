/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Shared logic is shipped as TypeScript source (no build step) - Next compiles it.
  transpilePackages: ['@youmart/shared-client'],
  // Live WordPress URLs and our pre-W6 paths -> the clean scheme (packages/shared-client
  // routes.ts), so existing links, bookmarks and search results keep working. Next also drops
  // trailing slashes (`/my-account/` -> `/my-account` -> `/account`).
  async redirects() {
    const page = ':n(\\d+)';
    return [
      // Listing pagination moved from `/page/N` into `?page=N`.
      {
        source: `/product-category/:path+/page/${page}`,
        destination: '/category/:path+?page=:n',
        permanent: true,
      },
      { source: '/product-category/:path+', destination: '/category/:path+', permanent: true },
      {
        source: `/category/:path+/page/${page}`,
        destination: '/category/:path+?page=:n',
        permanent: true,
      },
      { source: `/shop/page/${page}`, destination: '/shop?page=:n', permanent: true },
      // Account area.
      { source: '/my-account', destination: '/account', permanent: true },
      { source: '/my-account/orders', destination: '/account/orders', permanent: true },
      { source: '/my-account/view-order/:id', destination: '/account/orders', permanent: true },
      { source: '/my-account/edit-address', destination: '/account/addresses', permanent: true },
      {
        source: '/my-account/edit-address/:kind',
        destination: '/account/addresses',
        permanent: true,
      },
      { source: '/my-account/edit-account', destination: '/account/details', permanent: true },
      { source: '/my-account/:rest*', destination: '/account', permanent: true },
      // Order tools.
      { source: '/order-track', destination: '/track-order', permanent: true },
      { source: '/order-cancel', destination: '/cancel-order', permanent: true },
      { source: '/order-notify', destination: '/order-notifications', permanent: true },
      { source: '/ordernotify', destination: '/order-notifications', permanent: true },
      // Policy pages.
      { source: '/terms-conditions', destination: '/terms', permanent: true },
      { source: '/shipping-details', destination: '/shipping', permanent: true },
      { source: '/offers-and-coupons', destination: '/offers', permanent: true },
    ];
  },
};

export default nextConfig;
