import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { sanitizeLicenseKey, sanitizeHwid } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  // Chống brute-force: Tối đa 20 yêu cầu / 10 phút
  const rateCheck = checkRateLimit(`deactivate:${ip}`, 20, 10 * 60 * 1000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, message: 'Quá nhiều yêu cầu hủy liên kết. Vui lòng thử lại sau.' },
      { status: 429 }
    );
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Dữ liệu không đúng định dạng JSON.' },
        { status: 400 }
      );
    }

    const cleanKey = sanitizeLicenseKey(body?.license_key);
    const cleanHwid = sanitizeHwid(body?.hwid);

    if (!cleanKey || !cleanHwid) {
      return NextResponse.json(
        { success: false, message: 'Thiếu mã license_key hoặc mã máy (HWID).' },
        { status: 400 }
      );
    }

    const license = await prisma.license.findUnique({
      where: { licenseKey: cleanKey },
    });

    if (!license) {
      return NextResponse.json(
        { success: false, message: 'Mã bản quyền không tồn tại.' },
        { status: 404 }
      );
    }

    const isPersonalPlan = license.plan === 'pro_1pc' || license.plan === 'monthly' || license.plan === 'trial';
    let updatedNotes = license.notes || '';
    let recentResetsCount = 0;

    if (isPersonalPlan) {
      // Kiểm tra tần suất đổi máy trong 30 ngày qua (tối đa 2 lần/tháng)
      const resetRegex = /\[RESET:([^\]]+)\]/g;
      const matches = Array.from(updatedNotes.matchAll(resetRegex));
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const recentResets = matches.filter((m) => {
        const d = new Date(m[1]);
        return !isNaN(d.getTime()) && d > thirtyDaysAgo;
      });

      recentResetsCount = recentResets.length;

      if (recentResetsCount >= 2) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Gói Cá Nhân Pro chỉ hỗ trợ đổi máy (Reset HWID) tối đa 2 lần trong vòng 30 ngày. Bạn đã sử dụng hết 2 lượt đổi máy trong tháng này. Vui lòng liên hệ Admin hỗ trợ hoặc nâng cấp lên Gói Studio Team để đổi máy linh hoạt!',
            current_resets: recentResetsCount,
            max_resets_per_month: 2,
          },
          { status: 403 }
        );
      }

      // Thêm dấu mốc đổi máy mới
      const newTimestamp = new Date().toISOString();
      updatedNotes = `${updatedNotes} [RESET:${newTimestamp}]`.trim();
    }

    // Gỡ HWID của máy tính này khỏi danh sách hwidList
    const oldHwidList = license.hwidList || [];
    const newHwidList = oldHwidList.filter((h) => h !== cleanHwid);

    await prisma.license.update({
      where: { id: license.id },
      data: {
        hwidList: newHwidList,
        notes: updatedNotes,
      },
    });

    // Xóa bản ghi kích hoạt của máy tính này
    await prisma.activation.deleteMany({
      where: {
        licenseKey: cleanKey,
        hwid: cleanHwid,
      },
    });

    const resetMsg = isPersonalPlan
      ? ` (Gói Cá Nhân: Lượt đổi máy ${recentResetsCount + 1}/2 trong 30 ngày)`
      : '';

    return NextResponse.json({
      success: true,
      message: `Đã hủy liên kết máy tính thành công. Mã bản quyền có thể dùng trên máy tính khác.${resetMsg}`,
      current_devices: newHwidList.length,
      max_devices: license.maxDevices,
    });
  } catch (error: any) {
    console.error('[DEACTIVATE ERROR]:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi máy chủ khi hủy liên kết thiết bị.' },
      { status: 500 }
    );
  }
}

