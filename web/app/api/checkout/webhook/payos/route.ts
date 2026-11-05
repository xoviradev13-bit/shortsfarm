import { NextRequest, NextResponse } from 'next/server';
import { getPayOS, isPayOSConfigured } from '@/lib/payos';
import { fulfillOrder } from '@/lib/license-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const payos = getPayOS();
    if (!isPayOSConfigured() || !payos) {
      // Nếu payOS chưa cấu hình nhưng có nhận webhook test
      const orderCode = body?.data?.orderCode;
      if (orderCode && body?.code === '00') {
        await fulfillOrder(Number(orderCode));
        return NextResponse.json({ success: true, message: 'Fulfillment completed (unverified mode)' });
      }
      return NextResponse.json({ error: 'PayOS is not configured' }, { status: 400 });
    }

    // 1. Xác thực chữ ký webhook từ PayOS
    let webhookData: any;
    try {
      webhookData = await payos.webhooks.verify(body);
    } catch (verifyError: any) {
      console.warn('[PAYOS WEBHOOK] Chữ ký không hợp lệ:', verifyError.message);
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    // 2. Kiểm tra mã giao dịch thành công (code "00")
    if (webhookData && webhookData.code === '00') {
      const orderCode = Number(webhookData.orderCode);
      if (orderCode) {
        console.log(`[PAYOS WEBHOOK] Nhận thanh toán thành công cho đơn #${orderCode} - Số tiền: ${webhookData.amount}₫`);
        const fulfilled = await fulfillOrder(orderCode);
        return NextResponse.json({
          success: true,
          message: 'Order fulfilled successfully',
          orderCode,
          licenseKey: fulfilled.licenseKey,
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook received but not a success event' });
  } catch (error: any) {
    console.error('[PAYOS WEBHOOK ERROR]:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

