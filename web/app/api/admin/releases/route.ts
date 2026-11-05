import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function checkAdminAuth(req: NextRequest): boolean {
  const adminKey = req.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_SECRET_KEY || 'TiktokFarmSecretAdmin2026!#';
  return adminKey === expectedKey;
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

