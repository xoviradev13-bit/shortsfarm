/**
 * High-performance in-memory Rate Limiter
 * Bảo vệ chống tấn công Brute-force & Denial of Service (DoS)
 */

interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

const store = new Map<string, RateLimitRecord>();

// Định kỳ dọn dẹp các bản ghi quá hạn mỗi 10 phút để tránh rò rỉ bộ nhớ
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    store.forEach((record, key) => {
      if (now - record.firstAttemptAt > 60 * 60 * 1000 && (!record.blockedUntil || now > record.blockedUntil)) {
        store.delete(key);
      }
    });
  }, 10 * 60 * 1000);
}

export function checkRateLimit(
  identifier: string,
  maxAttempts = 10,
  windowMs = 15 * 60 * 1000
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const record = store.get(identifier);

  // Nếu IP/Identifier đang bị tạm khóa
  if (record?.blockedUntil && now < record.blockedUntil) {
    return { allowed: false, retryAfterMs: record.blockedUntil - now };
  }

  // Khởi tạo hoặc đặt lại chu kỳ mới
  if (!record || now - record.firstAttemptAt > windowMs) {
    store.set(identifier, { count: 1, firstAttemptAt: now });
    return { allowed: true };
  }

  record.count += 1;

  if (record.count > maxAttempts) {
    record.blockedUntil = now + windowMs;
    console.warn(`[SECURITY] Chặn '${identifier}' vì vượt ngưỡng ${maxAttempts} yêu cầu / ${Math.round(windowMs / 60000)} phút.`);
    return { allowed: false, retryAfterMs: windowMs };
  }

  return { allowed: true };
}

export function recordFailedAttempt(identifier: string, maxAttempts = 10, windowMs = 15 * 60 * 1000): void {
  const now = Date.now();
  const record = store.get(identifier);
  if (record) {
    record.count += 1;
    if (record.count > maxAttempts) {
      record.blockedUntil = now + windowMs;
    }
  } else {
    store.set(identifier, { count: 1, firstAttemptAt: now });
  }
}

export function resetAttempts(identifier: string): void {
  store.delete(identifier);
}
