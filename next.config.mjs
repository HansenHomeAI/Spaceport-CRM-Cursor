/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export for production builds, not dev mode
  ...(process.env.NODE_ENV === 'production' ? {
    output: 'export',
    distDir: 'out',
  } : {}),
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
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
