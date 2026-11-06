import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendReceiptEmail } from './email';

export interface PlanConfig {
  code: string;
  name: string;
  amount: number;
  durationDays: number | null; // null = lifetime
  maxDevices: number;
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  pro_1pc: {
    code: 'pro_1pc',
    name: 'Gói Cá Nhân (1 PC - Vĩnh Viễn)',
    amount: 499000,
    durationDays: null,
    maxDevices: 1,
  },
  studio_3pc: {
    code: 'studio_3pc',
    name: 'Gói Studio (3 PCs - Vĩnh Viễn)',
    amount: 3990000,
    durationDays: null,
    maxDevices: 3,
  },
  agency_5pc: {
    code: 'agency_5pc',
    name: 'Gói Agency (5 PCs - Vĩnh Viễn)',
    amount: 8500000,
    durationDays: null,
    maxDevices: 5,
  },
  // Tương thích ngược với các đơn hàng cũ
  monthly: {
    code: 'pro_1pc',
    name: 'Gói Cá Nhân (1 PC - Vĩnh Viễn)',
    amount: 499000,
    durationDays: null,
    maxDevices: 1,
  },
  yearly: {
    code: 'studio_3pc',
    name: 'Gói Studio (3 PCs - Vĩnh Viễn)',
    amount: 3990000,
    durationDays: null,
    maxDevices: 3,
  },
  lifetime: {
    code: 'agency_5pc',
    name: 'Gói Agency (5 PCs - Vĩnh Viễn)',
    amount: 8500000,
    durationDays: null,
    maxDevices: 5,
  },
};

export function generateLicenseKey(plan: string): string {
  const prefix = 'SS';
  let planTag = 'PRO';
  if (plan === 'studio_3pc' || plan === 'yearly') planTag = 'STU';
  else if (plan === 'agency_5pc' || plan === 'lifetime') planTag = 'AGE';
  else if (plan === 'trial') planTag = 'TRI';

  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part4 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${planTag}-${part1}-${part2}-${part3}-${part4}`;
}

export async function fulfillOrder(orderCode: number) {
  const order = await prisma.order.findUnique({
    where: { orderCode },
  });

  if (!order) {
    throw new Error(`Không tìm thấy đơn hàng với mã: ${orderCode}`);
  }

  // Nếu đơn hàng đã được xử lý trước đó, trả về key hiện tại
  if (order.status === 'paid' && order.licenseKey) {
    return {
      success: true,
      alreadyPaid: true,
      orderCode: order.orderCode,
      licenseKey: order.licenseKey,
      plan: order.plan,
    };
  }

  const planInfo = PLAN_CONFIGS[order.plan] || PLAN_CONFIGS.monthly;
  const newLicenseKey = generateLicenseKey(order.plan);

  let expiresAt: Date | null = null;
  if (planInfo.durationDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + planInfo.durationDays);
  }

  // 1. Tạo bản quyền trong bảng licenses
  const license = await prisma.license.create({
    data: {
      licenseKey: newLicenseKey,
      customerName: order.customerName || 'Khách hàng VietQR',
      customerEmail: order.customerEmail,
      plan: order.plan,
      maxDevices: planInfo.maxDevices,
      expiresAt,
      status: 'active',
      notes: `Tự động tạo từ đơn hàng VietQR #${order.orderCode} (${order.amount.toLocaleString('vi-VN')}₫)`,
    },
  });

  // 2. Cập nhật trạng thái đơn hàng sang 'paid'
  const updatedOrder = await prisma.order.update({
    where: { orderCode },
    data: {
      status: 'paid',
      licenseKey: newLicenseKey,
    },
  });

  // 3. Gửi email biên nhận kèm mã key cho khách hàng
  try {
    await sendReceiptEmail({
      to: order.customerEmail,
      customerName: order.customerName || undefined,
      licenseKey: newLicenseKey,
      plan: order.plan,
      amount: order.amount,
      expiresAt,
      maxDevices: planInfo.maxDevices,
    });
  } catch (emailErr) {
    console.warn('[EMAIL] Lỗi gửi email biên nhận:', emailErr);
  }

  return {
    success: true,
    alreadyPaid: false,
    orderCode: updatedOrder.orderCode,
    licenseKey: newLicenseKey,
    plan: order.plan,
    expiresAt,
    maxDevices: planInfo.maxDevices,
    customerEmail: order.customerEmail,
  };
}

