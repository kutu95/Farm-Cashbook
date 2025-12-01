/** @type {import('next').NextConfig} */
const nextConfig = {
  // basePath: Use empty string - Nginx handles /cashbook prefix stripping
  // This allows the app to work at both /cashbook (via Nginx) and root (when using domain)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  
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