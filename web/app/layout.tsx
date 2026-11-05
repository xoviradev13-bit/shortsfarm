import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shortsfarm.vercel.app';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070A13' },
    { media: '(prefers-color-scheme: light)', color: '#070A13' },
  ],
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'ShortsFarm - Hệ Thống Nuôi Kênh & Tự Động Reup Video AI Đa Nền Tảng',
    template: '%s | ShortsFarm Studio',
  },
  description:
    'Phần mềm tự động tải video Douyin, Xiaohongshu, YouTube không logo, render lách bản quyền bằng AI thông minh (Ken Burns, Voiceover) và tự động đăng lịch đa nền tảng TikTok Beta, YouTube Shorts, Reels qua Antidetect Browser.',
  applicationName: 'ShortsFarm',
  authors: [{ name: 'ShortsFarm Systems', url: siteUrl }],
  generator: 'Next.js',
  keywords: [
    'ShortsFarm',
    'tool reup video tiktok',
    'lách bản quyền video tiktok',
    'tải video douyin không logo',
    'tải video xiaohongshu',
    'auto upload tiktok',
    'auto upload youtube shorts',
    'auto upload facebook reels',
    'nuôi nick tiktok beta',
    'gpm login tool',
    'genlogin tool',
    'render video ai',
    'ai voiceover elevenlabs',
    'tiktok creator rewards',
    'cắt ghép video tự động',
  ],
  creator: 'ShortsFarm Systems',
  publisher: 'ShortsFarm Systems',
  category: 'Software',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
    languages: {
      'vi-VN': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: siteUrl,
    title: 'ShortsFarm - Hệ Thống Nuôi Kênh & Tự Động Reup Video AI Đa Nền Tảng',
    description:
      'Tải video Douyin & Xiaohongshu sạch logo, render lách bản quyền AI và auto đăng đa nền tảng TikTok, YouTube Shorts, Facebook Reels qua GPMLogin & GenLogin.',
    siteName: 'ShortsFarm',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ShortsFarm - AI Video Engine & Multi-Channel Auto Uploader',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShortsFarm - AI Video Engine & Multi-Channel Auto Uploader',
    description:
      'Hệ thống tự động tải video Douyin, Xiaohongshu, render lách bản quyền AI và auto upload lên TikTok Beta, YouTube Shorts, Reels.',
    images: ['/og-image.png'],
    creator: '@shortsfarm',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/apple-touch-icon.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="bg-[#070A13] text-gray-100 antialiased selection:bg-pink-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
