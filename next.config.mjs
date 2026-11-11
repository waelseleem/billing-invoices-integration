/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained server bundle for the Windows .exe package.
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle Oracle client native modules
      config.externals.push({
        'oracledb': 'commonjs oracledb'
      });
    }
    return config;
  },
  // Disable strict mode for Oracle compatibility
  reactStrictMode: false,
  // Enable server external packages for Oracle compatibility
  serverExternalPackages: ['oracledb']
}

export default nextConfig
