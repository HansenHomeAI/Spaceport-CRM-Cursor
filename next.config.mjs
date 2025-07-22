/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  distDir: 'out',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Spaceport-CRM-Cursor' : '',
  basePath: process.env.NODE_ENV === 'production' ? '/Spaceport-CRM-Cursor' : '',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true
  },
  experimental: {
    esmExternals: false
  }
}

export default nextConfig
