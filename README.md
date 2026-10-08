# Binance PWA Web Push Backend

Hệ thống Backend chuyên dụng phục vụ Push Notification thật cho ứng dụng **Binance / WFI PWA** trên iPhone và Android.

## Tính năng chính
- 🔑 Quản lý cặp khóa **VAPID Keys** chuẩn Web Push W3C & Apple iOS APNs.
- ⚙️ Lưu trữ cấu hình thông báo (Logo, Tiêu đề, Nội dung, Độ trễ) do Admin quản lý.
- 📲 Đăng ký và quản lý **Push Subscription** từ iPhone (Safari PWA Standalone).
- 💸 Khi MKT rút tiền thành công: Tự động gửi **Web Push THẬT** qua Apple Push Notification Server đến iPhone của MKT.
- 🛡️ Phân quyền nghiêm ngặt: **Customer thường tuyệt đối không nhận thông báo**.

## Deploy lên Render.com (1-Click)
1. Đăng nhập vào [dashboard.render.com](https://dashboard.render.com).
2. Chọn **New +** -> **Web Service**.
3. Chọn repo `binance-pwa-backend` từ tài khoản GitHub của bạn.
4. Render sẽ tự động phát hiện `render.yaml` và cấu hình tất cả các bước.
5. Bấm **Create Web Service**. Sau ~1 phút, bạn sẽ có URL HTTPS công khai (ví dụ: `https://binance-pwa-backend.onrender.com`).
