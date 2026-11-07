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
- Một file duy nhất `index.html` (~2900 dòng, gốc do Gemini Canvas tạo). Tailwind CDN, SheetJS xlsx 0.18.5 (cũ), ExcelJS 4.4.0 (tải khi xuất), Firebase **compat 9.22 – Realtime Database + Auth** (KHÔNG phải Firestore).
- Dự án Firebase: `taxi-tss-df1a5`, DB `https://taxi-tss-df1a5-default-rtdb.firebaseio.com`.
- Cấu trúc dữ liệu:
  - `settings/accounts` (mảng {user, pass, role} — mật khẩu dạng chữ thường), `settings/sources`, `settings/staff`, `settings/carTypes`, `settings/payments`, `settings/planPayments` (mảng, ghi đè cả mảng bằng `set`), `settings/lockHour`.
  - `trips/<id>` (toàn công ty) và `users_trips/<USER>/<id>` (bản sao theo tài khoản). id dạng `X<timestamp>_<i>` (cố định, tốt).
  - Trường đơn: dateStr (dd/mm/yyyy), timeStr, ticketNumber, originalTicket, plateNumber, carType, source, pickup (T1/T2/T3), destination, totalFare, originalTotalFare, paymentMethod, note, staff, role, createdBy, timestamp.
- 4 phân vùng: `pos` Bán vé (quầy), `driver` Cổng chủ xe, `plan` Team kế hoạch, `manager` Quản lý.

## Đăng nhập & bảo mật (lên main 07/11/2026; nhánh thử `bao-mat-dang-nhap`)
- Firebase Auth Email/Password. Tài khoản app `TSS01` ↔ email nội bộ `tss01@taxi-tss.local` (bản thử: `@test.taxi-tss.local`); đặt lại MK lần n → `tss01.vN@…`. Mật khẩu Firebase = `'tss-pw:' + mật khẩu app` (để MK cũ ngắn như "123" vẫn dùng được).
- Dữ liệu tài khoản: `login_index/<USER>={ver}` (công khai, để biết email khi đăng nhập), `accounts/<USER>={role,active,uid,ver}` (quản lý đọc), `roles/<uid>={user,role,active}` (quy tắc dựa vào đây).
- Quản lý tạo/đặt lại MK bằng app Firebase phụ (`createAuthUserFor`) → không bị đăng xuất. Không đổi được MK người khác → tạo phiên bản email mới, giữ tên tài khoản.
- Lần đầu (chưa có `login_index`): nút Trang Quản Lý → "Thiết lập quản lý lần đầu" (cần MK cũ 999), quy tắc cho phép tự phong quản lý chỉ khi `roles` trống. Sau đó nút "Chuyển Đổi Tài Khoản Cũ" chuyển `settings/accounts` (MK dạng chữ) sang Firebase rồi xóa nó.
- Xóa đơn ở Trang Quản Lý: nhập lại MK của chính quản lý (reauthenticate). Nút 🔑 Đổi Mật Khẩu cho mọi tài khoản. Bị khóa khi đang dùng → tự đăng xuất.
- Môi trường: `FORCE_TEST_ENV` trong index.html (nhánh thử = true, main = false) hoặc hostname có `-git-`/localhost → vùng `test_env/`, nhãn 🧪 BẢN THỬ, có nút "Chép dữ liệu thật vào bản thử" (chỉ đọc dữ liệu thật).
- Quy tắc: `firebase-rules/quy-tac-buoc-1.json` (chuyển tiếp: đường dẫn thật vẫn công khai, `test_env` khóa chặt) và `quy-tac-buoc-2.json` (khóa chặt cả hai). Sinh bằng script trong lịch sử phiên; giữ hai file đồng bộ khi sửa.
- Trình tự lên bản chính: bật Email/Password (đã xong) → dán quy tắc bước 1 (đã xong) → thử bản thử (đã xong) → FORCE_TEST_ENV=false, merge main (07/11) → quản lý thiết lập lần đầu + chuyển đổi tài khoản → dán quy tắc bước 2 (ảnh console xác nhận đã Publish quy tắc bước 2 ngày 07/11). HIỆN TẠI DB THẬT ĐÃ KHÓA. Trên nhánh thử, link `-git-` vẫn tự vào vùng thử nên giữ FORCE_TEST_ENV=false cũng được.
- Nhập hàng loạt 20 dòng; tên nhân sự "A + B" → tách đơn chia đều tiền (phiếu `123-1/2`). Chặn trùng (phiếu+biển số+ngày) trong tài khoản. Khóa sửa/xóa sau `lockHour` giờ sáng hôm sau.
- Đối soát (Quản lý): gom nhóm theo `số phiếu gốc + biển số + ngày`; so bên Quầy/Kế hoạch với bên Tài xế: lệch tiền < 1.000đ và cùng hình thức TT (hoặc thuộc nhóm đối tác/kế hoạch) → Trùng khớp; thiếu 1 bên → Chưa khớp; còn lại → Lệch. Xuất Excel bằng SheetJS (không màu).

## Chức năng thêm (nhánh bao-mat-dang-nhap)
- Ô tìm tài khoản `#acc-search` (lọc theo tên/phân vùng/trạng thái; không có → báo "CHƯA được tạo").
- Chưa báo cáo: nhóm thiếu 1 bên; quá hạn `reportDeadline` = ngày đơn +1 lúc `lockHourSetting` giờ (dữ liệu thật đang đặt 22h) → "Quá hạn: Tài xế/Bán vé chưa báo". Khung `#overdue-box` = "NHẮC BÁO CÁO NGÀY" chọn 1 ngày (mặc định hôm nay): liệt kê xe chưa báo (theo biển số) và phiếu bán vé chưa nhập — người dùng muốn GỌN, đừng gom nhiều ngày. Bộ lọc trạng thái `overdue*`, từ khóa "chưa báo"/"quá hạn". Ghép cặp so biển số đã chuẩn hóa `normalizePlate` (bỏ dấu . - khoảng trắng).

- Luật khớp thanh toán (08/11, người dùng báo "Thẻ vs NVQ vẫn khớp"): `paymentCategory` quy về NVQ / THE / TXT / KH (đơn role plan luôn KH; Công nợ, Chuyển khoản, đối tác = KH); đơn cũ không ghi thanh toán → theo nguồn (đối tác = KH) hoặc "chưa ghi". Khớp khi tiền lệch < 1.000đ VÀ mọi đơn 2 bên cùng 1 nhóm; "Free nội bộ" (FREE) ở bất kỳ bên nào thì khớp mọi hình thức (vẫn so tiền); đơn chọn Free mà tiền > 0 → Lệch "chọn Free nhưng có nhập tiền". `getMismatchReason` hiện lý do dưới nhãn Đơn Lệch và trong Excel. Ô chọn thanh toán hiện đúng giá trị thật (trước đây trống thì hiện nhầm lựa chọn đầu tiên).

## Tải dữ liệu theo ngày & gợi ý địa chỉ (nhánh `cai-tien-doi-soat`, 08/11)
- Mỗi đơn có `dateKey` (yyyy-mm-dd). `meta/dateKeyV1 = true` khi đã nâng cấp. Quản lý đăng nhập lần đầu với quy tắc mới → `runDateKeyBackfill` (thêm dateKey mọi đơn cũ ở `trips` + `users_trips/<u>`, tạo `places`). Mỗi lần đăng nhập `fixMissingDateKeys` (query `orderByChild('dateKey').endAt(null)`) bổ sung đơn do máy bản cũ ghi.
- Quản lý (`refreshManagerWindow`): chỉ tải `trips` trong khoảng = hợp (ngày đối soát, ngày doanh thu, ngày nhắc báo cáo); "Xem Tất Cả" tải toàn bộ. Nhân viên (`setStaffWindow`): từ đầu tháng trước, xem ngày cũ hơn thì `ensureStaffDate` tải thêm; nhập đơn ngày cũ → `submitBatch` tải đúng ngày đó để kiểm tra trùng.
- Nếu quy tắc chưa cho đọc `meta` (quy tắc cũ) → chế độ `full` (tải toàn bộ như cũ), vẫn chạy bình thường.
- Gợi ý địa chỉ: `places/<slug>={name,n}` (slug bỏ dấu), tăng `n` khi lưu đơn (`recordPlaces`, ghi riêng, lỗi thì bỏ qua). Gõ ≥2 ký tự không dấu cũng tìm được (`removeAccents`). Ô gợi ý dùng chung `renderSuggestBox` (chuột, ↑↓ Enter, Esc), dùng cho tên nhân sự + điểm đến (nhập hàng loạt và modal sửa).
- Quy tắc mới (đã thêm `.indexOn` dateKey cho trips & users_trips/$user, `places`, `meta`): `firebase-rules/quy-tac-buoc-2.json`, sinh bằng `firebase-rules/sinh-quy-tac.js` (`node sinh-quy-tac.js firebase-rules`). Quy tắc mới tương thích ngược với app cũ.
- ĐÃ LÊN MAIN 08/11; ảnh console xác nhận quy tắc mới (có .indexOn, places, meta) đã Publish. Chờ người dùng xác nhận quản lý đã đăng nhập để chạy nâng cấp dateKey.
- Bản thử: nút "Chép Dữ Liệu Thật" hỏi tài khoản QUẢN LÝ BẢN CHÍNH (đọc bằng app Firebase phụ, đọc settings từng mục vì quy tắc không cho đọc cả `settings`).

## Chống mất dữ liệu (nhánh `sao-luu-thung-rac`, 07/11 — sau sự cố mất chấm công ở app HR)
- `APP_VERSION` (hiện 3) + `meta/minAppVersion`: quản lý đăng nhập tự nâng minAppVersion = APP_VERSION; máy chạy bản cũ hơn → `appOutdated`, khung "Đã có bản app mới" che màn hình, `guardWrite()` chặn ghi (submitBatch, saveEditedTrip, sửa nhanh, xóa, danh mục, khôi phục). **Mỗi khi đổi cách lưu dữ liệu: TĂNG APP_VERSION.**
- Thùng rác: xóa đơn → `deleteTripsToTrash` ghi `deleted_trips/<id>` (+deletedAt, deletedBy) cùng lúc với xóa; quy tắc cũ chặn thì vẫn xóa như trước. Quản lý: nút 🗑️ Thùng Rác (30 ngày, `orderByChild('deletedAt')`), khôi phục không đè đơn đang có. Nhánh `deleted_trips` thật có dữ liệu cũ không có deletedAt → không hiện, không đụng tới.
- Danh mục: `listTxn` (transaction) thêm/xóa đúng mục, xóa theo giá trị; không ghi đè cả mảng.
- Sao lưu: nút 💾 Tải Bản Sao Lưu (JSON: trips, settings trừ accounts, accounts (không có mật khẩu), places, deleted_trips), ghi `meta/lastBackup`, nhắc đỏ nếu ≥7 ngày. 📤 Khôi Phục Từ File: chỉ THÊM đơn đang thiếu + mục danh mục thiếu, không sửa/xóa gì.
- Kiểm tra code 07/11: đơn lưu từng bản ghi riêng, không có đoạn tự dọn/xóa; bản app trước 07/11 bị quy tắc chặn hoàn toàn.

## Đếm số đơn theo bill (07/11)
- Đơn chia tiền nhiều nhân sự (A + B → "123-1/2", "123-2/2") vẫn lưu nhiều dòng nhưng ĐẾM là 1 đơn: `billKey` (phía + phiếu gốc + biển số chuẩn hóa + dateKey), `countBills`, `billCountText` → "3 đơn (4 dòng chia tiền)". Dùng ở tổng ngày/tháng/ảnh báo cáo của nhân viên, doanh thu ngày của quản lý, Excel (sideSums, sheet Tổng Hợp). Số phiếu hiển thị đúng "123-1/2" (formatDisplayTicket không đổi "/" thành "-" nữa). Excel không còn ký hiệu ₫ (người dùng yêu cầu).

## Lỗi/rủi ro đã phát hiện (06/11/2026) — 3–9 ĐÃ SỬA ở nhánh `cai-tien-doi-soat` (08/11)
1. ĐÃ SỬA 07/11: quy tắc RTDB thật trước đây `.read/.write: true`; nay là quy-tac-buoc-2 + Firebase Auth. Còn tồn: dữ liệu thử `test_env/` và tài khoản Auth `@test.taxi-tss.local`. Số liệu 07/11: lưu 1,61 MB, tải về 121 MB/6 ngày, kết nối đỉnh 33/100 (gói Spark). DB thật còn 2 nhánh cũ không dùng: `deleted_trips`, `drivers`.
2. ĐÃ SỬA: màn hình & Excel dùng chung `computeAuditGroups`/`getAuditStatus`; Excel ExcelJS có màu/kẻ ô/nhóm ngày/tổng/ký tên + sheet Tổng Hợp; ngày gõ thiếu dấu tự sửa, ngày sai bị chặn.
3. ĐÃ SỬA: "Tổng doanh thu ngày" chỉ cộng Bán vé + Kế hoạch; Chủ xe hiện riêng để đối chiếu.
4. ĐÃ SỬA: sửa số phiếu (modal / sửa nhanh) cập nhật `originalTicket = baseTicketOf(...)`.
5. ĐÃ SỬA: escape HTML (`escHtml`) mọi chỗ chèn dữ liệu đơn/danh mục; gợi ý dùng data-attribute.
6. ĐÃ SỬA: sửa nhanh chỉ lưu khi đổi thật và chỉ ghi đúng ô đó; ô số phiếu hiện đúng "123-1/2".
7. ĐÃ SỬA: ghép cặp dùng `originalTicket` / `baseTicketOf` (chỉ bỏ đuôi -k/n), không cắt ở dấu "-".
8. ĐÃ SỬA phần tải dữ liệu (xem mục trên). Còn tồn: mỗi đơn vẫn lưu 2 bản (trips + users_trips) — chấp nhận được (dung lượng nhỏ). Danh mục (nguồn đơn, nhân sự...) vẫn ghi cả mảng nhưng chỉ quản lý sửa.
9. ĐÃ XÓA code chết.

## Cách thử trong sandbox
- Bị chặn: cdn.tailwindcss.com, cdnjs, jsdelivr, gstatic, *.vercel.app, **firebaseio.com**. Được: npm, api.github.com.
- Tốt nhất: Firebase Emulator thật (`npm i firebase-tools@13 firebase@9.22.0`, `firebase emulators:start --only database,auth`, Java có sẵn, tải jar được). Playwright `page.route` trả index.html đã chèn `useEmulator` (rtdb, fbAuth, secAuth), phục vụ file compat từ node_modules/firebase; launch Chromium với `--disable-web-security --disable-features=BlockInsecurePrivateNetworkRequests,LocalNetworkAccessChecks`. Nạp quy tắc: PUT `/.settings/rules.json?ns=taxi-tss-df1a5-default-rtdb` header `Authorization: Bearer owner`. Không bao giờ chạy thử với Firebase thật.
- LibreOffice (soffice + pdftoppm) có sẵn để chụp ảnh file Excel.

## Bài học từ app HR (áp dụng khi sửa)
- Escape HTML khi chèn dữ liệu; dùng id cố định thay vì số thứ tự; ngày "hôm nay" theo giờ địa phương (không dùng toISOString).
- Chỉ ghi phần thay đổi, tránh ghi đè cả khối dữ liệu.
- Excel có định dạng: dùng ExcelJS (tải khi cần) — người dùng thích màu theo logic, kẻ ô, nhóm, dòng tổng, khu vực ký tên.
- Repo public → nhắc người dùng chuyển sang Private (hoặc ít nhất bỏ mật khẩu khỏi code).
