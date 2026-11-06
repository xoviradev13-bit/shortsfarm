import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';
import { sanitizeLicenseKey, sanitizeHwid, sanitizeText, generateLicenseSignature } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  // 1. Chống Brute-force: Tối đa 25 lần thử kích hoạt / 10 phút trên mỗi IP
  const rateCheck = checkRateLimit(`activate:${ip}`, 25, 10 * 60 * 1000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, message: 'Bạn đã thực hiện quá nhiều yêu cầu kích hoạt. Vui lòng thử lại sau 10 phút.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 0) / 1000)) },
      }
    );
  }

  try {
    const body = await req.json();
    const rawKey = body?.license_key;
    const rawHwid = body?.hwid;
    const rawDeviceName = body?.device_name;
    const rawAppVersion = body?.app_version;

    const cleanKey = sanitizeLicenseKey(rawKey);
    const cleanHwid = sanitizeHwid(rawHwid);
    const cleanDeviceName = sanitizeText(rawDeviceName, 80) || 'Desktop PC';
    const cleanAppVersion = sanitizeText(rawAppVersion, 20) || '1.0.0';

    if (!cleanKey || !cleanHwid || cleanKey.length < 5 || cleanHwid.length < 8) {
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền hoặc mã thiết bị (HWID) không đúng định dạng.' },
        { status: 400 }
      );
    }

    // 2. Tìm license trong Database
    const license = await prisma.license.findUnique({
      where: { licenseKey: cleanKey },
    });

    if (!license) {
      recordFailedAttempt(`activate:${ip}`, 25, 10 * 60 * 1000);
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền không tồn tại trên hệ thống.' },
        { status: 404 }
      );
    }

    // 3. Kiểm tra trạng thái
    if (license.status === 'suspended') {
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền này đã bị khóa hoặc tạm ngưng bởi quản trị viên.' },
        { status: 403 }
      );
    }

    // 4. Kiểm tra hạn sử dụng
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền đã hết hạn sử dụng. Vui lòng gia hạn thêm.' },
        { status: 403 }
      );
    }

    // 5. Kiểm tra danh sách thiết bị (HWID Binding)
    let currentHwidList = license.hwidList || [];
    const isAlreadyBound = currentHwidList.includes(cleanHwid);

    if (!isAlreadyBound) {
      if (currentHwidList.length >= license.maxDevices) {
        return NextResponse.json(
          {
            success: false,
            message: `Mã này chỉ cho phép tối đa ${license.maxDevices} máy tính. Máy của bạn chưa được liên kết. Vui lòng liên hệ Admin để gỡ liên kết máy cũ!`,
            active_devices: currentHwidList.length,
            max_devices: license.maxDevices,
          },
          { status: 403 }
        );
      }

      // Thêm HWID mới vào danh sách
      currentHwidList = [...currentHwidList, cleanHwid];
      await prisma.license.update({
        where: { id: license.id },
        data: {
          hwidList: currentHwidList,
        },
      });
    }

    // 6. Ghi nhận lịch sử kích hoạt / cập nhật Heartbeat
    await prisma.activation.upsert({
      where: {
        licenseKey_hwid: {
          licenseKey: cleanKey,
          hwid: cleanHwid,
        },
      },
      update: {
        deviceName: cleanDeviceName,
        appVersion: cleanAppVersion,
        ipAddress: ip,
        lastHeartbeat: new Date(),
      },
      create: {
        licenseKey: cleanKey,
        hwid: cleanHwid,
        deviceName: cleanDeviceName,
        appVersion: cleanAppVersion,
        ipAddress: ip,
      },
    });

    // 7. Sinh chữ ký số bảo mật (HMAC-SHA256) chống giả mạo CSDL offline
    const signature = generateLicenseSignature(
      license.licenseKey,
      cleanHwid,
      license.plan,
      license.expiresAt
    );

    return NextResponse.json({
      success: true,
      message: 'Kích hoạt bản quyền thành công!',
      license: {
        licenseKey: license.licenseKey,
        plan: license.plan,
        customerName: license.customerName,
        customerEmail: license.customerEmail,
        maxDevices: license.maxDevices,
        currentDevices: currentHwidList.length,
        expiresAt: license.expiresAt,
        activatedAt: new Date().toISOString(),
        signature,
      },
    });
  } catch (error: any) {
    console.error('[ACTIVATION ERROR]:', error);
    return NextResponse.json(
      { success: false, message: 'Máy chủ xử lý gặp lỗi. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
