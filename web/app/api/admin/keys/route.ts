import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

function checkAdminAuth(req: NextRequest): boolean {
  const adminKey = req.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_SECRET_KEY || 'TiktokFarmSecretAdmin2026!#';
  return adminKey === expectedKey;
}

// GET: Lấy danh sách key & tìm kiếm
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q') || '';

  const licenses = await prisma.license.findMany({
    where: search ? {
      OR: [
        { licenseKey: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ]
    } : undefined,
    include: {
      activations: {
        select: {
          hwid: true,
          deviceName: true,
          appVersion: true,
          lastHeartbeat: true,
          ipAddress: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ licenses });
}

// POST: Tạo License Key mới
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      customer_name = 'Khách hàng',
      customer_email,
      plan = 'monthly', // trial, monthly, yearly, lifetime
      duration_days = 30,
      max_devices = 1,
      custom_key,
      count = 1,
      notes = '',
    } = body;

    let expiresAt: Date | null = null;
    if (plan !== 'lifetime') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(duration_days));
    }

    const createdKeys = [];

    for (let i = 0; i < Number(count); i++) {
      let key = custom_key?.trim().toUpperCase();
      if (!key || count > 1) {
        // Sinh key dạng: TKFARM-XXXX-XXXX-XXXX
        const randPart1 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const randPart2 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const randPart3 = crypto.randomBytes(2).toString('hex').toUpperCase();
        key = `TKFARM-${randPart1}-${randPart2}-${randPart3}`;
      }

      const newLicense = await prisma.license.create({
        data: {
          licenseKey: key,
          customerName: customer_name,
          customerEmail: customer_email || null,
          plan,
          maxDevices: Number(max_devices),
          expiresAt,
          notes,
          status: 'active',
        },
      });

      createdKeys.push(newLicense);
    }

    return NextResponse.json({
      success: true,
      message: `Đã tạo thành công ${createdKeys.length} license key!`,
      data: createdKeys,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT: Thao tác Reset HWID, Khóa/Mở khóa, Gia hạn
export async function PUT(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, id, extra_days } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Thiếu id hoặc action' }, { status: 400 });
    }

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) {
      return NextResponse.json({ error: 'Không tìm thấy license' }, { status: 404 });
    }

    if (action === 'reset_hwid') {
      // Xóa toàn bộ HWID đã gán và activations để user đổi máy tính
      await prisma.license.update({
        where: { id },
        data: { hwidList: [] },
      });
      await prisma.activation.deleteMany({
        where: { licenseKey: license.licenseKey },
      });

      return NextResponse.json({
        success: true,
        message: `Đã gỡ liên kết máy tính cũ cho key ${license.licenseKey}. Khách hàng có thể kích hoạt trên máy mới!`,
      });
    }

    if (action === 'revoke') {
      await prisma.license.update({
        where: { id },
        data: { status: 'suspended' },
      });
      return NextResponse.json({ success: true, message: 'Đã tạm khóa mã bản quyền này!' });
    }

    if (action === 'activate') {
      await prisma.license.update({
        where: { id },
        data: { status: 'active' },
      });
      return NextResponse.json({ success: true, message: 'Đã kích hoạt lại mã bản quyền!' });
    }

    if (action === 'extend') {
      const days = Number(extra_days || 30);
      const baseDate = license.expiresAt && new Date(license.expiresAt) > new Date()
        ? new Date(license.expiresAt)
        : new Date();
      baseDate.setDate(baseDate.getDate() + days);

      await prisma.license.update({
        where: { id },
        data: {
          expiresAt: baseDate,
          status: 'active',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Đã gia hạn thêm ${days} ngày (Hết hạn: ${baseDate.toLocaleDateString()})`,
      });
    }

    return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Xóa license
export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });
  }

  await prisma.license.delete({ where: { id } });
  return NextResponse.json({ success: true, message: 'Đã xóa bản quyền khỏi hệ thống' });
}

