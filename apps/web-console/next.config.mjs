/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@qiuai/ui', '@qiuai/domain', '@qiuai/design-tokens'],
  poweredByHeader: false
};

export default nextConfig;
