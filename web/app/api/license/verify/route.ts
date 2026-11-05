import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_key, hwid } = body;

    if (!license_key || !hwid) {
      return NextResponse.json(
        { valid: false, message: 'Thiếu license_key hoặc hwid' },
        { status: 400 }
      );
    }

    const cleanKey = license_key.trim().toUpperCase();

    const license = await prisma.license.findUnique({
      where: { licenseKey: cleanKey },
    });

    if (!license) {
      return NextResponse.json(
        { valid: false, message: 'Mã bản quyền không tồn tại' },
        { status: 404 }
      );
    }

    if (license.status !== 'active') {
      return NextResponse.json(
        { valid: false, message: 'Mã bản quyền đã bị vô hiệu hóa hoặc khóa' },
        { status: 403 }
      );
    }

    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return NextResponse.json(
        { valid: false, message: 'Mã bản quyền đã hết hạn' },
        { status: 403 }
      );
    }

    const isMatch = (license.hwidList || []).includes(hwid);
    if (!isMatch) {
      return NextResponse.json(
        { valid: false, message: 'Mã bản quyền chưa kích hoạt trên máy tính này' },
        { status: 403 }
      );
    }

    // Cập nhật heartbeat không đồng bộ
    prisma.activation.updateMany({
      where: { licenseKey: cleanKey, hwid: hwid },
      data: { lastHeartbeat: new Date() },
    }).catch(() => {});

    return NextResponse.json({
      valid: true,
      plan: license.plan,
      customer_name: license.customerName,
      expires_at: license.expiresAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, message: 'Lỗi máy chủ xác thực', error: error.message },
      { status: 500 }
    );
  }
}

