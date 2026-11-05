'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Download,
  ShieldCheck,
  Layers,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Monitor,
  RefreshCw,
  Globe,
  Sliders,
  Flame,
  Zap,
  Copy,
  Check,
  QrCode,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
  Play,
  Youtube,
  Radio,
  Terminal,
} from 'lucide-react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://shortsfarm.vercel.app';

const JSON_LD_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#software`,
      name: 'ShortsFarm',
      operatingSystem: 'Windows 10, Windows 11 (64-bit)',
      applicationCategory: 'MultimediaApplication',
      description:
        'Phần mềm tự động tải video Douyin, Xiaohongshu, render lách bản quyền AI và auto upload lên TikTok Beta, YouTube Shorts, Facebook Reels qua Antidetect Browser.',
      url: SITE_URL,
      downloadUrl: `${SITE_URL}/api/download`,
      softwareVersion: '2.1.0',
      fileSize: '85MB',
      offers: {
        '@type': 'Offer',
        price: '499000',
        priceCurrency: 'VND',
        availability: 'https://schema.org/InStock',
        priceValidUntil: '2027-12-31',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        reviewCount: '184',
        bestRating: '5',
        worstRating: '1',
      },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'ShortsFarm Systems',
      url: SITE_URL,
      logo: `${SITE_URL}/apple-touch-icon.png`,
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Phần mềm có làm khoá tài khoản TikTok/YouTube/Facebook không?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Không. Khác với các tool dùng API bên thứ ba dễ bị nền tảng phát hiện, ShortsFarm điều khiển trực tiếp các trình duyệt Antidetect (GPMLogin, GenLogin) với đầy đủ cookies, canvas fingerprint thật, giống hệt người dùng lướt web thủ công.',
          },
        },
        {
          '@type': 'Question',
          name: 'Tôi đổi máy tính mới thì bản quyền có dùng tiếp được không?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Có. Bạn chỉ cần gửi email hoặc liên hệ Admin để thực hiện "Reset HWID", hệ thống sẽ gỡ máy cũ để bạn kích hoạt mã bản quyền sang máy tính mới trong vòng 1 phút.',
          },
        },
        {
          '@type': 'Question',
          name: 'Cách nhận các bản cập nhật mới nhất?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Mỗi khi mở ứng dụng, phần mềm sẽ tự động kiểm tra xem có bản vá hoặc tính năng mới hay không và hiển thị thông báo để bạn cập nhật chỉ bằng 1 cú nhấp chuột.',
          },
        },
      ],
    },
  ],
};

export default function LandingPage() {
  const [downloading, setDownloading] = useState(false);
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const youtubeDemoUrl = process.env.NEXT_PUBLIC_YOUTUBE_DEMO_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  // VietQR Checkout States
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{
    code: 'monthly' | 'yearly' | 'lifetime';
    name: string;
    amount: number;
    description: string;
  } | null>(null);

  const [checkoutStep, setCheckoutStep] = useState<'input' | 'payment' | 'success'>('input');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Payment Details
  const [orderData, setOrderData] = useState<{
    orderCode: number;
    amount: number;
    description: string;
    accountNo: string;
    accountName: string;
    bankBin: string;
    qrImageUrl: string;
    checkoutUrl?: string;
  } | null>(null);

  // Success Key Details
  const [licenseData, setLicenseData] = useState<{
    licenseKey: string;
    plan: string;
    expiresAt: string | null;
    maxDevices: number;
  } | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('');

  const handleDownload = () => {
    setDownloading(true);
    window.location.href = '/api/download';
    setTimeout(() => setDownloading(false), 3000);
  };

  const openCheckoutModal = (
    code: 'monthly' | 'yearly' | 'lifetime',
    name: string,
    amount: number,
    description: string
  ) => {
    setSelectedPlan({ code, name, amount, description });
    setCheckoutStep('input');
    setCheckoutError('');
    setLicenseData(null);
    setOrderData(null);
    setCheckoutModalOpen(true);
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail || !customerEmail.includes('@')) {
      setCheckoutError('Vui lòng nhập địa chỉ email hợp lệ để nhận mã bản quyền.');
      return;
    }
    if (!selectedPlan) return;

    setCreatingPayment(true);
    setCheckoutError('');

    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan.code,
          email: customerEmail,
          name: customerName,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setCheckoutError(data.message || 'Lỗi khởi tạo thanh toán VietQR.');
        setCreatingPayment(false);
        return;
      }

      setOrderData({
        orderCode: data.orderCode,
        amount: data.amount,
        description: data.description,
        accountNo: data.accountNo,
        accountName: data.accountName,
        bankBin: data.bankBin,
        qrImageUrl: data.qrImageUrl,
        checkoutUrl: data.checkoutUrl,
      });
      setLastCheckedTime(new Date().toLocaleTimeString('vi-VN'));
      setCheckoutStep('payment');
    } catch (err: any) {
      setCheckoutError(err.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setCreatingPayment(false);
    }
  };

  // Live Polling kiểm tra trạng thái thanh toán từ Ngân hàng / Webhook
  useEffect(() => {
    if (checkoutStep !== 'payment' || !orderData?.orderCode) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/status?orderCode=${orderData.orderCode}`);
        const data = await res.json();
        setLastCheckedTime(new Date().toLocaleTimeString('vi-VN'));

        if (data.success && data.status === 'paid' && data.licenseKey) {
          setLicenseData({
            licenseKey: data.licenseKey,
            plan: data.plan,
            expiresAt: data.expiresAt,
            maxDevices: data.maxDevices || 1,
          });
          setCheckoutStep('success');
        }
      } catch (err) {
        // Bỏ qua lỗi polling tạm thời
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [checkoutStep, orderData?.orderCode]);

  return (
    <div className="min-h-screen bg-[#070A13] text-gray-100 flex flex-col selection:bg-pink-600 selection:text-white">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_DATA) }}
      />
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#070A13]/80 border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                ShortsFarm
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

        <div className="max-w-6xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-pink-500/10 to-indigo-500/10 border border-pink-500/20 text-xs text-pink-300 font-medium mb-6">
            <Flame className="w-3.5 h-3.5 text-pink-400" />
            <span>Phiên bản 2.1.0: Hỗ trợ Douyin, Xiaohongshu & GPMLogin / GenLogin</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight sm:leading-[1.15]">
            ShortsFarm - Nuôi Kênh & Tự Động Reup Video AI{' '}
            <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-amber-300 bg-clip-text text-transparent">
              Đa Nền Tảng
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Tải video Douyin, Xiaohongshu, YouTube không watermark. Tự động lách thuật toán bằng công nghệ AI
            (cắt ghép, voiceover ElevenLabs, lật khung hình, hiệu ứng Ken Burns) và lập lịch đăng tự động qua GPMLogin & GenLogin.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold text-lg shadow-xl shadow-pink-600/40 hover:shadow-pink-600/60 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <Download className="w-5 h-5" />
              <span>Tải Bản Windows (64-bit)</span>
            </button>

            <button
              onClick={() => setYoutubeModalOpen(true)}
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-red-600/15 hover:bg-red-600/25 text-red-300 hover:text-white font-semibold text-lg border border-red-500/30 hover:border-red-500/50 transition flex items-center justify-center gap-2.5 shadow-lg shadow-red-600/10 active:scale-95"
            >
              <Youtube className="w-5 h-5 text-red-500" />
              <span>Xem Demo Trên YouTube</span>
            </button>

            <a
              href="#pricing"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gray-900/80 hover:bg-gray-800 text-gray-200 font-semibold text-lg border border-gray-800 hover:border-gray-700 transition flex items-center justify-center gap-2"
            >
              <span>Xem Bảng Giá Key</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tương thích Windows 10/11
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Dùng thử miễn phí
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Khóa bản quyền HWID an toàn
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Kết nối GPMLogin & GenLogin
            </span>
          </div>

          {/* =============================================================== */}
          {/* SOFTWARE APP UI DEMO SHOWCASE */}
          {/* =============================================================== */}
          <div className="mt-14 relative rounded-2xl border border-gray-800/90 bg-[#0A0E1A] shadow-2xl overflow-hidden text-left">
            {/* Desktop Window Title Bar */}
            <div className="flex items-center justify-between border-b border-gray-800/80 px-4 py-3 bg-[#070A13]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-3 font-mono text-xs text-gray-300 font-semibold">
                  ShortsFarm Desktop Engine v2.1.0 - [Auto-Pilot Pipeline: ĐANG CHẠY]
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Scheduler Active
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 font-mono text-[10px]">
                  NVENC GPU Acceleration
                </span>
              </div>
            </div>

            {/* Desktop UI Body: Sidebar + Main Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
              {/* App Left Sidebar */}
              <div className="hidden lg:block lg:col-span-3 border-r border-gray-800/80 bg-[#0B0F1D]/80 p-4 text-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-gray-800">
                  <div className="w-7 h-7 rounded-lg bg-pink-600 flex items-center justify-center font-bold text-white text-xs">
                    SF
                  </div>
                  <div>
                    <span className="font-bold text-white block">SHORTSFARM</span>
                    <span className="text-[10px] text-gray-400">AI Engine & Auto Upload</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-2 block mb-1">
                    QUY TRÌNH TỰ ĐỘNG
                  </span>
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-pink-600/20 text-pink-400 font-semibold border border-pink-500/30">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Chiến Dịch Tự Động</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-gray-400 hover:text-white">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Studio Biên Tập Video</span>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-2 block mb-1">
                    TÀI NGUYÊN & PROFILES
                  </span>
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-gray-400 hover:text-white">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Quản Lý Video & Tải Douyin</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-gray-400 hover:text-white">
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    <span>Phòng Thu ElevenLabs</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-gray-400 hover:text-white">
                    <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Dàn Nick GPMLogin & GenLogin</span>
                  </div>
                </div>

                <div className="pt-6">
                  <div className="p-3 rounded-xl bg-gray-900/90 border border-gray-800 text-[11px]">
                    <span className="text-gray-400 block">Dàn Profile Đang Chạy:</span>
                    <span className="font-bold text-emerald-400 text-sm">12 / 12 Profiles Sạch</span>
                    <span className="text-[10px] text-gray-400 block mt-1">GPMLogin Local Port: 9495</span>
                  </div>
                </div>
              </div>

              {/* App Workspace Area */}
              <div className="lg:col-span-9 p-4 sm:p-6 bg-gradient-to-b from-[#0D1222] to-[#080B14] flex flex-col justify-between">
                <div>
                  {/* Top 4 KPI Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                      <span className="text-[11px] text-gray-400 block">Trình duyệt kết nối</span>
                      <span className="font-bold text-white text-sm flex items-center gap-1.5 mt-1">
                        <Monitor className="w-3.5 h-3.5 text-pink-400" /> GPMLogin & GenLogin
                      </span>
                      <span className="text-[10px] text-emerald-400 block mt-0.5">● 12 Profiles Online</span>
                    </div>

                    <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                      <span className="text-[11px] text-gray-400 block">Nguồn Video Tải</span>
                      <span className="font-bold text-white text-sm flex items-center gap-1.5 mt-1">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" /> Douyin & Xiaohongshu
                      </span>
                      <span className="text-[10px] text-cyan-400 block mt-0.5">Sạch 100% Watermark</span>
                    </div>

                    <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                      <span className="text-[11px] text-gray-400 block">AI Lách Bản Quyền</span>
                      <span className="font-bold text-white text-sm flex items-center gap-1.5 mt-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Ken Burns & Voiceover
                      </span>
                      <span className="text-[10px] text-amber-400 block mt-0.5">ElevenLabs + Pitch 1.03x</span>
                    </div>

                    <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                      <span className="text-[11px] text-gray-400 block">Hàng Đợi Đăng Auto</span>
                      <span className="font-bold text-white text-sm flex items-center gap-1.5 mt-1">
                        <Zap className="w-3.5 h-3.5 text-rose-400" /> TikTok + Shorts + Reels
                      </span>
                      <span className="text-[10px] text-rose-400 block mt-0.5">24 Video Trong Hàng Đợi</span>
                    </div>
                  </div>

                  {/* Active Rendering & Live Account Tracker Split */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Left: 9:16 Video Canvas Simulation */}
                    <div className="md:col-span-5 p-4 rounded-xl bg-gray-900/90 border border-gray-800 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="w-36 h-56 rounded-lg bg-gradient-to-b from-gray-800 to-black border-2 border-pink-500/40 relative flex flex-col justify-between p-2 shadow-xl">
                        <div className="flex items-center justify-between text-[9px] text-gray-400">
                          <span className="px-1.5 py-0.5 rounded bg-black/60 text-emerald-400 font-mono">9:16 Dọc</span>
                          <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300">60s Beta</span>
                        </div>

                        {/* Animated Video Mockup Center */}
                        <div className="text-center my-auto">
                          <div className="w-10 h-10 rounded-full bg-pink-600/30 border border-pink-500 flex items-center justify-center mx-auto mb-2 text-pink-400">
                            <Play className="w-4 h-4 fill-pink-400 ml-0.5" />
                          </div>
                          <span className="px-2 py-1 rounded bg-black/80 text-[10px] font-bold text-yellow-300 block border border-yellow-500/30 shadow">
                            "HOOK 3S GIỮ CHÂN VIEW"
                          </span>
                        </div>

                        <div className="text-[8px] text-gray-400 bg-black/70 p-1 rounded font-mono">
                          Lách: Pitch 1.03x + Ken Burns
                        </div>
                      </div>

                      <div className="mt-3 text-center w-full">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-gray-400">Render Video_Douyin_04.mp4</span>
                          <span className="text-pink-400 font-bold">78%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
                          <div className="w-[78%] h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full" />
                        </div>
                      </div>
                    </div>

                    {/* Right: GPMLogin / GenLogin Account Tracking Feed */}
                    <div className="md:col-span-7 space-y-2.5">
                      <div className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                        <span>DÀN PROFILE GPMLOGIN & GENLOGIN:</span>
                        <span className="text-[11px] text-pink-400">Auto-Check 10K Follower</span>
                      </div>

                      <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 font-bold flex items-center justify-center">
                            GPM
                          </div>
                          <div>
                            <span className="font-bold text-white block">@creator_beta_us</span>
                            <span className="text-[10px] text-gray-400">Profile #01 (Proxy US Sạch)</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400 block">12.4K Follower 🏆</span>
                          <span className="text-[10px] text-emerald-300">Đạt Quỹ Sáng Tạo</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center">
                            GEN
                          </div>
                          <div>
                            <span className="font-bold text-white block">@mmo_affiliate_vn</span>
                            <span className="text-[10px] text-gray-400">GenLogin CDP (Port 55550)</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-white block">8.9K Follower</span>
                          <span className="text-[10px] text-gray-400">Đang đẩy view (+1.2K/ngày)</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 font-bold flex items-center justify-center">
                            GPM
                          </div>
                          <div>
                            <span className="font-bold text-white block">@viral_daily_clips</span>
                            <span className="text-[10px] text-gray-400">Profile #05 (Đăng Shorts & Reels)</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-cyan-400 block">Đã Đăng Xong</span>
                          <span className="text-[10px] text-gray-400">10:30 AM Hôm nay</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom App Bar: Terminal Log + YouTube Watch Button */}
                <div className="mt-4 pt-3 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-gray-400 w-full sm:w-auto overflow-hidden text-ellipsis whitespace-nowrap">
                    <Terminal className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <span>[LOG] Đã bóc sạch watermark Douyin 1080p -&gt; Upload GPMLogin thành công!</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setYoutubeModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition shrink-0 active:scale-95"
                  >
                    <Youtube className="w-4 h-4" />
                    <span>Xem Demo Thao Tác Thực Tế</span>
                  </button>
                </div>
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
              Tích hợp sẵn bộ điều khiển Playwright tự động kết nối qua API cục bộ GPMLogin & GenLogin, giữ nguyên cookies và vân tay máy tính.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: 'GPMLogin',
                desc: 'Tự động dò cổng API Local v1/v3, kết nối CDP siêu tốc, giữ nguyên phiên làm việc và proxy sạch.',
                port: 'Port 9495 / 19995',
                badge: 'Tích hợp sâu',
              },
              {
                name: 'GenLogin',
                desc: 'Trình duyệt Antidetect đa luồng thuần Việt, công nghệ tự động hóa CDP không chiếm chuột/bàn phím.',
                port: 'Port 55550',
                badge: 'Tối ưu ZeroRAM',
              },
              {
                name: 'Vân Tay Kháng Checkpoint',
                desc: 'Mô phỏng 100% Canvas, WebGL, AudioContext, Font, ClientRects như thiết bị vật lý thật.',
                port: 'Fingerprint V2',
                badge: 'Anti-Detect 100%',
              },
              {
                name: 'Proxy Độc Lập Cho Từng Nick',
                desc: 'Gắn cố định IPv4/IPv6, HTTP, SOCKS5 xoay IP tự động, ngăn chặn liên đới hàng loạt nick.',
                port: 'Multi-Proxy IP',
                badge: 'Proxy Riêng Biệt',
              },
            ].map((b, i) => (
              <div key={i} className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800 hover:border-pink-500/40 transition group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-800/80 flex items-center justify-center group-hover:bg-pink-500/20 group-hover:text-pink-400 transition">
                      <Monitor className="w-6 h-6 text-gray-300 group-hover:text-pink-400" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      {b.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-lg">{b.name}</h3>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">{b.desc}</p>
                </div>
                <div className="mt-5 inline-block px-2.5 py-1 rounded-md bg-gray-800 text-[11px] font-mono text-gray-300 w-fit">
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
            <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 flex flex-col justify-between hover:border-pink-500/30 transition">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-gray-800 text-gray-300">GÓI THÁNG</span>
                  <span className="text-[11px] text-pink-400 font-medium">1 lần mua</span>
                </div>
                <h3 className="text-2xl font-bold text-white mt-4">Cá Nhân (Pro 1 PC)</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">499.000₫</span>
                  <span className="ml-2 text-sm text-gray-400">/ 30 ngày</span>
                </div>
                <p className="mt-3 text-xs text-gray-400">Thanh toán 1 lần duy nhất, dùng trọn vẹn 30 ngày (không trừ tiền định kỳ).</p>

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Kích hoạt 1 máy tính (HWID)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Hỗ trợ GPMLogin & GenLogin</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Tải Douyin, Xiaohongshu, YT</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Render lách bản quyền tự động</li>
                </ul>
              </div>

              <div className="mt-8 space-y-2">
                <button
                  onClick={() => openCheckoutModal('monthly', 'Cá Nhân Pro (1 PC)', 499000, 'Kích hoạt 1 máy tính - Hạn 30 ngày')}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-pink-600/20 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Mua Bản Quyền (VietQR)</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full py-2.5 rounded-xl bg-gray-900/60 hover:bg-gray-800 text-gray-400 hover:text-white font-medium text-xs transition border border-gray-800"
                >
                  Tải Về Dùng Thử Trước
                </button>
              </div>
            </div>

            {/* Pro / Popular */}
            <div className="p-8 rounded-2xl bg-gradient-to-b from-[#161c2e] to-[#0d121f] border-2 border-pink-500/80 shadow-2xl shadow-pink-500/10 flex flex-col justify-between relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-[11px] font-bold text-white tracking-wide uppercase">
                PHỔ BIẾN NHẤT
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-pink-500/20 text-pink-300">GÓI NĂM</span>
                  <span className="text-[11px] text-emerald-400 font-medium">Tiết kiệm 35%</span>
                </div>
                <h3 className="text-2xl font-bold text-white mt-4">Studio (2 PCs)</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">3.990.000₫</span>
                  <span className="ml-2 text-sm text-gray-400">/ 1 năm</span>
                </div>
                <p className="mt-3 text-xs text-pink-300">Thanh toán 1 lần duy nhất, kích hoạt cùng lúc 2 máy trong 365 ngày.</p>

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Kích hoạt cùng lúc 2 máy tính</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Tự động hóa GPMLogin & GenLogin</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Đăng cả TikTok, YT Shorts, FB Reels</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Tự do đổi máy (Reset HWID 3 lần/năm)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Hỗ trợ kỹ thuật ưu tiên 24/7</li>
                </ul>
              </div>

              <div className="mt-8 space-y-2">
                <button
                  onClick={() => openCheckoutModal('yearly', 'Studio Pro (2 PCs)', 3990000, 'Kích hoạt 2 máy tính - Hạn 365 ngày')}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-amber-500 hover:from-pink-500 hover:to-amber-400 text-white font-bold text-sm shadow-xl shadow-pink-600/30 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Mua Bản Quyền (VietQR)</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full py-2.5 rounded-xl bg-gray-900/60 hover:bg-gray-800 text-gray-400 hover:text-white font-medium text-xs transition border border-gray-800"
                >
                  Tải Về Dùng Thử Trước
                </button>
              </div>
            </div>

            {/* Lifetime Agency */}
            <div className="p-8 rounded-2xl bg-[#0d121f] border border-gray-800 flex flex-col justify-between hover:border-amber-500/30 transition">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300">TRỌN ĐỜI</span>
                  <span className="text-[11px] text-amber-400 font-medium">Mua 1 lần vĩnh viễn</span>
                </div>
                <h3 className="text-2xl font-bold text-white mt-4">Agency Vĩnh Viễn</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-extrabold text-white">8.500.000₫</span>
                  <span className="ml-2 text-sm text-gray-400">/ trọn đời</span>
                </div>
                <p className="mt-3 text-xs text-gray-400">Thanh toán 1 lần duy nhất, update miễn phí mãi mãi, không phát sinh chi phí.</p>

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Kích hoạt tối đa 5 máy tính</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Không giới hạn số lượng profile & video</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Reset HWID không giới hạn số lần</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-pink-400" /> Quyền truy cập tính năng mới sớm nhất</li>
                </ul>
              </div>

              <div className="mt-8 space-y-2">
                <button
                  onClick={() => openCheckoutModal('lifetime', 'Agency Vĩnh Viễn (5 PCs)', 8500000, 'Kích hoạt 5 máy tính - Trọn đời vĩnh viễn')}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-amber-600/20 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Mua Bản Quyền Trọn Đời</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full py-2.5 rounded-xl bg-gray-900/60 hover:bg-gray-800 text-gray-400 hover:text-white font-medium text-xs transition border border-gray-800"
                >
                  Tải Về Dùng Thử Trước
                </button>
              </div>
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
              Không. Khác với các tool dùng API bên thứ ba dễ bị nền tảng phát hiện, ShortsFarm điều khiển trực tiếp các trình duyệt Antidetect (GPMLogin, GenLogin) với đầy đủ cookies, canvas fingerprint thật, giống hệt người dùng lướt web thủ công.
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
          <p>© 2026 ShortsFarm Studio. Toàn bộ quyền được bảo lưu.</p>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-gray-300">Tính năng</a>
            <a href="#pricing" className="hover:text-gray-300">Bảng giá</a>
            <Link href="/admin" className="hover:text-pink-400">Cổng Quản Trị</Link>
          </div>
        </div>
      </footer>

      {/* ===================================================================== */}
      {/* 8. VIETQR CHECKOUT & INSTANT KEY DELIVERY MODAL */}
      {/* ===================================================================== */}
      {checkoutModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#0D121F] border border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-800/80 flex items-center justify-between bg-gray-900/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center font-bold text-sm">
                  SF
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-none">
                    {checkoutStep === 'input' && 'Nhận Bản Quyền ShortsFarm'}
                    {checkoutStep === 'payment' && 'Quét Mã VietQR Kích Hoạt'}
                    {checkoutStep === 'success' && 'Bản Quyền Đã Kích Hoạt!'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {checkoutStep === 'input' && 'Thanh toán 1 lần - Không gia hạn tự động'}
                    {checkoutStep === 'payment' && 'Hệ thống tự động kích hoạt key trong 3-5 giây'}
                    {checkoutStep === 'success' && 'Sao chép mã bản quyền và sử dụng ngay'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              {/* STEP 1: INPUT EMAIL (NO PASSWORD REQUIRED) */}
              {checkoutStep === 'input' && (
                <form onSubmit={handleCreatePayment} className="space-y-5">
                  {/* Selected Plan Summary Banner */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-indigo-500/10 border border-pink-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-pink-400 font-semibold">Gói đã chọn:</span>
                        <h4 className="font-bold text-white text-lg">{selectedPlan.name}</h4>
                        <p className="text-xs text-gray-300 mt-0.5">{selectedPlan.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-extrabold text-pink-400">
                          {selectedPlan.amount.toLocaleString('vi-VN')}₫
                        </span>
                        <p className="text-[11px] text-gray-400 mt-0.5">1 lần mua</p>
                      </div>
                    </div>
                  </div>

                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-300 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Email Nhận Mã Bản Quyền <span className="text-pink-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="vidu: yourname@gmail.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-800 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 text-white text-sm"
                    />
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      Mã bản quyền sẽ hiển thị ngay trên màn hình và gửi bản sao lưu tới email này.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Họ và Tên (Không bắt buộc)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Nguyễn Văn A"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-800 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 text-white text-sm"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={creatingPayment}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-pink-600/30 transition flex items-center justify-center gap-2"
                    >
                      {creatingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang Khởi Tạo Mã VietQR...</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>Tiếp Tục Thanh Toán VietQR</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400 pt-1">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Bảo mật thông tin
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Không cần mật khẩu
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Kích hoạt tức thì
                    </span>
                  </div>
                </form>
              )}

              {/* STEP 2: VIETQR CODE & LIVE WEBHOOK POLLING */}
              {checkoutStep === 'payment' && orderData && (
                <div className="space-y-5 text-center">
                  {/* Status Bar */}
                  <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-between text-xs text-pink-300">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
                      <span>Đang chờ chuyển khoản...</span>
                    </span>
                    <span className="text-gray-400 text-[11px]">Cập nhật: {lastCheckedTime}</span>
                  </div>

                  {/* QR Image Box */}
                  <div className="p-4 bg-white rounded-2xl inline-block shadow-2xl border-4 border-pink-500/20 mx-auto">
                    <img
                      src={orderData.qrImageUrl}
                      alt="Mã VietQR Thanh Toán"
                      className="w-56 h-56 object-contain mx-auto"
                    />
                  </div>

                  <p className="text-xs text-gray-300">
                    Quét mã bằng ứng dụng ngân hàng bất kỳ (Vietcombank, MB, Techcombank, ACB, Momo...).
                  </p>

                  {/* Transfer Details Table */}
                  <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-4 text-left text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Ngân hàng thụ hưởng:</span>
                      <span className="font-semibold text-white">{orderData.bankBin}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Chủ tài khoản:</span>
                      <span className="font-semibold text-white uppercase">{orderData.accountName}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Số tài khoản:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">{orderData.accountNo}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(orderData.accountNo, 'acc')}
                          className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] flex items-center gap-1"
                        >
                          {copiedField === 'acc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedField === 'acc' ? 'Đã chép' : 'Chép'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Số tiền:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-pink-400 text-sm">
                          {orderData.amount.toLocaleString('vi-VN')}₫
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(orderData.amount), 'amount')}
                          className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] flex items-center gap-1"
                        >
                          {copiedField === 'amount' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedField === 'amount' ? 'Đã chép' : 'Chép'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-pink-500/10 border border-pink-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-pink-300 font-semibold block text-[11px]">Nội dung chuyển khoản (bắt buộc):</span>
                        <span className="font-mono font-bold text-white text-sm">{orderData.description}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(orderData.description, 'desc')}
                        className="px-3 py-1.5 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        {copiedField === 'desc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'desc' ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('input')}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      ← Đổi gói hoặc sửa email
                    </button>

                    {orderData.checkoutUrl && (
                      <a
                        href={orderData.checkoutUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
                      >
                        <span>Mở trang thanh toán cổng</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: INSTANT LICENSE KEY DISPLAY (SUCCESS SCREEN) */}
              {checkoutStep === 'success' && licenseData && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 animate-bounce">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div>
                    <h4 className="text-2xl font-black text-white">Thanh Toán Thành Công!</h4>
                    <p className="text-xs text-gray-300 mt-1">
                      Mã bản quyền đã được kích hoạt và gửi biên nhận tới: <strong className="text-white">{customerEmail}</strong>
                    </p>
                  </div>

                  {/* License Key Hero Box */}
                  <div className="p-5 rounded-2xl bg-gradient-to-b from-gray-900 via-[#10172A] to-gray-900 border-2 border-emerald-500/50 shadow-2xl relative">
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-400 block mb-2">
                      MÃ BẢN QUYỀN CỦA BẠN (CLICK ĐỂ SAO CHÉP)
                    </span>

                    <div className="font-mono text-xl sm:text-2xl font-black text-white tracking-widest break-all select-all py-2">
                      {licenseData.licenseKey}
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(licenseData.licenseKey, 'key')}
                      className="mt-3 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                    >
                      {copiedField === 'key' ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Đã Sao Chép Mã Key Vào Bộ Nhớ!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Sao Chép Mã Key</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Quick Usage Instructions */}
                  <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-4 text-left text-xs space-y-2 text-gray-300">
                    <span className="font-bold text-white block text-sm">Hướng dẫn kích hoạt trong 30 giây:</span>
                    <ol className="list-decimal pl-4 space-y-1 text-gray-400">
                      <li>Mở ứng dụng <strong>ShortsFarm Desktop</strong> trên máy tính.</li>
                      <li>Dán mã key vừa sao chép ở trên vào ô kích hoạt.</li>
                      <li>Bấm <strong>Kích hoạt</strong> để bắt đầu khai thác kênh tự động!</li>
                    </ol>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải Bản Cài Đặt (.exe)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutModalOpen(false)}
                      className="px-6 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white font-semibold text-xs transition border border-gray-800"
                    >
                      Hoàn Tất & Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 9. YOUTUBE VIDEO DEMO MODAL */}
      {/* ===================================================================== */}
      {youtubeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-2xl bg-[#0D121F] border border-gray-800 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
                  <Youtube className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-none">
                    Video Hướng Dẫn &amp; Demo Thực Tế ShortsFarm
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Trải nghiệm trực quan quy trình tải Douyin, AI lách bản quyền và đăng tự động
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setYoutubeModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player Container */}
            <div className="p-4 sm:p-6 bg-[#070A13]">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-gray-800 shadow-inner">
                <iframe
                  className="w-full h-full"
                  src={
                    youtubeDemoUrl.includes('watch?v=')
                      ? youtubeDemoUrl.replace('watch?v=', 'embed/')
                      : youtubeDemoUrl
                  }
                  title="ShortsFarm Desktop Engine Demo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>Kênh chính thức ShortsFarm Studio trên YouTube</span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={youtubeDemoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-1.5 transition shadow-lg shadow-red-600/30"
                  >
                    <Youtube className="w-4 h-4" />
                    <span>Mở Trên Ứng Dụng YouTube</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setYoutubeModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

