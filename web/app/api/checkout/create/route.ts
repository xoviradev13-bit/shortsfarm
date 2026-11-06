import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPayOS, isPayOSConfigured, buildDirectVietQrUrl, DIRECT_VIETQR_CONFIG } from '@/lib/payos';
import { PLAN_CONFIGS } from '@/lib/license-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, email, name } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng cung cấp địa chỉ email hợp lệ để nhận mã bản quyền.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name && typeof name === 'string' && name.trim()) ? name.trim() : 'Khách hàng';

    const selectedPlan = PLAN_CONFIGS[plan];
    if (!selectedPlan) {
      return NextResponse.json(
        { success: false, message: 'Gói bản quyền không hợp lệ. Vui lòng chọn monthly, yearly hoặc lifetime.' },
        { status: 400 }
      );
    }

    // Tạo mã đơn hàng duy nhất dạng số nguyên (từ 100000 đến 2000000000)
    // Dùng timestamp mili giây lấy 6 chữ số ngẫu nhiên kết hợp
    const timestamp = Math.floor(Date.now() / 1000); // 10 chữ số
    const randomSuffix = Math.floor(Math.random() * 899 + 100);
    // orderCode vừa vặn trong chuẩn 32-bit int Postgres: (timestamp % 1000000) * 1000 + randomSuffix
    const orderCode = ((timestamp % 1000000) * 1000) + randomSuffix;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shortsstack.vercel.app';
    const description = `SF${orderCode}`.slice(0, 25); // Nội dung chuyển khoản chuẩn VietQR

    let checkoutUrl = '';
    let qrCode = '';
    let accountNo = DIRECT_VIETQR_CONFIG.accountNo;
    let accountName = DIRECT_VIETQR_CONFIG.accountName;
    let bankBin = DIRECT_VIETQR_CONFIG.bankId;
    let paymentLinkId = '';

    const payos = getPayOS();
    if (isPayOSConfigured() && payos) {
      try {
        const paymentData = {
          orderCode,
          amount: selectedPlan.amount,
          description,
          returnUrl: `${siteUrl}?payment=success&orderCode=${orderCode}`,
          cancelUrl: `${siteUrl}?payment=cancel&orderCode=${orderCode}`,
          buyerEmail: cleanEmail,
          buyerName: cleanName,
        };

        const paymentLink = await payos.paymentRequests.create(paymentData);
        checkoutUrl = paymentLink.checkoutUrl || '';
        qrCode = paymentLink.qrCode || '';
        accountNo = paymentLink.accountNumber || accountNo;
        accountName = paymentLink.accountName || accountName;
        bankBin = paymentLink.bin || bankBin;
        paymentLinkId = paymentLink.paymentLinkId || '';
      } catch (payosError: any) {
        console.warn('[PayOS] Lỗi gọi API payos, chuyển sang VietQR fallback:', payosError.message);
      }
    }

    // Tạo ảnh VietQR động chuẩn NAPAS
    const qrImageUrl = buildDirectVietQrUrl({
      amount: selectedPlan.amount,
      description,
      bankId: bankBin,
      accountNo,
      accountName,
    });

    // Lưu đơn hàng vào cơ sở dữ liệu
    const order = await prisma.order.create({
      data: {
        orderCode,
        customerEmail: cleanEmail,
        customerName: cleanName,
        plan: selectedPlan.code,
        amount: selectedPlan.amount,
        status: 'pending',
        paymentLinkId,
        checkoutUrl,
        qrCode: qrCode || qrImageUrl,
        accountNo,
        accountName,
        bankBin,
      },
    });

    return NextResponse.json({
      success: true,
      orderCode: order.orderCode,
      plan: selectedPlan.code,
      planName: selectedPlan.name,
      amount: selectedPlan.amount,
      customerEmail: cleanEmail,
      description,
      accountNo,
      accountName,
      bankBin,
      qrImageUrl,
      checkoutUrl,
    });
  } catch (error: any) {
    console.error('[CHECKOUT CREATE ERROR]:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi khởi tạo đơn hàng: ' + (error.message || 'Hệ thống bận') },
      { status: 500 }
    );
  }
}

