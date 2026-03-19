/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow all origins for dev
  allowedDevOrigins: ['*'],
  // Skip TypeScript errors during build (Supabase types not fully generated)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
