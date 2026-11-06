import crypto from 'crypto';

const SIGNING_SECRET = process.env.LICENSE_SIGNING_SECRET || process.env.ADMIN_SECRET_KEY || 'ShortsFarmLicenseSecret2026!#';

/**
 * So sánh 2 chuỗi bí mật với thời gian hằng số (Constant-Time String Comparison)
 * Ngăn chặn tấn công dò mật khẩu theo độ trễ xử lý (Timing Attacks / Side-Channel Attacks).
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Luôn chạy timingSafeEqual với chính nó để giữ thời gian thực thi đồng nhất
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sinh chữ ký mã hóa HMAC-SHA256 cho bản quyền (Tamper-Proof Digital Signature)
 * Đảm bảo dữ liệu bản quyền không thể bị chỉnh sửa trái phép trong CSDL SQLite cục bộ.
 */
export function generateLicenseSignature(
  licenseKey: string,
  hwid: string,
  plan: string,
  expiresAt: string | Date | null
): string {
  const expStr = expiresAt instanceof Date ? expiresAt.toISOString() : (expiresAt || 'lifetime');
  const payload = `${licenseKey.trim().toUpperCase()}:${hwid.trim().toUpperCase()}:${plan.toLowerCase()}:${expStr}`;
  return crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
}

/**
 * Kiểm tra tính hợp lệ của chữ ký HMAC
 */
export function verifyLicenseSignature(
  licenseKey: string,
  hwid: string,
  plan: string,
  expiresAt: string | Date | null,
  signature: string
): boolean {
  const expected = generateLicenseSignature(licenseKey, hwid, plan, expiresAt);
  return constantTimeCompare(signature, expected);
}

/**
 * Làm sạch và kiểm tra định dạng License Key (Input Validation & Sanitization)
 */
export function sanitizeLicenseKey(key: unknown): string {
  if (typeof key !== 'string') return '';
  const trimmed = key.trim().toUpperCase();
  // Chỉ cho phép chữ, số và dấu gạch nối, độ dài tối đa 64 ký tự
  return trimmed.slice(0, 64).replace(/[^A-Z0-9\-_]/g, '');
}

/**
 * Làm sạch và kiểm tra mã HWID
 */
export function sanitizeHwid(hwid: unknown): string {
  if (typeof hwid !== 'string') return '';
  const trimmed = hwid.trim().toUpperCase();
  // Giới hạn 128 ký tự, chỉ chứa chữ, số, gạch nối và hai chấm
  return trimmed.slice(0, 128).replace(/[^A-Z0-9\-_:]/g, '');
}

/**
 * Làm sạch chuỗi văn bản thông thường (ngăn chặn XSS & Injection)
 */
export function sanitizeText(text: unknown, maxLen = 100): string {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, maxLen).replace(/[<>'"&]/g, '');
}

