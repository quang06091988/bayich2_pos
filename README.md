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

## Cách POS gửi đơn

Đơn chốt xong vào hàng chờ trong máy rồi tự gửi lên. Mất mạng, Google lỗi hay hết giờ chờ thì cứ để trong hàng chờ
và gửi lại sau — máy chủ nhận theo mã đơn nên không bao giờ trùng. Huỷ / khôi phục đơn và sửa tên, SĐT khách cũng
được gửi lên. Đơn bán khi máy chưa cài sổ chỉ nằm trong máy. Mọi lệnh cần Mã PIN; sai PIN máy chủ chờ 2 giây mới trả lời.
