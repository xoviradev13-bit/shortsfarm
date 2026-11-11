import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldCheck, ArrowLeft, Lock, HardDrive, Key, CreditCard, EyeOff, UserCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Chính Sách Quyền Riêng Tư (Privacy Policy) | ShortsStack Studio',
  description: 'Cam kết bảo mật dữ liệu cá nhân, triết lý Local-First, bảo mật mã phần cứng HWID và an toàn thông tin khách hàng tại ShortsStack.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-rose-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Trang Chủ ShortsStack</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Cập nhật: 2026
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Header Badge & Title */}
        <div className="mb-10 text-center sm:text-left border-b border-slate-200 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Chính Sách Bảo Mật Thông Tin
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Chính Sách Quyền Riêng Tư & Bảo Mật Dữ Liệu
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            ShortsStack Studio cam kết tuyệt đối bảo vệ quyền riêng tư và tài sản dữ liệu của người dùng. Chúng tôi xây dựng phần mềm với triết lý <strong>Local-First (Ưu tiên xử lý cục bộ trên máy trạm)</strong> nhằm đảm bảo bạn giữ quyền kiểm soát 100% đối với dữ liệu video, tài khoản mạng xã hội và thông tin cá nhân.
          </p>
        </div>

        {/* Section List */}
        <div className="space-y-10 text-sm leading-relaxed text-slate-700">
          {/* Section 1: Local-First Core */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <h2 className="text-lg font-bold text-slate-900">Triết Lý Local-First: Dữ Liệu Thuộc Về Bạn</h2>
            </div>
            <p className="mb-3">
              Không giống các nền tảng SaaS điện toán đám mây yêu cầu bạn phải tải video hay cookie tài khoản lên máy chủ trung gian, ShortsStack hoạt động hoàn toàn cục bộ trên máy tính của bạn:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <HardDrive className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                <h3 className="font-bold text-slate-900 text-xs">Video & Nội Dung</h3>
                <p className="text-[11px] text-slate-500 mt-1">Lưu trữ 100% trên ổ cứng của bạn. Không gửi lên bất kỳ máy chủ nào.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <Lock className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                <h3 className="font-bold text-slate-900 text-xs">Cookie & Profile Nick</h3>
                <p className="text-[11px] text-slate-500 mt-1">Quản lý trực tiếp trong GPMLogin/GenLogin. ShortsStack không đọc hay lưu cookie.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <Key className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                <h3 className="font-bold text-slate-900 text-xs">Khóa API Cá Nhân</h3>
                <p className="text-[11px] text-slate-500 mt-1">Mã hóa AES cục bộ trên máy bạn. Chỉ kết nối trực tiếp đến ElevenLabs/OpenAI.</p>
              </div>
            </div>
          </section>

          {/* Section 2: Collected Data */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <h2 className="text-lg font-bold text-slate-900">Dữ Liệu Chúng Tôi Thu Thập & Mục Đích Sử Dụng</h2>
            </div>
            <p className="mb-3">
              Để quản lý bản quyền và hỗ trợ kỹ thuật, máy chủ của ShortsStack chỉ lưu trữ tối thiểu các thông tin sau:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 text-xs">
              <li>
                <strong>Địa chỉ Email:</strong> Được sử dụng để gửi mã kích hoạt License Key, hóa đơn thanh toán và các thông báo cập nhật tính năng quan trọng.
              </li>
              <li>
                <strong>Mã băm phần cứng (HWID Hash):</strong> Khi kích hoạt bản quyền, phần mềm tạo ra một chuỗi băm một chiều (SHA-256) từ thông tin linh kiện phần cứng (CPU/Mainboard). Chuỗi băm này không chứa thông tin cá nhân và không thể giải mã ngược. Mục đích duy nhất là xác thực quyền sử dụng trên đúng số lượng thiết bị đã đăng ký.
              </li>
              <li>
                <strong>Lịch sử giao dịch:</strong> Mã đơn hàng, thời gian thanh toán và số tiền thanh toán thông qua hệ thống ngân hàng VietQR để đối soát đơn hàng.
              </li>
            </ul>
          </section>

          {/* Section 3: Payment Security */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                3
              </div>
              <h2 className="text-lg font-bold text-slate-900">Bảo Mật Giao Dịch & Thanh Toán VietQR</h2>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed mb-3">
              Giao dịch mua License Key được thực hiện qua cổng thanh toán tự động VietQR chuẩn NAPAS (kết nối trực tiếp hệ thống ngân hàng số và PayOS/SePay).
            </p>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs text-slate-600">
                ShortsStack <strong>hoàn toàn không lưu trữ</strong> bất kỳ thông tin thẻ ngân hàng, số dư tài khoản hay mật khẩu ngân hàng của bạn. Mọi giao dịch được chứng thực trực tiếp qua ứng dụng Mobile Banking của chính ngân hàng bạn sử dụng.
              </div>
            </div>
          </section>

          {/* Section 4: Data Sharing */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                4
              </div>
              <h2 className="text-lg font-bold text-slate-900">Cam Kết Không Chia Sẻ Dữ Liệu</h2>
            </div>
            <div className="space-y-2 text-slate-600 text-xs leading-relaxed">
              <p>
                Chúng tôi cam kết <strong>KHÔNG bán, KHÔNG cho thuê, và KHÔNG tiết lộ</strong> địa chỉ email, danh sách tài khoản hay bất kỳ thông tin nào của khách hàng cho bất kỳ bên thứ ba, đại lý quảng cáo hay mạng lưới tiếp thị liên kết nào.
              </p>
              <p>
                Dữ liệu chỉ được cung cấp khi có yêu cầu bằng văn bản chính thức từ cơ quan thực thi pháp luật có thẩm quyền theo quy định của pháp luật Việt Nam.
              </p>
            </div>
          </section>

          {/* Section 5: Remote Assistance (UltraViewer) */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                5
              </div>
              <h2 className="text-lg font-bold text-slate-900">Quy Định Bảo Mật Khi Hỗ Trợ Qua UltraViewer</h2>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed mb-3">
              Khi bạn yêu cầu kỹ thuật viên hỗ trợ cài đặt hoặc sửa lỗi môi trường máy trạm thông qua UltraViewer / TeamViewer / AnyDesk:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-xs">
              <li>Bạn luôn có quyền quan sát toàn bộ thao tác của kỹ thuật viên trực tiếp trên màn hình và có quyền ngắt kết nối bất cứ lúc nào.</li>
              <li>Kỹ thuật viên chỉ thao tác trong phạm vi thư mục cài đặt phần mềm ShortsStack và cấu hình môi trường liên quan (GPMLogin, GenLogin, NVIDIA Drivers, FFmpeg).</li>
              <li>Kỹ thuật viên tuyệt đối không truy cập vào thư mục tài liệu cá nhân, ảnh riêng tư hay trình duyệt cá nhân của khách hàng.</li>
            </ul>
          </section>

          {/* Section 6: Contact */}
          <section className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl">
            <h2 className="text-lg font-bold text-white mb-2">Yêu Cầu Về Quyền Riêng Tư & Xóa Dữ Liệu</h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Nếu bạn muốn kiểm tra thông tin bản quyền đã đăng ký hoặc yêu cầu xóa địa chỉ email khỏi danh sách thông báo cập nhật, vui lòng gửi yêu cầu đến chúng tôi:
            </p>
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
              <span className="text-slate-400 block mb-0.5">Bộ Phận Bảo Mật Thông Tin ShortsStack:</span>
              <span className="font-semibold text-rose-400">privacy@shortsstack.com • Hotline Zalo / Telegram</span>
            </div>
          </section>
        </div>

        {/* Back Button Bottom */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tôi Đã Hiểu & Quay Lại Trang Chủ</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

