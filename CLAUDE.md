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
- 4 phân vùng: `pos` Bán vé (quầy), `driver` Cổng chủ xe, `plan` Team kế hoạch, `manager` Quản lý.

## Đăng nhập & bảo mật (nhánh `bao-mat-dang-nhap`, từ 07/11/2026)
- Firebase Auth Email/Password. Tài khoản app `TSS01` ↔ email nội bộ `tss01@taxi-tss.local` (bản thử: `@test.taxi-tss.local`); đặt lại MK lần n → `tss01.vN@…`. Mật khẩu Firebase = `'tss-pw:' + mật khẩu app` (để MK cũ ngắn như "123" vẫn dùng được).
- Dữ liệu tài khoản: `login_index/<USER>={ver}` (công khai, để biết email khi đăng nhập), `accounts/<USER>={role,active,uid,ver}` (quản lý đọc), `roles/<uid>={user,role,active}` (quy tắc dựa vào đây).
- Quản lý tạo/đặt lại MK bằng app Firebase phụ (`createAuthUserFor`) → không bị đăng xuất. Không đổi được MK người khác → tạo phiên bản email mới, giữ tên tài khoản.
- Lần đầu (chưa có `login_index`): nút Trang Quản Lý → "Thiết lập quản lý lần đầu" (cần MK cũ 999), quy tắc cho phép tự phong quản lý chỉ khi `roles` trống. Sau đó nút "Chuyển Đổi Tài Khoản Cũ" chuyển `settings/accounts` (MK dạng chữ) sang Firebase rồi xóa nó.
- Xóa đơn ở Trang Quản Lý: nhập lại MK của chính quản lý (reauthenticate). Nút 🔑 Đổi Mật Khẩu cho mọi tài khoản. Bị khóa khi đang dùng → tự đăng xuất.
- Môi trường: `FORCE_TEST_ENV` trong index.html (nhánh thử = true, main = false) hoặc hostname có `-git-`/localhost → vùng `test_env/`, nhãn 🧪 BẢN THỬ, có nút "Chép dữ liệu thật vào bản thử" (chỉ đọc dữ liệu thật).
- Quy tắc: `firebase-rules/quy-tac-buoc-1.json` (chuyển tiếp: đường dẫn thật vẫn công khai, `test_env` khóa chặt) và `quy-tac-buoc-2.json` (khóa chặt cả hai). Sinh bằng script trong lịch sử phiên; giữ hai file đồng bộ khi sửa.
- Trình tự lên bản chính: bật Email/Password → dán quy tắc bước 1 → thử bản thử → đổi FORCE_TEST_ENV=false, merge main → quản lý thiết lập lần đầu + chuyển đổi tài khoản → dán quy tắc bước 2.
- Nhập hàng loạt 20 dòng; tên nhân sự "A + B" → tách đơn chia đều tiền (phiếu `123-1/2`). Chặn trùng (phiếu+biển số+ngày) trong tài khoản. Khóa sửa/xóa sau `lockHour` giờ sáng hôm sau.
- Đối soát (Quản lý): gom nhóm theo `số phiếu gốc + biển số + ngày`; so bên Quầy/Kế hoạch với bên Tài xế: lệch tiền < 1.000đ và cùng hình thức TT (hoặc thuộc nhóm đối tác/kế hoạch) → Trùng khớp; thiếu 1 bên → Chưa khớp; còn lại → Lệch. Xuất Excel bằng SheetJS (không màu).

## Chức năng thêm (nhánh bao-mat-dang-nhap)
- Ô tìm tài khoản `#acc-search` (lọc theo tên/phân vùng/trạng thái; không có → báo "CHƯA được tạo").
- Chưa báo cáo: nhóm thiếu 1 bên; quá hạn `reportDeadline` = ngày đơn +1 lúc `lockHourSetting` giờ (dữ liệu thật đang đặt 22h) → "Quá hạn: Tài xế/Bán vé chưa báo". Khung `#overdue-box` = "NHẮC BÁO CÁO NGÀY" chọn 1 ngày (mặc định hôm nay): liệt kê xe chưa báo (theo biển số) và phiếu bán vé chưa nhập — người dùng muốn GỌN, đừng gom nhiều ngày. Bộ lọc trạng thái `overdue*`, từ khóa "chưa báo"/"quá hạn". Ghép cặp so biển số đã chuẩn hóa `normalizePlate` (bỏ dấu . - khoảng trắng).

- Luật khớp thanh toán (08/11, người dùng báo "Thẻ vs NVQ vẫn khớp"): `paymentCategory` quy về NVQ / THE / TXT / KH (đơn role plan luôn KH; Công nợ, Chuyển khoản, đối tác = KH); đơn cũ không ghi thanh toán → theo nguồn (đối tác = KH) hoặc "chưa ghi". Khớp khi tiền lệch < 1.000đ VÀ mọi đơn 2 bên cùng 1 nhóm; "Free nội bộ" (FREE) ở bất kỳ bên nào thì khớp mọi hình thức (vẫn so tiền). `getMismatchReason` hiện lý do dưới nhãn Đơn Lệch và trong Excel. Ô chọn thanh toán hiện đúng giá trị thật (trước đây trống thì hiện nhầm lựa chọn đầu tiên).

## Lỗi/rủi ro đã phát hiện (06/11/2026, chưa sửa)
1. BẢO MẬT: quy tắc RTDB thật đang là `.read/.write: true` (đã xác nhận qua ảnh console 07/11). Đang sửa ở nhánh `bao-mat-dang-nhap`. Số liệu 07/11: lưu 1,61 MB, tải về 121 MB/6 ngày, kết nối đỉnh 33/100 (gói Spark). DB thật còn 2 nhánh cũ không dùng: `deleted_trips`, `drivers`.
2. ĐÃ SỬA (nhánh bao-mat-dang-nhap): màn hình & Excel dùng chung `computeAuditGroups`/`getAuditStatus`. Excel xuất bằng ExcelJS 4.4.0 (tải khi cần): sheet "Đối Soát" (màu theo trạng thái, kẻ ô, nhóm theo ngày, gộp ô STT/Trạng thái, dòng cộng ngày + tổng cộng, ký tên) và sheet "Tổng Hợp" (theo trạng thái / hình thức TT / nhân sự). Ngày gõ thiếu dấu ("01/112026") được `normalizeDateInput` tự sửa; nhập đơn kiểm tra ngày hợp lệ (`isValidDateStr`).
3. "Tổng doanh thu ngày" của Quản lý cộng cả đơn Tài xế lẫn Quầy → 1 chuyến bị tính 2 lần (đã tái hiện: 300k → 600k).
4. Sửa số phiếu (modal Sửa hoặc ô sửa nhanh của Quản lý) không cập nhật `originalTicket` → sửa phiếu gõ nhầm vẫn không ghép cặp được.
5. Không escape HTML: dấu `"` trong điểm đến/ghi chú bị cắt trong ô sửa nhanh, và khi rời ô sẽ lưu bản bị cắt → mất chữ (đã tái hiện).
6. Ô sửa nhanh lưu cả đơn mỗi lần rời ô (kể cả không đổi); số phiếu tách "123-1/2" hiển thị thành "123-1-2" rồi bị ghi đè.
7. Mã phiếu có sẵn dấu "-" bị cắt khi gom nhóm (`split('-')[0]`) → có thể ghép nhầm phiếu khác nhau.
8. Quản lý tải lại toàn bộ `trips` mỗi lần có thay đổi → chậm dần khi dữ liệu lớn. Danh mục/tài khoản ghi đè cả mảng, sửa/xóa theo số thứ tự → 2 người sửa cùng lúc có thể đè nhau.
9. Code chết: `checkAndShowMilestoneCongratModal` dùng biến không tồn tại (không được gọi).

## Cách thử trong sandbox
- Bị chặn: cdn.tailwindcss.com, cdnjs, jsdelivr, gstatic, *.vercel.app, **firebaseio.com**. Được: npm, api.github.com.
- Tốt nhất: Firebase Emulator thật (`npm i firebase-tools@13 firebase@9.22.0`, `firebase emulators:start --only database,auth`, Java có sẵn, tải jar được). Playwright `page.route` trả index.html đã chèn `useEmulator` (rtdb, fbAuth, secAuth), phục vụ file compat từ node_modules/firebase; launch Chromium với `--disable-web-security --disable-features=BlockInsecurePrivateNetworkRequests,LocalNetworkAccessChecks`. Nạp quy tắc: PUT `/.settings/rules.json?ns=taxi-tss-df1a5-default-rtdb` header `Authorization: Bearer owner`. Không bao giờ chạy thử với Firebase thật.
- LibreOffice (soffice + pdftoppm) có sẵn để chụp ảnh file Excel.

## Bài học từ app HR (áp dụng khi sửa)
- Escape HTML khi chèn dữ liệu; dùng id cố định thay vì số thứ tự; ngày "hôm nay" theo giờ địa phương (không dùng toISOString).
- Chỉ ghi phần thay đổi, tránh ghi đè cả khối dữ liệu.
- Excel có định dạng: dùng ExcelJS (tải khi cần) — người dùng thích màu theo logic, kẻ ô, nhóm, dòng tổng, khu vực ký tên.
- Repo public → nhắc người dùng chuyển sang Private (hoặc ít nhất bỏ mật khẩu khỏi code).
