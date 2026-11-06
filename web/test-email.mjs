import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

// Parse .env manually so we don't need extra dependencies
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.SMTP_PORT || '465', 10);
const secure = process.env.SMTP_SECURE === 'true' || port === 465;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.EMAIL_FROM || user;

console.log('--- ĐANG KIỂM TRA KẾT NỐI SMTP GMAIL ---');
console.log(`Host: ${host}`);
console.log(`Port: ${port}`);
console.log(`User: ${user}`);
console.log(`From: ${from}`);
console.log(`Pass length: ${pass ? pass.length : 0} chars`);

if (!user || !pass) {
  console.error('LỖI: Chưa cấu hình SMTP_USER hoặc SMTP_PASS!');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user,
    pass,
  },
});

async function run() {
  try {
    console.log('1. Đang xác thực (verify) thông tin đăng nhập SMTP...');
    await transporter.verify();
    console.log('✅ Xác thực SMTP Google thành công!');

    console.log(`2. Đang gửi email kiểm tra tới ${user}...`);
    const info = await transporter.sendMail({
      from: `ShortsStack Studio <${from}>`,
      to: user,
      subject: '🚀 [ShortsStack] Email Test Kích Hoạt Bản Quyền Thành Công',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #070A13; color: #E2E8F0; padding: 24px; border-radius: 12px; max-width: 550px; margin: 0 auto; border: 1px solid #1E293B;">
          <h2 style="color: #F43F5E; margin-top: 0;">ShortsStack AI Studio</h2>
          <p style="color: #34D399; font-weight: bold; font-size: 16px;">🎉 Cấu hình Nodemailer SMTP thành công!</p>
          <p style="color: #94A3B8; font-size: 14px;">Hệ thống email tự động đã sẵn sàng gửi License Key cho khách hàng ngay khi có thanh toán VietQR.</p>
          <div style="background: #1E293B; border: 1px dashed #F43F5E; padding: 12px; border-radius: 8px; margin: 16px 0; text-align: center;">
            <code style="color: #FFFFFF; font-size: 16px; font-weight: bold;">TEST-KEY-SHORTFARM-2026-SUCCESS</code>
          </div>
          <p style="font-size: 12px; color: #64748B;">Thời gian gửi: ${new Date().toLocaleString('vi-VN')}</p>
        </div>
      `,
    });

    console.log('✅ Gửi email test thành công!');
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Phản hồi máy chủ: ${info.response}`);
  } catch (error) {
    console.error('❌ Lỗi khi gửi email:', error);
  }
}

run();

