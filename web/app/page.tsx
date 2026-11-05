'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Download,
  ShieldCheck,
  Cpu,
  Layers,
  Video,
  Play,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Monitor,
  RefreshCw,
  Globe,
  Sliders,
  Flame,
  Zap,
} from 'lucide-react';

export default function LandingPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    window.location.href = '/api/download';
    setTimeout(() => setDownloading(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#070A13] text-gray-100 flex flex-col selection:bg-pink-600 selection:text-white">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#070A13]/80 border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                TikTokFarm
              </span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 font-medium">
                AI Studio 2.1
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-pink-400 transition-colors">Tính Năng</a>
            <a href="#browsers" className="hover:text-pink-400 transition-colors">Antidetect Browser</a>
            <a href="#pricing" className="hover:text-pink-400 transition-colors">Bảng Giá</a>
            <a href="#faq" className="hover:text-pink-400 transition-colors">Hỏi Đáp</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-xs font-medium text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-800 hover:border-gray-700 transition"
            >
              Quản Trị Key
            </Link>
            <button
              onClick={handleDownload}
              className="relative group overflow-hidden px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 transition shadow-lg shadow-pink-600/30 active:scale-95 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Đang chuyển hướng...' : 'Tải Về Ngay'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-20 pb-28 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-pink-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500/10 to-indigo-500/10 border border-pink-500/20 text-xs text-pink-300 font-medium mb-6">
            <Flame className="w-3.5 h-3.5 text-pink-400" />
            <span>Phiên bản 2.1.0: Hỗ trợ Douyin, Xiaohongshu & AdsPower/Dolphin</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight sm:leading-[1.15]">
            Hệ Thống Nuôi Kênh & Tự Động Reup Video AI{' '}
            <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-amber-300 bg-clip-text text-transparent">
              Đa Nền Tảng
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Tải video Douyin, Xiaohongshu, YouTube không watermark. Tự động lách thuật toán bằng công nghệ AI
            (cắt ghép, voiceover, lật khung hình, hiệu ứng Ken Burns) và lập lịch đăng tự động qua GPM-Login,
            AdsPower, Dolphin Anty, GenLogin.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold text-lg shadow-xl shadow-pink-600/40 hover:shadow-pink-600/60 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <Download className="w-5 h-5" />
              <span>Tải Bản Windows (64-bit)</span>
            </button>
            <a
              href="#pricing"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gray-900/80 hover:bg-gray-800 text-gray-200 font-semibold text-lg border border-gray-800 hover:border-gray-700 transition flex items-center justify-center gap-2"
            >
              <span>Xem Bảng Giá Key</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </a>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tương thích Windows 10/11
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Dùng thử miễn phí
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Khóa bản quyền HWID an toàn
            </span>
          </div>

          {/* Software Preview Card */}
          <div className="mt-14 relative rounded-2xl border border-gray-800 bg-[#0d121f]/90 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 mb-4 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 font-mono text-gray-300">TikTokFarm Desktop Dashboard</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px]">
                ● Live Scheduler Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                <span className="text-xs text-gray-400 font-medium">Trình duyệt kết nối</span>
                <div className="mt-2 text-lg font-bold text-white flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-pink-400" /> GPM / AdsPower / Dolphin
                </div>
                <p className="mt-1 text-xs text-emerald-400">Đã nhận diện 12 Profiles</p>
              </div>

              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                <span className="text-xs text-gray-400 font-medium">Nguồn video tải về</span>
                <div className="mt-2 text-lg font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" /> Douyin & Xiaohongshu
                </div>
                <p className="mt-1 text-xs text-cyan-400">Bóc tách sạch watermark 100%</p>
              </div>

              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                <span className="text-xs text-gray-400 font-medium">AI Lách Bản Quyền</span>
                <div className="mt-2 text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Ken Burns & Voiceover
                </div>
                <p className="mt-1 text-xs text-amber-400">Tự thay nhạc nền viral</p>
              </div>

              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                <span className="text-xs text-gray-400 font-medium">Hàng đợi đăng</span>
                <div className="mt-2 text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-rose-400" /> TikTok + Shorts + Reels
                </div>
                <p className="mt-1 text-xs text-rose-400">24 video trong hàng đợi</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Antidetect Browser Ecosystem */}
      <section id="browsers" className="py-20 border-y border-gray-800/80 bg-gradient-to-b from-[#070A13] via-[#0B0F1E] to-[#070A13]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest text-pink-400 font-semibold mb-2">TƯƠNG THÍCH MỌI TRÌNH DUYỆT</h2>
            <p className="text-3xl font-extrabold text-white">Nuôi Kênh Không Lo Checkpoint với Antidetect</p>
            <p className="mt-3 text-gray-400 text-sm">
              Tích hợp sẵn bộ điều khiển Playwright tự động kết nối qua API cục bộ, giữ nguyên cookies và vân tay máy tính.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'GPM-Login', desc: 'Dò cổng tự động v1/v3, kết nối siêu tốc', port: 'Port 9495 / 19995' },
              { name: 'AdsPower', desc: 'Hỗ trợ SunBrowser, API điều khiển Local', port: 'Port 50325' },
              { name: 'Dolphin Anty', desc: 'Khởi động profile với cờ Automation', port: 'Port 3001' },
              { name: 'GenLogin', desc: 'Trình duyệt thuần Việt, tối ưu đa luồng', port: 'Port 55550' },
            ].map((b, i) => (
              <div key={i} className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800 hover:border-pink-500/40 transition group">
                <div className="w-12 h-12 rounded-xl bg-gray-800/80 flex items-center justify-center mb-4 group-hover:bg-pink-500/20 group-hover:text-pink-400 transition">
                  <Monitor className="w-6 h-6 text-gray-300 group-hover:text-pink-400" />
                </div>
                <h3 className="font-bold text-white text-lg">{b.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{b.desc}</p>
                <div className="mt-4 inline-block px-2.5 py-1 rounded-md bg-gray-800 text-[11px] font-mono text-gray-300">
                  {b.port}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Core Features */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs uppercase tracking-widest text-pink-400 font-semibold mb-2">TÍNH NĂNG VƯỢT TRỘI</h2>
          <p className="text-3xl font-extrabold text-white">Tất Cả Công Cụ Bạn Cần Để Xây Kênh Triệu View</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 hover:border-gray-700 transition">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-6">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Tải Video 7 Nền Tảng</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Bóc tách video sạch không logo từ Douyin (TikTok TQ), Xiaohongshu (Tiểu Hồng Thư), YouTube, Facebook, Instagram, Weibo và Bilibili.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 hover:border-gray-700 transition">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-6">
              <Sliders className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Nạp Thư Mục Video Có Sẵn</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Tắt chế độ tự tải RSS bất kỳ lúc nào để chuyển sang nạp hàng loạt video MP4 từ ổ cứng cá nhân, tự động đưa vào hàng đợi render.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 hover:border-gray-700 transition">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-6">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">AI Lách Bản Quyền Độc Quyền</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Tự động cắt khung, đổi tốc độ vi mô, hiệu ứng chuyển động Ken Burns pan & zoom, xóa audio gốc và chèn nhạc nền xu hướng.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 hover:border-gray-700 transition">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Đăng Đa Nền Tảng Tự Động</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Hỗ trợ tự động lập lịch đăng song song lên TikTok, YouTube Shorts và Facebook Reels thông qua trình duyệt an toàn.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 hover:border-gray-700 transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Khóa Bản Quyền HWID</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Bảo vệ phần mềm bằng mã máy tính duy nhất, xác thực máy chủ Supabase, ngăn chặn chia sẻ phần mềm bất hợp pháp.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 hover:border-gray-700 transition">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-6">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Cập Nhật Tự Động (Auto-Update)</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Tự động thông báo và tải các bản vá lỗi khi có thuật toán mạng xã hội mới mà không cần cài đặt lại từ đầu.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Pricing Section */}
      <section id="pricing" className="py-24 bg-gradient-to-b from-[#070A13] via-[#0a0f1c] to-[#070A13] border-t border-gray-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest text-pink-400 font-semibold mb-2">BẢNG GIÁ BẢN QUYỀN</h2>
            <p className="text-3xl font-extrabold text-white">Chọn Gói Phù Hợp Cho Quy Mô Của Bạn</p>
            <p className="mt-3 text-gray-400 text-sm">Mỗi license gắn liền với máy tính của bạn và có thể yêu cầu reset máy khi đổi thiết bị.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-gray-800 text-gray-300">GÓI THÁNG</span>
                <h3 className="text-2xl font-bold text-white mt-4">Cá Nhân (Pro 1 PC)</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">499.000₫</span>
                  <span className="ml-2 text-sm text-gray-400">/ tháng</span>
                </div>
                <p className="mt-3 text-xs text-gray-400">Dành cho cá nhân xây từ 1 - 5 kênh tự động.</p>

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Kích hoạt 1 máy tính (HWID)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Hỗ trợ GPM & AdsPower</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Tải Douyin, Xiaohongshu, YT</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Render lách bản quyền tự động</li>
                </ul>
              </div>

              <button
                onClick={handleDownload}
                className="mt-8 w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm transition"
              >
                Tải Về Dùng Thử
              </button>
            </div>

            {/* Pro / Popular */}
            <div className="p-8 rounded-2xl bg-gradient-to-b from-[#161c2e] to-[#0d121f] border-2 border-pink-500/80 shadow-2xl shadow-pink-500/10 flex flex-col justify-between relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-[11px] font-bold text-white tracking-wide uppercase">
                PHỔ BIẾN NHẤT
              </div>

              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-pink-500/20 text-pink-300">GÓI NĂM</span>
                <h3 className="text-2xl font-bold text-white mt-4">Studio (2 PCs)</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">3.990.000₫</span>
                  <span className="ml-2 text-sm text-gray-400">/ năm</span>
                </div>
                <p className="mt-3 text-xs text-pink-300">Tiết kiệm 35% so với thanh toán từng tháng.</p>

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Kích hoạt cùng lúc 2 máy tính</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Hỗ trợ cả 4 Antidetect Browser</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Đăng cả TikTok, YT Shorts, FB Reels</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Tự do đổi máy (Reset HWID 3 lần/năm)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Hỗ trợ kỹ thuật ưu tiên 24/7</li>
                </ul>
              </div>

              <button
                onClick={handleDownload}
                className="mt-8 w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-pink-600/30 transition"
              >
                Nhận Bản Quyền Ngay
              </button>
            </div>

            {/* Lifetime Agency */}
            <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300">TRỌN ĐỜI</span>
                <h3 className="text-2xl font-bold text-white mt-4">Agency Vĩnh Viễn</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">8.500.000₫</span>
                  <span className="ml-2 text-sm text-gray-400">/ trọn đời</span>
                </div>
                <p className="mt-3 text-xs text-gray-400">Thanh toán 1 lần duy nhất, update miễn phí mãi mãi.</p>

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Kích hoạt tối đa 5 máy tính</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Không giới hạn số lượng profile & video</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Reset HWID không giới hạn số lần</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Quyền truy cập tính năng mới sớm nhất</li>
                </ul>
              </div>

              <button
                onClick={handleDownload}
                className="mt-8 w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm transition"
              >
                Liên Hệ Mua Gói Agency
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-white text-center mb-10">Câu Hỏi Thường Gặp (FAQ)</h2>
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-gray-900/50 border border-gray-800">
            <h4 className="font-semibold text-white">Phần mềm có làm khoá tài khoản TikTok/YouTube/Facebook không?</h4>
            <p className="mt-2 text-sm text-gray-400">
              Không. Khác với các tool dùng API bên thứ ba dễ bị nền tảng phát hiện, TikTokFarm điều khiển trực tiếp các trình duyệt Antidetect (GPM, AdsPower, Dolphin, GenLogin) với đầy đủ cookies, canvas fingerprint thật, giống hệt người dùng lướt web thủ công.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-gray-900/50 border border-gray-800">
            <h4 className="font-semibold text-white">Tôi đổi máy tính mới thì bản quyền có dùng tiếp được không?</h4>
            <p className="mt-2 text-sm text-gray-400">
              Có. Bạn chỉ cần gửi email hoặc liên hệ Admin để thực hiện "Reset HWID", hệ thống sẽ gỡ máy cũ để bạn kích hoạt mã bản quyền sang máy tính mới trong vòng 1 phút.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-gray-900/50 border border-gray-800">
            <h4 className="font-semibold text-white">Cách nhận các bản cập nhật mới nhất?</h4>
            <p className="mt-2 text-sm text-gray-400">
              Mỗi khi mở ứng dụng, phần mềm sẽ tự động kiểm tra xem có bản vá hoặc tính năng mới hay không và hiển thị thông báo để bạn cập nhật chỉ bằng 1 cú nhấp chuột.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="mt-auto py-8 border-t border-gray-800 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 TikTokFarm Studio. Toàn bộ quyền được bảo lưu.</p>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-gray-300">Tính năng</a>
            <a href="#pricing" className="hover:text-gray-300">Bảng giá</a>
            <Link href="/admin" className="hover:text-pink-400">Cổng Quản Trị</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

