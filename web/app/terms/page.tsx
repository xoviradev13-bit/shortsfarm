import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldAlert, ArrowLeft, CheckCircle2, AlertTriangle, FileText, Scale, RefreshCw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Điều Khoản Dịch Vụ (Terms of Service) | ShortsStack Studio',
  description: 'Quy định sử dụng phần mềm ShortsStack, chính sách cấp phép bản quyền HWID, chính sách không hoàn tiền và tuyên bố miễn trừ trách nhiệm nền tảng.',
};

export default function TermsOfServicePage() {
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
              Phiên bản hiệu lực: 2026
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Header Badge & Title */}
        <div className="mb-10 text-center sm:text-left border-b border-slate-200 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold uppercase tracking-wider mb-4">
            <Scale className="w-3.5 h-3.5" />
            Văn Bản Pháp Lý Chính Thức
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Điều Khoản Dịch Vụ & Phạm Vi Cấp Phép
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Chào mừng bạn đến với <strong>ShortsStack Studio</strong>. Khi bạn tải xuống, cài đặt hoặc thanh toán mua License Key bản quyền phần mềm ShortsStack, bạn đồng ý vô điều kiện với toàn bộ các điều khoản được quy định dưới đây. Vui lòng đọc kỹ trước khi sử dụng.
          </p>
        </div>

        {/* Section List */}
        <div className="space-y-10 text-sm leading-relaxed text-slate-700">
          {/* Section 1 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <h2 className="text-lg font-bold text-slate-900">Bản Chất Phần Mềm & Mô Hình Hoạt Động (Local-First)</h2>
            </div>
            <p className="mb-3">
              ShortsStack là phần mềm máy tính độc lập (Desktop Application) chạy trên hệ điều hành Windows 64-bit. Phần mềm cung cấp các công cụ:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mb-4 text-slate-600">
              <li>Biên tập video ngắn 9:16 tự động (Cắt ghép, lồng tiếng AI ElevenLabs, phụ đề tự động, hiệu ứng Ken Burns, Color Jitter).</li>
              <li>Hỗ trợ người dùng tải nội dung công khai từ các nền tảng video ngắn nhằm mục đích nghiên cứu và biên tập sáng tạo.</li>
              <li>Tự động hóa thao tác trình duyệt qua giao thức Chrome DevTools Protocol (CDP) kết nối trực tiếp với Antidetect Browser (GPMLogin, GenLogin).</li>
            </ul>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <strong>Nguyên tắc Local-First:</strong> Toàn bộ dữ liệu video, kịch bản, cấu hình tài khoản và tài nguyên đồ họa được xử lý cục bộ trên phần cứng máy trạm của bạn. ShortsStack không có quyền truy cập vào tài khoản mạng xã hội hay nội dung sáng tạo của bạn.
            </div>
          </section>

          {/* Section 2: License & HWID */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <h2 className="text-lg font-bold text-slate-900">Chính Sách Cấp Phép Bản Quyền (License Key & HWID)</h2>
            </div>
            <p className="mb-3">
              Khi mua bản quyền ShortsStack, bạn được cấp một License Key duy nhất tương ứng với gói đã chọn:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Gói Cá Nhân Pro (1 PC)
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  Kích hoạt cố định trên 01 máy tính thông qua mã nhận diện phần cứng (HWID). Giới hạn 3 - 5 Profiles antidetect và render tuần tự đơn luồng.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200">
                <h3 className="font-bold text-rose-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-rose-600" />
                  Gói Studio Team (3 PCs)
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  Kích hoạt đồng thời trên tối đa 03 máy tính độc lập. Không giới hạn profile, mở khóa render đa luồng tối ưu hóa GPU NVENC.
                </p>
              </div>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex gap-3 items-start">
              <RefreshCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Quy định đổi máy (Reset HWID):</strong> License Key được khóa theo linh kiện phần cứng (CPU/Mainboard). 
                Đối với gói Cá nhân, việc đổi máy do nâng cấp phần cứng hoặc chuyển đổi máy trạm được hỗ trợ tối đa 2 lần/tháng. Gói Studio được hỗ trợ reset linh hoạt khi có sự thay đổi máy trạm trong cùng một đội nhóm.
              </div>
            </div>
          </section>

          {/* Section 3: No-Refund Policy */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">
                3
              </div>
              <h2 className="text-lg font-bold text-slate-900">Chính Sách Hoàn Tiền (No-Refund Policy)</h2>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs mb-4">
              <strong>CHÍNH SÁCH BÁN HÀNG DỨT ĐIỂM:</strong> Do tính chất sản phẩm phần mềm kỹ thuật số đi kèm mã kích hoạt (License Key) sử dụng trọn đời, <strong>chúng tôi KHÔNG áp dụng chính sách hoàn tiền sau khi mã License đã được tạo hoặc kích hoạt thành công trên máy tính người dùng</strong>.
            </div>
            <p className="mb-2">
              Chúng tôi cung cấp video demo chi tiết, tài liệu mô tả thông số kỹ thuật và hỗ trợ giải đáp thắc mắc trước khi mua hàng. Khách hàng có trách nhiệm:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
              <li>Kiểm tra cấu hình máy tính cá nhân đảm bảo tương thích với Windows 10/11 64-bit và có cấu hình phần cứng phù hợp để render video.</li>
              <li>Chủ động trang bị các tài nguyên bên thứ ba (Proxy mạng sạch, tài khoản GPMLogin/GenLogin, API Key ElevenLabs nếu có nhu cầu lồng tiếng giọng AI cao cấp).</li>
              <li>Trường hợp lỗi do phần mềm ShortsStack không hoạt động được trên môi trường Windows chuẩn, kỹ thuật viên sẽ hỗ trợ khắc phục qua UltraViewer/TeamViewer cho đến khi phần mềm hoạt động bình thường.</li>
            </ul>
          </section>

          {/* Section 4: Platform Disclaimer (Extremely Important) */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">
                4
              </div>
              <h2 className="text-lg font-bold text-slate-900">Tuyên Bố Miễn Trừ Trách Nhiệm Nền Tảng (Disclaimer)</h2>
            </div>
            <div className="space-y-3 text-slate-600 text-xs leading-relaxed">
              <p>
                <strong>4.1. Tính độc lập:</strong> ShortsStack là công cụ phần mềm quản trị và biên tập độc lập, không trực thuộc, không liên kết, không được tài trợ hay bảo trợ bởi TikTok Pte. Ltd., ByteDance Ltd., Google LLC (YouTube), Meta Platforms Inc., GPMLogin hay GenLogin.
              </p>
              <p>
                <strong>4.2. Rủi ro tài khoản mạng xã hội:</strong> Các nền tảng mạng xã hội có toàn quyền thay đổi thuật toán kiểm duyệt nội dung, chính sách cộng đồng và điều kiện tham gia quỹ kiếm tiền vào bất kỳ lúc nào. ShortsStack cung cấp các thuật toán hỗ trợ tối ưu tính độc bản và tự động hóa thao tác theo hành vi người dùng thật, nhưng <strong>KHÔNG cam kết và KHÔNG chịu trách nhiệm</strong> đối với bất kỳ rủi ro nào liên quan đến việc tài khoản của người dùng bị hạn chế tương tác (shadowban), khóa kênh, từ chối bật kiếm tiền hay đình chỉ tài khoản do vi phạm chính sách của bên thứ ba.
              </p>
              <p>
                <strong>4.3. Bản quyền nội dung sáng tạo:</strong> Người dùng hoàn toàn tự chịu trách nhiệm pháp lý đối với toàn bộ hình ảnh, âm thanh, video và nội dung khai thác khi sử dụng phần mềm. Chúng tôi khuyến nghị người dùng luôn tuân thủ luật sở hữu trí tuệ và quy chuẩn sử dụng hợp lý (Fair Use).
              </p>
            </div>
          </section>

          {/* Section 5: Support & Updates */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">
                5
              </div>
              <h2 className="text-lg font-bold text-slate-900">Phạm Vi Hỗ Trợ Kỹ Thuật & Cập Nhật Phần Mềm</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 text-xs">
              <li>
                <strong>Hỗ trợ kỹ thuật:</strong> Áp dụng cho cả gói Cá Nhân Pro và Studio Team. Kỹ thuật viên hỗ trợ kiểm tra cài đặt ban đầu, hướng dẫn kết nối Antidetect Browser và xử lý lỗi vận hành qua UltraViewer/TeamViewer hoặc Telegram.
              </li>
              <li>
                <strong>Cập nhật phiên bản:</strong> Cả 2 gói đều nhận các bản cập nhật định kỳ bao gồm vá lỗi và cải tiến tính năng biên tập video hoàn toàn miễn phí.
              </li>
              <li>
                <strong>Giới hạn can thiệp:</strong> ShortsStack không hỗ trợ các vấn đề nằm ngoài phạm vi phần mềm như: lỗi hệ điều hành Windows bị nhiễm virus, lỗi mạng Proxy của bên cung cấp thứ ba, hoặc tư vấn kháng cáo tài khoản mạng xã hội.
              </li>
            </ul>
          </section>

          {/* Section 6: Contact */}
          <section className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl">
            <h2 className="text-lg font-bold text-white mb-2">Thông Tin Liên Hệ & Giải Đáp Pháp Lý</h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Nếu bạn có bất kỳ câu hỏi nào về Điều Khoản Dịch Vụ hoặc cần tư vấn chính sách bản quyền, vui lòng liên hệ trực tiếp với chúng tôi:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block mb-0.5">Kênh Hỗ Trợ Trực Tuyến:</span>
                <span className="font-semibold text-rose-400">Telegram / Zalo Hotline</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block mb-0.5">Email Pháp Lý & Bản Quyền:</span>
                <span className="font-semibold text-rose-400">support@shortsstack.com</span>
              </div>
            </div>
          </section>
        </div>

        {/* Back Button Bottom */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Đồng Ý & Quay Lại Trang Chủ</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

