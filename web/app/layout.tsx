import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shortsstack.com';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#FFFFFF' },
  ],
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'ShortsStack - Hệ Thống Nuôi Kênh & Tự Động Reup Video AI Đa Nền Tảng',
    template: '%s | ShortsStack Studio',
  },
  description:
    'Phần mềm tự động tải video Douyin, Xiaohongshu, YouTube không logo, tối ưu hóa nội dung độc bản bằng AI thông minh (Ken Burns, Voiceover) và tự động đăng lịch đa nền tảng TikTok Beta, YouTube Shorts, Reels qua Antidetect Browser.',
  applicationName: 'ShortsStack',
  authors: [{ name: 'ShortsStack Systems', url: siteUrl }],
  generator: 'Next.js',
  keywords: [
    'ShortsStack',
    'tool reup video tiktok',
    'tối ưu hóa video tiktok',
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
  creator: 'ShortsStack Systems',
  publisher: 'ShortsStack Systems',
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
    title: 'ShortsStack - Hệ Thống Nuôi Kênh & Tự Động Reup Video AI Đa Nền Tảng',
    description:
      'Tải video Douyin & Xiaohongshu sạch logo, tối ưu hóa nội dung độc bản AI và auto đăng đa nền tảng TikTok, YouTube Shorts, Facebook Reels qua GPMLogin & GenLogin.',
    siteName: 'ShortsStack',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ShortsStack - AI Video Engine & Multi-Channel Auto Uploader',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShortsStack - AI Video Engine & Multi-Channel Auto Uploader',
    description:
      'Hệ thống tự động tải video Douyin, Xiaohongshu, tối ưu hóa nội dung độc bản AI và auto upload lên TikTok Beta, YouTube Shorts, Reels.',
    images: ['/og-image.png'],
    creator: '@shortsstack',
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
    <html lang="vi" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className={`${inter.variable} font-sans bg-[#FAFCFE] text-slate-800 antialiased selection:bg-rose-500 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
