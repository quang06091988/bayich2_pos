/* Service worker của POS Bảy Ích 2 — giữ tối giản, luôn ưu tiên bản mới.
   - Trang POS: lấy mạng trước, mất mạng thì mở bản đã lưu (sửa code rồi push là máy có mạng nhận bản mới ngay).
   - CSV Menu / Info (docs.google.com …output=tsv): lấy mạng trước, mất mạng dùng bản đã lưu
     → vẫn mở POS và bán được với giá lần gần nhất; đơn vào hàng chờ, có mạng tự gửi như cũ.
   - Font Google, icon, manifest: dùng bản đã lưu, cập nhật ở nền.
   - Mọi thứ khác (Apps Script, ảnh VietQR, thư viện Excel…) đi thẳng mạng, KHÔNG lưu.
   Đổi BAN khi đổi cách lưu để dọn bản cũ. Muốn gỡ hẳn: thay file này bằng bản chỉ gọi self.registration.unregister(). */
const BAN = 'b2pos-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(BAN).then(c => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png'])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ds => Promise.all(ds.filter(k => k !== BAN).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Lấy mạng trước; mất mạng / lỗi thì trả bản đã lưu dưới khoá `khoa` */
async function mangTruoc(req, khoa) {
  const c = await caches.open(BAN);
  try {
    const r = await fetch(req);
    if (r.ok) await c.put(khoa, r.clone());
    return r;
  } catch (err) {
    const luu = await c.match(khoa);
    if (luu) return luu;
    throw err;
  }
}
/* Có bản lưu thì trả ngay, đồng thời tải bản mới ở nền */
async function luuTruoc(req) {
  const c = await caches.open(BAN), luu = await c.match(req);
  const moi = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => luu);
  return luu || moi;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (req.mode === 'navigate' && u.origin === location.origin) {
    e.respondWith(mangTruoc(req, './'));   // mọi lần mở (kể cả link đơn Zalo #don=…) dùng chung một bản lưu
    return;
  }
  if (u.hostname === 'docs.google.com' && u.searchParams.get('output') === 'tsv') {
    const k = new URL(u.origin + u.pathname);   // bỏ tham số chống cache, chỉ giữ tab + định dạng
    ['gid', 'single', 'output'].forEach(p => { if (u.searchParams.has(p)) k.searchParams.set(p, u.searchParams.get(p)); });
    e.respondWith(mangTruoc(req, k.href));
    return;
  }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com'
      || (u.origin === location.origin && /\.(png|webmanifest)$/.test(u.pathname))) {
    e.respondWith(luuTruoc(req));
  }
});
