import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TikTokFarm Studio - Tự Động Hóa Nuôi Kênh & Video AI Đa Nền Tảng',
  description: 'Công cụ tự động tải video Douyin, Xiaohongshu, YouTube, Facebook, render lách bản quyền AI và tự động đăng lên TikTok, YouTube Shorts, Reels thông qua Antidetect Browser.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className="bg-dark-900 text-gray-100 antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}

