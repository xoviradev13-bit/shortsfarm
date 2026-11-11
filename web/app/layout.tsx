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
    default: 'ShortsStack - Hệ Thống Tự Động Hóa Sản Xuất & Vận Hành Video Ngắn AI',
    template: '%s | ShortsStack Studio',
  },
  description:
    'Phần mềm tự động hóa sản xuất, bản địa hóa và tối ưu hóa video ngắn 9:16 độc bản bằng AI. Tích hợp tự động lồng tiếng ElevenLabs, phụ đề động và điều khiển trình duyệt GPMLogin, GenLogin đăng lịch đa kênh TikTok, YouTube Shorts, Reels.',
  applicationName: 'ShortsStack',
  authors: [{ name: 'ShortsStack Systems', url: siteUrl }],
  generator: 'Next.js',
  keywords: [
    'ShortsStack',
    'tự động hóa video ngắn',
    'phần mềm sản xuất video ai',
    'bản địa hóa video đa ngôn ngữ',
    'biên tập video 9:16 hàng loạt',
    'tự động đăng video đa kênh',
    'tối ưu video tiktok',
    'auto upload youtube shorts',
    'auto upload facebook reels',
    'quản trị tài khoản gpm login',
    'tự động hóa genlogin cdp',
    'render video ai gpu nvenc',
    'lồng tiếng ai elevenlabs',
    'tạo phụ đề video tự động',
    'công cụ sáng tạo video ngắn',
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
    title: 'ShortsStack - Hệ Thống Tự Động Hóa Sản Xuất & Vận Hành Video Ngắn AI',
    description:
      'Tự động hóa biên tập video 9:16 chuẩn độc bản, bản địa hóa nội dung bằng giọng đọc AI ElevenLabs và quản trị xuất bản đa kênh TikTok, YouTube Shorts, Reels qua GPMLogin & GenLogin.',
    siteName: 'ShortsStack',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ShortsStack - AI Video Production & Multi-Channel Automation Engine',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShortsStack - AI Video Production & Multi-Channel Automation Engine',
    description:
      'Hệ thống tự động hóa sản xuất, tối ưu hóa video độc bản AI và tự động xuất bản đa nền tảng TikTok, YouTube Shorts, Reels.',
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
