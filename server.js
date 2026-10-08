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
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BFIU7SwiIRWFUnqKrgYoNq11bco4r9ffq484DmrdbjPmSeRBhGrHr8LqCFrOvKyRgCe1nyYxgw1W0yM7yQYkBZo';
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'xc1PZfeml2Zn5UxhGcrQcUZNPuyOz3UiVn_YR5Av8Oc';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@binance-pwa.com';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('✓ Đã cấu hình VAPID Details thành công!');
} catch (vapidErr) {
  console.warn('⚠️ Lỗi cấu hình VAPID ban đầu, đang tự động sinh cặp khóa VAPID chuẩn 100%...');
  const autoKeys = webpush.generateVAPIDKeys();
  VAPID_PUBLIC_KEY = autoKeys.publicKey;
  VAPID_PRIVATE_KEY = autoKeys.privateKey;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('✓ Đã sinh và áp dụng VAPID Keys mới:', VAPID_PUBLIC_KEY);
}

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

// D. TRẠNG THÁI KHAI THÁC & SỐ DƯ (MINING ENGINE)
app.get('/api/mining/live-status', (req, res) => {
  const activePackages = 1;
  const dailyYield = 5000.0;
  const hourlyRate = 208.33;
  const secondRate = dailyYield / 86400.0;
  const nowTs = Math.floor(Date.now() / 1000);
  const cycleStartAt = nowTs - 14400; // Đã chạy 4 giờ

  res.json({
    success: true,
    user: {
      id: '86392015',
      name: 'Nick',
      email: 'mkt.demo@gmail.com',
      usdtBalance: 85.50,
      wfiBalance: 12580.35,
      role: 'MKT',
      commissionLevel: 2
    },
    mining: {
      status: 'Đang khai thác',
      isMining: true,
      activePackages: activePackages,
      dailyYield: dailyYield,
      hourlyRate: hourlyRate,
      secondRate: secondRate,
      cycleStartAt: cycleStartAt,
      serverTimestamp: nowTs,
      lastClaimAmount: 5000.0
    }
  });
});

app.get('/api/user/balance', (req, res) => {
  res.json({
    success: true,
    user: {
      id: '86392015',
      usdtBalance: 85.50,
      lockedUsdt: 0.0,
      availableUsdt: 85.50,
      wfiBalance: 12580.35,
      role: 'MKT'
    }
  });
});

app.post('/api/mining/claim', (req, res) => {
  res.json({
    success: true,
    claimedAmount: 5000.0,
    wfiBalance: 17580.35,
    message: 'Claim WFI thành công!'
  });
});

// E. LƯU PUSH SUBSCRIPTION CỦA MKT (CHỈ MKT ĐƯỢC LƯU)
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

// G. CÁC API CLIENT ĐẦY ĐỦ (CHO GITHUB PAGES KẾT NỐI VÀO)
// 1. Alias rút tiền
app.post('/api/withdraw/request', (req, res) => {
  req.url = '/api/withdraw';
  app.handle(req, res);
});

// 2. Lịch sử rút tiền
app.get('/api/user/withdrawals', (req, res) => {
  res.json({
    success: true,
    withdrawals: db.withdrawals || []
  });
});

// 3. Nạp tiền & Lịch sử nạp
app.post('/api/deposit/verify', (req, res) => {
  const { txid } = req.body;
  const amt = 50.0;
  res.json({
    success: true,
    message: 'Xác nhận nạp tiền thành công!',
    data: {
      txid: txid || '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(''),
      amount: amt,
      newUsdtBalance: 135.50,
      fromAddress: '0x3B28a9C2...789',
      blockNumber: 42198031,
      createdAt: new Date().toISOString()
    }
  });
});

app.get('/api/user/deposits', (req, res) => {
  res.json({
    success: true,
    deposits: [
      {
        id: 1,
        txid: '0x8f2a4c5e7b1a3d9e8c2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d0e2f4a6b',
        amount: 85.50,
        status: 'COMPLETED',
        createdAt: new Date().toISOString()
      }
    ]
  });
});

// 4. Mua gói đào WFI
app.post('/api/package/buy', (req, res) => {
  const qty = parseInt(req.body.quantity) || 1;
  const cost = qty * 10;
  res.json({
    success: true,
    user: {
      usdtBalance: Math.max(0, 85.50 - cost),
      activePackages: 1 + qty
    },
    package: {
      quantity: qty,
      totalCost: cost
    },
    mining: {
      hourlyRate: (1 + qty) * 208.33,
      wfiMinedToday: (1 + qty) * 5000
    }
  });
});

// 5. Lịch sử giao dịch ví & Hoa hồng
app.get('/api/user/transactions', (req, res) => {
  res.json({
    success: true,
    transactions: [
      { id: 1, type: 'DEPOSIT', amount: 85.50, symbol: 'USDT', status: 'COMPLETED', date: '08/10/2026' }
    ]
  });
});

app.get('/api/user/commission', (req, res) => {
  res.json({
    success: true,
    level: 2,
    rate: 8.0,
    salesVolume: 12500,
    history: []
  });
});

// 6. Bảng xếp hạng & Vòng quay
app.get('/api/leaderboard', (req, res) => {
  res.json({
    success: true,
    leaderboard: [
      { rank: 1, name: 'Alex Trader', volume: 154200, reward: '1.000 USDT' },
      { rank: 2, name: 'Dragon Whale', volume: 98400, reward: '500 USDT' },
      { rank: 3, name: 'Nick (Bạn)', volume: 65200, reward: '200 USDT' },
      { rank: 4, name: 'Crypto King', volume: 43100, reward: '100 USDT' }
    ]
  });
});

app.get('/api/wheel/status', (req, res) => {
  res.json({ success: true, spinsLeft: 3, costPerSpin: 1 });
});
app.post('/api/wheel/spin', (req, res) => {
  res.json({
    success: true,
    prize: { label: '+100 WFI', type: 'WFI', value: 100, index: 2 },
    newWfiBalance: 12680.35,
    spinsLeft: 2
  });
});
app.post('/api/wheel/buy', (req, res) => {
  res.json({ success: true, spinsLeft: 5, newUsdtBalance: 80.50 });
});

// 7. Đăng nhập
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body;
  const isMkt = email && (email.toLowerCase().includes('mkt') || email.toLowerCase().includes('marketing'));
  res.json({
    success: true,
    user: {
      id: isMkt ? 'mkt_88001122' : 'user_86392015',
      name: isMkt ? 'Marketing Partner' : 'Đặng Hùng',
      email: email || 'user@example.com',
      role: isMkt ? 'MKT' : 'CUSTOMER',
      usdtBalance: 85.50,
      wfiBalance: 12580.35
    }
  });
});

// H. ADMIN API ENDPOINTS (Dành cho trang Admin CRM)
app.get('/api/admin/dashboard', (req, res) => {
  res.json({
    success: true,
    totalUsers: 142,
    activePackagesCount: 38,
    totalDeposited: 12500,
    totalWithdrawn: 3400,
    pendingWithdrawals: (db.withdrawals || []).filter(w => w.status === 'PENDING').length
  });
});

app.get('/api/admin/users', (req, res) => {
  res.json({
    success: true,
    users: [
      { id: '86392015', name: 'Nick', email: 'mkt.demo@gmail.com', role: 'MKT', usdtBalance: 85.50, wfiBalance: 12580.35, activePackages: 1, commissionLevel: 2, isLocked: false },
      { id: '86392016', name: 'John Doe', email: 'customer1@gmail.com', role: 'CUSTOMER', usdtBalance: 210.00, wfiBalance: 5200.00, activePackages: 0, commissionLevel: 0, isLocked: false }
    ]
  });
});

app.get('/api/admin/packages', (req, res) => {
  res.json({
    success: true,
    packages: [
      { id: 1, userName: 'Nick', packageName: 'Gói đào WFI 1 Ngày', price: 10, quantity: 1, status: 'ACTIVE', createdAt: new Date().toISOString() }
    ]
  });
});

app.get('/api/admin/deposits', (req, res) => {
  res.json({
    success: true,
    deposits: [
      { id: 1, userName: 'Nick', amount: 85.50, status: 'COMPLETED', txid: '0x8f2a4c5e7b...', createdAt: new Date().toISOString() }
    ]
  });
});

app.get('/api/admin/withdrawals', (req, res) => {
  res.json({
    success: true,
    withdrawals: db.withdrawals || []
  });
});

app.get('/api/admin/commission/history', (req, res) => {
  res.json({ success: true, history: [] });
});

app.get('/api/admin/mkt/config', (req, res) => {
  res.json({ success: true, config: db.config });
});

app.post('/api/admin/mkt/config', (req, res) => {
  req.url = '/api/config';
  app.handle(req, res);
});

app.get('/api/admin/mkt/list', (req, res) => {
  res.json({
    success: true,
    mktList: [
      { id: 'mkt_88001122', name: 'Marketing Partner', email: 'mkt.demo@gmail.com', role: 'MKT', activeDevices: db.subscriptions.length }
    ]
  });
});

app.get('/api/admin/mkt/demo-history', (req, res) => {
  res.json({
    success: true,
    history: db.withdrawals.filter(w => w.userRole === 'MKT')
  });
});

app.post('/api/admin/withdraw/approve', (req, res) => {
  const { orderId } = req.body;
  const item = db.withdrawals.find(w => String(w.orderId) === String(orderId));
  if (item) item.status = 'COMPLETED';
  saveDatabase(db);
  res.json({ success: true, message: 'Đã duyệt lệnh rút thành công!' });
});

app.post('/api/admin/withdraw/reject', (req, res) => {
  const { orderId } = req.body;
  const item = db.withdrawals.find(w => String(w.orderId) === String(orderId));
  if (item) item.status = 'REJECTED';
  saveDatabase(db);
  res.json({ success: true, message: 'Đã từ chối lệnh rút!' });
});

// Khởi chạy server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`✓ WFI Binance PWA Web Push Backend đang chạy trên PORT ${PORT}`);
  console.log(`✓ VAPID Public Key: ${VAPID_PUBLIC_KEY}`);
  console.log(`=======================================================`);
});
