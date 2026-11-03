/** @type {import('next').NextConfig} */
const nextConfig = {
  // basePath: Use /cashbook for subpath hosting
  // When you get a domain, set NEXT_PUBLIC_BASE_PATH='' and rebuild
  // TEMPORARILY HARDCODED to empty for books.landlife.au domain hosting
  // TODO: Change back to env var logic when switching back to subpath hosting
  basePath: '',
  
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