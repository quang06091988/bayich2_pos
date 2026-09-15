# bayich2_pos — Bán hàng Bảy Ích 2

Trang bán hàng tại quầy (https://bayich2-pos.vercel.app): chọn hàng, tính tiền, VietQR, phiếu 58mm / A5,
nạp đơn Zalo từ link, báo cáo và **sổ bán hàng chung** trên Google Sheet.

## Dữ liệu

| Nguồn | Dùng để |
|---|---|
| Tab **Menu**, **Info** (sheet bayich2, CSV công khai) | Danh sách hàng, giá, thông tin tiệm |
| Apps Script **bayich2_banhang** (thư mục `appsscript/`) | Sổ bán hàng chung: ghi đơn, chốt ngày, báo cáo |

Script ghi vào 4 tab của sheet bayich2:

| Tab | Mỗi dòng |
|---|---|
| `BanHang` | một đơn (mã đơn = máy + thời điểm, không bao giờ trùng) |
| `BanHangMon` | một món trong đơn |
| `ChotNgay` | một ngày: tiền mặt trong két, tiền lẻ đầu ngày, chuyển khoản, doanh thu ngày |
| `CauHinh` | cài đặt nội bộ dùng chung: **Mã PIN chung**, **Tiền lẻ đầu ngày** — ⚠ không xuất bản tab này lên web |

Cột được tìm theo chữ tiêu đề, đổi thứ tự cột không sao.

## Cài lần đầu

1. Mở script → chọn hàm `caiDat` → Run → cấp quyền. Hàm tạo 4 tab và một Mã PIN ngẫu nhiên (xem ở tab `CauHinh`).
2. Điền **Tiền lẻ đầu ngày** trong tab `CauHinh`.
3. Mỗi điện thoại: mở POS → bấm **Chưa cài sổ** → nhập tên, ký hiệu số phiếu, Mã PIN.

- Script: https://script.google.com/d/1JwkkCWYsZSU4OotnVrDsWIdOet4JJnGtBwVPaR2lgs2c4KbMdeF-WkS_/edit
- Deployment (`API_SO` trong index.html): `AKfycbyPQNTjjlOHMY71N8AS8F26UptH3jWlXjcBgmf7sKXsJtPXYNnN7An2obL3JBEpYjzyJg`
- Cập nhật backend: `clasp push` → `clasp deploy -i <deploymentId>` (link /exec giữ nguyên).

## Bán nhanh

- **💵 Thu đủ** (thanh giỏ dưới đáy / cạnh nút Thanh toán): khách trả vừa đủ tiền mặt → chốt đơn trong một chạm, qua đơn mới
  ngay. Thanh báo 6 giây có **Phiếu** (in / chia sẻ) và **Hoàn tác** (bấm nhầm → huỷ đơn, hàng quay lại giỏ).
  Chuyển khoản, giảm giá, khách đưa tiền lớn cần thối → dùng **Thanh toán** như cũ (giảm giá nằm sau "Giảm giá ›").
- **Chạm vào số lượng** trong giỏ để gõ thẳng số (vd 20); 0 = bỏ món.
- **Chữ to, nút to**: bật riêng từng máy ở cuối Báo cáo hoặc trong khung "Cài sổ chung cho máy này".

## Cài POS lên điện thoại

- **Android (Chrome):** mở POS → bấm **Cài** ở thanh "📲 Cài POS lên màn hình chính" (hoặc menu ⋮ → Cài đặt ứng dụng).
- **iPhone (Safari):** bấm **Chia sẻ** ⎋ → **Thêm vào MH chính**. iPhone không chuyển dữ liệu từ Safari sang app vừa thêm:
  mở app xong bấm **Chưa cài sổ** và nhập lại Mã PIN (đơn còn trong hàng chờ của Safari thì mở Safari một lần cho nó gửi xong).
- `sw.js` cho app mở được cả khi mất mạng: trang và danh sách hàng lấy mạng trước, mất mạng thì dùng bản đã lưu;
  không bao giờ lưu các lệnh gửi sổ chung. Đổi `BAN` trong `sw.js` khi đổi cách lưu.

## Cách POS gửi đơn

Đơn chốt xong vào hàng chờ trong máy rồi tự gửi lên. Mất mạng, Google lỗi hay hết giờ chờ thì cứ để trong hàng chờ
và gửi lại sau — máy chủ nhận theo mã đơn nên không bao giờ trùng. Huỷ / khôi phục đơn và sửa tên, SĐT khách cũng
được gửi lên. Đơn bán khi máy chưa cài sổ chỉ nằm trong máy. Mọi lệnh cần Mã PIN; sai PIN máy chủ chờ 2 giây mới trả lời.
