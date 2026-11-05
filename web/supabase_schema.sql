-- =========================================================================
-- TikTokFarm & Video AI Studio - Supabase Schema
-- Hướng dẫn: Copy toàn bộ nội dung file này và paste vào:
-- Supabase Dashboard -> SQL Editor -> Click 'Run'
-- =========================================================================

-- 1. BẢNG QUẢN LÝ BẢN QUYỀN (LICENSES)
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    customer_name TEXT DEFAULT 'Khách hàng',
    customer_email TEXT,
    plan TEXT NOT NULL DEFAULT 'monthly', -- 'trial', 'monthly', 'yearly', 'lifetime'
    max_devices INT NOT NULL DEFAULT 1,
    hwid_list TEXT[] DEFAULT ARRAY[]::TEXT[], -- Danh sách HWID các máy đã kích hoạt
    status TEXT NOT NULL DEFAULT 'active',    -- 'active', 'suspended', 'expired'
    expires_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index tra cứu key siêu tốc
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);

-- 2. BẢNG THEO DÕI LƯỢT DOWNLOAD (DOWNLOADS)
CREATE TABLE IF NOT EXISTS public.downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT,
    user_agent TEXT,
    country TEXT DEFAULT 'VN',
    os TEXT DEFAULT 'Windows',
    version TEXT DEFAULT '2.1.0',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON public.downloads(created_at DESC);

-- 3. BẢNG LỊCH SỬ KÍCH HOẠT & HEARTBEAT (ACTIVATIONS)
CREATE TABLE IF NOT EXISTS public.activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT REFERENCES public.licenses(license_key) ON DELETE CASCADE,
    hwid TEXT NOT NULL,
    device_name TEXT,
    app_version TEXT,
    ip_address TEXT,
    last_heartbeat TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(license_key, hwid)
);

-- 4. BẢNG PHIÊN BẢN PHẦN MỀM & LINK TẢI MỚI NHẤT (APP_RELEASES)
CREATE TABLE IF NOT EXISTS public.app_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT UNIQUE NOT NULL,
    download_url TEXT NOT NULL,
    file_size_mb NUMERIC(10,2) DEFAULT 85.5,
    release_notes TEXT,
    is_mandatory BOOLEAN DEFAULT false,
    is_latest BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. DỮ LIỆU MẪU BAN ĐẦU
-- Tạo 1 bản release v2.1.0 mặc định
INSERT INTO public.app_releases (version, download_url, release_notes, is_mandatory, is_latest)
VALUES (
    '2.1.0',
    'https://github.com/your-repo/tiktok-farm/releases/download/v2.1.0/TikTokFarm_Setup_v2.1.0.exe',
    'Bổ sung hỗ trợ AdsPower, Dolphin Anty, GenLogin và tải đa nền tảng Douyin, Xiaohongshu.',
    false,
    true
)
ON CONFLICT (version) DO NOTHING;

-- Tạo 2 License Key mẫu để test ngay
INSERT INTO public.licenses (license_key, customer_name, customer_email, plan, max_devices, expires_at, notes)
VALUES 
(
    'TKFARM-DEMO-VIP1-2026', 
    'Nguyễn Văn A', 
    'demo@tiktokfarm.com', 
    'monthly', 
    1, 
    now() + INTERVAL '30 days',
    'Key mẫu test 30 ngày'
),
(
    'TKFARM-LIFE-PRO8-9999', 
    'Admin Owner', 
    'admin@tiktokfarm.com', 
    'lifetime', 
    3, 
    now() + INTERVAL '3650 days',
    'Key Lifetime 3 máy'
)
ON CONFLICT (license_key) DO NOTHING;

-- 6. CẤU HÌNH BẢO MẬT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc công khai thông tin releases & ghi nhận lượt tải
CREATE POLICY "Public read releases" ON public.app_releases FOR SELECT USING (true);
CREATE POLICY "Public insert downloads" ON public.downloads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read download count" ON public.downloads FOR SELECT USING (true);

-- Đối với licenses & activations:
-- Next.js API Routes dùng SUPABASE_SERVICE_ROLE_KEY (hoặc anon key với RPC)
-- Để bảo vệ không cho client bên ngoài đọc lén toàn bộ danh sách key:
CREATE POLICY "Service role full access licenses" ON public.licenses USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access activations" ON public.activations USING (true) WITH CHECK (true);

