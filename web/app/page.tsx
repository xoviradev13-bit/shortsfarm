'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Download,
  Sparkles,
  ShieldCheck,
  Zap,
  Bot,
  Video,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  Monitor,
  Flame,
  ArrowRight,
  TrendingUp,
  Sliders,
  DollarSign,
  X,
  Play,
  Youtube,
  Radio,
  Layers,
  Cpu,
  Laptop,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Star,
  Users,
  Volume2,
  Mic,
  Film,
  Terminal,
  Music,
  Settings,
  PieChart,
  Wand2,
  Brain,
  Mail,
  Phone,
  MessageSquare,
  Send,
  QrCode,
} from 'lucide-react';
import { TRANSLATIONS, Language } from '@/lib/translations';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://shortsstack.vercel.app';

export default function LandingPage() {
  // Language Selection (vi, en, zh) - default to 'vi'
  const [lang, setLang] = useState<Language>('vi');
  const t = TRANSLATIONS[lang] || TRANSLATIONS.vi;

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('shortsstack_lang') as Language;
      if (savedLang && (savedLang === 'vi' || savedLang === 'en' || savedLang === 'zh')) {
        setLang(savedLang);
      }
    } catch (e) {
      // ignore localstorage access errors
    }
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem('shortsstack_lang', newLang);
    } catch (e) { }
  };

  // Language Dropdown State
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages: { code: Language; label: string; flag: string; short: string }[] = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳', short: 'VN' },
    { code: 'en', label: 'English', flag: '🇺🇸', short: 'EN' },
    { code: 'zh', label: '简体中文', flag: '🇨🇳', short: '中文' },
  ];
  const currentLang = languages.find((l) => l.code === lang) || languages[0];

  // General Page States
  const [downloading, setDownloading] = useState(false);
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const youtubeDemoUrl = process.env.NEXT_PUBLIC_YOUTUBE_DEMO_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  // Interactive Mockup Tab Selection ('dashboard' | 'ai_engine' | 'browsers' | 'scheduler')
  const [activeMockupTab, setActiveMockupTab] = useState<'dashboard' | 'ai_engine' | 'browsers' | 'scheduler'>('dashboard');

  // Interactive ROI Calculator States
  const [calcChannels, setCalcChannels] = useState<number>(5);
  const [calcVideosPerDay, setCalcVideosPerDay] = useState<number>(3);
  const [calcAvgViews, setCalcAvgViews] = useState<number>(15000); // 15k views per video

  // Calculate Revenue ($0.60 average RPM for 1,000 qualified views)
  const monthlyTotalVideos = calcChannels * calcVideosPerDay * 30;
  const monthlyTotalViews = monthlyTotalVideos * calcAvgViews;
  const estimatedRpm = 0.60; // $0.60 per 1000 views
  const estimatedMonthlyRevenueUsd = Math.round((monthlyTotalViews / 1000) * estimatedRpm);
  const estimatedMonthlyRevenueVnd = estimatedMonthlyRevenueUsd * 25400;

  // FAQ Accordion Toggle (open index or null)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Contact Form States
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    topic: '',
    message: '',
  });
  const [contactSending, setContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // QR Code Modal State
  const [activeQrModal, setActiveQrModal] = useState<{
    appName: string;
    label: string;
    qrImage: string;
    directUrl: string;
    accountInfo: string;
    badgeBg: string;
    buttonColor: string;
  } | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = contactForm.name.trim();
    const emailTrimmed = contactForm.email.trim();
    const phoneTrimmed = contactForm.phone.trim();
    const messageTrimmed = contactForm.message.trim();

    // 1. Check required fields
    if (!nameTrimmed || !emailTrimmed || !messageTrimmed) {
      setContactError(
        lang === 'vi'
          ? 'Vui lòng điền đầy đủ họ tên, email và nội dung lời nhắn.'
          : lang === 'zh'
            ? '请完整填写姓名、邮箱与留言内容。'
            : 'Please fill in your name, email, and message.'
      );
      return;
    }

    // 2. Validate Name
    if (nameTrimmed.length < 2) {
      setContactError(
        lang === 'vi'
          ? 'Họ tên quá ngắn (vui lòng nhập tối thiểu 2 ký tự).'
          : lang === 'zh'
            ? '姓名至少需要2个字符。'
            : 'Please enter a valid name (at least 2 characters).'
      );
      return;
    }

    // 3. Validate Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setContactError(
        lang === 'vi'
          ? 'Địa chỉ email không đúng định dạng (ví dụ: yourname@gmail.com).'
          : lang === 'zh'
            ? '电子邮箱格式不正确（例如：yourname@gmail.com）。'
            : 'Please enter a valid email address (e.g. yourname@gmail.com).'
      );
      return;
    }

    // 4. Validate Phone if provided
    if (phoneTrimmed && !/^[\d+\-\s().]{8,20}$/.test(phoneTrimmed)) {
      setContactError(
        lang === 'vi'
          ? 'Số điện thoại không hợp lệ (tối thiểu 8-10 chữ số).'
          : lang === 'zh'
            ? '电话号码格式不正确。'
            : 'Please enter a valid phone number (at least 8-10 digits).'
      );
      return;
    }

    // 5. Validate Message length
    if (messageTrimmed.length < 5) {
      setContactError(
        lang === 'vi'
          ? 'Nội dung tin nhắn quá ngắn (vui lòng nhập tối thiểu 5 ký tự).'
          : lang === 'zh'
            ? '留言内容过短（至少5个字符）。'
            : 'Please enter a message with at least 5 characters.'
      );
      return;
    }

    setContactSending(true);
    setContactError(null);
    setContactSuccess(false);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameTrimmed,
          email: emailTrimmed,
          phone: phoneTrimmed || undefined,
          topic: contactForm.topic || (t.contact?.topicOptions?.[0] || 'Tư vấn phần mềm'),
          message: messageTrimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Có lỗi xảy ra khi gửi tin nhắn.');
      }

      setContactSuccess(true);
      setContactForm({ name: '', email: '', phone: '', topic: '', message: '' });
    } catch (err: any) {
      setContactError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setContactSending(false);
    }
  };

  // VietQR Checkout States
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{
    code: string;
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
    code: string,
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
      setCheckoutError(lang === 'vi' ? 'Vui lòng nhập địa chỉ email hợp lệ.' : lang === 'zh' ? '请输入有效的电子邮箱地址。' : 'Please enter a valid email address.');
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
        setCheckoutError(data.message || 'Lỗi khởi tạo thanh toán.');
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
      setLastCheckedTime(new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US'));
      setCheckoutStep('payment');
    } catch (err: any) {
      setCheckoutError(err.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setCreatingPayment(false);
    }
  };

  // Live Polling for Payment Confirmation
  useEffect(() => {
    if (checkoutStep !== 'payment' || !orderData?.orderCode) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/status?orderCode=${orderData.orderCode}`);
        const data = await res.json();
        setLastCheckedTime(new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US'));

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
        // Polling retry
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [checkoutStep, orderData?.orderCode, lang]);

  return (
    <div className="min-h-screen bg-[#FAFCFE] text-slate-800 flex flex-col font-sans relative overflow-x-hidden">
      {/* Subtle Background Glows (Refined light theme ambient aura) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[520px] h-[520px] bg-rose-200/40 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute -top-20 right-1/4 w-[480px] h-[480px] bg-indigo-200/35 rounded-full blur-[130px] animate-pulse-glow" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-64 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-100/40 rounded-full blur-[100px]" />
      </div>

      {/* Subtle Architectural Dot Grid Pattern */}
      <div className="absolute inset-0 bg-grid-slate-light opacity-60 pointer-events-none -z-10" />

      {/* ===================================================================== */}
      {/* 1. HEADER / NAVBAR (Crisp Translucent Glass) */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/90 border-b border-slate-200/80 transition-all shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between">
          {/* Logo & Brand Name */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform duration-200 border border-slate-200/80">
              <img
                src="/apple-touch-icon.png"
                alt="ShortsStack"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">
                  Shorts<span className="text-rose-600">Stack</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60 shadow-xs">
                  v2.1
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">AI Video Engine & Auto Uploader</p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-rose-600 transition-colors">{t.nav.features}</a>
            <a href="#browsers" className="hover:text-rose-600 transition-colors">{t.nav.browsers}</a>
            <a href="#calculator" className="hover:text-rose-600 transition-colors flex items-center gap-1.5">
              <span>{t.nav.calculator}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            </a>
            <a href="#pricing" className="hover:text-rose-600 transition-colors">{t.nav.pricing}</a>
            <a href="#faq" className="hover:text-rose-600 transition-colors">{t.nav.faq}</a>
            <a href="#contact" className="hover:text-rose-600 transition-colors">{t.nav.contact}</a>
          </nav>

          {/* Right Action Bar: Language Dropdown + Download CTA */}
          <div className="flex items-center gap-3">
            {/* Language Dropdown */}
            <div className="relative" ref={langDropdownRef}>
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200 text-xs font-semibold text-slate-700 transition shadow-2xs"
                aria-expanded={langDropdownOpen}
                aria-haspopup="true"
              >
                <span className="text-base leading-none">{currentLang.flag}</span>
                <span className="font-bold">{currentLang.short}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${langDropdownOpen ? 'rotate-180 text-rose-600' : ''}`} />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 py-1.5 z-50">
                  {languages.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        changeLanguage(item.code);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold transition ${lang === item.code
                        ? 'bg-rose-50 text-rose-600 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{item.flag}</span>
                        <span>{item.label}</span>
                      </div>
                      {lang === item.code && <Check className="w-3.5 h-3.5 text-rose-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Primary Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              className="relative group overflow-hidden px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 transition shadow-md shadow-rose-500/25 active:scale-95 flex items-center gap-2"
            >
              <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
              <span>{downloading ? '...' : t.nav.download}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. HERO SECTION (Editorial, High-Conversion SaaS Layout) */}
      {/* ===================================================================== */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Shimmer Announcement Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-rose-200/80 shadow-xs text-xs font-semibold text-rose-700 mb-8 hover:border-rose-300 transition cursor-default animate-float-gentle">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            <span>{t.hero.badge}</span>
            <ArrowRight className="w-3.5 h-3.5 text-rose-500" />
          </div>

          {/* Monumental Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            {t.hero.titleLine1}{' '}
            <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 bg-clip-text text-transparent">
              {t.hero.titleGradient}
            </span>{' '}
            <br className="hidden sm:inline" />
            {t.hero.titleLine2}
          </h1>

          {/* Subheading */}
          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
            {t.hero.description}
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-2xl lg:max-w-3xl mx-auto">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold shadow-xl shadow-rose-500/30 hover:shadow-rose-500/40 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-3.5 group"
            >
              <Download className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <div className="text-center sm:text-left leading-tight">
                <span className="block text-xs uppercase tracking-wider text-rose-100 font-semibold">
                  {lang === 'vi' ? 'Tải Bản' : lang === 'en' ? 'Download for' : '下载客户端'}
                </span>
                <span className="block text-sm sm:text-base font-bold whitespace-nowrap">
                  {lang === 'vi' ? 'Windows (64-bit)' : lang === 'en' ? 'Windows (64-bit)' : 'Windows (64位)'}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setYoutubeModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold border border-slate-200/90 shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-3 group"
            >
              <Play className="w-4 h-4 fill-rose-600 text-rose-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <div className="text-center sm:text-left leading-tight">
                <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  {lang === 'vi' ? 'Xem Video' : lang === 'en' ? 'Watch Demo' : '演示视频'}
                </span>
                <span className="block text-sm sm:text-base font-bold text-slate-800 whitespace-nowrap">
                  {lang === 'vi' ? 'Trực Tiếp' : lang === 'en' ? 'Live Video' : '实机操作'}
                </span>
              </div>
            </button>

            <a
              href="#pricing"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 font-bold border border-slate-200/60 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <div className="text-center sm:text-left leading-tight">
                <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  {lang === 'vi' ? 'Xem' : lang === 'en' ? 'View' : '查看'}
                </span>
                <span className="block text-sm sm:text-base font-bold text-slate-700 whitespace-nowrap">
                  {lang === 'vi' ? 'Bảng Giá' : lang === 'en' ? 'Pricing' : '价格方案'}
                </span>
              </div>
            </a>
          </div>

          <p className="mt-3.5 text-xs text-slate-500 font-medium">
            {t.hero.downloadSub}
          </p>

          {/* Trust Highlights Checklist */}
          <div className="mt-10 pt-6 border-t border-slate-200/60 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{t.hero.trustWindows}</span>
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{t.hero.trustHwid}</span>
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{t.hero.trustAntiBan}</span>
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{t.hero.trustBrowsers}</span>
            </span>
          </div>
        </div>

        {/* =============================================================== */}
        {/* 3. INTERACTIVE SOFTWARE WORKSPACE DEMO SHOWCASE (Remotion Real App Studio) */}
        {/* =============================================================== */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
          <div className="relative rounded-2xl border border-slate-800 bg-[#0A0E1A] text-slate-100 shadow-2xl shadow-rose-950/20 overflow-hidden text-left">
            {/* Desktop Window Titlebar (macOS Style Dots + Live System Pills) */}
            <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-[#0d1322]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-400/90 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-3 font-mono text-xs text-slate-400 font-semibold hidden sm:inline-block">
                  ShortsStack Studio v2.1.0 • AI Video Engine & Auto-Pilot
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Auto-Pilot: 4 Tasks Active</span>
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono text-[11px] font-semibold">
                  <Zap className="w-3 h-3 text-cyan-400" />
                  <span>NVENC GPU (142 FPS)</span>
                </span>
                <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 font-mono text-[11px] font-medium">
                  <Globe className="w-3 h-3 text-purple-400" />
                  <span>GPMLogin Automation</span>
                </span>
              </div>
            </div>

            {/* Desktop UI Body: Real App Sidebar + Interactive Work Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
              {/* App Left Sidebar (Matching Real Desktop App Navigation) */}
              <div className="lg:col-span-3 border-r border-slate-800/80 bg-[#070B14] p-4 text-xs flex flex-col justify-between h-full">
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80">
                    <div className="w-8 h-8 rounded-lg overflow-hidden shadow-md shadow-rose-600/30 shrink-0 border border-slate-800">
                      <img src="/apple-touch-icon.png" alt="ShortsStack" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <span className="font-bold text-white block text-sm tracking-wide">SHORTSSTACK</span>
                      <span className="text-[10px] text-slate-400">AI Engine & Auto Upload</span>
                    </div>
                  </div>

                  {/* Nav Section 1: QUY TRÌNH TỰ ĐỘNG */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 block mb-1">
                      {lang === 'vi' ? 'QUY TRÌNH TỰ ĐỘNG' : lang === 'zh' ? '全自动工作流' : 'AUTOMATION PIPELINE'}
                    </span>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('dashboard')}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-semibold transition text-xs ${activeMockupTab === 'dashboard'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Chiến Dịch Tự Động' : lang === 'zh' ? '自动运营战役' : 'Auto-Pilot Campaign'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('ai_engine')}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-semibold transition text-xs ${activeMockupTab === 'ai_engine'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
                    >
                      <Wand2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Studio Biên Tập Video' : lang === 'zh' ? '视频编辑工作室' : 'Video Editing Studio'}</span>
                    </button>
                  </div>

                  {/* Nav Section 2: TÀI NGUYÊN */}
                  <div className="space-y-1 pt-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 block mb-1">
                      {lang === 'vi' ? 'TÀI NGUYÊN' : lang === 'zh' ? '资源库' : 'RESOURCES'}
                    </span>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('ai_engine')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium transition text-xs text-slate-400 hover:text-white hover:bg-slate-800/40"
                    >
                      <Film className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Quản Lý Video' : lang === 'zh' ? '视频管理' : 'Video Manager'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('dashboard')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium transition text-xs text-slate-400 hover:text-white hover:bg-slate-800/40"
                    >
                      <Mic className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Phòng Thu ElevenLabs' : lang === 'zh' ? 'ElevenLabs 配音室' : 'ElevenLabs Studio'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('dashboard')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium transition text-xs text-slate-400 hover:text-white hover:bg-slate-800/40"
                    >
                      <Youtube className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>{lang === 'vi' ? 'Kênh Nguồn YouTube' : lang === 'zh' ? 'YouTube 采集源' : 'YouTube Sources'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('dashboard')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium transition text-xs text-slate-400 hover:text-white hover:bg-slate-800/40"
                    >
                      <Music className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Kho Âm Thanh & BGM' : lang === 'zh' ? '音效与背景音乐' : 'Audio & BGM Vault'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('browsers')}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-semibold transition text-xs ${activeMockupTab === 'browsers'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
                    >
                      <Bot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Quản Lý Dàn Account' : lang === 'zh' ? '矩阵多账号管理' : 'Account Farm Manager'}</span>
                    </button>
                  </div>

                  {/* Nav Section 3: GIÁM SÁT & HỆ THỐNG */}
                  <div className="space-y-1 pt-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 block mb-1">
                      {lang === 'vi' ? 'GIÁM SÁT & HỆ THỐNG' : lang === 'zh' ? '系统监控' : 'SYSTEM & MONITORING'}
                    </span>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('dashboard')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium transition text-xs text-slate-400 hover:text-white hover:bg-slate-800/40"
                    >
                      <PieChart className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Tổng Quan' : lang === 'zh' ? '数据总览' : 'Overview Analytics'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('scheduler')}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-semibold transition text-xs ${activeMockupTab === 'scheduler'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Hàng Đợi & Lịch Đăng' : lang === 'zh' ? '排期队列' : 'Queue & Scheduler'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('dashboard')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium transition text-xs text-slate-400 hover:text-white hover:bg-slate-800/40"
                    >
                      <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Chi Phí & Quản Lý AI' : lang === 'zh' ? 'AI 成本消耗' : 'AI Costs & Usage'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('dashboard')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium transition text-xs text-slate-400 hover:text-white hover:bg-slate-800/40"
                    >
                      <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Nhật Ký Hệ Thống' : lang === 'zh' ? '系统日志' : 'System Terminal Logs'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveMockupTab('dashboard')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium transition text-xs text-slate-400 hover:text-white hover:bg-slate-800/40"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{lang === 'vi' ? 'Cài Đặt' : lang === 'zh' ? '系统设置' : 'Settings'}</span>
                    </button>
                  </div>
                </div>

                {/* Local Machine & Antidetect Status Badge (from real app) */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 shadow-xs mt-auto">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Local Machine</span>
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <p className="text-[10px] text-slate-400">GPMLogin Engine: Connected</p>
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>US Resident Proxy</span>
                    <span className="text-emerald-400 font-semibold">100% Score</span>
                  </div>
                </div>
              </div>

              {/* App Workspace Interactive Area */}
              <div className="lg:col-span-9 p-5 sm:p-6 bg-[#0A0E1A] space-y-5">
                {/* Real App 4-Step Pipeline Stepper Banner (North Star UI) */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/90 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">BƯỚC 1</span>
                      <span className="font-semibold text-slate-200 block text-xs mt-0.5">Quét Nguồn Video</span>
                      <span className="text-[10px] text-slate-400">14 Kênh theo dõi</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">BƯỚC 2</span>
                      <span className="font-semibold text-slate-200 block text-xs mt-0.5">Remotion 9:16 Crop</span>
                      <span className="text-[10px] text-slate-400">Xóa logo 100%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">BƯỚC 3</span>
                      <span className="font-semibold text-rose-300 block text-xs mt-0.5">ElevenLabs Voice</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Auto-Pilot Active</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">BƯỚC 4</span>
                      <span className="font-semibold text-slate-200 block text-xs mt-0.5">Đăng Trình Duyệt</span>
                      <span className="text-[10px] text-slate-400">GPM / GenLogin</span>
                    </div>
                  </div>
                </div>

                {/* 4 Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium block">{t.mockup.statChannels}</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-white">14</span>
                      <span className="text-[10px] font-bold text-emerald-400">+2 new</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium block">{t.mockup.statQueue}</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-rose-400">38</span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">ready</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium block">{t.mockup.statViews}</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-white">1.84M</span>
                      <span className="text-[10px] font-bold text-emerald-400">↑ 34%</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium block">{t.mockup.statFollowers}</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-amber-300">142.8K</span>
                      <span className="text-[10px] font-bold text-amber-400">🏆 3 Mon</span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Content: TAB 1 (Dashboard - Remotion Studio Player & Live Tasks) */}
                {activeMockupTab === 'dashboard' && (
                  <div className="space-y-4">
                    {/* Split: Remotion 9:16 Video Canvas (Left) + Multi-task Pipeline (Right) */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Video Player Card */}
                      <div className="md:col-span-5 rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                          <span className="font-mono text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                            <Film className="w-3.5 h-3.5 text-rose-400" /> Player
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-mono font-bold">
                            9:16 (1080x1920)
                          </span>
                        </div>

                        {/* Simulated 9:16 Phone Aspect Video Frame with Video Underlay */}
                        <div className="relative my-3 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-[9/14] flex flex-col justify-between p-3 group shadow-inner">
                          {/* Real Video Underlay (Looping) */}
                          <video
                            src="/videos/Download.mp4"
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover"
                          />

                          {/* Gradient Vignette for crisp text & badge readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/60 pointer-events-none" />

                          {/* Top Video Badges */}
                          <div className="relative z-10 flex items-center justify-between text-[10px]">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold backdrop-blur-xs">
                              100% Watermark Cleaned
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-black/60 text-slate-300 font-mono">
                              NVENC GPU
                            </span>
                          </div>

                          {/* Center: Live Bouncing Audio Equalizer Waveform & Karaoke Subtitles */}
                          <div className="relative z-10 space-y-3 my-auto text-center">
                            {/* Remotion Audio Waveform Visualizer */}
                            <div className="flex items-center justify-center gap-1.5 h-8">
                              <span className="w-1 bg-rose-400 rounded-full animate-wave-1 inline-block" />
                              <span className="w-1 bg-pink-400 rounded-full animate-wave-2 inline-block" />
                              <span className="w-1 bg-amber-400 rounded-full animate-wave-3 inline-block" />
                              <span className="w-1 bg-cyan-400 rounded-full animate-wave-4 inline-block" />
                              <span className="w-1 bg-rose-400 rounded-full animate-wave-2 inline-block" />
                              <span className="w-1 bg-pink-400 rounded-full animate-wave-1 inline-block" />
                              <span className="w-1 bg-cyan-400 rounded-full animate-wave-3 inline-block" />
                              <span className="w-1 bg-amber-400 rounded-full animate-wave-4 inline-block" />
                            </div>

                            {/* Animated Kinetic Karaoke Subtitles Overlay */}
                            <div className="px-2 py-1.5 rounded-lg bg-black/75 backdrop-blur-sm border border-white/10 shadow-lg">
                              <p className="text-xs font-bold text-white leading-snug">
                                Thuật toán TikTok 2026{' '}
                                <span className="text-amber-300 bg-amber-500/30 px-1 rounded underline decoration-amber-400">
                                  tự động nhận diện
                                </span>{' '}
                                & phân phối triệu view!
                              </p>
                              <span className="text-[9px] text-slate-400 font-mono block mt-1">
                                [ElevenLabs: Adam Voice • 0.42s latency]
                              </span>
                            </div>
                          </div>

                          {/* Bottom Remotion Scrubber Bar */}
                          <div className="relative z-10 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span className="text-emerald-400 font-bold">00:14 / 00:65</span>
                              <span>Frame 840 / 3,900</span>
                            </div>
                            <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div className="absolute top-0 bottom-0 left-0 w-3/4 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full" />
                              <div className="absolute top-0 bottom-0 w-1 bg-white shadow-xs animate-remotion-scrubber" />
                            </div>
                          </div>
                        </div>

                        {/* Player Transport Bar */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 text-slate-300">
                            <Play className="w-3.5 h-3.5 text-rose-400 fill-rose-400" /> Playing 60 FPS
                          </span>
                          <span className="font-mono text-cyan-400">Audio Sync: 100%</span>
                        </div>
                      </div>

                      {/* Right: Real-time Multi-Task Live Render Pipeline */}
                      <div className="md:col-span-7 space-y-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <span>{lang === 'vi' ? 'HÀNG ĐỢI RENDERING & AUTO POST' : lang === 'zh' ? '实时渲染与发布队列' : 'LIVE RENDERING & AUTO-POST QUEUE'}</span>
                          </h4>
                          <span className="text-xs text-rose-400 font-semibold flex items-center gap-1 font-mono">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Auto-syncing
                          </span>
                        </div>

                        {/* 6 Active Tasks with Platform Icons & Animated Progress Bars */}
                        <div className="space-y-2">
                          {/* Task 1: TikTok */}
                          <div className="p-2.5 rounded-xl border border-slate-800/90 bg-slate-900/60 text-xs space-y-1.5 hover:border-slate-700/80 transition">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src="/images/tiktok-logo.png" alt="TikTok" className="w-4 h-4 object-contain shrink-0" />
                                <span className="font-bold text-slate-100">Douyin Life Hacks #429</span>
                              </div>
                              <span className="text-rose-400 font-mono font-bold text-[11px]">78%</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pl-6">
                              <span>ElevenLabs AI Voice Dubbing</span>
                              <span className="font-mono text-slate-500 text-[10px]">TikTok Beta US @lifehacks_pro</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full w-[78%] animate-progress-shimmer" />
                            </div>
                          </div>

                          {/* Task 2: YouTube */}
                          <div className="p-2.5 rounded-xl border border-slate-800/90 bg-slate-900/60 text-xs space-y-1.5 hover:border-slate-700/80 transition">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src="/images/youtube-logo.png" alt="YouTube" className="w-4 h-4 object-contain shrink-0" />
                                <span className="font-bold text-slate-100">Xiaohongshu Aesthetic POV #104</span>
                              </div>
                              <span className="text-cyan-400 font-mono font-bold text-[11px]">45%</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pl-6">
                              <span>Remotion 9:16 Re-composition & Dynamic Captions</span>
                              <span className="font-mono text-slate-500 text-[10px]">YouTube Shorts @daily_vibes</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full w-[45%] bg-gradient-to-r from-cyan-500 to-blue-500" />
                            </div>
                          </div>

                          {/* Task 3: Facebook */}
                          <div className="p-2.5 rounded-xl border border-slate-800/90 bg-slate-900/60 text-xs space-y-1.5 hover:border-slate-700/80 transition">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src="/images/facebook-logo.png" alt="Facebook" className="w-4 h-4 object-contain shrink-0" />
                                <span className="font-bold text-slate-100">Mystery Facts: Dark History #18</span>
                              </div>
                              <span className="text-indigo-400 font-mono font-bold text-[11px]">92%</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pl-6">
                              <span>Uploading via GPMLogin Profile #03</span>
                              <span className="font-mono text-slate-500 text-[10px]">Facebook Reels @mystery_unfold</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full w-[92%] bg-gradient-to-r from-indigo-500 to-purple-500" />
                            </div>
                          </div>

                          {/* Task 4: TikTok */}
                          <div className="p-2.5 rounded-xl border border-slate-800/90 bg-slate-900/60 text-xs space-y-1.5 hover:border-slate-700/80 transition">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src="/images/tiktok-logo.png" alt="TikTok" className="w-4 h-4 object-contain shrink-0" />
                                <span className="font-bold text-slate-100">Viral Tech Trends #08</span>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px]">
                                READY 100%
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pl-6">
                              <span>Scheduled for 19:30 US EST (Optimal Peak Traffic)</span>
                              <span className="font-mono text-slate-500 text-[10px]">TikTok UK Beta @future_gadgets</span>
                            </div>
                          </div>

                          {/* Task 5: YouTube (New) */}
                          <div className="p-2.5 rounded-xl border border-slate-800/90 bg-slate-900/60 text-xs space-y-1.5 hover:border-slate-700/80 transition">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src="/images/youtube-logo.png" alt="YouTube" className="w-4 h-4 object-contain shrink-0" />
                                <span className="font-bold text-slate-100">Satisfying Crafts & ASMR #52</span>
                              </div>
                              <span className="text-amber-400 font-mono font-bold text-[11px]">62%</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pl-6">
                              <span>FFmpeg Smart Color Jitter & Micro-Noise</span>
                              <span className="font-mono text-slate-500 text-[10px]">YouTube Shorts @craft_master_global</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full w-[62%] bg-gradient-to-r from-amber-500 to-orange-500" />
                            </div>
                          </div>

                          {/* Task 6: Facebook (New) */}
                          <div className="p-2.5 rounded-xl border border-slate-800/90 bg-slate-900/60 text-xs space-y-1.5 hover:border-slate-700/80 transition">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src="/images/facebook-logo.png" alt="Facebook" className="w-4 h-4 object-contain shrink-0" />
                                <span className="font-bold text-slate-100">Finance & Business Motivation #12</span>
                              </div>
                              <span className="text-rose-400 font-mono font-bold text-[11px]">35%</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pl-6">
                              <span>Watermark Cleaned (1080p 60FPS) • Anti-Ban</span>
                              <span className="font-mono text-slate-500 text-[10px]">Facebook Reels @success_mindset_vn</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full w-[35%] bg-gradient-to-r from-rose-500 to-pink-500" />
                            </div>
                          </div>
                        </div>

                        {/* Real-time Terminal Log Feed at Bottom */}
                        <div className="p-2.5 rounded-xl bg-black/80 border border-slate-800 font-mono text-[10px] text-slate-400 flex items-center gap-2 overflow-hidden">
                          <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-emerald-400">[16:38:24]</span>
                          <span className="text-slate-300 truncate">
                            [NVENC] Frame #840 encoded (142 FPS) | [ElevenLabs] Audio stream synced | [GPM] Profile #03 ready
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dynamic Content: TAB 2 (AI Engine Studio) */}
                {activeMockupTab === 'ai_engine' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      {lang === 'vi' ? 'QUY TRÌNH 4 BƯỚC LÁCH THUẬT TOÁN ĐA TẦNG' : lang === 'zh' ? '四步多重算法去重流程' : '4-STEP ALGORITHMIC EVASION PIPELINE'}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70">
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px]">BƯỚC 1</span>
                        <h5 className="font-bold text-white text-sm mt-2">{t.mockup.aiStep1}</h5>
                        <p className="text-slate-400 text-xs mt-1">Loại bỏ 100% watermark, bảo toàn độ phân giải 1080x1920 sắc nét.</p>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70">
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-[10px]">BƯỚC 2</span>
                        <h5 className="font-bold text-white text-sm mt-2">{t.mockup.aiStep2}</h5>
                        <p className="text-slate-400 text-xs mt-1">Đổi màu sắc quang học micro-noise, tốc độ 1.025x và đổi cao độ âm thanh.</p>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]">BƯỚC 3</span>
                        <h5 className="font-bold text-white text-sm mt-2">{t.mockup.aiStep3}</h5>
                        <p className="text-slate-400 text-xs mt-1">Voiceover chuẩn bản xứ và phụ đề karaoke bật chữ tạo tương tác cao.</p>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">BƯỚC 4</span>
                        <h5 className="font-bold text-white text-sm mt-2">{t.mockup.aiStep4}</h5>
                        <p className="text-slate-400 text-xs mt-1">Đẩy vào trình duyệt antidetect, điền tiêu đề SEO và bấm đăng tự động.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dynamic Content: TAB 3 (Browsers Farm) */}
                {activeMockupTab === 'browsers' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      {lang === 'vi' ? 'HỒ SƠ TRÌNH DUYỆT ĐANG LIÊN KẾT (GPMLogin & GenLogin)' : lang === 'zh' ? '已关联环境 (GPMLogin & GenLogin)' : 'ACTIVE ANTIDETECT BROWSER PROFILES'}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {[
                        { browser: 'GPMLogin', name: 'Profile_US_Alpha', proxy: 'US (California) 198.51.100.22', status: 'Sẵn sàng' },
                        { browser: 'GenLogin', name: 'Profile_UK_Beta', proxy: 'UK (London) 203.0.113.84', status: 'Sẵn sàng' },
                        { browser: 'GPMLogin', name: 'Profile_VN_Creator', proxy: 'VN (Hanoi) 103.21.144.12', status: 'Sẵn sàng' },
                      ].map((item, i) => (
                        <div key={i} className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold text-[10px]">
                              {item.browser}
                            </span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          </div>
                          <span className="font-bold text-white text-sm block mt-2">{item.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">{item.proxy}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dynamic Content: TAB 4 (Scheduler 24/7) */}
                {activeMockupTab === 'scheduler' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      {lang === 'vi' ? 'KHUNG GIỜ ĐĂNG BÀI TỰ ĐỘNG 24/7' : lang === 'zh' ? '24/7 全天候自动发布时段' : '24/7 AUTONOMOUS PUBLISHING SLOTS'}
                    </h4>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex flex-wrap gap-3 items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white block">Khung Giờ Vàng Mỹ (US Eastern Time)</span>
                        <span className="text-slate-400 text-[11px]">Đăng 3 slot: 09:00 AM • 01:00 PM • 07:30 PM EST</span>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                        Tự động kích hoạt
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. LIVE MARQUEE TICKER (Animated Attention Catching Banner) */}
      {/* ===================================================================== */}
      <div className="border-y border-slate-200/80 bg-white/90 py-3.5 overflow-hidden shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>{t.ticker.title}</span>
          </div>

          <div className="overflow-hidden whitespace-nowrap flex-1">
            <div className="animate-ticker-marquee text-xs font-medium text-slate-600 gap-10">
              {t.ticker.items.concat(t.ticker.items).map((item, idx) => (
                <span key={idx} className="inline-flex items-center gap-2">
                  <span className="text-rose-500">⚡</span>
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 5. FEATURES BENTO GRID (Deep Technical Capabilities) */}
      {/* ===================================================================== */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase font-extrabold tracking-wider px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {t.features.badge}
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mt-4 tracking-tight">
            {t.features.title}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            {t.features.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {t.features.items.map((item, idx) => (
            <div
              key={idx}
              className="p-7 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-rose-300 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {item.tag}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs group-hover:bg-rose-500 group-hover:text-white transition-colors">
                    0{idx + 1}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2.5 tracking-tight group-hover:text-rose-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{item.highlight}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. ANTIDETECT BROWSERS SHOWCASE (GPMLogin & GenLogin) */}
      {/* ===================================================================== */}
      <section id="browsers" className="py-20 bg-slate-50/70 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs uppercase font-extrabold tracking-wider px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {t.browsers.badge}
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mt-4 tracking-tight">
              {t.browsers.title}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600">
              {t.browsers.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* GPMLogin Card */}
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  G
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{t.browsers.gpmTitle}</h3>
                  <span className="text-xs text-slate-500 font-mono">Local API Automation</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t.browsers.gpmDesc}
              </p>
            </div>

            {/* GenLogin Card */}
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-rose-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  ⚡
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{t.browsers.genTitle}</h3>
                  <span className="text-xs text-slate-500 font-mono">Chrome DevTools CDP</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t.browsers.genDesc}
              </p>
            </div>
          </div>

          {/* 3 Core Security Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
            <div className="p-5 rounded-xl bg-white border border-slate-200/80">
              <span className="font-bold text-slate-900 text-sm block mb-1">{t.browsers.benefit1Title}</span>
              <p className="text-xs text-slate-600">{t.browsers.benefit1Desc}</p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200/80">
              <span className="font-bold text-slate-900 text-sm block mb-1">{t.browsers.benefit2Title}</span>
              <p className="text-xs text-slate-600">{t.browsers.benefit2Desc}</p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200/80">
              <span className="font-bold text-slate-900 text-sm block mb-1">{t.browsers.benefit3Title}</span>
              <p className="text-xs text-slate-600">{t.browsers.benefit3Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 7. INTERACTIVE REVENUE SIMULATOR (Standout High-Engagement Widget) */}
      {/* ===================================================================== */}
      <section id="calculator" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-white via-rose-50/30 to-indigo-50/20 border border-rose-200/70 shadow-xl shadow-slate-200/50">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full bg-rose-100 text-rose-800">
              {t.calculator.badge}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">
              {t.calculator.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t.calculator.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Sliders Control Panel */}
            <div className="md:col-span-7 space-y-6">
              {/* Slider 1: Channels */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-700">{t.calculator.channelsLabel}</span>
                  <span className="px-3 py-1 rounded-lg bg-rose-50 text-rose-600 font-extrabold text-sm border border-rose-200">
                    {calcChannels} Kênh
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={calcChannels}
                  onChange={(e) => setCalcChannels(parseInt(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>1 Kênh</span>
                  <span>10 Kênh</span>
                  <span>20 Kênh</span>
                </div>
              </div>

              {/* Slider 2: Videos per Day */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-700">{t.calculator.videosPerDayLabel}</span>
                  <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 font-extrabold text-sm border border-indigo-200">
                    {calcVideosPerDay} Video/ngày
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={calcVideosPerDay}
                  onChange={(e) => setCalcVideosPerDay(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>1 Video</span>
                  <span>5 Video</span>
                  <span>10 Video</span>
                </div>
              </div>

              {/* Slider 3: Average Views */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-700">{t.calculator.avgViewsLabel}</span>
                  <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-600 font-extrabold text-sm border border-amber-200">
                    {calcAvgViews.toLocaleString()} Views
                  </span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="5000"
                  value={calcAvgViews}
                  onChange={(e) => setCalcAvgViews(parseInt(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>5K Views</span>
                  <span>50K Views</span>
                  <span>100K Views</span>
                </div>
              </div>
            </div>

            {/* Revenue Output Card */}
            <div className="md:col-span-5 p-6 rounded-2xl bg-white border border-rose-200 shadow-lg text-center space-y-4">
              <div>
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  {t.calculator.monthlyViews}
                </span>
                <span className="text-3xl font-extrabold text-slate-900 block mt-1">
                  {(monthlyTotalViews / 1000000).toFixed(1)} Triệu View
                </span>
                <span className="text-[11px] text-slate-400 block font-mono mt-0.5">
                  ({monthlyTotalVideos} video xuất bản / tháng)
                </span>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <span className="text-xs font-bold uppercase text-rose-600 tracking-wider">
                  {t.calculator.estRevenue}
                </span>
                <div className="mt-1">
                  <span className="text-4xl font-extrabold bg-gradient-to-r from-rose-600 to-amber-600 bg-clip-text text-transparent block">
                    ${estimatedMonthlyRevenueUsd.toLocaleString()} USD
                  </span>
                  <span className="text-sm font-bold text-slate-700 block mt-1">
                    ≈ {estimatedMonthlyRevenueVnd.toLocaleString('vi-VN')}₫ / tháng
                  </span>
                </div>
              </div>

              <a
                href="#pricing"
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold text-sm shadow-md shadow-rose-500/25 hover:from-rose-600 hover:to-pink-700 transition flex items-center justify-center gap-2"
              >
                <span>{t.calculator.ctaBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <p className="text-[10px] text-slate-400 leading-normal text-left">
                {t.calculator.disclaimer}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 8. TRANSPARENT LIFETIME PRICING (All Lifetime, 1 / 3 / 5 PCs) */}
      {/* ===================================================================== */}
      <section id="pricing" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase font-extrabold tracking-wider px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {t.pricing.badge}
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mt-4 tracking-tight">
            {t.pricing.title}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            {t.pricing.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Plan 1: Pro 1 PC */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  {t.pricing.lifetimeBadge}
                </span>
                <span className="text-xs text-slate-500 font-medium">1 PC HWID</span>
              </div>

              <h3 className="text-2xl font-extrabold text-slate-900">{t.pricing.plan1Name}</h3>
              <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{t.pricing.plan1Desc}</p>

              <div className="my-6 pb-6 border-b border-slate-100">
                <span className="text-4xl font-extrabold text-slate-900">499.000{t.pricing.currency}</span>
                <span className="text-xs text-slate-500 block mt-1">{t.pricing.payOnce}</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-700 mb-8 font-medium">
                {t.pricing.features1.map((feat, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => openCheckoutModal('pro_1pc', t.pricing.plan1Name, 499000, t.pricing.plan1Desc)}
              className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition"
            >
              {t.pricing.buyBtn}
            </button>
          </div>

          {/* Plan 2: Studio 3 PCs (MOST POPULAR - Elevated Card) */}
          <div className="relative p-8 rounded-3xl bg-white border-2 border-rose-500 shadow-2xl shadow-rose-500/10 hover:shadow-rose-500/20 transition-all duration-300 flex flex-col justify-between scale-105 z-10">
            {/* Popular Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white text-[11px] font-extrabold tracking-wider shadow-sm uppercase">
              {t.pricing.popularBadge}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {t.pricing.lifetimeBadge}
                </span>
                <span className="text-xs text-rose-600 font-bold">3 PCs HWID</span>
              </div>

              <h3 className="text-2xl font-extrabold text-slate-900">{t.pricing.plan2Name}</h3>
              <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{t.pricing.plan2Desc}</p>

              <div className="my-6 pb-6 border-b border-slate-100">
                <span className="text-4xl font-extrabold text-rose-600">3.990.000{t.pricing.currency}</span>
                <span className="text-xs text-slate-500 block mt-1">{t.pricing.payOnce}</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-700 mb-8 font-medium">
                {t.pricing.features2.map((feat, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => openCheckoutModal('studio_3pc', t.pricing.plan2Name, 3990000, t.pricing.plan2Desc)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-extrabold text-sm shadow-lg shadow-rose-500/30 transition"
            >
              {t.pricing.buyBtn}
            </button>
          </div>

          {/* Plan 3: Agency 5 PCs */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {t.pricing.lifetimeBadge}
                </span>
                <span className="text-xs text-slate-500 font-medium">5 PCs HWID</span>
              </div>

              <h3 className="text-2xl font-extrabold text-slate-900">{t.pricing.plan3Name}</h3>
              <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{t.pricing.plan3Desc}</p>

              <div className="my-6 pb-6 border-b border-slate-100">
                <span className="text-4xl font-extrabold text-slate-900">8.500.000{t.pricing.currency}</span>
                <span className="text-xs text-slate-500 block mt-1">{t.pricing.payOnce}</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-700 mb-8 font-medium">
                {t.pricing.features3.map((feat, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => openCheckoutModal('agency_5pc', t.pricing.plan3Name, 8500000, t.pricing.plan3Desc)}
              className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition"
            >
              {t.pricing.buyBtn}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-10">
          🔒 {t.pricing.guarantee}
        </p>
      </section>

      {/* ===================================================================== */}
      {/* 9. TESTIMONIALS & REVIEWS */}
      {/* ===================================================================== */}
      <section className="py-20 bg-slate-50/70 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs uppercase font-extrabold tracking-wider px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {t.reviews.badge}
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mt-4 tracking-tight">
              {t.reviews.title}
            </h2>
            <p className="mt-4 text-base text-slate-600">
              {t.reviews.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {t.reviews.items.map((rev, idx) => (
              <div key={idx} className="p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-3.5">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                    "{rev.content}"
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={rev.avatar}
                      alt={rev.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 shadow-xs"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1 pr-1">
                      <span className="font-bold text-slate-900 text-sm block truncate">{rev.name}</span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-[140px] sm:max-w-[170px]" title={rev.role}>
                        {rev.role}
                      </span>
                    </div>
                  </div>
                  <div className="h-8 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200/90 flex items-center justify-center text-center shrink-0 whitespace-nowrap shadow-2xs">
                    {rev.metric}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 10. COLLAPSIBLE FAQ ACCORDION */}
      {/* ===================================================================== */}
      <section id="faq" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs uppercase font-extrabold tracking-wider px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {t.faq.badge}
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mt-4 tracking-tight">
              {t.faq.title}
            </h2>
            <p className="mt-4 text-base text-slate-600">
              {t.faq.subtitle}
            </p>
          </div>

          <div className="space-y-4">
            {t.faq.items.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-5 text-left flex items-center justify-between font-bold text-slate-900 hover:text-rose-600 transition"
                  >
                    <span className="text-sm sm:text-base pr-4">{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-rose-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 11. CALL TO ACTION (CTA) SECTION */}
      {/* ===================================================================== */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-b from-white via-rose-50/30 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 p-8 sm:p-14 text-white shadow-xl shadow-rose-600/20 overflow-hidden">
            {/* Background Decorative Rings */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full border-[30px] border-white/10 pointer-events-none" />
            <div className="absolute right-40 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold tracking-wide uppercase mb-4 border border-white/30">
                <Sparkles className="w-3.5 h-3.5" />
                {t.cta.badge}
              </span>

              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white">
                {t.cta.title}
              </h2>

              <p className="mt-4 text-sm sm:text-base text-rose-50 leading-relaxed max-w-2xl">
                {t.cta.subtitle}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-6 py-3.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 font-bold text-sm shadow-md transition active:scale-95 flex items-center gap-2.5"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloading ? '...' : t.cta.btnDownload}</span>
                </button>

                <a
                  href="#pricing"
                  className="px-6 py-3.5 rounded-xl bg-rose-700/80 hover:bg-rose-700 text-white font-bold text-sm border border-white/20 transition active:scale-95 flex items-center gap-2"
                >
                  <span>{t.cta.btnPricing}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href="#contact"
                  className="px-5 py-3.5 rounded-xl bg-black/20 hover:bg-black/30 text-white font-semibold text-sm backdrop-blur-sm transition active:scale-95 flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{t.cta.btnContact}</span>
                </a>
              </div>

              {/* Guarantee items */}
              <div className="mt-8 pt-6 border-t border-white/20 flex flex-wrap items-center gap-6 text-xs text-rose-100 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  {t.cta.guaranteeOneTime}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  {t.cta.guaranteeHwid}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  {t.cta.guaranteeSupport}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 12. CONTACT SECTION (Direct Channels & Inquiries Form) */}
      {/* ===================================================================== */}
      <section id="contact" className="py-20 bg-white border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs uppercase font-extrabold tracking-wider px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {t.contact.badge}
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mt-4 tracking-tight">
              {t.contact.title}
            </h2>
            <p className="mt-4 text-base text-slate-600">
              {t.contact.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Direct Channels Cards (Left 5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {t.contact.directTitle}
              </h3>

              {/* Zalo Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 hover:bg-blue-50/40 border border-slate-200/90 hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-2xs">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                    Zalo
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      {t.contact.zaloLabel}
                    </span>
                    <span className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition truncate block">
                      +84 326119184
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveQrModal({
                        appName: 'Zalo',
                        label: 'Zalo Hotline / Hỗ Trợ Kỹ Thuật 24/7',
                        qrImage: '/images/qrcode/zalo.qr.PNG',
                        directUrl: 'https://zalo.me/0326119184',
                        accountInfo: '+84 326119184 (ShortsStack Studio)',
                        badgeBg: 'bg-blue-600',
                        buttonColor: 'bg-blue-600 hover:bg-blue-700',
                      })
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200/80 transition flex items-center gap-1.5 shadow-2xs"
                    title="Quét mã QR bằng điện thoại"
                  >
                    <QrCode className="w-3.5 h-3.5 text-blue-600" />
                    <span>{lang === 'vi' ? 'Quét QR' : lang === 'zh' ? '扫码' : 'QR Scan'}</span>
                  </button>

                  <a
                    href="https://zalo.me/0326119184"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-xs"
                  >
                    <span>{lang === 'vi' ? 'Mở' : lang === 'zh' ? '打开' : 'Open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Email Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 hover:bg-rose-50/40 border border-slate-200/90 hover:border-rose-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-2xs">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      {t.contact.emailLabel}
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-rose-600 transition truncate block">
                      thenguyenfiner@gmail.com
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <a
                    href="mailto:thenguyenfiner@gmail.com"
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-xs"
                  >
                    <span>{lang === 'vi' ? 'Mở' : lang === 'zh' ? '打开' : 'Open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Facebook Fanpage Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200/90 hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-2xs">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#1877F2] text-white flex items-center justify-center font-black text-base shrink-0 shadow-sm">
                    f
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      {t.contact.facebookLabel}
                    </span>
                    <span className="text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition truncate block">
                      ShortsStack Studio
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveQrModal({
                        appName: 'Facebook',
                        label: 'Fanpage ShortsStack Studio',
                        qrImage: '/images/qrcode/facebook.qr.PNG',
                        directUrl: 'https://www.facebook.com/ShortsStackStudio',
                        accountInfo: 'https://www.facebook.com/ShortsStackStudio',
                        badgeBg: 'bg-[#1877F2]',
                        buttonColor: 'bg-[#1877F2] hover:bg-[#166fe5]',
                      })
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200/80 transition flex items-center gap-1.5 shadow-2xs"
                    title="Quét mã QR bằng điện thoại"
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{lang === 'vi' ? 'Quét QR' : lang === 'zh' ? '扫码' : 'QR Scan'}</span>
                  </button>

                  <a
                    href="https://www.facebook.com/ShortsStackStudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs transition flex items-center gap-1 shadow-xs"
                  >
                    <span>{lang === 'vi' ? 'Mở' : lang === 'zh' ? '打开' : 'Open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* WhatsApp Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 hover:bg-emerald-50/40 border border-slate-200/90 hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-2xs">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      {t.contact.whatsappLabel}
                    </span>
                    <span className="text-base font-extrabold text-slate-900 group-hover:text-emerald-600 transition truncate block">
                      +84 326119184
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveQrModal({
                        appName: 'WhatsApp',
                        label: 'WhatsApp Global Support',
                        qrImage: '/images/qrcode/whatsapp.qr.PNG',
                        directUrl: 'https://wa.me/84326119184',
                        accountInfo: '+84 326119184',
                        badgeBg: 'bg-[#25D366]',
                        buttonColor: 'bg-[#25D366] hover:bg-[#20ba59]',
                      })
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200/80 transition flex items-center gap-1.5 shadow-2xs"
                    title="Quét mã QR bằng điện thoại"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{lang === 'vi' ? 'Quét QR' : lang === 'zh' ? '扫码' : 'QR Scan'}</span>
                  </button>

                  <a
                    href="https://wa.me/84326119184"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs transition flex items-center gap-1 shadow-xs"
                  >
                    <span>{lang === 'vi' ? 'Mở' : lang === 'zh' ? '打开' : 'Open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs leading-relaxed flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>{t.contact.directSubtitle}</span>
              </div>
            </div>

            {/* Inquiries Form (Right 7 Cols) */}
            <div className="lg:col-span-7 bg-slate-50/70 p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm">
              <div className="mb-6">
                <h3 className="text-xl font-extrabold text-slate-900">
                  {lang === 'vi' ? 'Gửi Yêu Cầu Tư Vấn / Đặt Mua' : lang === 'zh' ? '发送咨询 / 采购需求' : 'Send Inquiry / Enterprise Request'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  {lang === 'vi' ? 'Điền thông tin bên dưới để chuyên viên ShortsStack tư vấn giải pháp và cấu hình máy phù hợp nhất.' : lang === 'zh' ? '填写下方信息，ShortsStack 专家团队将为您提供针对性配置方案。' : 'Fill out the form below and our engineering team will get back to you shortly.'}
                </p>
              </div>

              {contactSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold mb-6 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">{t.contact.formSuccess}</span>
                    <span className="text-xs text-emerald-700">ShortsStack sẽ liên hệ lại qua email hoặc số điện thoại của bạn ngay khi tiếp nhận.</span>
                  </div>
                </div>
              )}

              {contactError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{contactError}</span>
                </div>
              )}

              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {t.contact.formName} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder={lang === 'vi' ? 'Ví dụ: Nguyễn Văn A' : lang === 'zh' ? '如：张三' : 'e.g. John Doe'}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {t.contact.formEmail} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder={lang === 'vi' ? 'email@cuaban.com' : lang === 'zh' ? 'your@email.com' : 'you@company.com'}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {t.contact.formPhone}
                    </label>
                    <input
                      type="tel"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      placeholder={lang === 'vi' ? '0912 345 678 (hoặc số Zalo)' : lang === 'zh' ? '微信号或手机号' : '+1 (555) 000-0000'}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {t.contact.formTopic}
                    </label>
                    <select
                      value={contactForm.topic}
                      onChange={(e) => setContactForm({ ...contactForm, topic: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                    >
                      {t.contact.topicOptions.map((opt, i) => (
                        <option key={i} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t.contact.formMessage} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder={lang === 'vi' ? 'Nội dung cần hỗ trợ, số lượng kênh muốn nuôi hoặc yêu cầu demo...' : lang === 'zh' ? '请输入您的矩阵需求、想要运营的账号数量或定制功能...' : 'Tell us about your channels, team size, or custom workflow requirements...'}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={contactSending}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{contactSending ? t.contact.formSending : t.contact.formSubmit}</span>
                </button>

                <p className="text-center text-[11px] text-slate-500 mt-2">
                  🔒 {t.contact.guaranteeText}
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 13. RICH ENTERPRISE FOOTER (High-Density Multi-Column SaaS) */}
      {/* ===================================================================== */}
      <footer className="mt-auto border-t border-slate-200 bg-white pt-14 pb-10 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12">
            {/* Left Brand Column (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              <Link href="/" className="inline-flex items-center gap-3 group">
                <img
                  src="/apple-touch-icon.png"
                  alt="ShortsStack"
                  className="w-9 h-9 rounded-xl shadow-sm border border-slate-200/80 object-cover"
                />
                <span className="font-black text-xl tracking-tight text-slate-900">
                  SHORTS<span className="text-rose-600">STACK</span>
                </span>
              </Link>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                {t.footer.desc1}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                {t.footer.desc2}
              </p>
            </div>

            {/* Column 1: Operations & Product (3 Cols) */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-xs">
                {t.footer.col1Title}
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#features" className="hover:text-rose-600 transition">{t.footer.col1Links[0]}</a>
                </li>
                <li>
                  <a href="#browsers" className="hover:text-rose-600 transition">{t.footer.col1Links[1]}</a>
                </li>
                <li>
                  <a href="#features" className="hover:text-rose-600 transition">{t.footer.col1Links[2]}</a>
                </li>
                <li>
                  <a href="#calculator" className="hover:text-rose-600 transition">{t.footer.col1Links[3]}</a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-rose-600 transition">{t.footer.col1Links[4]}</a>
                </li>
              </ul>
            </div>

            {/* Column 2: Docs & Guides (2.5 Cols) */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-xs">
                {t.footer.col2Title}
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#faq" className="hover:text-rose-600 transition">{t.footer.col2Links[0]}</a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-rose-600 transition">{t.footer.col2Links[1]}</a>
                </li>
                <li>
                  <a href="#features" className="hover:text-rose-600 transition">{t.footer.col2Links[2]}</a>
                </li>
                <li>
                  <button type="button" onClick={handleDownload} className="hover:text-rose-600 transition text-left">
                    {t.footer.col2Links[3]}
                  </button>
                </li>
                <li>
                  <a href="#contact" className="hover:text-rose-600 transition">{t.footer.col2Links[4]}</a>
                </li>
              </ul>
            </div>

            {/* Column 3: Trust & Legal (2.5 Cols) */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-xs">
                {t.footer.col3Title}
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#browsers" className="hover:text-rose-600 transition">{t.footer.col3Links[0]}</a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-rose-600 transition">{t.footer.col3Links[1]}</a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-rose-600 transition">{t.footer.col3Links[2]}</a>
                </li>
                <li>
                  <Link href="/admin" className="hover:text-rose-600 font-semibold text-slate-800 transition flex items-center gap-1.5">
                    <span>{t.footer.col3Links[3]}</span>
                    <ArrowRight className="w-3 h-3 text-rose-500" />
                  </Link>
                </li>
                <li>
                  <a href="#contact" className="hover:text-rose-600 transition">{t.footer.col3Links[4]}</a>
                </li>
              </ul>
            </div>
          </div>

          {/* Sub-Footer Divider Bar */}
          <div className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <p>{t.footer.copyright}</p>
            <div className="flex items-center gap-2 text-slate-600">
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              <span>{t.footer.securityBadge}</span>
            </div>
          </div>

          {/* Disclaimer text at bottom */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] text-slate-400 text-center leading-relaxed max-w-4xl mx-auto">
            {t.footer.disclaimer}
          </div>
        </div>
      </footer>

      {/* ===================================================================== */}
      {/* 12. VIETQR CHECKOUT & INSTANT DELIVERY MODAL (Clean Light Theme) */}
      {/* ===================================================================== */}
      {checkoutModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-extrabold text-sm">
                  SS
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-none">
                    {checkoutStep === 'input' && t.checkout.titleInput}
                    {checkoutStep === 'payment' && t.checkout.titlePayment}
                    {checkoutStep === 'success' && t.checkout.titleSuccess}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {checkoutStep === 'input' && t.checkout.subInput}
                    {checkoutStep === 'payment' && t.checkout.subPayment}
                    {checkoutStep === 'success' && t.checkout.subSuccess}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              {/* STEP 1: INPUT CUSTOMER DETAILS */}
              {checkoutStep === 'input' && (
                <form onSubmit={handleCreatePayment} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-rose-700 font-bold block">{selectedPlan.name}</span>
                      <span className="text-[11px] text-slate-600 block mt-0.5">{selectedPlan.description}</span>
                    </div>
                    <span className="text-xl font-extrabold text-rose-600 shrink-0">
                      {selectedPlan.amount.toLocaleString('vi-VN')}₫
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t.checkout.customerNameLabel}
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t.checkout.customerNamePlaceholder}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t.checkout.emailLabel} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder={t.checkout.emailPlaceholder}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {t.checkout.emailHint}
                    </p>
                  </div>

                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={creatingPayment}
                    className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm shadow-md shadow-rose-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>{creatingPayment ? t.checkout.creatingOrder : t.checkout.proceedBtn}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* STEP 2: VIETQR PAYMENT SCAN */}
              {checkoutStep === 'payment' && orderData && (
                <div className="space-y-4 text-center">
                  {/* QR Code Container */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 inline-block shadow-sm">
                    {orderData.qrImageUrl ? (
                      <img
                        src={orderData.qrImageUrl}
                        alt="VietQR Code"
                        className="w-56 h-56 mx-auto rounded-lg object-contain bg-white p-2"
                      />
                    ) : (
                      <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                        QR Code
                      </div>
                    )}
                  </div>

                  {/* Transfer Details Card */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left text-xs space-y-2.5">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">{t.checkout.bankNameLabel}:</span>
                      <span className="font-bold text-slate-900">{orderData.bankBin || 'MBBank'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">{t.checkout.accountNoLabel}:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{orderData.accountNo}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(orderData.accountNo, 'acc')}
                          className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold"
                        >
                          {copiedField === 'acc' ? t.checkout.copied : t.checkout.copyBtn}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">{t.checkout.amountLabel}:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-600 text-sm">
                          {orderData.amount.toLocaleString('vi-VN')}₫
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(orderData.amount), 'amt')}
                          className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold"
                        >
                          {copiedField === 'amt' ? t.checkout.copied : t.checkout.copyBtn}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500">{t.checkout.contentLabel}:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {orderData.description}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(orderData.description, 'desc')}
                          className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold"
                        >
                          {copiedField === 'desc' ? t.checkout.copied : t.checkout.copyBtn}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Polling Notice */}
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
                    <RefreshCw className="w-3.5 h-3.5 text-rose-500 animate-spin" />
                    <span>{t.checkout.waitingPayment}</span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    {t.checkout.paymentNote}
                  </p>

                  <button
                    type="button"
                    onClick={() => setCheckoutStep('input')}
                    className="text-xs text-slate-500 hover:text-slate-800 underline mt-2"
                  >
                    {t.checkout.backBtn}
                  </button>
                </div>
              )}

              {/* STEP 3: SUCCESS KEY DELIVERY */}
              {checkoutStep === 'success' && licenseData && (
                <div className="space-y-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{t.checkout.titleSuccess}</h4>
                    <p className="text-xs text-slate-600 mt-1">{t.checkout.successMessage}</p>
                  </div>

                  {/* License Key Box */}
                  <div className="p-4 rounded-2xl bg-slate-900 text-white text-center space-y-2 shadow-inner">
                    <span className="text-xs text-slate-400 block font-mono">{t.checkout.licenseKeyLabel}</span>
                    <div className="text-lg sm:text-xl font-mono font-extrabold text-rose-400 tracking-wider break-all">
                      {licenseData.licenseKey}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(licenseData.licenseKey, 'key')}
                      className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
                    >
                      {copiedField === 'key' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t.checkout.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.checkout.copyBtn}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Quick Usage Guide */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left text-xs space-y-1.5 text-slate-700">
                    <span className="font-bold text-slate-900 block">{t.checkout.guideTitle}</span>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                      <li>{t.checkout.guideStep1}</li>
                      <li>{t.checkout.guideStep2}</li>
                      <li>{t.checkout.guideStep3}</li>
                    </ol>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t.checkout.downloadInstallerBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutModalOpen(false)}
                      className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition border border-slate-200"
                    >
                      {t.checkout.doneBtn}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 13. YOUTUBE VIDEO DEMO MODAL */}
      {/* ===================================================================== */}
      {youtubeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <Youtube className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-none">
                    ShortsStack Desktop Engine Demo
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live Demo Video & Walkthrough
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setYoutubeModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 bg-slate-950">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner">
                <iframe
                  className="w-full h-full"
                  src={
                    youtubeDemoUrl.includes('watch?v=')
                      ? youtubeDemoUrl.replace('watch?v=', 'embed/')
                      : youtubeDemoUrl
                  }
                  title="ShortsStack Desktop Engine Demo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 14. CONTACT QR CODE SCANNING MODAL */}
      {/* ===================================================================== */}
      {activeQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveQrModal(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveQrModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className={`w-12 h-12 rounded-2xl ${activeQrModal.badgeBg} text-white flex items-center justify-center font-bold text-lg shadow-md`}>
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                {lang === 'vi'
                  ? `Quét Mã QR ${activeQrModal.appName}`
                  : lang === 'zh'
                    ? `扫描 ${activeQrModal.appName} 二维码`
                    : `Scan ${activeQrModal.appName} QR Code`}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                {lang === 'vi'
                  ? `Mở camera điện thoại hoặc ứng dụng ${activeQrModal.appName} để quét mã và kết nối ngay.`
                  : lang === 'zh'
                    ? `请使用手机 ${activeQrModal.appName} 或相机扫描二维码直接添加。`
                    : `Open ${activeQrModal.appName} or your phone camera to scan and connect directly.`}
              </p>
            </div>

            {/* High-Res QR Code Preview */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center shadow-inner">
              <img
                src={activeQrModal.qrImage}
                alt={activeQrModal.appName}
                className="w-56 h-56 object-contain rounded-xl bg-white shadow-xs p-2 border border-slate-100"
              />
            </div>

            {/* Account Info Pill */}
            <div className="text-xs font-semibold text-slate-700 bg-slate-100 py-2 px-3 rounded-xl truncate">
              {activeQrModal.accountInfo}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <a
                href={activeQrModal.directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 py-2.5 rounded-xl ${activeQrModal.buttonColor} text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm`}
              >
                <span>{lang === 'vi' ? 'Mở Trực Tiếp' : lang === 'zh' ? '直接打开' : 'Open Link'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setActiveQrModal(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                {lang === 'vi' ? 'Đóng' : lang === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
