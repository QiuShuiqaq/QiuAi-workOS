/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@qiuai/api-client',
    '@qiuai/api-contract',
    '@qiuai/design-tokens',
    '@qiuai/ui'
  ],
  poweredByHeader: false
};

export default nextConfig;
