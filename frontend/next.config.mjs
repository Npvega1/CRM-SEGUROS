/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permitir Server Actions desde subdominios de Emergent
  // Usar wildcard simple (*) para match de un nivel
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'http://localhost:3000',
        '*.emergentagent.com',
        '*.emergentcf.cloud',
        '*.preview.emergentagent.com',
        '*.preview.emergentcf.cloud',
        '*.cluster-0.preview.emergentcf.cloud'
      ],
      bodySizeLimit: '10mb'
    }
  }
};

export default nextConfig;
