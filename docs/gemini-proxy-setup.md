# 🌐 Hướng Dẫn Tạo Gemini Proxy (Cloudflare Worker)

> Dành cho người dùng tại **Việt Nam** — Google Gemini API bị chặn tại VN.  
> Tạo proxy riêng miễn phí trong **5 phút** để ShortsStack kết nối bình thường, **không cần VPN**.

---

## Tại sao cần làm điều này?

ShortsStack sử dụng **Google Gemini AI** để tạo phụ đề, tóm tắt nội dung và tối ưu video.  
Tại Việt Nam, Google chặn IP kết nối đến `generativelanguage.googleapis.com`.  
Cloudflare Worker đóng vai trò **cầu nối trung gian** — chuyển tiếp request của bạn đến Google qua server ở nước ngoài.

> **Miễn phí hoàn toàn:** Cloudflare cấp **100,000 request/ngày** miễn phí.  
> Với gói trả phí \$5/tháng bạn có **10 triệu request/tháng**.

---

## Bước 1 — Tạo tài khoản Cloudflare

1. Truy cập [dash.cloudflare.com](https://dash.cloudflare.com)
2. Đăng ký tài khoản miễn phí (hoặc đăng nhập nếu đã có)

---

## Bước 2 — Tạo Worker mới

1. Vào **Workers & Pages** ở sidebar trái
2. Nhấn **Create** → chọn **Create Worker**
3. Đặt tên tùy ý (ví dụ: `gemini-proxy`)
4. Nhấn **Deploy** (bỏ qua code mặc định, chưa cần sửa)

---

## Bước 3 — Dán code proxy

1. Sau khi deploy, nhấn **Edit code**
2. **Xóa toàn bộ** code mặc định trong editor
3. **Dán đoạn code sau vào:**

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Chuyển tiếp đến Google Gemini API chính thức
    url.hostname = "generativelanguage.googleapis.com";
    url.port = "443";
    url.protocol = "https:";

    const headers = new Headers(request.headers);
    headers.set("Host", "generativelanguage.googleapis.com");

    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: "follow"
    });

    try {
      const response = await fetch(modifiedRequest);

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      newHeaders.set("Access-Control-Allow-Headers", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
```

4. Nhấn **Deploy** để lưu

---

## Bước 4 — Copy URL Worker của bạn

Sau khi deploy, Cloudflare sẽ cấp cho bạn một URL dạng:

```
https://gemini-proxy.<your-subdomain>.workers.dev
```

Copy URL này.

---

## Bước 5 — Cài vào ShortsStack

1. Mở **ShortsStack** → vào **Cài Đặt**
2. Tìm ô **Gemini Proxy Base URL**
3. Dán URL Worker vừa copy vào
4. Nhấn **Lưu Cài Đặt**

✅ Xong! ShortsStack sẽ tự động dùng Worker của bạn thay vì kết nối trực tiếp đến Google.

---

## Lưu ý bảo mật

- ✅ **Không lưu API key** trong Worker — key của bạn chỉ truyền qua HTTPS, Worker không lưu gì cả
- ✅ **Không chia sẻ URL Worker** với người khác — ai có URL đó có thể dùng nó làm relay (dù vẫn cần API key của họ)
- ✅ **Worker chỉ forward request** — không đọc, không lưu, không sửa nội dung của bạn
- ℹ️ API key sẽ xuất hiện trong **Cloudflare Logs** của chính bạn — đây là bình thường và chỉ bạn mới xem được

---

## Kiểm tra hoạt động

Nếu Worker hoạt động đúng, truy cập URL Worker trên trình duyệt sẽ thấy response JSON từ Google:

```
https://gemini-proxy.<your-subdomain>.workers.dev/v1beta/models?key=test
```

---

## Câu hỏi thường gặp

**Q: Tôi không ở Việt Nam, có cần làm không?**  
A: Không cần. ShortsStack tự động kết nối thẳng đến Google nếu IP của bạn không bị chặn. Chỉ cần để trống ô Gemini Proxy Base URL.

**Q: Worker miễn phí có giới hạn không?**  
A: 100,000 request/ngày — đủ dùng cho cá nhân và nhóm nhỏ. Nếu dùng nhiều hơn, nâng lên gói \$5/tháng (10 triệu request/tháng).

**Q: Tôi có thể dùng chung một Worker với nhiều máy không?**  
A: Có, nhưng không nên chia sẻ URL Worker với người lạ vì giới hạn request tính chung cho cả Worker.

**Q: ShortsStack có lưu Gemini API key của tôi không?**  
A: API key lưu **cục bộ trên máy bạn** trong file `.env`, không gửi lên bất kỳ server nào của ShortsStack.

