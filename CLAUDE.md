# CLAUDE.md — App Đối Soát Bill Taxi TSS (repo DOI-SOAT-TAXI-TSS)

## Người dùng & cách làm việc
- Công ty CP Dịch Vụ Hàng Không TSS (vận chuyển hành khách, taxi, quầy sân bay TSN, chi nhánh Nha Trang).
- Người dùng KHÔNG phải lập trình viên: luôn trả lời **tiếng Việt, câu ngắn, dễ hiểu**. Hay gửi ảnh chụp màn hình để báo lỗi.
- Muốn làm trọn vẹn: sửa code → tự thử → push GitHub → Vercel tự deploy → báo link.
- App này KHÁC app nhân sự HR (repo APP-NH-N-S-). Không trộn lẫn.

## Deploy
- Repo public `maituankhanh94-hash/doi-soat-taxi-tss`, nhánh `main` → Vercel project **dv-tss-30-10** (tài khoản maituankhanh94-9147).
- Link chính: https://dv-tss-30-10.vercel.app
- Link preview nhánh: `https://dv-tss-30-10-git-<tên-nhánh>-maituankhanh94-9147.vercel.app/`
- Kiểm tra deploy: `curl https://api.github.com/repos/maituankhanh94-hash/doi-soat-taxi-tss/commits/<sha>/status` → Vercel "Deployment has completed".
- Thay đổi lớn / chạm dữ liệu: đưa lên nhánh thử nghiệm + vùng dữ liệu riêng (vd. tiền tố đường dẫn `test/…` trong Realtime DB), gửi link preview; chỉ push `main` khi người dùng nói "đưa lên bản chính". Sửa nhỏ an toàn có thể lên thẳng main sau khi tự thử kỹ.
- Push bị 403 → người dùng cài Claude GitHub App cho repo: https://github.com/apps/claude/installations/select_target

## Kiến trúc app
- Một file duy nhất `index.html` (~2400 dòng, gốc do Gemini Canvas tạo). Tailwind CDN, SheetJS xlsx 0.18.5, Firebase **compat 9.22 – Realtime Database** (KHÔNG phải Firestore), không dùng Firebase Auth.
- Dự án Firebase: `taxi-tss-df1a5`, DB `https://taxi-tss-df1a5-default-rtdb.firebaseio.com`.
- Cấu trúc dữ liệu:
  - `settings/accounts` (mảng {user, pass, role} — mật khẩu dạng chữ thường), `settings/sources`, `settings/staff`, `settings/carTypes`, `settings/payments`, `settings/planPayments` (mảng, ghi đè cả mảng bằng `set`), `settings/lockHour`.
  - `trips/<id>` (toàn công ty) và `users_trips/<USER>/<id>` (bản sao theo tài khoản). id dạng `X<timestamp>_<i>` (cố định, tốt).
  - Trường đơn: dateStr (dd/mm/yyyy), timeStr, ticketNumber, originalTicket, plateNumber, carType, source, pickup (T1/T2/T3), destination, totalFare, originalTotalFare, paymentMethod, note, staff, role, createdBy, timestamp.
- 4 phân vùng: `pos` Bán vé (quầy), `driver` Cổng chủ xe, `plan` Team kế hoạch (đăng nhập bằng tài khoản trong settings/accounts), `manager` (mật khẩu cứng `999` trong code; mật khẩu xóa đơn `0105`).
- Nhập hàng loạt 20 dòng; tên nhân sự "A + B" → tách đơn chia đều tiền (phiếu `123-1/2`). Chặn trùng (phiếu+biển số+ngày) trong tài khoản. Khóa sửa/xóa sau `lockHour` giờ sáng hôm sau.
- Đối soát (Quản lý): gom nhóm theo `số phiếu gốc + biển số + ngày`; so bên Quầy/Kế hoạch với bên Tài xế: lệch tiền < 1.000đ và cùng hình thức TT (hoặc thuộc nhóm đối tác/kế hoạch) → Trùng khớp; thiếu 1 bên → Chưa khớp; còn lại → Lệch. Xuất Excel bằng SheetJS (không màu).

## Lỗi/rủi ro đã phát hiện (06/11/2026, chưa sửa)
1. BẢO MẬT: không có Auth → quy tắc RTDB gần như chắc chắn mở công khai; ai có link đọc/xóa được toàn bộ dữ liệu, xem cả mật khẩu tài khoản. Mật khẩu quản lý/xóa nằm trong code public.
2. Excel xuất ra dùng luật đối soát khác màn hình (so khắt khe tên hình thức TT) → màn hình "Trùng khớp" nhưng Excel "Không trùng khớp" (đã tái hiện).
3. "Tổng doanh thu ngày" của Quản lý cộng cả đơn Tài xế lẫn Quầy → 1 chuyến bị tính 2 lần (đã tái hiện: 300k → 600k).
4. Sửa số phiếu (modal Sửa hoặc ô sửa nhanh của Quản lý) không cập nhật `originalTicket` → sửa phiếu gõ nhầm vẫn không ghép cặp được.
5. Không escape HTML: dấu `"` trong điểm đến/ghi chú bị cắt trong ô sửa nhanh, và khi rời ô sẽ lưu bản bị cắt → mất chữ (đã tái hiện).
6. Ô sửa nhanh lưu cả đơn mỗi lần rời ô (kể cả không đổi); số phiếu tách "123-1/2" hiển thị thành "123-1-2" rồi bị ghi đè.
7. Mã phiếu có sẵn dấu "-" bị cắt khi gom nhóm (`split('-')[0]`) → có thể ghép nhầm phiếu khác nhau.
8. Quản lý tải lại toàn bộ `trips` mỗi lần có thay đổi → chậm dần khi dữ liệu lớn. Danh mục/tài khoản ghi đè cả mảng, sửa/xóa theo số thứ tự → 2 người sửa cùng lúc có thể đè nhau.
9. Code chết: `checkAndShowMilestoneCongratModal` dùng biến không tồn tại (không được gọi).

## Cách thử trong sandbox
- Bị chặn: cdn.tailwindcss.com, cdnjs, jsdelivr, gstatic, *.vercel.app, **firebaseio.com**. Được: npm, api.github.com.
- Playwright + `page.route`: trả index.html, Tailwind rỗng, xlsx từ npm, thay `firebase-app-compat.js` bằng Firebase giả trong bộ nhớ (`firebase.database().ref(p).on/once/set/update`). Không bao giờ chạy thử với Firebase thật.
- LibreOffice (soffice + pdftoppm) có sẵn để chụp ảnh file Excel.

## Bài học từ app HR (áp dụng khi sửa)
- Escape HTML khi chèn dữ liệu; dùng id cố định thay vì số thứ tự; ngày "hôm nay" theo giờ địa phương (không dùng toISOString).
- Chỉ ghi phần thay đổi, tránh ghi đè cả khối dữ liệu.
- Excel có định dạng: dùng ExcelJS (tải khi cần) — người dùng thích màu theo logic, kẻ ô, nhóm, dòng tổng, khu vực ký tên.
- Repo public → nhắc người dùng chuyển sang Private (hoặc ít nhất bỏ mật khẩu khỏi code).
