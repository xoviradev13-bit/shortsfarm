'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Key,
  Download,
  Users,
  Shield,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Copy,
  Check,
  Search,
  ExternalLink,
  Laptop,
  Calendar,
  AlertCircle,
  LogOut,
  UploadCloud,
  DollarSign,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'licenses' | 'orders' | 'downloads' | 'releases'>('licenses');

  // Dữ liệu
  const [stats, setStats] = useState<any>(null);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Phân trang danh sách keys
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Phân trang đơn hàng & lượt tải
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);
  const [downloadsPage, setDownloadsPage] = useState(1);
  const [downloadsPageSize, setDownloadsPageSize] = useState(10);

  // Modal tạo key
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({
    customer_name: '',
    customer_email: '',
    plan: 'pro_1pc',
    duration_days: 0,
    max_devices: 1,
    custom_key: '',
    count: 1,
    notes: '',
  });

  // Modal cập nhật release
  const [releaseForm, setReleaseForm] = useState({
    version: '1.0.1',
    download_url: '',
    release_notes: '',
    file_size_mb: 85.5,
    is_mandatory: false,
  });

  useEffect(() => {
    const saved = sessionStorage.getItem('tf_admin_key');
    if (saved) {
      setAdminKey(saved);
      verifyAndFetch(saved);
    }
  }, []);

  const verifyAndFetch = async (key: string) => {
    setLoading(true);
    try {
      const resStats = await fetch('/api/admin/stats', {
        headers: { 'x-admin-key': key },
      });

      if (resStats.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('tf_admin_key');
        alert('Mật khẩu quản trị không chính xác!');
        setLoading(false);
        return;
      }

      const dataStats = await resStats.json();
      setStats(dataStats.stats);
      setDownloads(dataStats.recent_downloads || []);
      setOrders(dataStats.recent_orders || []);
      if (dataStats.latest_release) {
        setReleaseForm({
          version: dataStats.latest_release.version,
          download_url: dataStats.latest_release.downloadUrl,
          release_notes: dataStats.latest_release.releaseNotes || '',
          file_size_mb: dataStats.latest_release.fileSizeMb || 85.5,
          is_mandatory: dataStats.latest_release.isMandatory || false,
        });
      }

      // Lấy danh sách keys
      const resKeys = await fetch(`/api/admin/keys?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'x-admin-key': key },
        cache: 'no-store',
      });
      const dataKeys = await resKeys.json();
      setLicenses(dataKeys.licenses || []);

      setIsAuthenticated(true);
      sessionStorage.setItem('tf_admin_key', key);
    } catch (e: any) {
      alert('Lỗi kết nối máy chủ: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) return;
    verifyAndFetch(adminKey.trim());
  };

  const handleLogout = () => {
    sessionStorage.removeItem('tf_admin_key');
    setIsAuthenticated(false);
    setAdminKey('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Thao tác với License (Khóa/Mở Khóa, Gỡ HWID, Gia Hạn, Xóa)
  const handleKeyAction = async (action: string, id: string, extraDays = 30) => {
    if (action === 'reset_hwid' && !confirm('Bạn có chắc muốn gỡ liên kết máy tính cũ cho key này?')) return;
    if (action === 'delete' && !confirm('Bạn có chắc chắn muốn xóa vĩnh viễn key này?')) return;
    if (action === 'revoke' && !confirm('Bạn có chắc chắn muốn khóa key này? Máy đang dùng sẽ bị chặn.')) return;

    try {
      let res: Response;
      if (action === 'delete') {
        res = await fetch(`/api/admin/keys?id=${id}`, {
          method: 'DELETE',
          headers: { 'x-admin-key': adminKey },
        });
      } else {
        res = await fetch('/api/admin/keys', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey,
          },
          body: JSON.stringify({ action, id, extra_days: extraDays }),
        });
      }

      const data = await res.json();
      if (!res.ok || data.error) {
        alert('Lỗi: ' + (data.error || 'Thao tác không thành công'));
        return;
      }
      await verifyAndFetch(adminKey);
    } catch (e: any) {
      alert('Thao tác thất bại: ' + e.message);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(newKeyForm),
      });
      const result = await res.json();
      if (result.success) {
        alert(result.message);
        setShowCreateModal(false);
        setNewKeyForm({
          customer_name: '',
          customer_email: '',
          plan: 'pro_1pc',
          duration_days: 0,
          max_devices: 1,
          custom_key: '',
          count: 1,
          notes: '',
        });
        verifyAndFetch(adminKey);
      } else {
        alert('Lỗi: ' + result.error);
      }
    } catch (e: any) {
      alert('Lỗi tạo key: ' + e.message);
    }
  };

  const handleUpdateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/releases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(releaseForm),
      });
      const result = await res.json();
      if (result.success) {
        alert(result.message);
        verifyAndFetch(adminKey);
      } else {
        alert('Lỗi: ' + result.error);
      }
    } catch (e: any) {
      alert('Lỗi cập nhật release: ' + e.message);
    }
  };

  // Màn hình Login nếu chưa nhập Secret Key
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070A13] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d121f] border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-center text-white">Đăng Nhập Cổng Quản Trị</h1>
          <p className="text-xs text-gray-400 text-center mt-1">
            Nhập mật mã quản trị (ADMIN_SECRET_KEY) để quản lý bản quyền
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1.5">Mật mã Admin</label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Nhập secret key..."
                className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:outline-none focus:border-pink-500 transition"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 font-semibold text-sm text-white transition shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Vào Trang Quản Trị'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">
              ← Quay lại trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredLicenses = licenses.filter((lic) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      lic.licenseKey?.toLowerCase().includes(q) ||
      lic.customerName?.toLowerCase().includes(q) ||
      lic.customerEmail?.toLowerCase().includes(q) ||
      lic.notes?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredLicenses.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredLicenses.length);
  const paginatedLicenses = filteredLicenses.slice(startIndex, endIndex);

  // Phân trang đơn hàng
  const totalOrdersPages = Math.ceil(orders.length / ordersPageSize) || 1;
  const startOrderIndex = (ordersPage - 1) * ordersPageSize;
  const endOrderIndex = Math.min(startOrderIndex + ordersPageSize, orders.length);
  const paginatedOrders = orders.slice(startOrderIndex, endOrderIndex);

  // Phân trang lượt tải
  const totalDownloadsPages = Math.ceil(downloads.length / downloadsPageSize) || 1;
  const startDownloadIndex = (downloadsPage - 1) * downloadsPageSize;
  const endDownloadIndex = Math.min(startDownloadIndex + downloadsPageSize, downloads.length);
  const paginatedDownloads = downloads.slice(startDownloadIndex, endDownloadIndex);

  return (
    <div className="min-h-screen bg-[#070A13] text-gray-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-gray-800/80 bg-[#0d121f]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-pink-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                SS
              </span>
              <span className="truncate">ShortsStack Admin</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1 ml-4 lg:ml-6 border-l border-gray-800 pl-4 lg:pl-6 overflow-x-auto">
              <button
                onClick={() => setActiveTab('licenses')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${activeTab === 'licenses'
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Quản Lý Bản Quyền
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${activeTab === 'orders'
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Đơn Hàng & Doanh Thu {stats?.paid_orders_count ? `(${stats.paid_orders_count})` : ''}
              </button>
              <button
                onClick={() => setActiveTab('downloads')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${activeTab === 'downloads'
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Nhật Ký Tải Về
              </button>
              <button
                onClick={() => setActiveTab('releases')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${activeTab === 'releases'
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Link Tải & Auto-Update
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => verifyAndFetch(adminKey)}
              className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Thoát</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Header Tab Switcher (< sm) */}
        <div className="sm:hidden border-t border-gray-800/80 bg-[#090d17] px-3 py-2 overflow-x-auto flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('licenses')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition ${activeTab === 'licenses'
              ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
              : 'text-gray-400 hover:text-white bg-gray-900/60'
              }`}
          >
            Bản Quyền
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition ${activeTab === 'orders'
              ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
              : 'text-gray-400 hover:text-white bg-gray-900/60'
              }`}
          >
            Đơn Hàng {stats?.paid_orders_count ? `(${stats.paid_orders_count})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('downloads')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition ${activeTab === 'downloads'
              ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
              : 'text-gray-400 hover:text-white bg-gray-900/60'
              }`}
          >
            Nhật Ký Tải
          </button>
          <button
            onClick={() => setActiveTab('releases')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition ${activeTab === 'releases'
              ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
              : 'text-gray-400 hover:text-white bg-gray-900/60'
              }`}
          >
            Bản Phát Hành
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 w-full flex-1">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0d121f] border border-gray-800">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Tổng Lượt Tải</span>
              <Download className="w-4 h-4 text-pink-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">{stats?.total_downloads || 0}</div>
            <p className="text-[11px] text-gray-500 mt-1">Từ trang landing page</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#0d121f] border border-gray-800">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Key Đang Chạy</span>
              <Key className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">{stats?.active_licenses || 0}</div>
            <p className="text-[11px] text-emerald-400 mt-1">Trên tổng {stats?.total_licenses || 0} keys</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#0d121f] border border-gray-800">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Máy Đã Gán HWID</span>
              <Laptop className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">{stats?.total_activations || 0}</div>
            <p className="text-[11px] text-gray-500 mt-1">Thiết bị hoạt động</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#0d121f] border border-gray-800 border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-semibold text-emerald-400">Tổng Doanh Thu</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 truncate">
              {(stats?.total_revenue || 0).toLocaleString('vi-VN')}₫
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {stats?.paid_orders_count || 0} đơn VietQR
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1 p-4 sm:p-5 rounded-2xl bg-[#0d121f] border border-gray-800">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Phiên Bản</span>
              <UploadCloud className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">v{releaseForm.version}</div>
            <p className="text-[11px] text-amber-400 mt-1">Sẵn sàng đẩy update</p>
          </div>
        </div>

        {/* TAB 1: LICENSES */}
        {activeTab === 'licenses' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo mã key, tên, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verifyAndFetch(adminKey)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Key Bản Quyền</span>
              </button>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-gray-800 bg-[#0d121f] overflow-x-auto">
              <div className="sm:hidden px-4 pt-3 text-[10px] text-gray-500">
                ← Vuốt ngang để xem đủ cột thông tin →
              </div>
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead className="bg-gray-900/60 border-b border-gray-800 text-gray-400 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="p-4">Mã Bản Quyền</th>
                    <th className="p-4">Khách Hàng</th>
                    <th className="p-4">Gói Cước</th>
                    <th className="p-4">Thiết Bị (HWID)</th>
                    <th className="p-4">Trạng Thái</th>
                    <th className="p-4">Hạn Sử Dụng</th>
                    <th className="p-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredLicenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        {searchQuery ? 'Không tìm thấy key nào khớp với từ khóa tìm kiếm.' : 'Chưa có license key nào. Bấm "Tạo Key Bản Quyền" để sinh key mới.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedLicenses.map((lic) => {
                      const isExpired = lic.expiresAt && new Date(lic.expiresAt) < new Date();
                      const boundCount = lic.hwidList?.length || 0;

                      return (
                        <tr key={lic.id} className="hover:bg-gray-900/30 transition">
                          <td className="p-4 font-mono font-medium text-white">
                            <div className="flex items-center gap-2">
                              <span>{lic.licenseKey}</span>
                              <button
                                onClick={() => copyToClipboard(lic.licenseKey)}
                                className="text-gray-500 hover:text-pink-400"
                                title="Sao chép key"
                              >
                                {copiedKey === lic.licenseKey ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {lic.notes && <div className="text-[10px] text-gray-500 mt-0.5">{lic.notes}</div>}
                          </td>

                          <td className="p-4">
                            <div className="font-semibold text-gray-200">{lic.customerName || 'N/A'}</div>
                            <div className="text-gray-400 text-[11px]">{lic.customerEmail || 'Chưa có email'}</div>
                          </td>

                          <td className="p-4 uppercase font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${lic.plan === 'agency_5pc' || lic.plan === 'lifetime'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : lic.plan === 'studio_3pc' || lic.plan === 'yearly'
                                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                                  : 'bg-pink-500/15 text-pink-400 border border-pink-500/30'
                                }`}
                            >
                              {lic.plan === 'pro_1pc' || lic.plan === 'monthly'
                                ? '1 PC (Vĩnh Viễn)'
                                : lic.plan === 'studio_3pc' || lic.plan === 'yearly'
                                  ? 'Studio (3 PCs)'
                                  : lic.plan === 'agency_5pc' || lic.plan === 'lifetime'
                                    ? 'Agency (5 PCs)'
                                    : lic.plan}
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-semibold ${boundCount >= lic.maxDevices ? 'text-amber-400' : 'text-gray-300'
                                  }`}
                              >
                                {boundCount} / {lic.maxDevices} Máy
                              </span>
                            </div>
                            {boundCount > 0 && (
                              <button
                                onClick={() => handleKeyAction('reset_hwid', lic.id)}
                                className="mt-1 text-[10px] text-pink-400 hover:text-pink-300 underline block"
                                title="Gỡ máy cũ khi khách đổi PC"
                              >
                                Gỡ HWID cũ
                              </button>
                            )}
                          </td>

                          <td className="p-4">
                            {lic.status === 'suspended' ? (
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] border border-rose-500/20">
                                Đã Khóa
                              </span>
                            ) : isExpired ? (
                              <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px]">
                                Hết Hạn
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20">
                                Đang Chạy
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-gray-300">
                            {lic.expiresAt ? (
                              <div className={isExpired ? 'text-rose-400' : ''}>
                                {new Date(lic.expiresAt).toLocaleDateString('vi-VN')}
                              </div>
                            ) : (
                              <span className="text-amber-400 font-medium">Vĩnh viễn</span>
                            )}
                          </td>

                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleKeyAction('extend', lic.id, 30)}
                                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white"
                                title="Gia hạn thêm 30 ngày"
                              >
                                +30d
                              </button>
                              {lic.status === 'suspended' ? (
                                <button
                                  onClick={() => handleKeyAction('activate', lic.id)}
                                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-emerald-500/20 text-rose-400 hover:text-emerald-400 border border-rose-500/30 transition"
                                  title="Key đang BỊ KHÓA - Nhấp để Mở Khóa key này"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleKeyAction('revoke', lic.id)}
                                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-amber-500/20 text-emerald-400 hover:text-amber-400 border border-gray-700/60 transition"
                                  title="Key đang HOẠT ĐỘNG - Nhấp để Tạm Khóa key này"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleKeyAction('delete', lic.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                                title="Xóa vĩnh viễn"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Phân Trang (Pagination) */}
              <div className="p-4 border-t border-gray-800 bg-gray-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <span>Hiển thị</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 rounded-lg bg-gray-900 border border-gray-800 text-white font-medium focus:outline-none"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>
                    bản quyền | <strong>{filteredLicenses.length === 0 ? 0 : startIndex + 1}</strong> - <strong>{endIndex}</strong> trên tổng <strong>{filteredLicenses.length}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 flex items-center gap-1 font-medium transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Trước</span>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <React.Fragment key={p}>
                          {prev && p - prev > 1 && <span className="px-1 text-gray-600">...</span>}
                          <button
                            onClick={() => setCurrentPage(p)}
                            className={`w-8 h-8 rounded-lg font-bold text-xs transition ${currentPage === p
                              ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                              : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                              }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 flex items-center gap-1 font-medium transition"
                  >
                    <span>Sau</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ORDERS & REVENUE */}
        {activeTab === 'orders' && (
          <div className="rounded-2xl border border-gray-800 bg-[#0d121f] overflow-x-auto">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>Danh Sách Đơn Hàng & Doanh Thu VietQR</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Tự động đối soát từ Webhook PayOS & VietQR</p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
                <span className="text-xs text-gray-400">Tổng doanh thu thực tế: </span>
                <span className="font-black text-emerald-400 text-base ml-1">
                  {(stats?.total_revenue || 0).toLocaleString('vi-VN')}₫
                </span>
              </div>
            </div>
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-gray-900/60 border-b border-gray-800 text-gray-400 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="p-4">Mã Đơn Hàng</th>
                  <th className="p-4">Khách Hàng</th>
                  <th className="p-4">Gói Bản Quyền</th>
                  <th className="p-4">Số Tiền</th>
                  <th className="p-4">License Key Đã Cấp</th>
                  <th className="p-4">Thời Gian</th>
                  <th className="p-4 text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      Chưa ghi nhận đơn hàng thanh toán thành công nào trên hệ thống.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-gray-900/30">
                      <td className="p-4 font-mono font-bold text-white">#{ord.orderCode}</td>
                      <td className="p-4">
                        <div className="font-semibold text-white">{ord.customerName || 'Khách VietQR'}</div>
                        <div className="text-[11px] text-gray-400">{ord.customerEmail}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/30">
                          {ord.plan === 'pro_1pc' || ord.plan === 'monthly'
                            ? '1 PC (Vĩnh Viễn)'
                            : ord.plan === 'studio_3pc' || ord.plan === 'yearly'
                              ? 'Studio (3 PCs)'
                              : ord.plan === 'agency_5pc' || ord.plan === 'lifetime'
                                ? 'Agency (5 PCs)'
                                : ord.plan}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-emerald-400">
                        {(ord.amount || 0).toLocaleString('vi-VN')}₫
                      </td>
                      <td className="p-4 font-mono text-gray-300">
                        {ord.licenseKey ? (
                          <div className="flex items-center gap-1.5">
                            <span>{ord.licenseKey}</span>
                            <button
                              onClick={() => copyToClipboard(ord.licenseKey)}
                              className="text-gray-500 hover:text-pink-400"
                              title="Sao chép key"
                            >
                              {copiedKey === ord.licenseKey ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-4 text-gray-400">
                        {new Date(ord.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-4 text-right">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Đã Thanh Toán
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Phân Trang Đơn Hàng */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span>Hiển thị</span>
                <select
                  value={ordersPageSize}
                  onChange={(e) => {
                    setOrdersPageSize(Number(e.target.value));
                    setOrdersPage(1);
                  }}
                  className="px-2 py-1 rounded-lg bg-gray-900 border border-gray-800 text-white font-medium focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span>
                  đơn hàng | <strong>{orders.length === 0 ? 0 : startOrderIndex + 1}</strong> - <strong>{endOrderIndex}</strong> trên tổng <strong>{orders.length}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                  disabled={ordersPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 flex items-center gap-1 font-medium transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </button>

                {Array.from({ length: totalOrdersPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalOrdersPages || Math.abs(p - ordersPage) <= 2)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    return (
                      <React.Fragment key={p}>
                        {prev && p - prev > 1 && <span className="px-1 text-gray-600">...</span>}
                        <button
                          onClick={() => setOrdersPage(p)}
                          className={`w-8 h-8 rounded-lg font-bold text-xs transition ${ordersPage === p
                            ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                            : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  onClick={() => setOrdersPage((p) => Math.min(totalOrdersPages, p + 1))}
                  disabled={ordersPage === totalOrdersPages}
                  className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 flex items-center gap-1 font-medium transition"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DOWNLOADS */}
        {activeTab === 'downloads' && (
          <div className="rounded-2xl border border-gray-800 bg-[#0d121f] overflow-x-auto">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Lịch Sử Lượt Tải Gần Đây</h3>
              <span className="text-xs text-gray-400">Hiển thị các lượt tải mới nhất từ Landing Page</span>
            </div>
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-gray-900/60 border-b border-gray-800 text-gray-400 uppercase text-[10px]">
                <tr>
                  <th className="p-4">Thời Gian</th>
                  <th className="p-4">IP Người Dùng</th>
                  <th className="p-4">Quốc Gia</th>
                  <th className="p-4">Hệ Điều Hành</th>
                  <th className="p-4">Phiên Bản</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {downloads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      Chưa ghi nhận lượt tải nào.
                    </td>
                  </tr>
                ) : (
                  paginatedDownloads.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-900/30">
                      <td className="p-4 text-gray-300">
                        {new Date(d.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-4 font-mono text-pink-400">{d.ipAddress || 'Ẩn danh'}</td>
                      <td className="p-4 text-gray-300">{d.country || 'VN'}</td>
                      <td className="p-4 text-gray-300">{d.os || 'Windows'}</td>
                      <td className="p-4 font-mono text-emerald-400">v{d.version || '2.1.0'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Phân Trang Lượt Tải */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span>Hiển thị</span>
                <select
                  value={downloadsPageSize}
                  onChange={(e) => {
                    setDownloadsPageSize(Number(e.target.value));
                    setDownloadsPage(1);
                  }}
                  className="px-2 py-1 rounded-lg bg-gray-900 border border-gray-800 text-white font-medium focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span>
                  lượt tải | <strong>{downloads.length === 0 ? 0 : startDownloadIndex + 1}</strong> - <strong>{endDownloadIndex}</strong> trên tổng <strong>{downloads.length}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDownloadsPage((p) => Math.max(1, p - 1))}
                  disabled={downloadsPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 flex items-center gap-1 font-medium transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </button>

                {Array.from({ length: totalDownloadsPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalDownloadsPages || Math.abs(p - downloadsPage) <= 2)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    return (
                      <React.Fragment key={p}>
                        {prev && p - prev > 1 && <span className="px-1 text-gray-600">...</span>}
                        <button
                          onClick={() => setDownloadsPage(p)}
                          className={`w-8 h-8 rounded-lg font-bold text-xs transition ${downloadsPage === p
                            ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                            : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  onClick={() => setDownloadsPage((p) => Math.min(totalDownloadsPages, p + 1))}
                  disabled={downloadsPage === totalDownloadsPages}
                  className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 flex items-center gap-1 font-medium transition"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RELEASES */}
        {activeTab === 'releases' && (
          <div className="max-w-2xl bg-[#0d121f] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-2">Cấu Hình Bản Phát Hành & Auto-Update</h3>
            <p className="text-xs text-gray-400 mb-6">
              Khi bạn build bản `.exe` mới và đẩy lên Google Drive / GitHub Releases, hãy cập nhật link và version ở đây.
              Ứng dụng trên máy tính của người dùng sẽ tự động nhận diện và nhắc họ cập nhật.
            </p>

            <form onSubmit={handleUpdateRelease} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Số phiên bản (Version)</label>
                  <input
                    type="text"
                    value={releaseForm.version}
                    onChange={(e) => setReleaseForm({ ...releaseForm, version: e.target.value })}
                    placeholder="ví dụ: 2.1.0"
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Dung lượng file (MB)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={releaseForm.file_size_mb}
                    onChange={(e) => setReleaseForm({ ...releaseForm, file_size_mb: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  Đường link tải trực tiếp (GitHub Release / S3 / Direct EXE Link)
                </label>
                <input
                  type="url"
                  value={releaseForm.download_url}
                  onChange={(e) => setReleaseForm({ ...releaseForm, download_url: e.target.value })}
                  placeholder="https://github.com/.../ShortsStack_Setup_v2.1.exe"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">Nội dung cập nhật (Changelog)</label>
                <textarea
                  rows={3}
                  value={releaseForm.release_notes}
                  onChange={(e) => setReleaseForm({ ...releaseForm, release_notes: e.target.value })}
                  placeholder="Tính năng mới: Bổ sung download Douyin, nâng cấp GenLogin CDP..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="mandatory"
                  checked={releaseForm.is_mandatory}
                  onChange={(e) => setReleaseForm({ ...releaseForm, is_mandatory: e.target.checked })}
                  className="w-4 h-4 rounded text-pink-600 bg-gray-900 border-gray-800"
                />
                <label htmlFor="mandatory" className="text-gray-300">
                  Bắt buộc cập nhật (Ứng dụng cũ sẽ không cho chạy tiếp nếu chưa update)
                </label>
              </div>

              <button
                type="submit"
                className="mt-4 px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 font-semibold text-white transition flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Lưu & Đẩy Thông Báo Cập Nhật</span>
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Modal Tạo Key Mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full max-h-[92vh] overflow-y-auto bg-[#0d121f] border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-pink-400" /> Tạo Mã Bản Quyền Mới
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Tên khách hàng</label>
                  <input
                    type="text"
                    value={newKeyForm.customer_name}
                    onChange={(e) => setNewKeyForm({ ...newKeyForm, customer_name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Email / SĐT</label>
                  <input
                    type="text"
                    value={newKeyForm.customer_email}
                    onChange={(e) => setNewKeyForm({ ...newKeyForm, customer_email: e.target.value })}
                    placeholder="email@gmail.com"
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Gói cước</label>
                  <select
                    value={newKeyForm.plan}
                    onChange={(e) => {
                      const p = e.target.value;
                      let devices = 1;
                      let days = 0;
                      if (p === 'studio_3pc') {
                        devices = 3;
                      } else if (p === 'agency_5pc' || p === 'lifetime') {
                        devices = 5;
                      } else if (p === 'trial') {
                        devices = 1;
                        days = 3;
                      }
                      setNewKeyForm({
                        ...newKeyForm,
                        plan: p,
                        max_devices: devices,
                        duration_days: days,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white"
                  >
                    <option value="pro_1pc">Cá Nhân (1 PC - Vĩnh Viễn)</option>
                    <option value="studio_3pc">Studio (3 PCs - Vĩnh Viễn)</option>
                    <option value="agency_5pc">Agency (5 PCs - Vĩnh Viễn)</option>
                    <option value="trial">Dùng Thử (3 Ngày)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-medium mb-1">Số ngày dùng</label>
                  <input
                    type="number"
                    value={newKeyForm.duration_days}
                    onChange={(e) => setNewKeyForm({ ...newKeyForm, duration_days: parseInt(e.target.value) || 0 })}
                    disabled={newKeyForm.plan !== 'trial'}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-medium mb-1">Số máy tối đa (PC)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newKeyForm.max_devices}
                    onChange={(e) => setNewKeyForm({ ...newKeyForm, max_devices: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  Mã Key Tùy Chọn (Bỏ trống để tự sinh ngẫu nhiên)
                </label>
                <input
                  type="text"
                  value={newKeyForm.custom_key}
                  onChange={(e) => setNewKeyForm({ ...newKeyForm, custom_key: e.target.value })}
                  placeholder="ví dụ: SS-VIP-2026"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">Ghi chú đơn hàng</label>
                <input
                  type="text"
                  value={newKeyForm.notes}
                  onChange={(e) => setNewKeyForm({ ...newKeyForm, notes: e.target.value })}
                  placeholder="Chuyển khoản VCB 499k..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 font-semibold text-white shadow-lg shadow-pink-600/30"
                >
                  Tạo & Kích Hoạt Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

