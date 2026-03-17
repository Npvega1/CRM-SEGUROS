/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permitir Server Actions desde cualquier origen (workaround para ambiente de desarrollo)
  // Usar doble wildcard (**) para match multinivel de subdominios en Kubernetes
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'http://localhost:3000',
        '**.emergentagent.com',
        '**.emergentcf.cloud',
        '**.preview.emergentagent.com',
        '**.preview.emergentcf.cloud'
      ],
      bodySizeLimit: '10mb'
    }
  }
};

export default nextConfig;
