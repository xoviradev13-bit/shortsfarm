import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function checkAdminAuth(req: NextRequest): boolean {
  const adminKey = req.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_SECRET_KEY || 'TiktokFarmSecretAdmin2026!#';
  return adminKey === expectedKey;
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    const recentDownloads = await prisma.download.findMany({
      take: 15,
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
      },
      latest_release: latestRelease,
      recent_downloads: recentDownloads,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

