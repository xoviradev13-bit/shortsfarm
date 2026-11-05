import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cổng Quản Trị Hệ Thống | ShortsFarm',
  description: 'Bảng điều khiển quản trị license, lượt tải và phiên bản phần mềm ShortsFarm.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

