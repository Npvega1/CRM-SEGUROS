/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deshabilitar generación estática para páginas que usan Supabase
  // Las variables de entorno solo están disponibles en runtime
  output: 'standalone',
  
  // Ignorar errores de ESLint durante el build (ya se verifican en desarrollo)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Ignorar errores de TypeScript durante el build (ya se verifican en desarrollo)
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
