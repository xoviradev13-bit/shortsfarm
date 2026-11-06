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

function withAdminAuth(req: NextRequest): NextResponse | null {
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
  return null;
}

export async function POST(req: NextRequest) {
  const authError = withAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { version, download_url, release_notes, file_size_mb, is_mandatory } = body;

    if (!version || !download_url) {
      return NextResponse.json({ error: 'Thiếu version hoặc download_url' }, { status: 400 });
    }

    // Set tất cả các bản cũ về isLatest = false
    await prisma.appRelease.updateMany({
      data: { isLatest: false },
    });

    // Tạo bản mới hoặc cập nhật nếu đã có version
    const release = await prisma.appRelease.upsert({
      where: { version },
      update: {
        downloadUrl: download_url,
        releaseNotes: release_notes || '',
        fileSizeMb: parseFloat(file_size_mb || '85'),
        isMandatory: Boolean(is_mandatory),
        isLatest: true,
      },
      create: {
        version,
        downloadUrl: download_url,
        releaseNotes: release_notes || '',
        fileSizeMb: parseFloat(file_size_mb || '85'),
        isMandatory: Boolean(is_mandatory),
        isLatest: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật link tải phiên bản v${version}!`,
      release,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

