# HƯỚNG DẪN TRIỂN KHAI WEB PORTAL & LICENSE SERVER (SUPABASE + PRISMA + VERCEL)

Hệ thống bao gồm:
1. **Trang Landing Page (`/`)**: Giới thiệu tính năng, bảng giá, nút tải về phần mềm (tự động đếm lượt tải).
2. **Trang Quản Trị (`/admin`)**: Quản lý tạo/xóa/gia hạn license key, reset HWID khi khách đổi máy tính, xem nhật ký lượt tải, phát hành bản cập nhật (Auto-Update).
3. **Bộ API Bản Quyền**: `/api/license/activate`, `/api/license/verify`, `/api/version`, `/api/download`.
4. **Desktop Client (`backend/modules/license_client.py`)**: Tự lấy HWID máy tính và xác thực với máy chủ.

---

## BƯỚC 1: KHỞI TẠO SUPABASE DATABASE

1. Đăng nhập vào [https://supabase.com](https://supabase.com) và bấm **New Project**.
2. Đặt tên dự án (ví dụ: `tiktok-farm`) và lưu lại mật khẩu Database Password.
3. Vào mục **SQL Editor** ở thanh menu bên trái.
4. Mở file `supabase_schema.sql` trong thư mục này, copy toàn bộ nội dung và dán vào SQL Editor, sau đó bấm **Run**.
5. Lấy chuỗi kết nối Database:
   - Vào **Project Settings** (biểu tượng bánh răng) -> **Database** -> mục **Connection string** -> chọn tab **URI**.
   - **DATABASE_URL** (Mode: Transaction, cổng 6543): Dùng cho kết nối truy vấn thông thường.
     *Ví dụ:* `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`
   - **DIRECT_URL** (Mode: Session, cổng 5432): Dùng cho Prisma migration.
     *Ví dụ:* `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

---

## BƯỚC 2: DEPLOY LÊN VERCEL (MIỄN PHÍ)

### Cách 1: Đẩy code lên GitHub và kết nối Vercel (Khuyên dùng)
1. Đẩy mã nguồn thư mục `web/` lên repository GitHub của bạn.
2. Vào [https://vercel.com](https://vercel.com), bấm **Add New...** -> **Project** -> Chọn repository vừa tạo.
3. Nếu bạn để chung repo với toàn bộ dự án, ở phần **Root Directory**, bấm **Edit** và chọn thư mục `web`.
4. Mở mục **Environment Variables** và thêm các biến môi trường sau:
   - `DATABASE_URL`: Chuỗi kết nối Supabase (Transaction Pooler - port 6543)
   - `DIRECT_URL`: Chuỗi kết nối Supabase (Session - port 5432)
   - `ADMIN_SECRET_KEY`: Mật khẩu đăng nhập trang `/admin` (ví dụ: `AdminVip2026!#`)
   - `NEXT_PUBLIC_DEFAULT_DOWNLOAD_URL`: Đường link tải file `.exe` cài đặt (Google Drive / GitHub Release / S3)
5. Bấm **Deploy**. Sau khoảng 1-2 phút, bạn sẽ nhận được đường dẫn website (ví dụ: `https://tiktokfarm.vercel.app`).

### Cách 2: Deploy trực tiếp bằng Vercel CLI
Mở terminal tại thư mục `web` và chạy:
```bash
npm install -g vercel
vercel
```

---

## BƯỚC 3: SỬ DỤNG TRANG QUẢN TRỊ (ADMIN)

1. Truy cập đường dẫn: `https://<ten-mien-cua-ban>.vercel.app/admin`
2. Nhập mật mã quản trị bạn đã cấu hình tại biến `ADMIN_SECRET_KEY`.
3. Tại giao diện Admin:
   - **Tạo Key**: Bấm nút *Tạo Key Bản Quyền*, chọn gói (Tháng, Năm, Trọn đời), số lượng máy (1 PC, 2 PC...) và gửi mã key đó cho khách hàng.
   - **Reset HWID khi khách đổi máy**: Nếu khách nâng cấp hoặc đổi máy tính, tìm tên khách trong bảng và bấm **Gỡ HWID cũ**. Khách có thể nhập lại key vào máy mới ngay lập tức!
   - **Theo dõi tải về**: Xem người dùng từ quốc gia nào, IP nào đã bấm tải phần mềm.
   - **Auto-Update**: Khi có phiên bản mới, vào tab *Link Tải & Auto-Update*, nhập version (ví dụ: `2.1.1`) và link file `.exe` mới để đẩy thông báo đến toàn bộ người dùng.

---

## BƯỚC 4: KẾT NỐI VỚI PHẦN MỀM DESKTOP (PYTHON)

Trong file `.env` của ứng dụng desktop `tiktok-farm`, thêm dòng:
```env
LICENSE_SERVER_URL=https://<ten-mien-cua-ban>.vercel.app
```

Khi ứng dụng chạy lên:
- `backend/modules/license_client.py` sẽ tự động lấy HWID máy tính của người dùng (dựa trên Bo mạch chủ + CPU ID).
- Gửi lên Vercel để kích hoạt hoặc kiểm tra tính hợp lệ.
- Nếu không có key hoặc key hết hạn/sai máy, ứng dụng sẽ từ chối hoạt động và yêu cầu người dùng mua bản quyền!

