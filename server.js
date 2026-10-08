const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ==============================================================================
// 1. CẤU HÌNH VAPID KEYS CHO WEB PUSH (APPLE IOS & ANDROID)
// ==============================================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BFIU7SwiIRWFUnqKrgYoNq11bco4r9ffq484DmrdbjPmSeRBhGrHr8LqCFrOvKyRgCe1nyYxgw1W0yM7yQYkBZo';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'AMXNT2X3ppdmZ-VMYRnK0HFGTT7sjs91IlZ_2EeQL_Dn';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@binance-pwa.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==============================================================================
// 2. LƯU TRỮ DỮ LIỆU BỀN VỮNG (JSON DATABASE FILE)
// ==============================================================================
const DB_FILE = path.join(__dirname, 'storage.json');

function loadDatabase() {
  const defaultData = {
    config: {
      title: 'Xử lý tiền gửi USDT',
      bodyTemplate: 'Khoản tiền gửi {amount} USDT của bạn hiện đang được xử lý về ví {short_address}.',
      delaySeconds: 3,
      iconUrl: 'img/wfi_coin_hero.jpg'
    },
    subscriptions: [], // Danh sách PushSubscription của riêng tài khoản MKT
    withdrawals: []
  };

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return { ...defaultData, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Lỗi đọc database file:', err);
  }
  return defaultData;
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi lưu database file:', err);
  }
}

// Khởi tạo DB
let db = loadDatabase();

// ==============================================================================
// 3. API ENDPOINTS
// ==============================================================================

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'WFI Binance PWA Web Push Server',
    time: new Date().toISOString(),
    mktSubscriptionsCount: db.subscriptions.length
  });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running healthy' });
});

// A. LẤY VAPID PUBLIC KEY CHO CLIENT SUB
app.get('/api/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY
  });
});

// B. LẤY CẤU HÌNH NOTIFICATION DO ADMIN ĐÃ LƯU
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: db.config
  });
});

// C. ADMIN LƯU CẤU HÌNH (LOGO + TIÊU ĐỀ + NỘI DUNG)
app.post('/api/config', (req, res) => {
  const { title, bodyTemplate, delaySeconds, iconUrl } = req.body;

  if (!title || !bodyTemplate) {
    return res.status(400).json({ success: false, message: 'Tiêu đề và Nội dung không được để trống' });
  }

  db.config = {
    title: String(title).trim(),
    bodyTemplate: String(bodyTemplate).trim(),
    delaySeconds: parseInt(delaySeconds) || 3,
    iconUrl: String(iconUrl || '').trim() || 'img/wfi_coin_hero.jpg'
  };

  saveDatabase(db);
  console.log('✓ Admin đã cập nhật cấu hình:', db.config);

  res.json({
    success: true,
    message: 'Đã lưu cấu hình Notification thành công trên Backend!',
    config: db.config
  });
});

// D. LƯU PUSH SUBSCRIPTION CỦA MKT (CHỈ MKT ĐƯỢC LƯU)
app.post('/api/save-subscription', (req, res) => {
  const { subscription, userRole, userId, userEmail } = req.body;

  // Bảo vệ phân quyền: Chỉ tài khoản MKT mới được lưu subscription để nhận thông báo
  const isMkt = (userRole === 'MKT' || userEmail === 'mkt.demo@gmail.com');
  if (!isMkt) {
    return res.status(403).json({
      success: false,
      message: 'Từ chối: Chỉ tài khoản MKT mới được cấp quyền nhận thông báo Push.'
    });
  }

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, message: 'Push subscription không hợp lệ' });
  }

  // Tránh trùng lặp endpoint
  const existsIndex = db.subscriptions.findIndex(s => s.endpoint === subscription.endpoint);
  if (existsIndex >= 0) {
    db.subscriptions[existsIndex] = subscription;
  } else {
    db.subscriptions.push(subscription);
  }

  saveDatabase(db);
  console.log(`✓ Đã lưu Push Subscription cho MKT (${userEmail || userId}). Tổng subs: ${db.subscriptions.length}`);

  res.json({
    success: true,
    message: 'Đã lưu thiết bị MKT nhận thông báo thành công!',
    totalActiveDevices: db.subscriptions.length
  });
});

// E. XỬ LÝ LỆNH RÚT TIỀN & BẮN WEB PUSH ĐẾN MKT
app.post('/api/withdraw', async (req, res) => {
  const { userId, userRole, userEmail, toAddress, amount } = req.body;

  const amt = parseFloat(amount) || 10;
  const addr = String(toAddress || '').trim();
  const isMktUser = (userRole === 'MKT' || userEmail === 'mkt.demo@gmail.com');

  const orderId = Math.floor(100000 + Math.random() * 900000);
  const fee = 1.0;
  const netAmount = Math.max(0, amt - fee);

  const withdrawRecord = {
    orderId,
    userId,
    userRole: isMktUser ? 'MKT' : 'CUSTOMER',
    amount: amt,
    fee,
    netAmount,
    toAddress: addr,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  db.withdrawals.push(withdrawRecord);
  saveDatabase(db);

  // Phản hồi ngay cho Client để giao diện mượt mà
  res.json({
    success: true,
    message: `Tạo lệnh rút ${amt} USDT thành công. Lệnh đang chờ duyệt.`,
    data: withdrawRecord,
    isMkt: isMktUser
  });

  // ============================================================================
  // QUY TẮC BẢO MẬT: CHỈ MKT NHẬN PUSH NOTIFICATION. CUSTOMER TUYỆT ĐỐI KHÔNG NHẬN!
  // ============================================================================
  if (!isMktUser) {
    console.log(`[Customer Withdraw] User ${userId} rút tiền bình thường. Không gửi Push Notification.`);
    return;
  }

  // Định dạng nội dung thông báo theo cấu hình mới nhất của Admin
  const cfg = db.config;
  const shortAddr = addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
  const timeStr = new Date().toLocaleTimeString('vi-VN');
  const amtStr = amt.toLocaleString('vi-VN', { minimumFractionDigits: 2 });
  const netStr = netAmount.toLocaleString('vi-VN', { minimumFractionDigits: 2 });

  const finalTitle = cfg.title.replace('{amount}', amtStr).replace('{short_address}', shortAddr).replace('{address}', addr).replace('{time}', timeStr);
  const finalBody = cfg.bodyTemplate.replace('{amount}', amtStr).replace('{net_amount}', netStr).replace('{short_address}', shortAddr).replace('{address}', addr).replace('{time}', timeStr);

  const pushPayload = JSON.stringify({
    title: finalTitle,
    body: finalBody,
    icon: cfg.iconUrl,
    badge: cfg.iconUrl,
    tag: 'wfi-withdraw-' + Date.now(),
    url: './index.html'
  });

  const delayMs = (cfg.delaySeconds || 3) * 1000;
  console.log(`[MKT Withdraw] Lên lịch gửi Web Push sau ${cfg.delaySeconds}s tới ${db.subscriptions.length} thiết bị MKT...`);

  setTimeout(async () => {
    if (db.subscriptions.length === 0) {
      console.warn('⚠️ Chưa có thiết bị MKT nào đăng ký Push Subscription trên Backend.');
      return;
    }

    const deadSubscriptions = [];

    for (const sub of db.subscriptions) {
      try {
        await webpush.sendNotification(sub, pushPayload, {
          TTL: 60,
          urgency: 'high'
        });
        console.log('✓ Đã bắn Web Push thật thành công đến iPhone MKT:', sub.endpoint.slice(0, 45) + '...');
      } catch (err) {
        console.error('Lỗi gửi Web Push đến thiết bị:', err.statusCode, err.message);
        // Nếu subscription đã hết hạn hoặc bị hủy (410 Gone / 404 Not Found)
        if (err.statusCode === 410 || err.statusCode === 404) {
          deadSubscriptions.push(sub.endpoint);
        }
      }
    }

    // Dọn dẹp các subscription đã chết
    if (deadSubscriptions.length > 0) {
      db.subscriptions = db.subscriptions.filter(s => !deadSubscriptions.includes(s.endpoint));
      saveDatabase(db);
    }
  }, delayMs);
});

// F. ADMIN BẮN THỬ TEST PUSH ĐẾN THIẾT BỊ MKT
app.post('/api/test-push', async (req, res) => {
  if (db.subscriptions.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Chưa có thiết bị iPhone MKT nào kết nối Push Subscription. Vui lòng mở PWA trên iPhone và cấp quyền thông báo trước.'
    });
  }

  const cfg = db.config;
  const pushPayload = JSON.stringify({
    title: '🔔 [Admin Test] ' + cfg.title,
    body: cfg.bodyTemplate.replace('{amount}', '100,00').replace('{short_address}', '0x7A...8F2'),
    icon: cfg.iconUrl,
    badge: cfg.iconUrl,
    tag: 'test-push-' + Date.now(),
    url: './index.html'
  });

  let sentCount = 0;
  for (const sub of db.subscriptions) {
    try {
      await webpush.sendNotification(sub, pushPayload);
      sentCount++;
    } catch (err) {
      console.error('Lỗi gửi test push:', err.message);
    }
  }

  res.json({
    success: true,
    message: `Đã gửi Push Notification thử nghiệm đến ${sentCount} thiết bị iPhone MKT!`
  });
});

// Khởi chạy server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`✓ WFI Binance PWA Web Push Backend đang chạy trên PORT ${PORT}`);
  console.log(`✓ VAPID Public Key: ${VAPID_PUBLIC_KEY}`);
  console.log(`=======================================================`);
});
