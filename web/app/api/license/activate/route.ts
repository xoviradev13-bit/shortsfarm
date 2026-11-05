import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_key, hwid, device_name, app_version } = body;

    if (!license_key || !hwid) {
      return NextResponse.json(
        { success: false, message: 'Thiếu mã bản quyền (license_key) hoặc mã máy (hwid)' },
        { status: 400 }
      );
    }

    const cleanKey = license_key.trim().toUpperCase();

    // 1. Tìm license trong Database
    const license = await prisma.license.findUnique({
      where: { licenseKey: cleanKey },
    });

    if (!license) {
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền không tồn tại trên hệ thống.' },
        { status: 404 }
      );
    }

    // 2. Kiểm tra trạng thái
    if (license.status === 'suspended') {
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền này đã bị khóa hoặc tạm ngưng.' },
        { status: 403 }
      );
    }

    // 3. Kiểm tra hạn sử dụng
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền đã hết hạn sử dụng. Vui lòng gia hạn thêm.' },
        { status: 403 }
      );
    }

    // 4. Kiểm tra danh sách thiết bị (HWID Binding)
    let currentHwidList = license.hwidList || [];
    const isAlreadyBound = currentHwidList.includes(hwid);

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
      currentHwidList = [...currentHwidList, hwid];
      await prisma.license.update({
        where: { id: license.id },
        data: {
          hwidList: currentHwidList,
        },
      });
    }

    // 5. Ghi nhận lịch sử kích hoạt / cập nhật Heartbeat
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await prisma.activation.upsert({
      where: {
        licenseKey_hwid: {
          licenseKey: cleanKey,
          hwid: hwid,
        },
      },
      update: {
        deviceName: device_name || 'Desktop PC',
        appVersion: app_version || '2.1.0',
        ipAddress: ip.split(',')[0].trim(),
        lastHeartbeat: new Date(),
      },
      create: {
        licenseKey: cleanKey,
        hwid: hwid,
        deviceName: device_name || 'Desktop PC',
        appVersion: app_version || '2.1.0',
        ipAddress: ip.split(',')[0].trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Kích hoạt bản quyền thành công!',
      data: {
        license_key: license.licenseKey,
        plan: license.plan,
        customer_name: license.customerName,
        max_devices: license.maxDevices,
        current_devices: currentHwidList.length,
        expires_at: license.expiresAt,
        activated_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Activation error:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi kích hoạt hệ thống', details: error.message },
      { status: 500 }
    );
  }
}

