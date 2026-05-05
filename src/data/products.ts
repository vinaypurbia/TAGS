/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'www.youtube.com',
      'youtube.com',
      'www.facebook.com',
      'facebook.com',
      'www.instagram.com',
      'instagram.com',
      'www.tiktok.com',
      'tiktok.com',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob:",
              "frame-src 'self' https://www.youtube.com https://youtube.com https://www.facebook.com https://www.tiktok.com https://www.instagram.com",
              "connect-src 'self' https:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
