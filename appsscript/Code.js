/**
 * Apps Script STANDALONE "bayich2_banhang" — sổ bán hàng chung của trang Bán hàng (bayich2-pos.vercel.app).
 *
 * Ghi vào sheet bayich2:
 *   BanHang     — mỗi dòng một đơn POS (mã đơn = máy + thời điểm nên không bao giờ trùng)
 *   BanHangMon  — mỗi dòng một món trong đơn
 *   ChotNgay    — mỗi dòng một ngày: tiền mặt, chuyển khoản, tổng doanh thu, ai chốt
 *   CauHinh     — cài đặt nội bộ dùng chung cho các công cụ (Mã PIN chung, Tiền lẻ đầu ngày…)
 *                 ⚠ KHÔNG đưa tab CauHinh vào "Xuất bản lên web".
 *
 * Mọi lệnh là doPost {hanhDong, pin, …}. Sai PIN thì chờ 2 giây mới trả lời (dò mã rất chậm).
 *   kiemTra  {pin}                                          → {ok, tienLe}
 *   ghiDon   {pin, don:[…]}                                 → ghi đơn mới; đơn đã có thì chỉ cập nhật
 *                                                             trạng thái (huỷ/khôi phục), tên & SĐT khách
 *   chotNgay {pin, ngay, tienKet, chuyenKhoan, posGhiNhan, nguoi, ghiChu}
 *   baoCao   {pin, tu, den}                                 → đơn + chốt ngày trong khoảng [tu, den]
 * Gửi lại cùng một đơn bao nhiêu lần cũng không tạo trùng — máy có thể thử lại thoải mái khi mạng chập chờn.
 *
 * CÀI / CẤP QUYỀN / NÂNG CẤP: chọn hàm caiDat → Run (tạo tab còn thiếu, tạo Mã PIN ngẫu nhiên nếu chưa có).
 * CẬP NHẬT CODE: clasp push → clasp deploy -i <deploymentId> (link /exec giữ nguyên).
 */

var ID_BAYICH2 = '1Wd4Zvq2xiIiEzou_dvE2YtOk-bJJhAD7se0yREYe9c8';
var TZ = 'Asia/Ho_Chi_Minh';

var TAB_DON = 'BanHang', TAB_MON = 'BanHangMon', TAB_CHOT = 'ChotNgay', TAB_CAU_HINH = 'CauHinh';
var COT = {
  BanHang: ['Mã', 'Số phiếu', 'Ngày', 'Giờ', 'Máy', 'Nguồn', 'Thanh toán', 'Tạm tính', 'Giảm giá', 'Thành tiền',
            'Khách đưa', 'Tiền thối', 'Khách', 'SĐT', 'Trạng thái', 'Cập nhật lúc'],
  BanHangMon: ['Mã đơn', 'Số phiếu', 'Ngày', 'Tên hàng', 'Đơn vị', 'SL', 'Đơn giá', 'Thành tiền', 'Ghi chú'],
  ChotNgay: ['Ngày', 'Tiền mặt trong két', 'Tiền lẻ đầu ngày', 'Tiền mặt bán được', 'Chuyển khoản', 'Tổng',
             'POS ghi nhận', 'Người chốt', 'Lúc', 'Ghi chú'],
  CauHinh: ['Trường', 'Giá trị', 'Ghi chú', 'Dùng cho']
};
/* Cột giữ dạng chữ — không để Sheet tự đổi "2026-09-15" thành ngày hay "0901…" thành số */
var COT_CHU = {
  BanHang: ['Mã', 'Số phiếu', 'Ngày', 'Giờ', 'SĐT', 'Cập nhật lúc'],
  BanHangMon: ['Mã đơn', 'Số phiếu', 'Ngày'],
  ChotNgay: ['Ngày', 'Lúc'],
  CauHinh: ['Giá trị']
};
var RONG = {
  BanHang: [150, 80, 95, 55, 80, 80, 100, 90, 80, 100, 90, 80, 130, 105, 90, 150],
  BanHangMon: [150, 80, 95, 230, 70, 50, 90, 100, 200],
  ChotNgay: [95, 130, 115, 130, 110, 110, 110, 100, 150, 220],
  CauHinh: [170, 150, 420, 120]
};

var TRUONG_PIN = 'Mã PIN chung', TRUONG_TIEN_LE = 'Tiền lẻ đầu ngày';
/* Trường trong tab CauHinh do công cụ này tạo (Trường | Giá trị | Ghi chú | Dùng cho). Công cụ khác thêm dòng của mình. */
var CAU_HINH_BAN_DAU = [
  [TRUONG_PIN, '', 'Mỗi điện thoại nhập một lần. Đổi ở đây là mọi công cụ theo. KHÔNG xuất bản tab này lên web.', 'Mọi công cụ'],
  [TRUONG_TIEN_LE, '', 'Tiền để sẵn trong két mỗi sáng — Chốt ngày trừ ra để ra tiền mặt bán được', 'Bán hàng']
];

var NGUON = { pos: 'POS', zalo: 'Zalo', nhanh: 'Ghi nhanh' };
var TOI_DA_DON = 200, TOI_DA_MON = 200, TIEN_TOI_DA = 10000000000;

/* ══════════════════ VÀO ══════════════════ */
function doGet() {
  return traLoi({ ok: true, ten: 'bayich2_banhang', thoiGian: new Date().toISOString() });
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return traLoi({ ok: false, loi: 'Dữ liệu gửi lên không đọc được' }); }
  try {
    var ss = SpreadsheetApp.openById(ID_BAYICH2);
    var ch = docCauHinh(ss);
    if (!ch.pin) return traLoi({ ok: false, maLoi: 'CHUA_CAI', loi: 'Chưa có "' + TRUONG_PIN + '" trong tab ' + TAB_CAU_HINH + ' — mở Apps Script, chạy hàm caiDat một lần' });
    if (chuanPin(d && d.pin) !== chuanPin(ch.pin)) { Utilities.sleep(2000); return traLoi({ ok: false, maLoi: 'PIN', loi: 'Sai mã PIN' }); }

    if (d.hanhDong === 'kiemTra') return traLoi({ ok: true, tienLe: ch.tienLe, canhBao: ch.canhBao });
    if (d.hanhDong === 'baoCao') return traLoi(baoCao(ss, d, ch));
    if (d.hanhDong !== 'ghiDon' && d.hanhDong !== 'chotNgay') return traLoi({ ok: false, loi: 'Hành động không hợp lệ' });

    var khoa = LockService.getScriptLock();
    if (!khoa.tryLock(20000)) return traLoi({ ok: false, loi: 'Máy khác đang ghi sổ, thử lại sau ít giây' });
    try {
      return traLoi(d.hanhDong === 'ghiDon' ? ghiDon(ss, d) : chotNgay(ss, d, ch));
    } finally {
      khoa.releaseLock();
    }
  } catch (err) {
    return traLoi({ ok: false, loi: String(err && err.message || err) });
  }
}

/* ══════════════════ CẤU HÌNH ══════════════════ */
function docCauHinh(ss) {
  var kq = { pin: null, tienLe: 0, canhBao: [] };
  var sh = ss.getSheetByName(TAB_CAU_HINH);
  if (!sh) { kq.canhBao.push('Chưa có tab ' + TAB_CAU_HINH); return kq; }
  var hang = sh.getDataRange().getValues(), td = hang[0] || [];
  var cTr = timCot(td, 'Trường'), cGt = timCot(td, 'Giá trị');
  if (cTr < 0 || cGt < 0) { kq.canhBao.push('Tab ' + TAB_CAU_HINH + ' thiếu tiêu đề Trường / Giá trị'); return kq; }
  var gt = {};
  for (var i = 1; i < hang.length; i++) { var t = chuanHoa(hang[i][cTr]); if (t) gt[t] = hang[i][cGt]; }
  var pin = String(gt[chuanHoa(TRUONG_PIN)] == null ? '' : gt[chuanHoa(TRUONG_PIN)]).trim();
  kq.pin = pin || null;
  var tl = gt[chuanHoa(TRUONG_TIEN_LE)];
  if (tl == null || String(tl).trim() === '') kq.canhBao.push('Chưa khai "' + TRUONG_TIEN_LE + '" trong tab ' + TAB_CAU_HINH + ' — Chốt ngày đang tính là 0');
  else kq.tienLe = Math.max(0, soNguyen(tl) || 0);
  return kq;
}

/* ══════════════════ GHI ĐƠN ══════════════════ */
function ghiDon(ss, d) {
  if (!Array.isArray(d.don) || !d.don.length) return { ok: false, loi: 'Không có đơn nào để ghi' };
  if (d.don.length > TOI_DA_DON) return { ok: false, loi: 'Quá nhiều đơn trong một lần gửi' };
  var shD = layTab(ss, TAB_DON), shM = layTab(ss, TAB_MON);
  var hangD = shD.getDataRange().getValues(), cD = bangCot(hangD[0], COT.BanHang, TAB_DON);
  var tdM = shM.getRange(1, 1, 1, shM.getLastColumn()).getValues()[0], cM = bangCot(tdM, COT.BanHangMon, TAB_MON);

  var dongCua = {};
  for (var i = 1; i < hangD.length; i++) { var ma = String(hangD[i][cD['Mã']] || '').trim(); if (ma) dongCua[ma] = i + 1; }

  var bayGio = gioVN(new Date()), moiD = [], moiM = [], daGhi = [], boQua = [], daThem = {};
  d.don.forEach(function (x) {
    var s = kiemDon(x);
    if (s.loi) { boQua.push({ id: x && x.id ? String(x.id).slice(0, 40) : '', lyDo: s.loi }); return; }
    var r = dongCua[s.id];
    if (r) {   // đơn đã có trên sổ: chỉ cập nhật những gì được phép đổi sau khi chốt
      shD.getRange(r, cD['Trạng thái'] + 1).setValue(s.trangThai);
      shD.getRange(r, cD['Khách'] + 1).setValue(s.khach);
      shD.getRange(r, cD['SĐT'] + 1).setValue(s.sdt);
      shD.getRange(r, cD['Cập nhật lúc'] + 1).setValue(bayGio);
      daGhi.push(s.id);
      return;
    }
    if (daThem[s.id]) { daGhi.push(s.id); return; }
    daThem[s.id] = true;
    moiD.push(taoDong(hangD[0].length, cD, {
      'Mã': s.id, 'Số phiếu': s.bill, 'Ngày': s.ngay, 'Giờ': s.gio, 'Máy': s.may, 'Nguồn': NGUON[s.nguon],
      'Thanh toán': s.method === 'qr' ? 'Chuyển khoản' : 'Tiền mặt', 'Tạm tính': s.sub, 'Giảm giá': s.disc,
      'Thành tiền': s.amt, 'Khách đưa': s.cash, 'Tiền thối': s.change, 'Khách': s.khach, 'SĐT': s.sdt,
      'Trạng thái': s.trangThai, 'Cập nhật lúc': bayGio
    }));
    s.items.forEach(function (it) {
      moiM.push(taoDong(tdM.length, cM, {
        'Mã đơn': s.id, 'Số phiếu': s.bill, 'Ngày': s.ngay, 'Tên hàng': it.n, 'Đơn vị': it.u,
        'SL': it.q, 'Đơn giá': it.p, 'Thành tiền': Math.round(it.q * it.p), 'Ghi chú': it.note
      }));
    });
    daGhi.push(s.id);
  });
  themDong(shD, TAB_DON, hangD[0], moiD);
  themDong(shM, TAB_MON, tdM, moiM);
  if (moiD.length || moiM.length) SpreadsheetApp.flush();
  return { ok: true, daGhi: daGhi, boQua: boQua, soMoi: moiD.length };
}

/* Kiểm & chuẩn hoá một đơn từ máy gửi lên. Trả {loi} nếu không hợp lệ. */
function kiemDon(x) {
  x = x || {};
  var id = String(x.id || '');
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return { loi: 'Mã đơn không hợp lệ' };
  var ts = Number(x.ts);
  if (!(ts > 1600000000000 && ts < Date.now() + 86400000)) return { loi: 'Thời điểm bán không hợp lệ' };
  var tien = function (v) { var n = Math.round(Number(v) || 0); return n >= 0 && n <= TIEN_TOI_DA ? n : NaN; };
  var sub = tien(x.sub), disc = tien(x.disc), amt = tien(x.amt), cash = tien(x.cash), change = tien(x.change);
  if (isNaN(sub) || isNaN(disc) || isNaN(amt) || isNaN(cash) || isNaN(change)) return { loi: 'Số tiền không hợp lệ' };
  if (!Array.isArray(x.items) || x.items.length > TOI_DA_MON) return { loi: 'Danh sách món không hợp lệ' };
  var items = [];
  for (var k = 0; k < x.items.length; k++) {
    var it = x.items[k] || {}, n = String(it.n || '').trim().slice(0, 120), q = Number(it.q), p = tien(it.p);
    if (!n || !(q > 0 && q <= 100000) || isNaN(p)) return { loi: 'Món "' + n.slice(0, 30) + '" không hợp lệ' };
    items.push({ n: n, u: String(it.u || '').slice(0, 20), q: q, p: p, note: String(it.note || '').slice(0, 200) });
  }
  var luc = new Date(ts);
  return {
    id: id, ts: ts, ngay: Utilities.formatDate(luc, TZ, 'yyyy-MM-dd'), gio: Utilities.formatDate(luc, TZ, 'HH:mm'),
    bill: String(x.bill || '').slice(0, 20), may: String(x.may || '').slice(0, 30),
    nguon: NGUON[x.nguon] ? x.nguon : 'pos', method: x.method === 'qr' ? 'qr' : 'cash',
    sub: sub, disc: disc, amt: amt, cash: cash, change: change,
    khach: String(x.khach || '').slice(0, 60), sdt: String(x.sdt || '').slice(0, 20),
    trangThai: x['void'] ? 'Đã huỷ' : 'Hoàn tất', items: items
  };
}

/* ══════════════════ CHỐT NGÀY ══════════════════ */
function chotNgay(ss, d, ch) {
  var ngay = String(d.ngay || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { ok: false, loi: 'Ngày chốt không hợp lệ' };
  var tien = function (v) { var n = Math.round(Number(v) || 0); return n >= 0 && n <= TIEN_TOI_DA ? n : NaN; };
  var tienKet = tien(d.tienKet), ck = tien(d.chuyenKhoan), pos = tien(d.posGhiNhan);
  if (isNaN(tienKet) || isNaN(ck) || isNaN(pos)) return { ok: false, loi: 'Số tiền không hợp lệ' };

  var sh = layTab(ss, TAB_CHOT), hang = sh.getDataRange().getValues(), c = bangCot(hang[0], COT.ChotNgay, TAB_CHOT);
  var dong = -1;
  for (var i = 1; i < hang.length; i++) if (ngayChu(hang[i][c['Ngày']]) === ngay) dong = i + 1;
  var tienMat = tienKet - ch.tienLe;   // âm nếu két ít hơn tiền lẻ — vẫn ghi để thấy mà kiểm lại
  var gt = {
    'Ngày': ngay, 'Tiền mặt trong két': tienKet, 'Tiền lẻ đầu ngày': ch.tienLe, 'Tiền mặt bán được': tienMat,
    'Chuyển khoản': ck, 'Tổng': tienMat + ck, 'POS ghi nhận': pos, 'Người chốt': String(d.nguoi || '').slice(0, 30),
    'Lúc': gioVN(new Date()), 'Ghi chú': String(d.ghiChu || '').slice(0, 200)
  };
  var thay = dong > 0;
  if (!thay) {
    dong = sh.getLastRow() + 1;
    dinhDangChu(sh, TAB_CHOT, hang[0], dong, 1);
    sh.getRange(dong, 1, 1, hang[0].length).setValues([taoDong(hang[0].length, c, gt)]);
  } else {
    Object.keys(gt).forEach(function (k) { sh.getRange(dong, c[k] + 1).setValue(gt[k]); });
  }
  SpreadsheetApp.flush();
  return { ok: true, thay: thay, chot: chotRaNgoai(gt) };
}

function chotRaNgoai(g) {
  return {
    ngay: ngayChu(g['Ngày']), tienKet: soNguyen(g['Tiền mặt trong két']) || 0, tienLe: soNguyen(g['Tiền lẻ đầu ngày']) || 0,
    tienMat: soNguyen(g['Tiền mặt bán được']) || 0, chuyenKhoan: soNguyen(g['Chuyển khoản']) || 0, tong: soNguyen(g['Tổng']) || 0,
    posGhiNhan: soNguyen(g['POS ghi nhận']) || 0, nguoi: String(g['Người chốt'] || ''), luc: gioChu(g['Lúc'], 'yyyy-MM-dd HH:mm:ss'),
    ghiChu: String(g['Ghi chú'] || '')
  };
}

/* ══════════════════ BÁO CÁO ══════════════════ */
function baoCao(ss, d, ch) {
  var tu = String(d.tu || ''), den = String(d.den || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tu) || !/^\d{4}-\d{2}-\d{2}$/.test(den)) return { ok: false, loi: 'Khoảng ngày không hợp lệ' };

  var shD = layTab(ss, TAB_DON), hangD = shD.getDataRange().getValues(), cD = bangCot(hangD[0], COT.BanHang, TAB_DON);
  var don = [], theoMa = {};
  for (var i = 1; i < hangD.length; i++) {
    var h = hangD[i], ma = String(h[cD['Mã']] || '').trim(), ngay = ngayChu(h[cD['Ngày']]);
    if (!ma || ngay < tu || ngay > den) continue;
    var s = {
      id: ma, bill: String(h[cD['Số phiếu']] || ''), ngay: ngay, gio: gioChu(h[cD['Giờ']], 'HH:mm'),
      may: String(h[cD['Máy']] || ''), nguon: khoaNguon(h[cD['Nguồn']]),
      method: String(h[cD['Thanh toán']]).trim() === 'Chuyển khoản' ? 'qr' : 'cash',
      sub: soNguyen(h[cD['Tạm tính']]) || 0, disc: soNguyen(h[cD['Giảm giá']]) || 0, amt: soNguyen(h[cD['Thành tiền']]) || 0,
      cash: soNguyen(h[cD['Khách đưa']]) || 0, change: soNguyen(h[cD['Tiền thối']]) || 0,
      khach: String(h[cD['Khách']] || ''), sdt: String(h[cD['SĐT']] || ''),
      'void': String(h[cD['Trạng thái']]).trim() === 'Đã huỷ', items: []
    };
    don.push(s); theoMa[ma] = s;
  }
  if (don.length) {
    var shM = layTab(ss, TAB_MON), hangM = shM.getDataRange().getValues(), cM = bangCot(hangM[0], COT.BanHangMon, TAB_MON);
    for (var j = 1; j < hangM.length; j++) {
      var m = hangM[j], chu = theoMa[String(m[cM['Mã đơn']] || '').trim()];
      if (!chu) continue;
      chu.items.push({ n: String(m[cM['Tên hàng']] || ''), u: String(m[cM['Đơn vị']] || ''), q: Number(m[cM['SL']]) || 0,
                       p: soNguyen(m[cM['Đơn giá']]) || 0, note: String(m[cM['Ghi chú']] || '') });
    }
  }
  var chot = [];
  var shC = layTab(ss, TAB_CHOT), hangC = shC.getDataRange().getValues(), cC = bangCot(hangC[0], COT.ChotNgay, TAB_CHOT);
  for (var k = 1; k < hangC.length; k++) {
    var n = ngayChu(hangC[k][cC['Ngày']]);
    if (!n || n < tu || n > den) continue;
    var g = {};
    COT.ChotNgay.forEach(function (t) { g[t] = hangC[k][cC[t]]; });
    chot.push(chotRaNgoai(g));
  }
  return { ok: true, don: don, chot: chot, tienLe: ch.tienLe, canhBao: ch.canhBao, thoiGian: new Date().toISOString() };
}

/* ══════════════════ CÀI / NÂNG CẤP ══════════════════ */
function caiDat() {
  var ss = SpreadsheetApp.openById(ID_BAYICH2);
  [TAB_DON, TAB_MON, TAB_CHOT].forEach(function (t) { taoTab(ss, t); });
  var sh = ss.getSheetByName(TAB_CAU_HINH);
  if (!sh) {
    sh = taoTab(ss, TAB_CAU_HINH);
    sh.getRange(2, 1, CAU_HINH_BAN_DAU.length, 4).setValues(CAU_HINH_BAN_DAU);
    sh.getRange(2, 3, CAU_HINH_BAN_DAU.length, 1).setWrap(true);
  } else {
    Logger.log('Tab ' + TAB_CAU_HINH + ' đã có — giữ nguyên, chỉ thêm trường còn thiếu');
    themTruongThieu(sh);
  }
  var ch = docCauHinh(ss);
  if (!ch.pin) {
    var pin = String(100000 + Math.floor(Math.random() * 900000));
    var hang = sh.getDataRange().getValues(), cTr = timCot(hang[0], 'Trường'), cGt = timCot(hang[0], 'Giá trị');
    for (var i = 1; i < hang.length; i++) {
      if (chuanHoa(hang[i][cTr]) === chuanHoa(TRUONG_PIN)) {
        sh.getRange(i + 1, cGt + 1).setNumberFormat('@').setValue(pin);
        Logger.log('Đã tạo ' + TRUONG_PIN + ': ' + pin + ' (xem / đổi ở tab ' + TAB_CAU_HINH + ')');
      }
    }
  } else {
    Logger.log(TRUONG_PIN + ' đã có — giữ nguyên');
  }
  ch = docCauHinh(ss);
  ch.canhBao.forEach(function (c) { Logger.log('  ! ' + c); });
  Logger.log('Xong. Nhớ: KHÔNG đưa tab ' + TAB_CAU_HINH + ' vào "Xuất bản lên web".');
}

function taoTab(ss, ten) {
  var sh = ss.getSheetByName(ten);
  if (sh) { if (ten !== TAB_CAU_HINH) Logger.log('Tab ' + ten + ' đã có — giữ nguyên'); return sh; }
  var cot = COT[ten];
  sh = ss.insertSheet(ten, ss.getNumSheets());
  sh.getRange(1, 1, 1, cot.length).setValues([cot]).setFontWeight('bold').setBackground('#2f5233').setFontColor('#f6f1e4');
  sh.setFrozenRows(1);
  (COT_CHU[ten] || []).forEach(function (t) { var i = cot.indexOf(t); if (i >= 0) sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@'); });
  (RONG[ten] || []).forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  Logger.log('Đã tạo tab ' + ten);
  return sh;
}

/* Tab CauHinh đã có (có thể do công cụ khác tạo): thêm dòng còn thiếu ngay dưới khối, không đụng dòng cũ */
function themTruongThieu(sh) {
  var hang = sh.getDataRange().getValues(), td = hang[0] || [];
  var cTr = timCot(td, 'Trường'), cGt = timCot(td, 'Giá trị'), cGc = timCot(td, 'Ghi chú'), cDc = timCot(td, 'Dùng cho');
  if (cTr < 0 || cGt < 0) { Logger.log('Tab ' + TAB_CAU_HINH + ' thiếu tiêu đề Trường / Giá trị — bỏ qua'); return; }
  var co = {}, cuoi = 1;
  for (var i = 1; i < hang.length; i++) { var t = String(hang[i][cTr] || '').trim(); if (t) { co[chuanHoa(t)] = true; cuoi = i + 1; } }
  var them = CAU_HINH_BAN_DAU.filter(function (c) { return !co[chuanHoa(c[0])]; });
  them.forEach(function (c, j) {
    var r = cuoi + 1 + j;
    sh.getRange(r, cTr + 1).setValue(c[0]);
    sh.getRange(r, cGt + 1).setNumberFormat('@').setValue(c[1]);
    if (cGc >= 0) sh.getRange(r, cGc + 1).setValue(c[2]);
    if (cDc >= 0) sh.getRange(r, cDc + 1).setValue(c[3]);
  });
  if (them.length) Logger.log('Đã thêm ' + them.length + ' trường: ' + them.map(function (c) { return c[0]; }).join(', '));
}

/* ══════════════════ phụ trợ ══════════════════ */
function layTab(ss, ten) {
  var sh = ss.getSheetByName(ten);
  if (!sh) throw new Error('Chưa có tab ' + ten + ' — mở Apps Script, chạy hàm caiDat một lần');
  return sh;
}

/* Vị trí từng cột theo chữ tiêu đề — người dùng có thể đổi thứ tự cột */
function bangCot(tieuDe, cot, ten) {
  var c = {}, thieu = [];
  cot.forEach(function (t) { c[t] = timCot(tieuDe || [], t); if (c[t] < 0) thieu.push(t); });
  if (thieu.length) throw new Error('Tab ' + ten + ' thiếu cột: ' + thieu.join(', '));
  return c;
}

function taoDong(dai, c, gt) {
  var dong = [];
  for (var i = 0; i < dai; i++) dong.push('');
  Object.keys(gt).forEach(function (k) { dong[c[k]] = gt[k]; });
  return dong;
}

function themDong(sh, ten, tieuDe, dong) {
  if (!dong.length) return;
  var r = sh.getLastRow() + 1;
  dinhDangChu(sh, ten, tieuDe, r, dong.length);
  sh.getRange(r, 1, dong.length, tieuDe.length).setValues(dong);
}

function dinhDangChu(sh, ten, tieuDe, r, n) {
  (COT_CHU[ten] || []).forEach(function (t) { var i = timCot(tieuDe, t); if (i >= 0) sh.getRange(r, i + 1, n, 1).setNumberFormat('@'); });
}

function khoaNguon(nhan) {
  var n = chuanHoa(nhan);
  for (var k in NGUON) if (chuanHoa(NGUON[k]) === n) return k;
  return 'pos';
}

function ngayChu(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v == null ? '' : v).trim();
}

function gioChu(v, dang) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, dang);
  return String(v == null ? '' : v).trim();
}

function gioVN(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss'); }

function chuanPin(s) { return String(s == null ? '' : s).replace(/\s+/g, '').replace(/^0+(?=\d)/, ''); }

function soNguyen(v) {
  if (typeof v === 'number') return Math.round(v);
  var s = String(v == null ? '' : v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  var n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n);
}

function chuanHoa(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function timCot(tieuDe, ten) {
  var can = chuanHoa(ten);
  for (var i = 0; i < tieuDe.length; i++) if (chuanHoa(tieuDe[i]) === can) return i;
  return -1;
}

function traLoi(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
