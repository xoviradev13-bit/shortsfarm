import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const licenses = await prisma.license.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, licenseKey: true, plan: true, customerEmail: true, status: true, createdAt: true, maxDevices: true, expiresAt: true }
  });

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, orderCode: true, plan: true, customerEmail: true, status: true, amount: true, licenseKey: true, createdAt: true }
  });

  console.log('\n===== BẢNG LICENSES (5 mới nhất) =====');
  console.table(licenses.map(l => ({
    id: l.id,
    key: l.licenseKey,
    plan: l.plan,
    email: l.customerEmail,
    status: l.status,
    maxDevices: l.maxDevices,
    expiresAt: l.expiresAt?.toLocaleDateString('vi-VN') ?? 'Vĩnh viễn',
    createdAt: l.createdAt.toLocaleString('vi-VN'),
  })));

  console.log('\n===== BẢNG ORDERS (5 mới nhất) =====');
  console.table(orders.map(o => ({
    orderCode: o.orderCode,
    plan: o.plan,
    email: o.customerEmail,
    amount: o.amount.toLocaleString('vi-VN') + '₫',
    status: o.status,
    licenseKey: o.licenseKey ?? '(chưa có)',
    createdAt: o.createdAt.toLocaleString('vi-VN'),
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());

