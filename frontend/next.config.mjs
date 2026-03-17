/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permitir Server Actions desde dominios de preview
  experimental: {
    serverActions: {
      // Configuración más permisiva para permitir ambos dominios del cluster
      allowedOrigins: [
        'localhost:3000',
        'http://localhost:3000',
        'https://localhost:3000',
        'policy-hub-64.preview.emergentagent.com',
        'https://policy-hub-64.preview.emergentagent.com',
        'policy-hub-64.cluster-0.preview.emergentcf.cloud',
        'https://policy-hub-64.cluster-0.preview.emergentcf.cloud',
        // Agregar más variantes para asegurar compatibilidad
        '*.preview.emergentcf.cloud',
        '*.cluster-0.preview.emergentcf.cloud'
      ],
      // Deshabilitar bodySizeLimit para permitir uploads grandes
      bodySizeLimit: '10mb'
    }
  }
};

export default nextConfig;
