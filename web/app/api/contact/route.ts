import { NextResponse } from 'next/server';
import { sendContactEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, topic, message } = body;

    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim();
    const trimmedMessage = String(message || '').trim();
    const trimmedPhone = phone ? String(phone).trim() : '';
    const trimmedTopic = topic ? String(topic).trim() : 'Tư vấn phần mềm';

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng điền đầy đủ họ tên, email và nội dung lời nhắn.' },
        { status: 400 }
      );
    }

    if (trimmedName.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Họ tên phải có ít nhất 2 ký tự.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { success: false, error: 'Địa chỉ email không đúng định dạng (ví dụ: name@gmail.com).' },
        { status: 400 }
      );
    }

    if (trimmedPhone && !/^[\d+\-\s().]{8,20}$/.test(trimmedPhone)) {
      return NextResponse.json(
        { success: false, error: 'Số điện thoại không đúng định dạng (tối thiểu 8-10 số).' },
        { status: 400 }
      );
    }

    if (trimmedMessage.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Nội dung tin nhắn quá ngắn (tối thiểu 5 ký tự).' },
        { status: 400 }
      );
    }

    const result = await sendContactEmail({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone || undefined,
      topic: trimmedTopic,
      message: trimmedMessage,
    });

    return NextResponse.json({
      success: true,
      message: 'Tin nhắn của bạn đã được gửi thành công tới thenguyenfiner@gmail.com!',
    });
  } catch (error: any) {
    console.error('[API CONTACT ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Có lỗi xảy ra khi gửi tin nhắn.' },
      { status: 500 }
    );
  }
}

