import nodemailer, { type Transporter } from 'nodemailer';

interface ReceiptEmailParams {
  to: string;
  customerName?: string;
  licenseKey: string;
  plan: string;
  amount: number;
  expiresAt: Date | null;
  maxDevices: number;
}

const PLAN_NAMES: Record<string, string> = {
  pro_1pc: 'Gói Cá Nhân (1 PC - Vĩnh Viễn)',
  studio_3pc: 'Gói Studio (3 PCs - Vĩnh Viễn)',
  agency_5pc: 'Gói Agency (5 PCs - Vĩnh Viễn)',
  monthly: 'Gói Cá Nhân (1 PC - Vĩnh Viễn)',
  yearly: 'Gói Studio (3 PCs - Vĩnh Viễn)',
  lifetime: 'Gói Agency (5 PCs - Vĩnh Viễn)',
};

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

export async function sendReceiptEmail(params: ReceiptEmailParams): Promise<{ success: boolean; message?: string }> {
  const { to, customerName, licenseKey, plan, amount, expiresAt, maxDevices } = params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shortsstack.vercel.app';
  const planDisplay = PLAN_NAMES[plan] || plan;
  const expiresDisplay = expiresAt
    ? expiresAt.toLocaleDateString('vi-VN')
    : 'Vĩnh viễn (Trọn đời không giới hạn)';
  const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  const subject = `[ShortsStack] Kích Hoạt Mã Bản Quyền Thành Công - ${planDisplay}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #070A13; color: #E2E8F0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0D121F; border: 1px solid #1E293B; border-radius: 16px; padding: 32px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #F43F5E; font-size: 26px; margin: 0;">ShortsStack AI Studio</h1>
      <p style="color: #94A3B8; font-size: 14px; margin-top: 6px;">Hệ thống Nuôi Kênh & Tự Động Reup Video Đa Nền Tảng</p>
    </div>

    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
      <h2 style="color: #34D399; font-size: 18px; margin: 0;">🎉 Thanh Toán Thành Công!</h2>
      <p style="color: #A7F3D0; font-size: 14px; margin: 6px 0 0 0;">Cảm ơn bạn đã lựa chọn phần mềm ShortsStack.</p>
    </div>

    <div style="margin-bottom: 24px;">
      <p style="color: #94A3B8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">MÃ BẢN QUYỀN CỦA BẠN:</p>
      <div style="background: #1E293B; border: 2px dashed #F43F5E; border-radius: 12px; padding: 16px; text-align: center;">
        <span style="font-family: monospace; font-size: 22px; font-weight: bold; color: #FFFFFF; letter-spacing: 2px;">
          ${licenseKey}
        </span>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
      <tr style="border-bottom: 1px solid #1E293B;">
        <td style="padding: 10px 0; color: #94A3B8;">Khách hàng:</td>
        <td style="padding: 10px 0; color: #FFFFFF; text-align: right; font-weight: 600;">${customerName || to}</td>
      </tr>
      <tr style="border-bottom: 1px solid #1E293B;">
        <td style="padding: 10px 0; color: #94A3B8;">Gói bản quyền:</td>
        <td style="padding: 10px 0; color: #FFFFFF; text-align: right; font-weight: 600;">${planDisplay}</td>
      </tr>
      <tr style="border-bottom: 1px solid #1E293B;">
        <td style="padding: 10px 0; color: #94A3B8;">Số máy kích hoạt:</td>
        <td style="padding: 10px 0; color: #FFFFFF; text-align: right; font-weight: 600;">${maxDevices} máy tính (HWID)</td>
      </tr>
      <tr style="border-bottom: 1px solid #1E293B;">
        <td style="padding: 10px 0; color: #94A3B8;">Thời hạn sử dụng:</td>
        <td style="padding: 10px 0; color: #34D399; text-align: right; font-weight: 600;">${expiresDisplay}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #94A3B8;">Tổng tiền đã thanh toán:</td>
        <td style="padding: 10px 0; color: #F43F5E; text-align: right; font-weight: bold; font-size: 16px;">${formattedAmount}</td>
      </tr>
    </table>

    <div style="background: #111827; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #CBD5E1;">
      <h3 style="color: #FFFFFF; font-size: 15px; margin: 0 0 8px 0;">🚀 Hướng dẫn kích hoạt:</h3>
      <ol style="margin: 0; padding-left: 18px; line-height: 1.6;">
        <li>Tải và cài đặt phần mềm nếu bạn chưa cài: <a href="${siteUrl}/api/download" style="color: #F43F5E; text-decoration: none; font-weight: bold;">Tải Bộ Cài (.exe)</a></li>
        <li>Mở ứng dụng <strong>ShortsStack</strong> trên máy tính của bạn.</li>
        <li>Dán mã bản quyền ở trên vào hộp kích hoạt và bấm <strong>Kích hoạt</strong>.</li>
        <li>Phần mềm sẽ tự động đồng bộ và mở khóa toàn bộ tính năng!</li>
      </ol>
    </div>

    <div style="text-align: center; border-top: 1px solid #1E293B; padding-top: 16px; font-size: 12px; color: #64748B;">
      <p>Cần hỗ trợ đổi máy (Reset HWID) hoặc kỹ thuật? Liên hệ Admin qua Telegram hoặc Email.</p>
      <p>© 2026 ShortsStack Systems. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

  // 1. Kiểm tra Nodemailer SMTP (Khuyên dùng - Gmail App Password hoặc Custom SMTP)
  const transporter = getTransporter();
  if (transporter) {
    try {
      const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'ShortsStack <license@shortsstack.com>';
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      console.log(`[EMAIL] Đã gửi biên nhận qua SMTP Nodemailer thành công tới ${to}`);
      return { success: true };
    } catch (err: any) {
      console.warn(`[EMAIL] Gửi qua Nodemailer SMTP thất bại: ${err.message}`);
    }
  }

  // 2. Kiểm tra Resend API (Nếu bạn cấu hình RESEND_API_KEY)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'ShortsStack <license@shortsstack.com>',
          to: [to],
          subject,
          html,
        }),
      });

      if (res.ok) {
        console.log(`[EMAIL] Đã gửi biên nhận thành công tới ${to} qua Resend`);
        return { success: true };
      }
    } catch (err: any) {
      console.warn(`[EMAIL] Gửi qua Resend gặp lỗi: ${err.message}`);
    }
  }

  // 3. Fallback: Console log (khi chưa cấu hình SMTP hay Resend)
  console.log(`[EMAIL DISPATCH] Đơn hàng cho ${to} | Key: ${licenseKey} | Plan: ${plan}`);
  return { success: true, message: 'Logged to console' };
}

export interface ContactEmailParams {
  name: string;
  email: string;
  phone?: string;
  topic?: string;
  message: string;
}

export async function sendContactEmail(params: ContactEmailParams): Promise<{ success: boolean; message?: string }> {
  const { name, email, phone, topic, message } = params;
  const to = 'thenguyenfiner@gmail.com';
  const subject = `[ShortsStack Liên Hệ Mới] từ ${name} - ${topic || 'Tư Vấn Phần Mềm'}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #e11d48; margin-top: 0;">Yêu Cầu Liên Hệ Mới từ ShortsStack Portal</h2>
      <p style="color: #475569; font-size: 14px;">Bạn vừa nhận được một yêu cầu liên hệ hoặc đăng ký tư vấn từ khách hàng:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; width: 35%;">Họ và tên:</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Email khách hàng:</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Số điện thoại / Zalo:</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">${phone || 'Chưa cung cấp'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Chủ đề quan tâm:</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; color: #e11d48; font-weight: bold;">${topic || 'Tư vấn phần mềm'}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; vertical-align: top;">Nội dung lời nhắn:</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; white-space: pre-wrap;">${message}</td>
        </tr>
      </table>

      <div style="margin-top: 20px; padding: 12px; background-color: #f1f5f9; border-radius: 8px; font-size: 12px; color: #64748b;">
        Email này được gửi tự động từ biểu mẫu liên hệ trên website ShortsStack.
      </div>
    </div>
  `;

  // 1. Gửi qua SMTP
  const transporter = getTransporter();
  if (transporter) {
    try {
      const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'ShortsStack Support <thenguyenfiner@gmail.com>';
      await transporter.sendMail({
        from,
        to,
        replyTo: email,
        subject,
        html,
      });
      console.log(`[CONTACT EMAIL] Đã gửi thông tin liên hệ từ ${email} tới ${to} qua SMTP`);
      return { success: true };
    } catch (err: any) {
      console.warn(`[CONTACT EMAIL] Lỗi gửi qua SMTP: ${err.message}`);
    }
  }

  // 2. Gửi qua Resend
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'ShortsStack <contact@shortsstack.com>',
          to: [to],
          reply_to: email,
          subject,
          html,
        }),
      });

      if (res.ok) {
        console.log(`[CONTACT EMAIL] Đã gửi thông tin liên hệ tới ${to} qua Resend`);
        return { success: true };
      }
    } catch (err: any) {
      console.warn(`[CONTACT EMAIL] Lỗi gửi qua Resend: ${err.message}`);
    }
  }

  // 3. Fallback
  console.log(`[CONTACT FORM DISPATCH] Form từ: ${name} (${email}) | SĐT: ${phone} | Topic: ${topic} | Lời nhắn: ${message}`);
  return { success: true, message: 'Received and logged' };
}
