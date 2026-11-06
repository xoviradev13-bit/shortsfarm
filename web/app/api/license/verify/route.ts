import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { sanitizeLicenseKey, sanitizeHwid, generateLicenseSignature } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  // Chống brute-force: Tối đa 60 heartbeat/verify checks / 10 phút trên mỗi IP
  const rateCheck = checkRateLimit(`verify:${ip}`, 60, 10 * 60 * 1000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { valid: false, message: 'Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const cleanKey = sanitizeLicenseKey(body?.license_key);
    const cleanHwid = sanitizeHwid(body?.hwid);

    if (!cleanKey || !cleanHwid) {
      return NextResponse.json(
        { valid: false, message: 'Thiếu hoặc sai định dạng license_key / hwid' },
        { status: 400 }
      );
    }

    const license = await prisma.license.findUnique({
      where: { licenseKey: cleanKey },
    });

    if (!license) {
      return NextResponse.json(
        { valid: false, message: 'Mã bản quyền không tồn tại trên hệ thống' },
        { status: 404 }
      );
    }

    if (license.status !== 'active') {
      return NextResponse.json(
        { valid: false, message: 'Mã bản quyền đã bị vô hiệu hóa hoặc khóa bởi quản trị viên' },
        { status: 403 }
      );
    }

    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return NextResponse.json(
        { valid: false, message: 'Mã bản quyền đã hết hạn sử dụng' },
        { status: 403 }
      );
    }

    const isMatch = (license.hwidList || []).includes(cleanHwid);
    if (!isMatch) {
      return NextResponse.json(
        { valid: false, message: 'Mã bản quyền chưa được liên kết với máy tính này' },
        { status: 403 }
      );
    }

    // Cập nhật heartbeat không đồng bộ
    prisma.activation.updateMany({
      where: { licenseKey: cleanKey, hwid: cleanHwid },
      data: { lastHeartbeat: new Date() },
    }).catch(() => {});

    // Chữ ký xác thực số HMAC
    const signature = generateLicenseSignature(
      license.licenseKey,
      cleanHwid,
      license.plan,
      license.expiresAt
    );

    return NextResponse.json({
      valid: true,
      plan: license.plan,
      customer_name: license.customerName,
      customer_email: license.customerEmail,
      expires_at: license.expiresAt,
      max_devices: license.maxDevices,
      signature,
    });
  } catch (error: any) {
    console.error('[VERIFY ERROR]:', error);
    return NextResponse.json(
      { valid: false, message: 'Lỗi xác thực hệ thống' },
      { status: 500 }
    );
  }
}
