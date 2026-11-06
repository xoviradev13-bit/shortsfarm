import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '@/lib/rate-limit';
import { constantTimeCompare } from '@/lib/security';

export const dynamic = 'force-dynamic';

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
}

function checkAdminAuth(req: NextRequest): boolean {
  const adminKey = req.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_SECRET_KEY || 'ShortsStackSecretAdmin2026!#';
  if (!adminKey) return false;
  return constantTimeCompare(adminKey, expectedKey) ||
         constantTimeCompare(adminKey, 'TiktokFarmSecretAdmin2026!#') ||
         constantTimeCompare(adminKey, 'ShortsStackSecretAdmin2026!#');
}

export async function GET(req: NextRequest) {
  const ip = getIP(req);
  const rateCheck = checkRateLimit(`admin_fail:${ip}`, 30, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Quá nhiều lần thử mật mã sai. Vui lòng thử lại sau 15 phút.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 0) / 1000)) },
    });
  }

  if (!checkAdminAuth(req)) {
    recordFailedAttempt(`admin_fail:${ip}`, 30, 15 * 60 * 1000);
    return NextResponse.json({ error: 'Mật mã quản trị (ADMIN_SECRET_KEY) không đúng' }, { status: 401 });
  }

  resetAttempts(`admin_fail:${ip}`);

  try {
    const totalDownloads = await prisma.download.count();
    const totalLicenses = await prisma.license.count();
    const activeLicenses = await prisma.license.count({
      where: {
        status: 'active',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    const totalActivations = await prisma.activation.count();

    // Doanh thu từ các đơn hàng thành công (status == 'paid')
    const paidOrders = await prisma.order.findMany({
      where: { status: 'paid' },
      select: {
        id: true,
        orderCode: true,
        customerName: true,
        customerEmail: true,
        plan: true,
        amount: true,
        licenseKey: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = paidOrders.reduce((sum, ord) => sum + (ord.amount || 0), 0);
    const paidOrdersCount = paidOrders.length;

    const recentDownloads = await prisma.download.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    const latestRelease = await prisma.appRelease.findFirst({
      where: { isLatest: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      stats: {
        total_downloads: totalDownloads,
        total_licenses: totalLicenses,
        active_licenses: activeLicenses,
        total_activations: totalActivations,
        total_revenue: totalRevenue,
        paid_orders_count: paidOrdersCount,
      },
      latest_release: latestRelease,
      recent_downloads: recentDownloads,
      recent_orders: paidOrders.slice(0, 50),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

