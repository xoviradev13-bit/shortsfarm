import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPayOS, isPayOSConfigured } from '@/lib/payos';
import { fulfillOrder } from '@/lib/license-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderCodeParam = searchParams.get('orderCode');

    if (!orderCodeParam) {
      return NextResponse.json({ success: false, message: 'Thiếu orderCode' }, { status: 400 });
    }

    const orderCode = parseInt(orderCodeParam, 10);
    if (isNaN(orderCode)) {
      return NextResponse.json({ success: false, message: 'orderCode không hợp lệ' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderCode },
    });

    if (!order) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy đơn hàng' }, { status: 404 });
    }

    // 1. Nếu đơn hàng đã hoàn tất trong database
    if (order.status === 'paid' && order.licenseKey) {
      const license = await prisma.license.findUnique({
        where: { licenseKey: order.licenseKey },
      });

      return NextResponse.json({
        success: true,
        status: 'paid',
        orderCode: order.orderCode,
        licenseKey: order.licenseKey,
        plan: order.plan,
        customerEmail: order.customerEmail,
        expiresAt: license?.expiresAt || null,
        maxDevices: license?.maxDevices || 1,
      });
    }

    // 2. Nếu vẫn đang pending và payOS được cấu hình: chủ động kiểm tra với PayOS API
    const payos = getPayOS();
    if (isPayOSConfigured() && payos) {
      try {
        const paymentInfo = await payos.paymentRequests.get(orderCode);
        if (paymentInfo && paymentInfo.status === 'PAID') {
          // Ngân hàng đã nhận tiền! Tự động tạo key và trả về ngay
          const fulfilled = await fulfillOrder(orderCode);
          return NextResponse.json({
            success: true,
            status: 'paid',
            orderCode,
            licenseKey: fulfilled.licenseKey,
            plan: fulfilled.plan,
            customerEmail: fulfilled.customerEmail,
            expiresAt: fulfilled.expiresAt,
            maxDevices: fulfilled.maxDevices,
          });
        }
      } catch (checkErr) {
        // Tiếp tục trả về pending nếu API check lỗi
      }
    }

    return NextResponse.json({
      success: true,
      status: order.status,
      orderCode: order.orderCode,
      licenseKey: null,
      plan: order.plan,
      customerEmail: order.customerEmail,
    });
  } catch (error: any) {
    console.error('[CHECKOUT STATUS ERROR]:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi kiểm tra trạng thái đơn: ' + error.message },
      { status: 500 }
    );
  }
}

