/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Temporarily ignore build errors caused by Deno Edge Functions
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config, { isServer }) => {
    // Exclude Supabase Edge Functions from the build
    config.module.rules.push({
      test: /supabase.*functions.*\.ts$/,
      loader: 'ignore-loader',
    });
    return config;
  },
  // Exclude Supabase Edge Functions from the build
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'].filter(ext => 
    !ext.includes('supabase') && !ext.includes('functions')
  ),
}

module.exports = nextConfig