import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const release = await prisma.appRelease.findFirst({
      where: { isLatest: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!release) {
      return NextResponse.json({
        latest_version: '2.1.0',
        download_url: process.env.NEXT_PUBLIC_DEFAULT_DOWNLOAD_URL || '',
        release_notes: 'Bản cập nhật ổn định',
        is_mandatory: false,
      });
    }

    return NextResponse.json({
      latest_version: release.version,
      download_url: release.downloadUrl,
      file_size_mb: release.fileSizeMb,
      release_notes: release.releaseNotes,
      is_mandatory: release.isMandatory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Lỗi kiểm tra phiên bản', details: error.message },
      { status: 500 }
    );
  }
}

