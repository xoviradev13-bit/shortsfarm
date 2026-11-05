import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const country = req.headers.get('x-vercel-ip-country') || 'VN';

    // 1. Lấy thông tin bản phát hành mới nhất
    let latestRelease = await prisma.appRelease.findFirst({
      where: { isLatest: true },
      orderBy: { createdAt: 'desc' },
    });

    const downloadUrl = latestRelease?.downloadUrl || 
      process.env.NEXT_PUBLIC_DEFAULT_DOWNLOAD_URL || 
      'https://github.com/your-repo/tiktok-farm/releases/latest';

    const version = latestRelease?.version || '2.1.0';

    // 2. Ghi nhận lượt tải vào cơ sở dữ liệu
    await prisma.download.create({
      data: {
        ipAddress: ip.split(',')[0].trim(),
        userAgent: userAgent.slice(0, 255),
        country,
        os: userAgent.includes('Windows') ? 'Windows' : userAgent.includes('Mac') ? 'macOS' : 'Other',
        version,
      },
    });

    // Nếu người dùng yêu cầu dạng JSON (desktop app check)
    const { searchParams } = new URL(req.url);
    if (searchParams.get('format') === 'json') {
      return NextResponse.json({
        success: true,
        version,
        download_url: downloadUrl,
        size_mb: latestRelease?.fileSizeMb || 85,
      });
    }

    // Redirect trực tiếp đến file tải
    return NextResponse.redirect(downloadUrl, 302);
  } catch (error: any) {
    console.error('Error tracking download:', error);
    const fallbackUrl = process.env.NEXT_PUBLIC_DEFAULT_DOWNLOAD_URL || 'https://github.com/your-repo/tiktok-farm/releases';
    return NextResponse.redirect(fallbackUrl, 302);
  }
}

