import { NextRequest, NextResponse } from 'next/server';
import { fulfillOrder } from '@/lib/license-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Kiểm tra API Key của SePay nếu có cấu hình
    const sepayApiKey = process.env.SEPAY_API_KEY;
    if (sepayApiKey) {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.replace(/Apikey\s+/i, '').trim();
      if (token !== sepayApiKey) {
        return NextResponse.json({ error: 'Unauthorized SePay Webhook' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { content, transferAmount, transferType } = body;

    // Chỉ xử lý giao dịch tiền vào (transferType === 'in')
    if (transferType !== 'in') {
      return NextResponse.json({ success: true, message: 'Ignored outgoing transaction' });
    }

    // 2. Tìm mã đơn hàng SFXXXXXX trong nội dung chuyển khoản
    const match = String(content || '').match(/SF(\d+)/i);
    if (!match || !match[1]) {
      return NextResponse.json({ success: true, message: 'No matching SF order code found in content' });
    }

    const orderCode = parseInt(match[1], 10);
    console.log(`[SEPAY WEBHOOK] Tìm thấy đơn hàng #${orderCode} với số tiền ${transferAmount}₫`);

    const fulfilled = await fulfillOrder(orderCode);

    return NextResponse.json({
      success: true,
      message: 'Order fulfilled via SePay webhook',
      orderCode,
      licenseKey: fulfilled.licenseKey,
    });
  } catch (error: any) {
    console.error('[SEPAY WEBHOOK ERROR]:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

