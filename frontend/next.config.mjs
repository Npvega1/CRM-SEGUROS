/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.emergentagent.com',
        '*.emergentcf.cloud',
        '*.preview.emergentagent.com',
        '*.preview.emergentcf.cloud',
        '**.emergentagent.com',
        '**.emergentcf.cloud',
        '**.preview.emergentagent.com',
        '**.preview.emergentcf.cloud',
        'crm-pipeline-opp.preview.emergentagent.com',
        'crm-pipeline-opp.cluster-5.preview.emergentcf.cloud'
      ],
      bodySizeLimit: '10mb'
    }
  },
  allowedDevOrigins: [
    'crm-pipeline-opp.preview.emergentagent.com',
    'crm-pipeline-opp.cluster-5.preview.emergentcf.cloud',
    '*.emergentagent.com',
    '*.emergentcf.cloud'
  ]
};

export default nextConfig;
