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
- (10/11) BỎ giới hạn 6 ký tự: mật khẩu app ngắn bao nhiêu cũng được (chỉ cần không trống) — Firebase vẫn ổn nhờ tiền tố `authPassword`. Áp cho tạo TK, đặt lại MK, đổi MK, thiết lập lần đầu.
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

## Đếm số đơn theo bill (07/11)
- Đơn chia tiền nhiều nhân sự (A + B → "123-1/2", "123-2/2") vẫn lưu nhiều dòng nhưng ĐẾM là 1 đơn: `billKey` (phía + phiếu gốc + biển số chuẩn hóa + dateKey), `countBills`, `billCountText` → "3 đơn (4 dòng chia tiền)". Dùng ở tổng ngày/tháng/ảnh báo cáo của nhân viên, doanh thu ngày của quản lý, Excel. Số phiếu hiển thị đúng "123-1/2". Excel không còn ký hiệu ₫.

## Excel cho MISA (09/11)
- Kế toán báo copy từ file Excel sang MISA nạp hàng loạt không nhận (do ô gộp, dòng tiêu đề ngày/tổng chen giữa, ngày dạng chữ). Đã thêm trang thứ 3 "Dữ Liệu MISA" (`buildFlatSheet`): phẳng, 1 dòng tiêu đề, không gộp ô, ngày kiểu Date (tạo bằng Date.UTC để không lệch ngày), tiền số thuần. Đang chờ người dùng gửi file mẫu MISA để khớp đúng cột.
- (10/11) Kế toán (chị Ngọc) gửi "FILE ĐẨY NGÀY 07.xlsx": trang 'Tổng hợp' cột C = BSX 3 số, trang MISA cột F = VLOOKUP(C, 'LỊCH XE'!H:I) với H = NUMBERVALUE(RIGHT(biển số bỏ dấu chấm,3)) → khóa là SỐ. App ghi biển số dạng CHỮ → #N/A. ĐÃ SỬA (lên main): `plateCell` ghi biển số toàn chữ số thành SỐ ở mọi trang Excel; trang Dữ Liệu MISA thêm cột "BSX 3 số (MISA)" (`plate3Num`, sau cột Biển số).

- (10/11, nhánh `misa-chuan`) Trang Dữ Liệu MISA = ĐÚNG 18 cột A→R mẫu nạp MISA (trang MISA của file đẩy): A "Chưa thu tiền", B/C ngày, D/E số phiếu, F Mã KH (TRỐNG – app không có mã KH theo xe), G "VC", H "131", I "5113", J "Chuyến", K 1, L/M tiền (#,##0), N = Nguồn đơn (Mã công trình), O = Nhân sự, P = Thanh toán, Q = Điểm đón, R = Điểm đến; KHÔNG có cột tham khảo phía sau (người dùng yêu cầu bỏ). Mỗi cuốc 1 dòng: ưu tiên bên Bán vé/KH, chỉ có chủ xe thì lấy chủ xe. Số phiếu hiển thị/xuất: đơn 1 người thêm "-1/1" (`formatDisplayTicket`, không đổi dữ liệu lưu).

## Bảng giá công ty (nhánh `bang-gia`, 09/11 — ĐÃ LÊN MAIN 09/11 (commit 9ac73e8 + ghi chú); nhánh `sao-luu-thung-rac` vẫn CHƯA lên main)
- Nguồn: `bang-gia/BANG_GIA_XE.xlsx` (trang "DON SB" = sân bay đi quận/phường TP.HCM, giá xe 4/7/16; trang "TOUR" = đi tỉnh, xe 7/16, 1 chiều/2 chiều; City tour 4h/8h). Chuyển sang `bang-gia.json` bằng `node bang-gia/tao-bang-gia.js bang-gia/BANG_GIA_XE.xlsx bang-gia.json` (cần exceljs). App tải file tĩnh này (`loadPriceList`), không lưu trong Firebase → đổi giá = gửi file Excel mới, chạy lại script, push.
- HAI BẢNG GIÁ (10/11): MỚI = `bang-gia/BANG_GIA_XE.xlsx` → `bang-gia.json` (mã BG…), CŨ = `bang-gia/BANG_GIA_XE_CU.xlsx` → `bang-gia-cu.json` (mã BGC…, chạy script với tham số thứ 3 `BGC`). Quản lý chọn bảng áp dụng cho cả công ty bằng nút "💲 Bảng giá đang áp dụng" (đầu bảng Nhắc Báo Cáo) → `meta/priceSet` = 'moi'|'cu' (quy tắc: chỉ quản lý ghi); mọi máy nghe thay đổi và đổi ngay (`applyPriceSet`). Đơn mới lưu thêm `priceSet`. Đơn cũ suy giá theo bảng ĐANG áp dụng. Cùng cấu trúc Excel; bảng CŨ có thêm cột "XUẤT SGN TAXI/DV" (bỏ qua) và vài mục Tân Bình (Nhà ga T2→T1, Tòa nhà Vietjet, Bluesky).
- (09/11) Mức % giảm tối đa CHỈNH ĐƯỢC: Quản lý sửa ở đầu bảng Nhắc Báo Cáo (ô Nội thành/Ngoại thành + nút Lưu) → `meta/discountLimit={noi:10,ngoai:15}` (đơn vị %), mọi máy nghe & tính lại (`DISCOUNT_LIMIT`, `pctText`). Không có → mặc định 10/15.
- (09/11) QUY ƯỚC Ô ĐIỂM ĐẾN (Bán vé + Kế hoạch; người dùng gọi là "ô điểm đón" nhưng Điểm Đón trong app là chọn Ga T1/T2/T3): nội thành BẮT BUỘC ghi Quận (`destHasDistrict`: Q1/Quận 3/District 7, tên quận chữ như Bình Thạnh, huyện, tên tỉnh, hoặc đã chọn mục 📋 bảng giá). Thiếu → nhập hàng loạt KHÔNG lưu dòng nào, tô đỏ ô; modal sửa chặn khi đổi điểm đến. Có dòng ghi chú 📌 trên bảng nhập + placeholder.
- (09/11, nhánh `goi-y-quan`) Thiếu Quận → KHUNG NHẮC LỚN chữ to đậm (`showDestFixModal`, mẫu 3: "Vui lòng nhập thêm QUẬN cho điểm đến "…" mới thực hiện lưu đơn được." — đã bỏ chữ (dòng n) theo yêu cầu; ô thiếu tô đỏ. ĐÃ LÊN MAIN 09/11 (commit 9ac73e8 + ghi chú)"), nút "ĐÃ HIỂU, TÔI SẼ SỬA". Người dùng KHÔNG muốn gợi ý Quận trong khung (đã bỏ bản có gợi ý).
- (09/11, LÊN MAIN) PHƯỜNG/XÃ MỚI sau sáp nhập 01/7/2025: `NEW_WARDS` trong index.html (168 phường/xã TP.HCM gồm cả Bình Dương, BR-VT cũ; [loại, tên, quận/huyện cũ, vùng]; nguồn npm `vietnam-address-database@1.0.0` bảng ward_mappings). `findNewWards` (ưu tiên tên dài), `destHasDistrict` chấp nhận phường/xã mới; `wardPriceMatches` nhận mục bảng giá theo cột "Phường mới" → dùng trong `autoMatchRowPrice` (đúng 1 mục) và `inferListPrice` (giá thấp nhất). Khung nhắc: "Vui lòng nhập thêm PHƯỜNG / XÃ (hoặc Quận cũ)…". Danh sách cho người dùng: `bang-gia/DANH_SACH_PHUONG_XA_MOI_TPHCM.xlsx`. `tao-bang-gia.js` có `WARD_FIX` sửa lỗi gõ tên phường trong Excel (Hạnh Mỹ Tây→Thạnh Mỹ Tây, Đông Lợi Trung→Bình Lợi Trung, Thủ Đúc→Thủ Đức, Xã Hạnh An→Xã Thạnh An).
- (09/11, LÊN MAIN) Nới quy ước điểm đến — `destHasDistrict(dest, priceId, payMethod)` chấp nhận thêm: (1) `VN_PLACES` 639 tên tỉnh + quận/huyện/thị xã cả nước (cũ+mới, trừ TP.HCM cũ; nguồn cùng gói npm) trừ `PLACE_EXCLUDE` (tên trùng đường TP.HCM: Tam Đảo, Ba Vì, Yên Thế, Đồ Sơn, Đức Thọ, Vân Đồn, Điện Biên, Huế/Vinh…; "Huế" chỉ nhận khi có dấu; bỏ cụm "Xa lộ Hà Nội"); (2) Free nội bộ không bắt + `DEST_EXEMPT` khi ĐỨNG ĐẦU (hủy, nội bộ, về bãi, khách không đi, đưa đón nhân viên, tour, chờ khách…); (3) `canonWords` coi y=i cuối âm tiết (Mỹ=Mĩ), Q.01/Quận 03; (4) `DISTRICT_ABBR` BT TB PN GV TĐ BC HM CC NB CG BTân (KHÔNG nhận D1 vì trùng đường D2); (5) `LANDMARKS` ~150 địa danh (bến xe, bệnh viện, TTTM, khách sạn…). Vẫn nhắc: chỉ tên đường, HCMC, Saigon, Phường 15. Thử bằng bộ ~80 mẫu.
- Vùng: quận TP.HCM = nội thành (giảm tối đa 10%); huyện Bình Chánh/Cần Giờ/Hóc Môn/Củ Chi/Nhà Bè + đi tỉnh = ngoại thành (15%). `DISCOUNT_LIMIT`.
- Áp dụng cho Bán vé (pos) VÀ Team Kế hoạch (plan) kể cả đơn đối tác (người dùng xác nhận); Chủ xe không áp; đơn Free nội bộ không xét.
- Gõ điểm đến → gợi ý 📋 mục bảng giá kèm giá theo loại xe (`showDestSuggestions`, `findPriceMatches`: so từng từ, số khớp nguyên số, "quận 10"/"q10" lọc đúng quận, "p15"/"f7" → phường). Chọn → tự điền giá (đổi loại xe tự đổi giá nếu chưa sửa tay). Gõ tay khớp đúng 1 mục → tự nhận (`autoMatchRowPrice`).
- Đơn cũ / gõ tay không gắn bảng giá: `inferListPrice` suy giá từ điểm đến + loại xe lúc hiển thị (KHÔNG ghi dữ liệu): khớp 1 mục → giá đó; nhiều mục → giá thấp nhất (có mục ngoại thành thì dùng mức 15%); ghi "(ước tính)". Số nhà/tên đường/tòa nhà không có trong bảng giá → không xét. `findPriceMatches` bỏ chữ chung (phường, xã, quận, tp...; KHÔNG bỏ "đường" vì trùng "Dương"); chữ gõ trùng tên quận/tỉnh thì chỉ lấy khu vực đó. Người dùng nhấn mạnh: chỉ LỌC để biết nhân viên sai, KHÔNG được đổi giá đơn cũ.
- Giảm quá mức VẪN CHO LƯU. THEO DÕI ÂM THẦM (`SILENT_DISCOUNT_WATCH = true`, người dùng chọn 09/11): nhân viên KHÔNG thấy cảnh báo/ghi chú giảm giá (giá vẫn tự điền), chỉ Quản lý thấy và lọc. Đơn lưu thêm `priceId, priceLabel, listPrice (giá cả đơn), priceZone`. `discountInfo(t)` so `originalTotalFare` (đơn chia tiền) với listPrice.
- Quản lý: dưới ô Tổng Tiền hiện "Giá bảng … • giảm …%" (đỏ nếu vượt), bộ lọc trạng thái "💸 Giảm Giá Quá Mức" (`overdiscount`), từ khóa "giảm giá"/"vượt mức", khung nhắc có mục 💸 (bảng: họ tên đầy đủ nhân viên + TK, ngày, phiếu, điểm đến, giá bảng, đã thu, % giảm).
- Nút "📥 Xuất Excel Mục Này" (`exportReminderExcel`, theo remindFrom–remindTo): 4 trang Tài Xế Chưa Báo / Bán Vé Chưa Nhập (đỏ = quá hạn, vàng = chờ) / Giảm Giá Vượt Mức / Theo Nhân Viên (tổng + ký tên). Helper `xlTable`, `collectOverDiscount`.
- (09/11) Nút riêng "📥 Xuất Excel Giảm Giá Vượt Mức" trong khung 💸 → `exportReminderExcel('discount')`: chỉ 2 trang Giảm Giá Vượt Mức (có ký tên) + Theo Nhân Viên, file `Giam_Gia_Vuot_Muc_TSS_….xlsx`.
- Khung Nhắc Báo Cáo là BẢNG RIÊNG ("📋 Nhắc Báo Cáo & Giảm Giá Vượt Mức", ngay trên Bảng Đối Soát), chọn Từ–Đến ngày (`remindFrom/remindTo`, nút Hôm nay/Hôm qua/7 ngày/Tháng này). Excel: trang Đối Soát ghi 💸 vào cột Ghi chú; trang Dữ Liệu MISA thêm cột Giá bảng giá, Giảm %, Vùng, Vượt mức, Mục bảng giá.

## Lỗi/rủi ro đã phát hiện (06/11/2026) — 3–9 ĐÃ SỬA ở nhánh `cai-tien-doi-soat` (08/11)
1. ĐÃ SỬA 07/11: quy tắc RTDB thật trước đây `.read/.write: true`; nay là quy-tac-buoc-2 + Firebase Auth. Còn tồn: dữ liệu thử `test_env/` và tài khoản Auth `@test.taxi-tss.local`. Số liệu 07/11: lưu 1,61 MB, tải về 121 MB/6 ngày, kết nối đỉnh 33/100 (gói Spark). DB thật còn 2 nhánh cũ không dùng: `deleted_trips`, `drivers`.
- (10/11) Excel Đối Soát lọc Phân vùng = Tài xế (hoặc chỉ có đơn chủ xe): cột Tổng Tiền ở dòng CỘNG NGÀY/TỔNG CỘNG cộng tiền CHỦ XE (`driverView` trong buildAuditSheet), cột cạnh ghi "Quầy+KH: …". Trước đó luôn cộng Quầy+KH → ra 0.
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
