export type Language = 'vi' | 'en' | 'zh';

export interface TranslationDictionary {
  nav: {
    features: string;
    browsers: string;
    demo: string;
    calculator: string;
    pricing: string;
    faq: string;
    contact: string;
    download: string;
    adminPortal: string;
  };
  hero: {
    badge: string;
    titleLine1: string;
    titleGradient: string;
    titleLine2: string;
    description: string;
    downloadBtn: string;
    demoBtn: string;
    pricingBtn: string;
    downloadSub: string;
    trustWindows: string;
    trustHwid: string;
    trustAntiBan: string;
    trustBrowsers: string;
  };
  ticker: {
    title: string;
    items: string[];
  };
  mockup: {
    windowTitle: string;
    statusActive: string;
    tabDashboard: string;
    tabAiEngine: string;
    tabBrowsers: string;
    tabScheduler: string;
    statChannels: string;
    statQueue: string;
    statViews: string;
    statFollowers: string;
    channelName: string;
    channelStatus: string;
    aiStep1: string;
    aiStep2: string;
    aiStep3: string;
    aiStep4: string;
  };
  features: {
    badge: string;
    title: string;
    subtitle: string;
    items: Array<{
      tag: string;
      title: string;
      desc: string;
      highlight: string;
    }>;
  };
  browsers: {
    badge: string;
    title: string;
    subtitle: string;
    gpmTitle: string;
    gpmDesc: string;
    genTitle: string;
    genDesc: string;
    benefit1Title: string;
    benefit1Desc: string;
    benefit2Title: string;
    benefit2Desc: string;
    benefit3Title: string;
    benefit3Desc: string;
  };
  calculator: {
    badge: string;
    title: string;
    subtitle: string;
    channelsLabel: string;
    videosPerDayLabel: string;
    avgViewsLabel: string;
    monthlyViews: string;
    estRevenue: string;
    disclaimer: string;
    ctaBtn: string;
  };
  pricing: {
    badge: string;
    title: string;
    subtitle: string;
    lifetimeBadge: string;
    popularBadge: string;
    currency: string;
    payOnce: string;
    buyBtn: string;
    plan1Name: string;
    plan1Desc: string;
    plan2Name: string;
    plan2Desc: string;
    plan3Name: string;
    plan3Desc: string;
    features1: string[];
    features2: string[];
    features3: string[];
    guarantee: string;
  };
  reviews: {
    badge: string;
    title: string;
    subtitle: string;
    items: Array<{
      name: string;
      role: string;
      content: string;
      metric: string;
      rating: number;
      avatar: string;
    }>;
  };
  faq: {
    badge: string;
    title: string;
    subtitle: string;
    items: Array<{
      q: string;
      a: string;
    }>;
  };
  cta: {
    badge: string;
    title: string;
    subtitle: string;
    btnDownload: string;
    btnPricing: string;
    btnContact: string;
    guaranteeOneTime: string;
    guaranteeHwid: string;
    guaranteeSupport: string;
  };
  contact: {
    badge: string;
    title: string;
    subtitle: string;
    directTitle: string;
    directSubtitle: string;
    zaloLabel: string;
    emailLabel: string;
    facebookLabel: string;
    whatsappLabel: string;
    formName: string;
    formEmail: string;
    formPhone: string;
    formTopic: string;
    formMessage: string;
    formSubmit: string;
    formSending: string;
    formSuccess: string;
    topicOptions: string[];
    guaranteeText: string;
  };
  checkout: {
    titleInput: string;
    titlePayment: string;
    titleSuccess: string;
    subInput: string;
    subPayment: string;
    subSuccess: string;
    customerNameLabel: string;
    customerNamePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    emailHint: string;
    proceedBtn: string;
    creatingOrder: string;
    backBtn: string;
    bankNameLabel: string;
    accountNoLabel: string;
    accountNameLabel: string;
    amountLabel: string;
    contentLabel: string;
    copyBtn: string;
    copied: string;
    waitingPayment: string;
    paymentNote: string;
    successMessage: string;
    licenseKeyLabel: string;
    guideTitle: string;
    guideStep1: string;
    guideStep2: string;
    guideStep3: string;
    downloadInstallerBtn: string;
    doneBtn: string;
  };
  footer: {
    tagline: string;
    desc1: string;
    desc2: string;
    col1Title: string;
    col1Links: string[];
    col2Title: string;
    col2Links: string[];
    col3Title: string;
    col3Links: string[];
    copyright: string;
    systemStatus: string;
    securityBadge: string;
    disclaimer: string;
    privacy: string;
    terms: string;
  };
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  vi: {
    nav: {
      features: 'Tính Năng',
      browsers: 'Trình Duyệt Antidetect CDP',
      demo: 'Video Demo',
      calculator: 'Tính Doanh Thu',
      pricing: 'Bảng Giá',
      faq: 'Hỏi Đáp',
      contact: 'Liên Hệ',
      download: 'Tải Về Ngay',
      adminPortal: 'Cổng Quản Trị',
    },
    hero: {
      badge: 'Bản Phát Hành 1.0.1 • Tích Hợp GPMLogin & GenLogin • Auto-Pilot AI Engine',
      titleLine1: 'Hệ Thống Tự Động Hóa',
      titleGradient: 'Sản Xuất Video Ngắn AI',
      titleLine2: '& Vận Hành Đa Kênh Chuyên Nghiệp',
      description:
        'Giải pháp toàn diện cho Creator, Media Studio và MMO Agency: Tự động hóa khai thác tư liệu, biên tập video 9:16 độc bản với thuật toán quang học thông minh (Ken Burns, Pan-Zoom, Color Jitter), lồng tiếng AI ElevenLabs đa ngôn ngữ và điều khiển trình duyệt GPMLogin, GenLogin xuất bản lịch đăng mượt mà.',
      downloadBtn: 'Tải Bản Windows (64-bit)',
      demoBtn: 'Xem Video Trực Tiếp',
      pricingBtn: 'Xem Bảng Giá',
      downloadSub: 'Tương thích Win 10/11 • Kèm hướng dẫn cài đặt',
      trustWindows: 'Tương thích Windows 10/11 64-bit',
      trustHwid: 'Bảo mật khóa phần cứng HWID độc quyền',
      trustAntiBan: 'Mô phỏng thao tác người dùng thật qua CDP',
      trustBrowsers: 'Điều khiển GPMLogin & GenLogin thời gian thực',
    },
    ticker: {
      title: 'Hoạt Động Trực Tiếp',
      items: [
        'Kênh @tech_viral vừa tự động xuất bản 4 video ngắn lên TikTok Creators',
        'Khách hàng 098****321 vừa kích hoạt bản quyền Studio 3 PCs',
        'Chiến dịch #TechDaily đã render thành công 18 video chuẩn 9:16',
        'Telegram Bot vừa gửi cảnh báo: Kênh @us_daily cán mốc 10.500 Follower',
        'Hệ thống tự động đồng bộ 24 Profile GPMLogin với IP US chuyên biệt',
        'Đã xuất xưởng bộ giọng đọc ElevenLabs biểu cảm chuẩn ngữ cảnh cho 12 video',
      ],
    },
    mockup: {
      windowTitle: 'ShortsStack Desktop Engine v1.0.1 - [Quy Trình Auto-Pilot: Đang Hoạt Động]',
      statusActive: 'Hệ Thống Đang Chạy Ngầm',
      tabDashboard: 'Bảng Điều Khiển',
      tabAiEngine: 'Bộ Render AI',
      tabBrowsers: 'Trình Duyệt GPMLogin',
      tabScheduler: 'Lập Lịch Đăng',
      statChannels: 'Tổng Số Kênh',
      statQueue: 'Video Đang Chờ',
      statViews: 'Lượt Xem 24h',
      statFollowers: 'Tổng Follower',
      channelName: 'Hồ Sơ Kênh TikTok Creators US #01',
      channelStatus: 'Trạng thái ổn định • Đang xuất bản theo lịch trình',
      aiStep1: 'Thu thập & trích xuất tư liệu 1080p sắc nét',
      aiStep2: 'Tái tạo độc bản: Ken Burns, Color Jitter & Micro-Noise',
      aiStep3: 'Lồng tiếng ElevenLabs & Render phụ đề động ASS',
      aiStep4: 'Đồng bộ Antidetect Browser tự động xuất bản',
    },
    features: {
      badge: 'Công Nghệ Đột Phá',
      title: 'Quy Trình Sản Xuất & Xuất Bản Video Đa Kênh Tự Động',
      subtitle:
        'Được tối ưu chuyên biệt cho các Media Studio, Nhà sáng tạo nội dung số và Agency quản trị hệ thống kênh TikTok, YouTube Shorts và Facebook Reels quy mô lớn.',
      items: [
        {
          tag: 'KHAI THÁC TƯ LIỆU',
          title: 'Thu Thập & Trích Xuất Tư Liệu Video 1080p Đa Nguồn',
          desc: 'Tự động quét theo từ khóa, hashtag hoặc danh mục mục tiêu từ Douyin, Xiaohongshu và YouTube. Trích xuất video nguồn độ phân giải cao, làm sạch siêu dữ liệu gốc và chuẩn hóa tỷ lệ khung hình 9:16.',
          highlight: 'Tốc độ tải đa luồng cực nhanh, bảo toàn chất lượng',
        },
        {
          tag: 'AI UNIQUENESS ENGINE',
          title: 'Bộ Xử Lý Độc Bản Video AI Đa Tầng',
          desc: 'Ứng dụng công nghệ xử lý hình ảnh tiên tiến: chuyển động quang học Ken Burns mượt mà, phân cấp màu sắc vi sai (micro-noise), biến tần âm thanh tự nhiên và làm mới hoàn toàn cấu trúc keyframe của video.',
          highlight: 'Vượt qua các tầng kiểm duyệt thuật toán nghiêm ngặt',
        },
        {
          tag: 'VOICEOVER & SUBTITLES',
          title: 'Bản Địa Hóa Kịch Bản, Lồng Tiếng AI & Phụ Đề Động',
          desc: 'Tự động dịch thuật và bản địa hóa nội dung chuẩn ngữ cảnh bản xứ. Tích hợp giọng đọc AI ElevenLabs biểu cảm tự nhiên và tự động render phụ đề động (Dynamic Animated Subtitles) chuẩn phong cách viral.',
          highlight: 'Tối ưu giữ chân người xem (Audience Retention)',
        },
        {
          tag: 'ANTIDETECT BROWSER',
          title: 'Điều Khiển Trình Duyệt GPMLogin & GenLogin',
          desc: 'Tương tác trực tiếp qua giao thức Chrome DevTools Protocol (CDP), giữ nguyên cookie, canvas và fingerprint chuẩn thiết bị thực như người dùng thao tác chuột tự nhiên.',
          highlight: 'Cô lập hoàn toàn môi trường từng hồ sơ',
        },
        {
          tag: 'AUTO SCHEDULER',
          title: 'Lập Lịch & Phân Bổ Bài Đăng Theo Khung Giờ Vàng',
          desc: 'Cấu hình xuất bản thông minh theo múi giờ mục tiêu (US, UK, DE, VN). Phần mềm tự động khởi chạy hồ sơ, kết nối proxy chuyên biệt và kích hoạt xuất bản đúng khung giờ có tương tác cao nhất.',
          highlight: 'Hoạt động bền bỉ 24/7 không cần can thiệp',
        },
        {
          tag: 'SMART TELEMETRY',
          title: 'Giám Sát Chỉ Số & Cảnh Báo Telegram Real-Time',
          desc: 'Theo dõi chỉ số tăng trưởng follower và lượt xem liên tục. Tự động gửi thông báo tức thì về điện thoại qua Telegram Bot khi kênh đạt các cột mốc quan trọng (1.000, 10.000 Followers) để kịp thời kích hoạt các tính năng nâng cao.',
          highlight: 'Nắm bắt tiến độ tăng trưởng dàn kênh thời gian thực',
        },
      ],
    },
    browsers: {
      badge: 'Công Nghệ Cách Ly Trình Duyệt',
      title: 'Tích Hợp Sâu Trình Duyệt Antidetect Tiêu Chuẩn Doanh Nghiệp',
      subtitle:
        'Khác biệt hoàn toàn với các công cụ can thiệp bằng API không chính thức dễ bị hệ thống bảo mật phát hiện, ShortsStack điều khiển hồ sơ trình duyệt thực thông qua giao thức CDP chuẩn mở.',
      gpmTitle: 'Kết Nối Trực Tiếp GPMLogin',
      gpmDesc: 'Giao tiếp qua Local API tự động. Tự động lấy danh sách profile, mở đúng proxy và quản lý tài nguyên máy tính tối ưu.',
      genTitle: 'Hỗ Trợ Toàn Diện GenLogin',
      genDesc: 'Tự động kết nối GenLogin qua giao thức CDP. Điều khiển trình duyệt mượt mà, hỗ trợ môi trường đa luồng không giật lag.',
      benefit1Title: 'Dấu Vân Tay Số (Fingerprint) Độc Lập',
      benefit1Desc: 'Mỗi kênh vận hành trong một sandbox tách biệt với các thông số Canvas, WebGL, Audio và Fonts của thiết bị thực tế.',
      benefit2Title: 'Định Tuyến Proxy Cố Định Theo Hồ Sơ',
      benefit2Desc: 'Mỗi hồ sơ được gán cố định với địa chỉ IP/Proxy riêng biệt, đảm bảo tính nhất quán về vị trí địa lý của thị trường mục tiêu.',
      benefit3Title: 'Giao Thức Tương Tác Chuẩn CDP',
      benefit3Desc: 'Mọi thao tác tải lên, nhập tiêu đề và gắn hashtag đều được mô phỏng theo chuyển động chuột và gõ phím tự nhiên của con người.',
    },
    calculator: {
      badge: 'Dự Báo Tiềm Năng',
      title: 'Ước Tính Doanh Thu Với ShortsStack',
      subtitle: 'Khảo sát mô hình doanh thu tiềm năng khi vận hành hệ sinh thái nội dung ngắn tự động trên các nền tảng TikTok Creator Rewards, YouTube Shorts và Facebook Reels.',
      channelsLabel: 'Số lượng kênh vận hành song song:',
      videosPerDayLabel: 'Số video đăng tự động mỗi kênh/ngày:',
      avgViewsLabel: 'Lượt xem trung bình mỗi video:',
      monthlyViews: 'Tổng lượt xem ước tính / tháng',
      estRevenue: 'Doanh thu tiềm năng ước tính / tháng',
      disclaimer: '* Dự báo dựa trên mức RPM trung bình $0.40 - $0.80 của chương trình TikTok Creator Rewards US/EU. Kết quả thực tế tùy thuộc vào chất lượng chủ đề và độ viral của nội dung.',
      ctaBtn: 'Bắt Đầu Vận Hành Ngay',
    },
    pricing: {
      badge: 'Đầu Tư 1 Lần - Sử Dụng Trọn Đời',
      title: 'Bảng Giá Phần Mềm',
      subtitle: 'Không phí duy trì hàng tháng. Không phụ phí ẩn. Được cập nhật toàn bộ tính năng mới miễn phí trọn đời.',
      lifetimeBadge: 'VĨNH VIỄN',
      popularBadge: 'ĐƯỢC CHỌN NHIỀU NHẤT',
      currency: '₫',
      payOnce: 'Thanh toán 1 lần duy nhất',
      buyBtn: 'Mua Bản Quyền Ngay',
      plan1Name: 'Gói Cá Nhân Pro',
      plan1Desc: 'Phù hợp cho cá nhân khởi nghiệp quản trị 3 - 5 profiles trên 1 máy tính.',
      plan2Name: 'Gói Studio Team',
      plan2Desc: 'Lựa chọn số 1 cho nhóm 2-3 người làm quy mô vừa và lớn với dàn 3 máy tính.',
      plan3Name: 'Gói Doanh Nghiệp (Agency)',
      plan3Desc: 'Giải pháp riêng biệt cho các Studio & Xưởng MMO vận hành từ 5 máy trở lên.',
      features1: [
        '1 Key gắn cố định vào 1 máy tính (Khóa HWID)',
        'Sử dụng vĩnh viễn (Thanh toán 1 lần trọn đời)',
        'Tối đa 3 - 5 Profiles antidetect (GPMLogin / GenLogin)',
        'Xử lý tuần tự đơn luồng ổn định',
        'Đổi máy mới hoặc nâng cấp: hỗ trợ chuyển key (tối đa 2 lần/tháng)',
        'Hỗ trợ kỹ thuật 1-1 cài đặt qua UltraViewer',
        'Cập nhật định kỳ tính năng mới miễn phí',
        'Khai thác tư liệu 1080p từ Douyin, Xiaohongshu',
        'Bản địa hóa kịch bản & lồng tiếng AI ElevenLabs',
      ],
      features2: [
        'Kích hoạt cùng lúc 3 Máy Tính độc lập',
        'Sử dụng vĩnh viễn trọn đời cho cả 3 máy',
        'Không giới hạn Profile / Kênh vận hành',
        'Mở khóa render đa luồng GPU NVENC siêu tốc',
        'Reset HWID linh hoạt chuyển đổi máy trạm cho cả nhóm',
        'Hỗ trợ kỹ thuật 1-1 tối ưu hệ thống qua UltraViewer',
        'Cập nhật định kỳ tính năng mới miễn phí',
        'Ưu tiên kết nối server render AI tốc độ cao',
        'Tham gia nhóm kín chia sẻ ngách video viral',
      ],
      features3: [
        'Kích hoạt cùng lúc 5 Máy Tính độc lập',
        'Sử dụng vĩnh viễn trọn đời',
        'Mọi tính năng của Gói Studio Team',
        'Phân quyền quản trị key và HWID chuyên biệt',
        'Hỗ trợ riêng qua Hotline / Telegram VIP 24/7',
        'Tùy chỉnh tính năng riêng theo yêu cầu Studio',
        'Bảo hành phần mềm & cam kết cập nhật đầu tiên',
      ],
      guarantee: 'Cam kết hỗ trợ cài đặt kích hoạt thành công 100%. Đổi máy mới (Reset HWID) dễ dàng qua Admin.',
    },
    reviews: {
      badge: 'Cảm Nhận Khách Hàng',
      title: 'Được Tin Dùng Bởi +500 Nhà Sáng Tạo',
      subtitle: 'Xem những người làm MMO thực chiến chia sẻ về hiệu quả tự động hóa cùng ShortsStack.',
      items: [
        {
          name: 'Hoàng Nam',
          role: 'MMO Creator • Kênh US Niche Story',
          content: 'Trước đây mình phải ngồi cắt video và đăng tay từng profile, mất 6 tiếng mỗi ngày. Từ khi dùng ShortsStack, phần mềm tự render và tự mở GPMLogin đăng đúng giờ. Sau 3 tuần đã có 4 kênh cắn đề xuất bật được kiếm tiền!',
          metric: '4 Kênh Đạt 10K Follower',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Đặng Tuấn Anh',
          role: 'Founder Media Automation Studio (12 Nhân Sự)',
          content: 'ShortsStack giúp studio giải phóng 80% thời gian biên tập. Tư liệu video được tái tạo chỉ số độc bản rất mượt mà, phụ đề ElevenLabs chuẩn từng câu chữ, hiệu suất sản xuất tăng gấp 3 lần.',
          metric: '$4,200/tháng Doanh Thu',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Minh Trang',
          role: 'Kênh Review & Sáng Tạo Video Ngắn',
          content: 'Thích nhất là tính năng điều khiển GenLogin mượt mà, không bao giờ gặp lỗi phiên do dùng CDP chuẩn. Giao diện desktop rất trực quan, đầu tư bản quyền vĩnh viễn tiết kiệm rất nhiều chi phí so với thuê SaaS hàng tháng!',
          metric: 'Quản Lý 80+ Hồ Sơ Ổn Định',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Lê Bảo Long',
          role: 'Chủ Kênh YouTube Shorts 450K Subs',
          content: 'Tính năng tái tạo video độc bản tự động với Ken Burns và Color Jitter hoạt động quá xuất sắc. Tỷ lệ trùng lặp nội dung giảm từ 60% xuống gần như 0%. Lượng view Shorts tăng vọt và giữ phong độ rất ổn định.',
          metric: '+28.5M Views / Tháng',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Nguyễn Quỳnh Nga',
          role: 'TikTok Shop & Affiliate Creator',
          content: 'Phòng thu ElevenLabs tích hợp sẵn dịch tiếng Anh và lồng giọng chuẩn Tây bản xứ nghe cực kỳ cuốn hút. Dàn 25 tài khoản TikTok Shop của mình ra đơn đều đặn mỗi ngày mà không tốn tiền thuê voice talent.',
          metric: '350+ Đơn Hàng / Tuần',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Trần Khắc Huy',
          role: 'Trưởng Nhóm MCN Video Automation',
          content: 'Đội ngũ hỗ trợ qua Zalo và UltraViewer cực kỳ tận tình, setup xong toàn bộ dàn máy trạm 5 PC trong chưa đầy 30 phút. Phần mềm chạy ngầm êm ái, GPU NVENC render video 1080p 60FPS chỉ mất vài giây.',
          metric: 'Vận Hành 120 Nick Mượt Mà',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
        },
      ],
    },
    faq: {
      badge: 'Giải Đáp Thắc Mắc',
      title: 'Những Câu Hỏi Thường Gặp',
      subtitle: 'Mọi thông tin bạn cần biết trước khi sở hữu bản quyền phần mềm ShortsStack.',
      items: [
        {
          q: 'Cơ chế tự động hóa của ShortsStack có đảm bảo an toàn cho hồ sơ tài khoản không?',
          a: 'ShortsStack tuân thủ triệt để nguyên lý mô phỏng hành vi người dùng thật (Human-like Browser Automation). Phần mềm không sử dụng các endpoint API không chính thức dễ bị nền tảng phát hiện, mà giao tiếp trực tiếp với Antidetect Browser (GPMLogin, GenLogin) qua giao thức Chrome DevTools Protocol (CDP). Mọi thông số phần cứng, Canvas, Audio, WebGL và Cookie được giữ nguyên bản trên từng phiên duyệt độc lập, đảm bảo môi trường tương tác an toàn tối đa.',
        },
        {
          q: 'Tôi đổi máy tính mới thì bản quyền có dùng tiếp được không?',
          a: 'Có. Mỗi key được liên kết theo mã phần cứng (HWID) máy tính để bảo mật. Khi bạn nâng cấp hoặc đổi máy tính mới, chỉ cần liên hệ Admin hỗ trợ Reset HWID linh hoạt, bạn có thể kích hoạt lại trên máy mới nhanh chóng.',
        },
        {
          q: 'Cách nhận các bản cập nhật mới nhất như thế nào?',
          a: 'Mỗi khi mở ứng dụng, ShortsStack sẽ tự động kết nối với máy chủ để kiểm tra phiên bản mới. Nếu có tính năng mới hoặc bản vá thuật toán, phần mềm sẽ hiển thị thông báo để bạn cập nhật chỉ bằng một cú click chuột.',
        },
        {
          q: 'Tôi cần chuẩn bị môi trường phần cứng và tài nguyên gì để vận hành?',
          a: 'Bạn chỉ cần máy tính chạy Windows 10 hoặc 11 64-bit (khuyến nghị RAM từ 16GB, card đồ họa rời NVIDIA để tối ưu tốc độ render GPU NVENC), cài đặt sẵn GPMLogin hoặc GenLogin cùng với danh sách Proxy của thị trường bạn định hướng phát triển nội dung.',
        },
        {
          q: 'Sau khi chuyển khoản VietQR, bao lâu tôi nhận được mã kích hoạt?',
          a: 'Hệ thống xác nhận thanh toán VietQR hoàn toàn tự động 24/7. Ngay khi giao dịch ngân hàng thành công (thông thường chỉ mất 3 - 5 giây), mã License Key sẽ hiển thị ngay trên màn hình và đồng thời được gửi về email của bạn.',
        },
      ],
    },
    checkout: {
      titleInput: 'Nhận Bản Quyền ShortsStack Vĩnh Viễn',
      titlePayment: 'Quét Mã VietQR Kích Hoạt Tự Động',
      titleSuccess: 'Bản Quyền Đã Được Kích Hoạt Thành Công!',
      subInput: 'Thanh toán 1 lần - Sử dụng trọn đời - Không gia hạn hàng tháng',
      subPayment: 'Hệ thống tự động kích hoạt mã key trong 3 - 5 giây sau khi chuyển khoản',
      subSuccess: 'Sao chép mã bản quyền và dán vào ứng dụng Desktop để mở khóa',
      customerNameLabel: 'Họ và tên của bạn',
      customerNamePlaceholder: 'ví dụ: Nguyễn Văn A',
      emailLabel: 'Địa chỉ Email nhận mã bản quyền',
      emailPlaceholder: 'email_cua_ban@gmail.com',
      emailHint: 'Mã License Key và hóa đơn sẽ được gửi tự động về địa chỉ email này.',
      proceedBtn: 'Tiếp Tục Đến Bước Thanh Toán VietQR',
      creatingOrder: 'Đang tạo đơn hàng...',
      backBtn: 'Quay lại',
      bankNameLabel: 'Ngân hàng thụ hưởng',
      accountNoLabel: 'Số tài khoản',
      accountNameLabel: 'Chủ tài khoản',
      amountLabel: 'Số tiền thanh toán',
      contentLabel: 'Nội dung chuyển khoản (bắt buộc đúng)',
      copyBtn: 'Sao chép',
      copied: 'Đã chép!',
      waitingPayment: 'Đang chờ hệ thống ngân hàng xác nhận giao dịch...',
      paymentNote: 'Lưu ý: Quét mã QR bằng App ngân hàng để tự động điền đúng số tiền và nội dung chuyển khoản.',
      successMessage: 'Cảm ơn bạn! Đơn hàng của bạn đã được thanh toán và kích hoạt thành công.',
      licenseKeyLabel: 'Mã Bản Quyền Của Bạn (License Key):',
      guideTitle: 'Hướng dẫn kích hoạt trong 30 giây:',
      guideStep1: 'Mở ứng dụng ShortsStack Desktop trên máy tính.',
      guideStep2: 'Dán mã License Key ở trên vào ô kích hoạt bản quyền.',
      guideStep3: 'Bấm Kích Hoạt để mở khóa toàn bộ tính năng sản xuất & tự động hóa đa kênh!',
      downloadInstallerBtn: 'Tải Bộ Cài Đặt (.exe)',
      doneBtn: 'Hoàn Tất & Đóng',
    },
    cta: {
      badge: 'Bắt Đầu Ngay Hôm Nay',
      title: 'Sẵn Sàng Tự Động Hóa Hệ Thống Sản Xuất Video Ngắn Của Bạn?',
      subtitle: 'Tải ngay phần mềm ShortsStack cho Windows 64-bit hoặc sở hữu License bản quyền vĩnh viễn không phí duy trì hàng tháng. Hỗ trợ kỹ thuật 24/7 trực tiếp qua UltraViewer.',
      btnDownload: 'Tải Bản Windows (64-bit)',
      btnPricing: 'Sở Hữu Key Vĩnh Viễn',
      btnContact: 'Tư Vấn Miễn Phí',
      guaranteeOneTime: 'Bản quyền trọn đời 1 lần thanh toán',
      guaranteeHwid: 'Bảo mật khóa máy HWID độc quyền',
      guaranteeSupport: 'Hỗ trợ UltraViewer 24/7 siêu tốc',
    },
    contact: {
      badge: 'Kênh Hỗ Trợ 24/7',
      title: 'Liên Hệ & Đăng Ký Tư Vấn Trực Tiếp',
      subtitle: 'Đội ngũ kỹ thuật ShortsStack luôn sẵn sàng giải đáp thắc mắc, tư vấn cấu hình phần cứng tối ưu và hỗ trợ thiết lập hệ thống qua UltraViewer.',
      directTitle: 'Kênh Liên Lạc Trực Tiếp',
      directSubtitle: 'Kết nối ngay với chúng tôi qua các kênh dưới đây:',
      zaloLabel: 'Zalo Hotline / Tư Vấn Nhanh',
      emailLabel: 'Email Hỗ Trợ Trực Tiếp',
      facebookLabel: 'Fanpage ShortsStack Studio',
      whatsappLabel: 'WhatsApp Global Support',
      formName: 'Họ và tên của bạn',
      formEmail: 'Địa chỉ Email nhận phản hồi',
      formPhone: 'Số điện thoại / Zalo (tùy chọn)',
      formTopic: 'Gói cước hoặc chủ đề bạn quan tâm',
      formMessage: 'Nội dung lời nhắn hoặc câu hỏi của bạn',
      formSubmit: 'Gửi Yêu Cầu Liên Hệ',
      formSending: 'Đang gửi thông tin...',
      formSuccess: 'Cảm ơn bạn! Thông tin đã được gửi thành công tới thenguyenfiner@gmail.com. Chúng tôi sẽ phản hồi trong vòng 15 phút.',
      topicOptions: [
        'Tư vấn Gói Cá Nhân Pro (1 PC - Vĩnh Viễn)',
        'Tư vấn Gói Studio Team (3 PCs - Vĩnh Viễn)',
        'Tư vấn Gói Doanh Nghiệp / Farm lớn (> 5 máy)',
        'Hỗ trợ kỹ thuật / Cài đặt UltraViewer',
        'Hợp tác đại lý / MCN & Studio lớn',
      ],
      guaranteeText: 'Phản hồi trong vòng 15 phút • Hỗ trợ UltraViewer / TeamViewer cài đặt trực tiếp',
    },
    footer: {
      tagline: 'ShortsStack AI Studio',
      desc1: 'Nền tảng quản lý và tự động hóa vận hành kênh video quy mô lớn. Đồng bộ GPMLogin, ElevenLabs AI, tự động tối ưu hóa nội dung chuẩn thuật toán kiểm duyệt và theo dõi hiệu suất, doanh thu tập trung trên một hệ thống.',
      desc2: 'Chuyên biệt cho nhu cầu vận hành của Creator, Studio & MCN.',
      col1Title: 'VẬN HÀNH & SẢN PHẨM',
      col1Links: [
        'Chiến Dịch Auto-Pilot',
        'Studio Biên Tập Video 9:16',
        'Quản Lý Dàn Account (GPM)',
        'Báo Cáo Hiệu Suất & Doanh Thu',
        'Phòng Thu ElevenLabs AI',
        'Kho Âm Thanh & BGM',
      ],
      col2Title: 'TÀI LIỆU & HƯỚNG DẪN',
      col2Links: [
        'Hướng Dẫn Cài Đặt (Win 10/11)',
        'Cấu Hình GPMLogin & GenLogin',
        'Tối Ưu Tỷ Lệ Độc Bản & Thuật Toán',
        'Tải Bản Cài Đặt (.exe)',
        'Câu Hỏi Thường Gặp (FAQ)',
        'Nhật Ký Hệ Thống (Audit Logs)',
      ],
      col3Title: 'BẢO MẬT & HỖ TRỢ',
      col3Links: [
        'Trung Tâm Hỗ Trợ 24/7',
        'Kích Hoạt License Key',
        'Chính Sách Đổi Máy (HWID)',
        'Điều Khoản Dịch Vụ (TOS)',
        'Chính Sách Quyền Riêng Tư',
        'Cổng Đăng Nhập Quản Trị',
      ],
      copyright: '© 2026 ShortsStack Studio. Toàn bộ quyền được bảo lưu.',
      systemStatus: 'Tất cả hệ thống hoạt động bình thường',
      securityBadge: 'Kiến trúc Local-First • Bảo mật mã hóa phần cứng HWID • Render trực tiếp GPU máy trạm',
      disclaimer: 'Disclaimer: ShortsStack là nền tảng phần mềm quản trị vận hành độc lập, không trực thuộc, liên kết, bảo trợ hay được ủy quyền bởi TikTok Pte. Ltd. hoặc ByteDance Ltd.',
      privacy: 'Chính sách bảo mật',
      terms: 'Điều khoản sử dụng',
    },
  },

  en: {
    nav: {
      features: 'Features',
      browsers: 'Antidetect Browsers',
      demo: 'Live Demo',
      calculator: 'Revenue Calc',
      pricing: 'Pricing',
      faq: 'FAQ',
      contact: 'Contact',
      download: 'Download Now',
      adminPortal: 'Admin Portal',
    },
    hero: {
      badge: 'Release v1.0.1 • GPMLogin & GenLogin Integrated • AI Auto-Pilot',
      titleLine1: 'The Next-Gen Multi-Channel',
      titleGradient: 'AI Video Repurposing &',
      titleLine2: 'Channel Farming Auto-Pilot',
      description:
        'Download Douyin & Xiaohongshu videos with zero watermarks. Automatically bypass algorithmic duplicate-content filters across TikTok Beta, YouTube Shorts, and Facebook Reels via smart AI transformations, then publish seamlessly through real Antidetect Browsers.',
      downloadBtn: 'Download for Windows (64-bit)',
      demoBtn: 'Watch Live Demo',
      pricingBtn: 'View Pricing',
      downloadSub: 'Windows 10/11 compatible • Includes setup guide',
      trustWindows: 'Windows 10/11 64-bit fully certified',
      trustHwid: 'Hardware-bound HWID security protection',
      trustAntiBan: 'No 3rd-party API abuse — Zero shadowban risk',
      trustBrowsers: 'Real-time GPMLogin & GenLogin automation',
    },
    ticker: {
      title: 'Live Activity Stream',
      items: [
        'Channel @tech_viral just auto-published 4 videos to TikTok Beta',
        'Customer in Singapore activated a Studio Team 3-PC Lifetime license',
        'Campaign #CryptoStory rendered 18 viral 9:16 vertical clips with AI audio',
        'Telegram Alert: Channel @us_funny hit 10,500 followers milestone!',
        'System automatically synced 24 GPMLogin profiles with clean residential IPs',
        'ElevenLabs AI voiceover pipeline generated realistic audio for 12 videos',
      ],
    },
    mockup: {
      windowTitle: 'ShortsStack Desktop Engine v1.0.1 - [Auto-Pilot Pipeline: Active]',
      statusActive: 'Background Engine Running',
      tabDashboard: 'Overview Dashboard',
      tabAiEngine: 'AI Render Pipeline',
      tabBrowsers: 'GPMLogin Profiles',
      tabScheduler: 'Auto Scheduler',
      statChannels: 'Active Channels',
      statQueue: 'Queue In Progress',
      statViews: '24h Total Views',
      statFollowers: 'Total Followers',
      channelName: 'TikTok US Beta Farm #01',
      channelStatus: 'Healthy • Auto-farming engagement active',
      aiStep1: 'Scan & scrape Douyin watermark-free',
      aiStep2: 'Anti-detect: Ken Burns & micro noise',
      aiStep3: 'ElevenLabs voiceover & ASS subtitles',
      aiStep4: 'Auto-inject into GPMLogin for upload',
    },
    features: {
      badge: 'Core Capabilities',
      title: 'Fully Automated Content Operations',
      subtitle:
        'Engineered specifically for MMO studios, solo creators, and agencies managing dozens of monetization channels.',
      items: [
        {
          tag: 'WATERMARK-FREE',
          title: 'Scrape Douyin, Xiaohongshu & YouTube',
          desc: 'Automatically scan niche keywords or target accounts, batch download 1080p high-resolution clips with 100% watermark eradication.',
          highlight: 'High-speed multi-threaded scraper',
        },
        {
          tag: 'AI TRANSFORMATION ENGINE',
          title: 'Multi-Layer AI Video Re-Creation Engine',
          desc: 'Applies dynamic Ken Burns optical zoom, micro-noise color jitter, subtle audio pitch resample, and smart portrait orientation conversion.',
          highlight: 'Meets 4-tier content uniqueness standards',
        },
        {
          tag: 'VOICEOVER & SUBTITLE',
          title: 'AI Translation & Kinetic Karaoke Subs',
          desc: 'Paraphrase scripts into English or local languages, synthesize ultra-realistic ElevenLabs audio, and stamp viral kinetic karaoke subtitles.',
          highlight: 'Meets 60s+ Creator Rewards criteria',
        },
        {
          tag: 'ANTIDETECT BROWSER',
          title: 'Native GPMLogin & GenLogin Control',
          desc: 'Direct Chrome DevTools Protocol automation preserving native cookies, canvas hashes, WebGL, and human-like cursor movements.',
          highlight: 'Eliminates shadowban and API detection',
        },
        {
          tag: 'AUTO SCHEDULER',
          title: 'Intelligent Peak-Hours Auto-Publisher',
          desc: 'Program publication schedules for target timezones (US, UK, DE, VN). Automatically launches profiles, connects proxies, and publishes.',
          highlight: 'Continuous 24/7 autonomous runtime',
        },
        {
          tag: 'TELEGRAM MONITOR',
          title: 'Instant 10,000 Followers Alert',
          desc: 'Live follower tracker scanning account metrics in real time. Sends instant push notifications when a profile qualifies for monetization.',
          highlight: 'Apply for Creator Rewards without delay',
        },
      ],
    },
    browsers: {
      badge: 'Account Safety Guaranteed',
      title: 'Deep Antidetect Browser Integration',
      subtitle:
        'Say NO to cheap cloud API uploaders that get your accounts banned. ShortsStack drives authentic local browser profiles with genuine hardware fingerprints.',
      gpmTitle: 'Native GPMLogin Connection',
      gpmDesc: 'Communicates via automated Local API. Seamlessly opens assigned proxy profiles and manages low memory footprint.',
      genTitle: 'Comprehensive GenLogin CDP',
      genDesc: 'Hooks into GenLogin via Chrome DevTools Protocol. Smooth multi-tab execution without UI lag.',
      benefit1Title: '100% Genuine Fingerprints',
      benefit1Desc: 'Each channel runs in a sandbox with unique Canvas, WebGL, AudioContext, and OS font hashes.',
      benefit2Title: 'Dedicated Proxy Binding',
      benefit2Desc: 'Profiles are permanently pinned to clean residential proxies for accurate geolocated uploads.',
      benefit3Title: 'Zero Suspicious API Calls',
      benefit3Desc: 'TikTok and YouTube inspect all interactions as authentic user clicks, scrolling, and keystrokes.',
    },
    calculator: {
      badge: 'Potential Forecast',
      title: 'Estimate Your Monthly Revenue',
      subtitle: 'Simulate your earnings potential when deploying automated video farming on TikTok Creator Rewards and YouTube Shorts.',
      channelsLabel: 'Active channels running concurrently:',
      videosPerDayLabel: 'Automated videos published per channel/day:',
      avgViewsLabel: 'Average views per video:',
      monthlyViews: 'Estimated Monthly Views',
      estRevenue: 'Potential Monthly Earnings',
      disclaimer: '* Projection calculated with an average $0.40 - $0.80 RPM standard for US/EU TikTok Creator Rewards. Actual performance depends on niche engagement and algorithmic virality.',
      ctaBtn: 'Start Channel Farming Today',
    },
    pricing: {
      badge: 'One-Time Investment • Lifetime Access',
      title: 'Software Pricing',
      subtitle: 'No monthly subscriptions. No recurring fees. Free lifetime updates and new feature releases included.',
      lifetimeBadge: 'LIFETIME',
      popularBadge: 'MOST POPULAR',
      currency: '₫',
      payOnce: 'One-time payment',
      buyBtn: 'Get Lifetime License',
      plan1Name: 'Personal Pro',
      plan1Desc: 'Ideal for solo creators managing 3 - 5 profiles on a single computer.',
      plan2Name: 'Studio Team',
      plan2Desc: 'The #1 choice for content studios running multiple rigs with 3 computers.',
      plan3Name: 'Enterprise Agency',
      plan3Desc: 'Custom solution for high-volume content farms operating 5+ machines.',
      features1: [
        '1 PC Activation (Hardware HWID bound)',
        'Lifetime license (Never expires)',
        'Up to 3 - 5 Antidetect Profiles (GPMLogin / GenLogin)',
        'Sequential single-thread rendering pipeline',
        'Hardware upgrade / PC transfer: up to 2 times/month',
        '1-on-1 UltraViewer installation assistance',
        'Regular feature updates included',
        'High-quality Douyin & Xiaohongshu video downloader',
        'AI script localization & ElevenLabs voiceover',
      ],
      features2: [
        '3 PCs Simultaneous Independent Activation',
        'Lifetime license for all 3 machines',
        'Unlimited Profiles & Channels',
        'Unlocked multi-thread NVENC GPU accelerated rendering',
        'Flexible HWID reset for team machine rotation',
        '1-on-1 UltraViewer setup & optimization support',
        'Regular feature updates included',
        'Priority high-speed AI render queue',
        'Access to private mastermind & viral niche group',
      ],
      features3: [
        '5 PCs Simultaneous Independent Activation',
        'Lifetime unlimited access',
        'Everything in Studio Team',
        'Dedicated admin license management portal',
        'VIP 24/7 hotline and Telegram support',
        'Custom feature requests tailored for your studio',
        'Software warranty & first-access update channel',
      ],
      guarantee: '100% guaranteed installation & activation. Hassle-free machine migration (Reset HWID) through admin.',
    },
    reviews: {
      badge: 'Verified Customer Reviews',
      title: 'Trusted by 500+ Content Creators',
      subtitle: 'Discover how professional creators scale viral content with ShortsStack.',
      items: [
        {
          name: 'Alex Rivera',
          role: 'US Faceless Content Creator',
          content: 'I used to spend 6 hours every day manually trimming clips and logging into multiple accounts. With ShortsStack, everything renders automatically and uploads via GPMLogin on schedule. Hit monetization on 4 channels within 3 weeks!',
          metric: '4 Monetized Channels',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Kevin Zhao',
          role: 'Studio Founder • 12-Member Team',
          content: 'The 5-PC Agency plan saved our team over 80% in editorial overhead. Douyin videos are converted flawlessly with accurate ElevenLabs narration. Our TikTok Creator Rewards payout exceeded $4,200 last month.',
          metric: '$4,200/mo Revenue',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Sarah Jenkins',
          role: 'Affiliate Marketing Specialist',
          content: 'The GenLogin integration is bulletproof — zero bans because it operates through a real browser instance. The lifetime license pricing is an absolute steal compared to monthly SaaS tools.',
          metric: '80+ Profiles Managed',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Liam Crawford',
          role: 'YouTube Shorts Creator (450K Subs)',
          content: 'The automated video re-creation using Ken Burns and micro color jitter is unmatched. Content ID duplicate claims dropped from 60% down to practically 0%. View counts have stayed consistently viral.',
          metric: '+28.5M Views / Month',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Elena Rostova',
          role: 'TikTok Shop & Affiliate Creator',
          content: 'The integrated ElevenLabs studio with native English translation produces super engaging native voiceovers. My 25 TikTok Shop accounts are converting daily without needing freelance voice actors.',
          metric: '350+ Sales / Week',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: 'Marcus Vance',
          role: 'Head of Video Automation MCN',
          content: 'UltraViewer onboarding was instantaneous — our entire 5-PC workstation cluster was configured in under 30 minutes. Silent background operation with NVENC GPU render takes literally seconds per clip.',
          metric: '120 Channels Managed',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
        },
      ],
    },
    faq: {
      badge: 'Got Questions?',
      title: 'Frequently Asked Questions',
      subtitle: 'Everything you need to know about the ShortsStack platform and licensing.',
      items: [
        {
          q: 'Will using this tool get my TikTok or YouTube accounts banned?',
          a: 'No. ShortsStack completely avoids cheap, flagged third-party APIs. Instead, it automates authentic local Antidetect Browsers (GPMLogin, GenLogin) via Chrome DevTools Protocol (CDP). Every action simulates real human cursor movements, authentic canvas hashes, and genuine cookies.',
        },
        {
          q: 'Can I transfer my license if I upgrade or buy a new computer?',
          a: 'Yes. Each license key is cryptographically tied to your computer hardware ID (HWID). When changing machines, simply reach out to support for a free HWID reset and reactivate on your new PC within 60 seconds.',
        },
        {
          q: 'How do software updates work?',
          a: 'Every time you launch ShortsStack, it checks our servers for new releases. Whenever platform algorithm updates or new features are deployed, a 1-click update prompt will appear to automatically update your app.',
        },
        {
          q: 'What system requirements are needed?',
          a: 'Windows 10 or 11 (64-bit), 8GB - 16GB RAM recommended, GPMLogin or GenLogin installed, and clean residential proxies configured for your profiles.',
        },
        {
          q: 'How fast will I receive my license key after payment?',
          a: 'Payment verification is 100% automated 24/7. As soon as the transaction clears (typically 3 - 5 seconds), your License Key appears immediately on screen and is also delivered to your email.',
        },
      ],
    },
    checkout: {
      titleInput: 'Get Your Lifetime ShortsStack License',
      titlePayment: 'Scan VietQR to Instantly Activate',
      titleSuccess: 'License Key Activated Successfully!',
      subInput: 'One-time payment • Lifetime access • No monthly renewal fees',
      subPayment: 'System automatically confirms payment in 3 - 5 seconds',
      subSuccess: 'Copy your license key and paste it into the desktop app',
      customerNameLabel: 'Your Full Name',
      customerNamePlaceholder: 'e.g. John Doe',
      emailLabel: 'Email address to receive license',
      emailPlaceholder: 'your_email@gmail.com',
      emailHint: 'Your license key and invoice will be automatically emailed here.',
      proceedBtn: 'Proceed to Payment',
      creatingOrder: 'Generating payment order...',
      backBtn: 'Back',
      bankNameLabel: 'Beneficiary Bank',
      accountNoLabel: 'Account Number',
      accountNameLabel: 'Account Holder',
      amountLabel: 'Amount',
      contentLabel: 'Transfer Message (Exact match required)',
      copyBtn: 'Copy',
      copied: 'Copied!',
      waitingPayment: 'Waiting for banking network confirmation...',
      paymentNote: 'Tip: Scan with any banking app to automatically fill the exact amount and memo.',
      successMessage: 'Thank you! Your payment has been received and your key is ready.',
      licenseKeyLabel: 'Your License Key:',
      guideTitle: '30-Second Activation Guide:',
      guideStep1: 'Open the ShortsStack Desktop application on your PC.',
      guideStep2: 'Paste your License Key into the activation box.',
      guideStep3: 'Click Activate to instantly unlock all features!',
      downloadInstallerBtn: 'Download Installer (.exe)',
      doneBtn: 'Done & Close',
    },
    cta: {
      badge: 'Get Started Today',
      title: 'Ready to Put Your Viral Video Channels on Complete Auto-Pilot?',
      subtitle: 'Download ShortsStack for Windows 64-bit or secure your lifetime license key with zero monthly renewal fees. 24/7 remote setup support via UltraViewer.',
      btnDownload: 'Download for Windows (64-bit)',
      btnPricing: 'Get Lifetime License',
      btnContact: 'Free Consultation',
      guaranteeOneTime: 'One-time payment • Lifetime access',
      guaranteeHwid: 'Exclusive hardware HWID encryption',
      guaranteeSupport: '24/7 dedicated UltraViewer support',
    },
    contact: {
      badge: '24/7 Customer Support',
      title: 'Get in Touch with Our Technical Team',
      subtitle: 'Our technical engineering team is ready to answer questions, recommend optimal hardware profiles, and assist with UltraViewer setup.',
      directTitle: 'Direct Communication Channels',
      directSubtitle: 'Connect with our team directly through your preferred channel:',
      zaloLabel: 'Zalo Hotline / Instant Chat',
      emailLabel: 'Direct Support Email',
      facebookLabel: 'Official Facebook Page',
      whatsappLabel: 'WhatsApp Global Support',
      formName: 'Your Full Name',
      formEmail: 'Email Address for Response',
      formPhone: 'Phone Number / WhatsApp (Optional)',
      formTopic: 'Subject or Plan of Interest',
      formMessage: 'Your Message or Question',
      formSubmit: 'Submit Inquiry',
      formSending: 'Sending message...',
      formSuccess: 'Thank you! Your inquiry has been sent to thenguyenfiner@gmail.com. We typically respond within 15 minutes.',
      topicOptions: [
        'Personal Pro (1 PC - Lifetime License)',
        'Studio Team (3 PCs - Lifetime License)',
        'Enterprise Agency (5 PCs - Lifetime License)',
        'Technical Support / UltraViewer Setup',
        'Agency Partnership / MCN Bulk Licensing',
      ],
      guaranteeText: 'Average response time: Under 15 minutes • Remote UltraViewer / TeamViewer setup included',
    },
    footer: {
      tagline: 'ShortsStack AI Studio',
      desc1: 'Enterprise multi-channel automation and AI video repurposing platform. Seamlessly integrates GPMLogin, ElevenLabs AI, automated duplicate-content protection, and centralized performance analytics.',
      desc2: 'Tailored for professional content creators, boutique studios, and MCN agencies.',
      col1Title: 'OPERATIONS & PRODUCT',
      col1Links: [
        'Auto-Pilot Campaigns',
        '9:16 Video Studio',
        'Account Farm Manager (GPM)',
        'Performance & Revenue Analytics',
        'ElevenLabs AI Audio Studio',
        'Audio & BGM Vault',
      ],
      col2Title: 'DOCS & GUIDES',
      col2Links: [
        'Installation Guide (Win 10/11)',
        'GPMLogin & GenLogin Setup',
        'Content Uniqueness & Algorithmic Best Practices',
        'Download Installer (.exe)',
        'Frequently Asked Questions (FAQ)',
        'System Audit Logs',
      ],
      col3Title: 'SECURITY & SUPPORT',
      col3Links: [
        '24/7 Support Center',
        'Activate License Key',
        'Machine Migration (HWID Reset)',
        'Terms of Service (TOS)',
        'Privacy Policy',
        'Admin Portal Login',
      ],
      copyright: '© 2026 ShortsStack Studio. All rights reserved.',
      systemStatus: 'All Systems Operational',
      securityBadge: 'Local-First Architecture • Hardware HWID Encryption • Workstation GPU Rendering',
      disclaimer: 'Disclaimer: ShortsStack is an independent automation software platform and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with TikTok Pte. Ltd. or ByteDance Ltd.',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
    },
  },

  zh: {
    nav: {
      features: '核心功能',
      browsers: '防关联浏览器',
      demo: '实机演示',
      calculator: '收益测算',
      pricing: '价格方案',
      faq: '常见问题',
      contact: '联系我们',
      download: '立即下载',
      adminPortal: '管理后台',
    },
    hero: {
      badge: '最新 v1.0.1 版本 • 深度集成 GPMLogin 与 GenLogin • AI 全自动运营',
      titleLine1: '新一代多平台矩阵',
      titleGradient: 'AI 视频二次创作与',
      titleLine2: '批量养号全自动系统',
      description:
        '自动批量采集抖音、小红书无水印高清视频。通过智能 AI 重组算法（Ken Burns 运镜、微噪扰动、音频变频、智能 9:16 画幅）彻底突破 TikTok Beta、YouTube Shorts 与 Reels 的去重检测，并通过真实防关联指纹浏览器全自动发布。',
      downloadBtn: '下载 Windows 客户端 (64位)',
      demoBtn: '观看实机演示',
      pricingBtn: '查看价格方案',
      downloadSub: '兼容 Windows 10/11 • 附带完整安装指南',
      trustWindows: '完美适配 Windows 10/11 64位系统',
      trustHwid: '硬件机器码 HWID 专属加密保护',
      trustAntiBan: '拒绝第三方危险 API • 零封号风控风险',
      trustBrowsers: '实时驱动 GPMLogin 与 GenLogin 浏览器',
    },
    ticker: {
      title: '实时运行动态',
      items: [
        '频道 @tech_viral 刚自动发布了 4 条高清二创短视频至 TikTok Beta',
        '新加坡客户成功激活 Studio 团队版 3 台电脑永久授权',
        '活动 #CryptoStory 成功渲染 18 条 9:16 竖屏高转化短视频',
        'Telegram 告警：账号 @us_funny 粉丝量突破 10,500 大关！',
        '系统自动同步 24 个绑定纯净海外住宅 IP 的 GPMLogin 环境',
        'ElevenLabs AI 拟真配音引擎已为 12 部视频生成纯正美语解说',
      ],
    },
    mockup: {
      windowTitle: 'ShortsStack Desktop Engine v1.0.1 - [全自动运营流程：运行中]',
      statusActive: '后台引擎平稳运行中',
      tabDashboard: '总览面板',
      tabAiEngine: 'AI 渲染流水线',
      tabBrowsers: '防关联环境',
      tabScheduler: '定时排期',
      statChannels: '矩阵账号总数',
      statQueue: '待发布队列',
      statViews: '24小时总播放',
      statFollowers: '总关注粉丝',
      channelName: 'TikTok 美区创作者基金矩阵 #01',
      channelStatus: '状态良好 • 正在自动模拟真人互动',
      aiStep1: '无水印采集抖音/小红书',
      aiStep2: '多重抗重：Ken Burns 与噪点微调',
      aiStep3: 'ElevenLabs 配音与动态卡拉OK字幕',
      aiStep4: '自动注入 GPMLogin 浏览器发布',
    },
    features: {
      badge: '技术优势',
      title: '实现矩阵短视频全自动无人值守',
      subtitle:
        '专为出海创作者、MMO 团队以及管理数十个 TikTok 基金账号、YouTube Shorts 的机构量身打造。',
      items: [
        {
          tag: '高清无水印采集',
          title: '一键抓取抖音、小红书与 YouTube',
          desc: '支持按关键词或目标博主批量抓取，下载 1080P 超清视频源文件，100% 自动消除平台水印。',
          highlight: '极速多线程并发采集',
        },
        {
          tag: '多层抗去重引擎',
          title: '突破性对抗去重与智能二创',
          desc: '采用 Ken Burns 动态景深缩放、微像素色彩扰动、音频高频重采样与镜像翻转，使视频在向量空间完全独立。',
          highlight: '轻松绕过平台 4 级内容审查',
        },
        {
          tag: 'AI 配音与字幕',
          title: 'AI 翻译配音与动感卡拉OK字幕',
          desc: '自动提取并重写口播文案，接入 ElevenLabs 纯正拟真人声，并生成 TikTok 爆款风格词级跳动字幕。',
          highlight: '完美满足 60 秒以上分成标准',
        },
        {
          tag: '指纹防关联',
          title: '原生驱动 GPMLogin 与 GenLogin',
          desc: '通过 Chrome DevTools Protocol (CDP) 真实控制浏览器，完整保留真实 Cookie、Canvas 指纹和鼠标轨迹。',
          highlight: '杜绝账号关联与限流降权',
        },
        {
          tag: '智能排期发布',
          title: '全球黄金时区自动分发发布',
          desc: '可按目标国（美、英、德、越等）黄金流量时间自定义排期。软件自动调起环境、连通代理并准时发布。',
          highlight: '7x24 小时不间断自主作业',
        },
        {
          tag: 'TELEGRAM 监控',
          title: '万粉达标实时推送通知',
          desc: '后台实时追踪各账号粉丝与播放数据。当账号突破 10,000 粉丝达标时，即刻通过 Telegram 推送至手机。',
          highlight: '第一时间提报基金开通资格',
        },
      ],
    },
    browsers: {
      badge: '账号安全基石',
      title: '深度打通专业防关联浏览器',
      subtitle:
        '坚决不使用任何粗暴简陋的第三方上传接口。ShortsStack 直接接管并操作真实的本地独立浏览器环境。',
      gpmTitle: '原生对接 GPMLogin',
      gpmDesc: '通过本地 Local API 自动化快速通讯。自动加载环境与专属代理，超低内存占用保障高并发稳定。',
      genTitle: '全面支持 GenLogin',
      genDesc: '无缝接入 GenLogin CDP 协议。浏览器操控顺滑无卡顿，多开多发稳定不崩溃。',
      benefit1Title: '100% 物理级独立指纹',
      benefit1Desc: '每个账号都在具备独立 Canvas、WebGL、AudioContext 及字体库的环境中运行。',
      benefit2Title: '独立住宅代理绑定',
      benefit2Desc: '支持环境与优质美区/欧区住宅 IP 绑定，确保发布时网络基站与地理定位一致。',
      benefit3Title: '无任何违规接口痕迹',
      benefit3Desc: '所有平台均将发布行为视作真实用户的键盘输入与鼠标点击，享受纯自然流推荐。',
    },
    calculator: {
      badge: '收益预测',
      title: '测算您的每月矩阵预期收益',
      subtitle: '模拟在 TikTok 创作者基金与 YouTube Shorts 部署全自动养号矩阵的潜在回报。',
      channelsLabel: '同时并发运营的频道/账号数：',
      videosPerDayLabel: '单个账号每日自动发布视频数：',
      avgViewsLabel: '每条视频预估平均播放量：',
      monthlyViews: '预估每月总播放量',
      estRevenue: '预估每月潜在创作者分成',
      disclaimer: '* 测算基于美区/欧区 TikTok Creator Rewards 平均每千次播放分成 $0.40 - $0.80 RPM 标准。实际表现受视频垂直领域和爆款概率影响。',
      ctaBtn: '立即开始矩阵化运营',
    },
    pricing: {
      badge: '一次付费 • 永久使用',
      title: '软件价格方案',
      subtitle: '无按月续费。无任何隐藏开支。终身享受全部后续功能更新与算力优化。',
      lifetimeBadge: '终身有效',
      popularBadge: '最受青睐',
      currency: '₫',
      payOnce: '一次性支付，终身享用',
      buyBtn: '立即购买授权',
      plan1Name: '个人专业版 Pro',
      plan1Desc: '适合单人起步，在一台主力电脑上矩阵运营 3 - 10 个出海视频账号。',
      plan2Name: '工作室团队版 Team',
      plan2Desc: '2-3 人短视频工作室的最佳选择，支持多台设备协同创作渲染。',
      plan3Name: '机构企业版 Agency',
      plan3Desc: '为大规模出海矩阵打造，支持 5 台高配机器 24 小时全负荷并发渲染。',
      features1: [
        '授权 1 台电脑（绑定硬件 HWID）',
        '永久使用（终生无需续费）',
        '不限制运营频道与渲染视频数量',
        '抖音与小红书超清无水印抓取',
        '全套 AI 画面与音频深度去重算法',
        '原生对接 GPMLogin 与 GenLogin 自动化',
        'Telegram 万粉达标智能监控推送',
        'Telegram 专属 1 对 1 技术售后支持',
        '终身免费在线版本升级',
      ],
      features2: [
        '同时授权 3 台电脑独立运行',
        '终身永久授权权限',
        '包含个人专业版全部功能',
        '支持灵活换机（后台免费重置 HWID）',
        '多机并发负载均衡加速',
        '尊享高优先级 AI 渲染队列',
        '提供远程协助环境配置服务',
        '加入内部出海爆款选品交流群',
      ],
      features3: [
        '同时授权 5 台电脑独立运行',
        '终身永久授权权限',
        '包含工作室团队版全部功能',
        '专属多机授权密钥管理面板',
        '全天候 7x24 VIP 专线与 Telegram 响应',
        '根据工作室特殊工作流定制专属特性',
        '软件故障先行质保与新功能优先内测',
      ],
      guarantee: '100% 确保安装成功与激活上线。支持通过管理后台便捷申请换机重置。',
    },
    reviews: {
      badge: '用户真实心声',
      title: '深受 500+ 出海创作者信赖',
      subtitle: '看看实战操盘手如何评价 ShortsStack 带来的效能跃升。',
      items: [
        {
          name: '陈宇航',
          role: '美区历史解说创作者',
          content: '以前每天手工剪片、换环境上传要折腾大半天。用了 ShortsStack 后，全自动出片并排期到 GPMLogin。三周内有两个新号顺利冲破万粉并开通基金，省时又省力！',
          metric: '2个账号成功开通基金',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: '林家豪',
          role: '8人短剧出海工作室负责人',
          content: '5台设备的企业版极大解放了团队的生产力。以前剪辑师做去重很头疼，现在机器批量处理，配音字幕一次性搞定。上个月团队总分成突破了 3 万多，非常值得投资！',
          metric: '月分成达 $4,200+',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: '王思敏',
          role: '海外好物种草玩家',
          content: '最赞的是原生控制 GenLogin，指纹真实，完全不会被平台判定为可疑接口。买断制相比那些每个月按账号收钱的 SaaS 划算太多了。',
          metric: '稳定托管 60+ 账号',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: '赵子涵',
          role: 'YouTube Shorts 45万粉博主',
          content: '自动微噪与多层运镜彻底解决去重难题，版权识别警告降为0。Shorts 播放量飙升非常稳健，是目前市面上最省心的桌面端工具。',
          metric: '月播放量 +28.5M',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: '张小萌',
          role: 'TikTok Shop 跨境带货达人',
          content: '内置的 ElevenLabs 英文配音非常地道，完全听不出机器感。团队 25 个小店账号出单稳定，彻底省去了请外籍配音员的高额开销。',
          metric: '周均出单 350+',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        },
        {
          name: '黄志强',
          role: '矩阵自动化 MCN 运营总监',
          content: '售后技术团队通过远程协助半小时内帮我们跑通了 5 台高配工作站。GPU NVENC 编码快得惊人，几秒就能完成一条高清 60 帧成品。',
          metric: '稳定驱动 120 个环境',
          rating: 5,
          avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
        },
      ],
    },
    faq: {
      badge: '解疑答惑',
      title: '常见疑问解答',
      subtitle: '购买前您需要了解的全部关键细节与保障。',
      items: [
        {
          q: '使用该工具会导致 TikTok 或 YouTube 账号被封吗？',
          a: '不会。ShortsStack 坚决不使用任何廉价有风险的第三方 API 接口。软件通过 Chrome 官方的 CDP 协议真实驱动 GPMLogin 或 GenLogin 浏览器，环境具备真实的硬件指纹、独立 Cookie 及模拟人手轨迹，对于平台而言与普通用户无异。',
        },
        {
          q: '后续更换新电脑，已买的授权还能继续使用吗？',
          a: '可以。每个激活码绑定一台机器的硬件码（HWID）。当您升级或更换电脑时，只需联系管理团队免费重置 HWID，1分钟内即可在新电脑上重新激活。',
        },
        {
          q: '软件后续更新如何获取？',
          a: '每次启动 ShortsStack 时，软件均会自动校验服务器。一旦有算法优化或新增功能，界面会弹出提示，点击即可一键升级，永久免费。',
        },
        {
          q: '运行软件需要什么样的电脑配置？',
          a: '推荐 Windows 10 或 11（64位）系统，内存建议 8GB - 16GB 或更高。电脑需安装好 GPMLogin 或 GenLogin，并配置好用于账号运营的纯净代理 IP。',
        },
        {
          q: '扫码转账付款后，多久可以拿到激活码？',
          a: '系统采用全天候 24 小时全自动 VietQR 到账对账机制。银行交易成功后（通常仅需 3 至 5 秒），界面会立即展示激活码，同时会自动发送至您的收件邮箱。',
        },
      ],
    },
    checkout: {
      titleInput: '获取 ShortsStack 终身永久授权',
      titlePayment: '扫描 VietQR 自动秒级到账激活',
      titleSuccess: '恭喜！授权已成功激活',
      subInput: '一次付费 • 终身使用 • 无任何月度续费',
      subPayment: '转账成功后，系统将在 3 - 5 秒内自动核销并出码',
      subSuccess: '请复制您的授权码并粘贴至桌面客户端中激活',
      customerNameLabel: '您的称呼 / 姓名',
      customerNamePlaceholder: '例如：王先生',
      emailLabel: '接收激活码的电子邮箱',
      emailPlaceholder: 'your_email@gmail.com',
      emailHint: '授权码和电子凭证将实时发送至该邮箱备查。',
      proceedBtn: '前往扫码支付 VietQR',
      creatingOrder: '正在生成支付订单...',
      backBtn: '返回上一步',
      bankNameLabel: '收款银行',
      accountNoLabel: '银行账号',
      accountNameLabel: '收款账户名',
      amountLabel: '支付金额',
      contentLabel: '转账附言（必须完全一致）',
      copyBtn: '复制',
      copied: '已复制！',
      waitingPayment: '正在监听银行网关确认交易中...',
      paymentNote: '提示：请使用任意手机银行 App 扫码，系统将自动填充金额与转账附言。',
      successMessage: '非常感谢！您的付款已确认，授权激活码已生成完毕。',
      licenseKeyLabel: '您的专属永久授权码 (License Key)：',
      guideTitle: '30秒快速激活步骤：',
      guideStep1: '在您的电脑上打开 ShortsStack 桌面客户端。',
      guideStep2: '在激活弹窗中粘贴上方复制的授权码。',
      guideStep3: '点击“立即激活”按钮，开启全自动养号与 AI 二创！',
      downloadInstallerBtn: '下载客户端安装包 (.exe)',
      doneBtn: '完成并关闭',
    },
    cta: {
      badge: '立即开启高效运营',
      title: '准备好让您的百万播放视频矩阵全自动运转了吗？',
      subtitle: '即刻下载 ShortsStack 客户端或选购专属买断制永久授权码，免除高昂月租。支持 7x24 小时远程极速协助安装。',
      btnDownload: '下载 Windows 客户端 (64位)',
      btnPricing: '查看永久授权价格',
      btnContact: '联系免费咨询',
      guaranteeOneTime: '一次买断 • 终身使用免续费',
      guaranteeHwid: '专属机器码 HWID 加密保障',
      guaranteeSupport: '7x24 远程极速协助安装',
    },
    contact: {
      badge: '全天候支持服务',
      title: '联系我们与获取专属解决方案',
      subtitle: 'ShortsStack 专业技术支持团队随时为您解答软硬件环境部署、矩阵防封建议以及远程协助安装。',
      directTitle: '官方直连沟通渠道',
      directSubtitle: '欢迎通过以下任意快捷渠道与我们取得联系：',
      zaloLabel: 'Zalo 官方专线 / 快速咨询',
      emailLabel: '官方支持邮箱',
      facebookLabel: 'Facebook 官方粉丝专页',
      whatsappLabel: 'WhatsApp 全球海外客服',
      formName: '您的姓名 / 称呼',
      formEmail: '用于接收回复的电子邮箱',
      formPhone: '手机号码 / 微信 / Zalo（选填）',
      formTopic: '您关注的方案或咨询主题',
      formMessage: '您的具体需求或疑问留言',
      formSubmit: '提交咨询信息',
      formSending: '正在提交信息...',
      formSuccess: '感谢您的留言！咨询信息已成功发送至 thenguyenfiner@gmail.com，客服专员将在 15 分钟内与您联系。',
      topicOptions: [
        '咨询 个人专业版（1 PC - 永久授权）',
        '咨询 工作室团队版（3 PCs - 永久授权）',
        '咨询 企业旗舰版（5 PCs - 永久授权）',
        '技术支持 / 远程协助环境部署',
        '渠道代理 / MCN 批量采购合作',
      ],
      guaranteeText: '平均 15 分钟内快速响应 • 支持 UltraViewer / TeamViewer 远程一对一协助',
    },
    footer: {
      tagline: 'ShortsStack AI Studio',
      desc1: '新一代短视频矩阵全自动运营与 AI 智能重组创作系统。深度集成 GPMLogin、ElevenLabs AI 配音与全自动抗封流控，实现矩阵资产多合一聚合管控。',
      desc2: '专为专业创作者、短剧与出海出单工作室、MCN 机构打造。',
      col1Title: '系统运营与产品',
      col1Links: [
        'Auto-Pilot 自动化战役',
        '9:16 智能短视频工作室',
        '矩阵多账号环境管理 (GPM)',
        '流量与收益分析中心',
        'ElevenLabs AI 配音工坊',
        '免版税音频与 BGM 库',
      ],
      col2Title: '技术文档与指引',
      col2Links: [
        'Windows 10/11 安装指南',
        'GPMLogin 与 GenLogin 配置',
        '算法抗重去重实战技巧',
        '下载安装包 (.exe)',
        '常见问题解答 (FAQ)',
        '系统操作审计日志',
      ],
      col3Title: '安全合规与售后',
      col3Links: [
        '7x24 全天候支持中心',
        '永久授权激活码验证',
        '电脑换机重置政策 (HWID)',
        '软件使用服务条款 (TOS)',
        '个人数据隐私保护政策',
        '管理后台登录通道',
      ],
      copyright: '© 2026 ShortsStack Studio. 保留所有权利。',
      systemStatus: '全部云端服务运行正常',
      securityBadge: '本地优先架构 • 硬件 HWID 绑定加密 • 工作站 GPU 硬件加速',
      disclaimer: '免责声明：ShortsStack 是一套完全独立的桌面端自动化软件平台，与 TikTok Pte. Ltd. 或 ByteDance Ltd. 无任何官方附属、关联、赞助或背书关系。',
      privacy: '隐私协议',
      terms: '服务条款',
    },
  },
};

