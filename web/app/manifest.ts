import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ShortsFarm - AI Video Engine & Multi-Channel Auto Uploader',
    short_name: 'ShortsFarm',
    description: 'Hệ thống tự động tải video Douyin, Xiaohongshu, render lách bản quyền AI và auto upload lên TikTok Beta, YouTube Shorts, Reels.',
    start_url: '/',
    display: 'standalone',
    background_color: '#070A13',
    theme_color: '#E11D48',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}

