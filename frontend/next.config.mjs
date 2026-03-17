/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permitir Server Actions desde dominios de preview
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.preview.emergentagent.com',
        '*.preview.emergentcf.cloud',
        '*.cluster-0.preview.emergentcf.cloud',
        'policy-hub-64.preview.emergentagent.com',
        'policy-hub-64.cluster-0.preview.emergentcf.cloud'
      ]
    }
  }
};

export default nextConfig;
