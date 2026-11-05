import { PayOS } from '@payos/node';

const clientId = process.env.PAYOS_CLIENT_ID || '';
const apiKey = process.env.PAYOS_API_KEY || '';
const checksumKey = process.env.PAYOS_CHECKSUM_KEY || '';

let payosInstance: PayOS | null = null;

if (clientId && apiKey && checksumKey) {
  try {
    payosInstance = new PayOS({
      clientId,
      apiKey,
      checksumKey,
    });
  } catch (err) {
    console.warn('[PayOS] Khởi tạo SDK thất bại:', err);
  }
}

export function getPayOS(): PayOS | null {
  return payosInstance;
}

export function isPayOSConfigured(): boolean {
  return Boolean(clientId && apiKey && checksumKey && payosInstance);
}

// Cấu hình tài khoản ngân hàng dự phòng (cho VietQR trực tiếp nếu chưa có payOS)
export const DIRECT_VIETQR_CONFIG = {
  bankId: process.env.VIETQR_BANK_ID || 'MB', // Mã BIN hoặc mã ngân hàng (MB, VCB, TCB, ACB, VPB)
  accountNo: process.env.VIETQR_ACCOUNT_NO || '0988888888',
  accountName: process.env.VIETQR_ACCOUNT_NAME || 'NGUYEN VAN A',
  template: 'compact2', // compact, compact2, qr_only
};

export function buildDirectVietQrUrl(params: {
  amount: number;
  description: string;
  bankId?: string;
  accountNo?: string;
  accountName?: string;
}): string {
  const bank = params.bankId || DIRECT_VIETQR_CONFIG.bankId;
  const accNo = params.accountNo || DIRECT_VIETQR_CONFIG.accountNo;
  const accName = encodeURIComponent(params.accountName || DIRECT_VIETQR_CONFIG.accountName);
  const desc = encodeURIComponent(params.description);
  return `https://img.vietqr.io/image/${bank}-${accNo}-${DIRECT_VIETQR_CONFIG.template}.png?amount=${params.amount}&addInfo=${desc}&accountName=${accName}`;
}

