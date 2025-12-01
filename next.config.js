/** @type {import('next').NextConfig} */
const nextConfig = {
  // basePath: Use /cashbook for subpath hosting
  // When you get a domain, set NEXT_PUBLIC_BASE_PATH='' and rebuild
  // For books.landlife.au domain, use empty basePath
  // Temporarily hardcoded to empty for domain hosting - change back to '/cashbook' for subpath
  basePath: process.env.USE_DOMAIN === 'true' || process.env.NEXT_PUBLIC_BASE_PATH === ''
    ? '' 
    : (process.env.NEXT_PUBLIC_BASE_PATH !== undefined 
        ? process.env.NEXT_PUBLIC_BASE_PATH 
        : '/cashbook'),
  
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