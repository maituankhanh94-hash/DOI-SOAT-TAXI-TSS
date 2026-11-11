# BÀN GIAO KỸ THUẬT — App Đối Soát Bill Taxi TSS (11/11/2026)

> Gửi Claude ở phiên mới. Bạn đang tiếp nhận một app đang chạy THẬT, có dữ liệu thật của công ty.
> Hãy đọc hết tài liệu này, đọc thêm `CLAUDE.md` trong repo, rồi mới sửa code.

## 0. Người dùng & cách làm việc
- Chủ app: anh/chị Khánh, CÔNG TY CP DỊCH VỤ HÀNG KHÔNG TSS. Công ty làm vận chuyển hành khách, taxi, có quầy ở sân bay TSN và chi nhánh Nha Trang.
- Người dùng **không phải lập trình viên**:
  - Luôn trả lời **tiếng Việt, câu ngắn, dễ hiểu**. Xưng "tôi", gọi "anh/chị".
  - Người dùng hay gửi ảnh chụp màn hình để báo lỗi.
- Người dùng muốn bạn làm trọn: sửa code → tự thử → push GitHub → Vercel tự deploy → gửi link.
- Người dùng **không thích chờ lâu**:
  - Sửa nhỏ thì chỉ thử gọn.
  - Việc lâu thì báo ngắn mình đang làm gì.
- Kế toán là chị Ngọc. Chị dùng file Excel xuất từ app để đẩy lên phần mềm MISA.
- App này KHÁC app nhân sự HR (repo APP-NH-N-S-). Không trộn lẫn hai app.

## 1. Mã nguồn
- **Nguồn chuẩn là repo GitHub** `maituankhanh94-hash/doi-soat-taxi-tss`, nhánh `main`.
  - File `index.html` dài khoảng 4.250 dòng (~260 KB). File này chứa toàn bộ HTML/CSS/JS.
  - Đi kèm có `bang-gia.json` và `bang-gia-cu.json`.
  - File quá lớn để dán vào chat. Hãy clone repo, hoặc đọc file đính kèm `index.html` mà người dùng gửi.
- Các file khác trong repo:
  - `CLAUDE.md`: ghi chú chi tiết từng tính năng. **Luôn cập nhật file này khi sửa.**
  - `firebase-rules/sinh-quy-tac.js`: script sinh quy tắc Firebase, ra 2 file `quy-tac-buoc-1.json` và `quy-tac-buoc-2.json`. **Bước 2 đang dùng thật.**
  - `bang-gia/tao-bang-gia.js`: chuyển Excel bảng giá thành JSON.
    - Lệnh: `node bang-gia/tao-bang-gia.js bang-gia/BANG_GIA_XE.xlsx bang-gia.json`
    - Bảng giá cũ thì thêm tham số `BGC`.
  - `bang-gia/*.xlsx`: bảng giá gốc, và danh sách 168 phường/xã mới của TP.HCM.
- Deploy:
  - Vercel project `dv-tss-30-10` (tài khoản maituankhanh94-9147).
  - Link chính: https://dv-tss-30-10.vercel.app
  - Link bản thử: `https://dv-tss-30-10-git-<tên-nhánh>-maituankhanh94-9147.vercel.app/`
  - Kiểm tra deploy xong: `curl https://api.github.com/repos/maituankhanh94-hash/doi-soat-taxi-tss/commits/<sha>/status` → thấy "Deployment has completed".
  - Lưu ý: push cùng một sha lên nhánh thử rồi lên main thì Vercel có thể **không** tạo bản production mới. Muốn chắc, hãy xem `/statuses` có target_url mới không.

## 2. Tổng quan ứng dụng
App web một trang để **đối soát Bill dịch vụ xe**. Mỗi cuốc xe có 2 bên cùng báo cáo:
- **Bán vé** (quầy, `pos`) hoặc **Team Kế hoạch** (`plan`): báo phía bán.
- **Chủ xe / tài xế** (`driver`): báo phía chạy xe.

App ghép hai bên theo **số phiếu gốc + biển số + ngày**. Kết quả là 1 trong 3 trạng thái: Trùng khớp, Lệch, hoặc Chưa khớp (thiếu 1 bên). Ngoài ra còn quản lý giá, nhân viên và xuất Excel cho kế toán.

Có 4 phân vùng: `pos`, `driver`, `plan`, `manager` (Quản lý).

**Tính năng đã hoàn thiện (đều đang ở main):**
1. **Đăng nhập Firebase Auth**:
   - Tài khoản `TSS01` dùng email ảo `tss01@taxi-tss.local`. Mật khẩu Firebase = `'tss-pw:'+mật khẩu`, nên mật khẩu ngắn bao nhiêu cũng được.
   - Quản lý tạo tài khoản, đặt lại mật khẩu, khóa tài khoản, đổi phân vùng.
   - Có nút 🔑 để ai cũng tự đổi mật khẩu của mình.
2. **Nhập hàng loạt 20 dòng**:
   - Tên "A + B" thì tách thành nhiều đơn, chia đều tiền, số phiếu thành `123-1/2`, `123-2/2`.
   - Chặn đơn trùng (cùng phiếu + biển số + ngày).
   - Khóa sửa/xóa sau `lockHour` giờ sáng hôm sau.
   - Ngày gõ thiếu dấu tự sửa, ngày sai thì chặn.
3. **Quy ước ô Điểm Đến** (chỉ áp cho Bán vé + Kế hoạch):
   - Bắt buộc có Phường/Xã mới **hoặc** Quận/Huyện cũ **hoặc** tên tỉnh/huyện cả nước **hoặc** địa danh lớn.
   - Thiếu thì hiện **khung nhắc lớn**: "Vui lòng nhập thêm PHƯỜNG / XÃ (hoặc Quận cũ) cho điểm đến "…" mới thực hiện lưu đơn được." Ô thiếu tô đỏ, và **không lưu dòng nào**.
   - Hàm chính: `destHasDistrict`, `NEW_WARDS` (168 phường/xã), `VN_PLACES` (639 tên), `PLACE_EXCLUDE`, `LANDMARKS`, `DISTRICT_ABBR`, `DEST_EXEMPT`, `canonWords` (coi y = i).
4. **Team Kế hoạch: biển số không bắt buộc** (`plateOptional`). Đơn không biển số được ghép theo phiếu + ngày.
5. **Bảng giá công ty**:
   - Có 2 bảng MỚI/CŨ. Quản lý chọn bảng ở `meta/priceSet`.
   - Gõ điểm đến thì hiện gợi ý 📋 kèm giá, chọn là tự điền giá.
   - App tự nhận giá theo phường mới (`wardPriceMatches`).
   - Đơn cũ thì ước tính giá (`inferListPrice`), **chỉ để lọc, không bao giờ sửa giá đơn cũ**.
6. **Giảm giá vượt mức**:
   - Mức % chỉnh được ở `meta/discountLimit` (mặc định 10% nội thành, 15% ngoại thành).
   - **Theo dõi âm thầm**: nhân viên không thấy cảnh báo, chỉ Quản lý thấy và lọc được.
7. **Bảng Nhắc Báo Cáo & Giảm Giá Vượt Mức**:
   - Chọn Từ–Đến ngày.
   - Hiện: xe chưa báo, bán vé chưa nhập, đơn giảm giá vượt mức (ghi họ tên đầy đủ).
   - 2 nút xuất Excel riêng.
8. **Bảng Đối Soát (Quản lý)**:
   - Lọc theo phân vùng, trạng thái, từ khóa, ngày.
   - Sửa tại chỗ (`updateInlineTripField`): ngày (mới làm 11/11), số phiếu, biển số, loại xe, nguồn, điểm đến, thanh toán, ghi chú, tiền.
   - Luật khớp thanh toán theo `paymentCategory` (NVQ / THE / TXT / KH / FREE).
9. **Excel (ExcelJS, có màu, kẻ ô, ký tên)** gồm 3 trang:
   - **Đối Soát**: nhóm theo ngày, có dòng cộng ngày và tổng. Nếu lọc riêng tài xế thì cộng tiền chủ xe (`driverView`).
   - **Tổng Hợp**.
   - **Dữ Liệu MISA**: đúng 18 cột A→R theo mẫu MISA:
     - A "Chưa thu tiền"; B, C là ngày; D, E là số phiếu; F (Mã KH) để TRỐNG.
     - G "VC", H "131", I "5113", J "Chuyến", K là 1.
     - L, M là tiền định dạng `#,##0`.
     - N Nguồn đơn, O Nhân sự, P Thanh toán, Q Điểm đón, R Điểm đến.
     - Mỗi cuốc 1 dòng, ưu tiên bên bán.
   - Biển số chỉ có chữ số thì ghi dạng **SỐ** (`plateCell`), để file đẩy MISA dùng VLOOKUP được.
   - Số phiếu đơn 1 người hiển thị/xuất thành `xxx-1/1` (`formatDisplayTicket`). **Không đổi dữ liệu lưu.**
10. **Đếm đơn theo bill**: đơn chia tiền vẫn tính là 1 đơn (`billKey`, `countBills`).
11. **Tải dữ liệu theo ngày** (`dateKey` + `.indexOn`), gợi ý địa chỉ từ `places`, có bản thử dùng vùng dữ liệu `test_env/`.

## 3. Dữ liệu & trạng thái
**Firebase Realtime Database** (KHÔNG phải Firestore). Dùng SDK compat 9.22, dự án `taxi-tss-df1a5`. **DB thật đã khóa bằng quy tắc bước 2.**

| Đường dẫn | Nội dung | Quyền |
|---|---|---|
| `trips/<id>` | Mọi đơn của công ty. id = `X<timestamp>_<i>` | QL đọc/ghi; NV ghi đơn của mình |
| `users_trips/<USER>/<id>` | Bản sao đơn theo tài khoản | QL + chính chủ |
| `settings/sources, staff, carTypes, payments, planPayments, lockHour` | Danh mục (mảng, chỉ QL ghi) | NV đọc từng mục |
| `login_index/<USER>={ver}` | Để biết email khi đăng nhập | công khai |
| `accounts/<USER>={role,active,uid,ver}` | Danh sách tài khoản | QL |
| `roles/<uid>={user,role,active}` | Quy tắc dựa vào đây | |
| `places/<slug>={name,n}` | Gợi ý địa chỉ | NV đang hoạt động |
| `meta/` | `dateKeyV1`, `priceSet`, `discountLimit`, (bản thử: `biz`) | đọc: NV; ghi: QL |
| `test_env/…` | Toàn bộ dữ liệu bản thử (link có `-git-`) | khóa chặt |

- **Trường của 1 đơn**: id, dateStr (dd/mm/yyyy), dateKey (yyyy-mm-dd), timeStr, ticketNumber, originalTicket, plateNumber, carType, source, pickup (T1/T2/T3), destination, totalFare, originalTotalFare, paymentMethod, note, staff, role, createdBy, timestamp. Có thể có thêm: priceId, priceLabel, listPrice, priceZone, priceSet.
- **Biến chính ở máy**:
  - `loggedInUser {user, role}`
  - `allCompanyTrips` (QL, đã tải theo khoảng ngày)
  - `personalTrips` (NV)
  - `sourceOptions`, `staffOptions`, `paymentOptions`, `planPaymentOptions`, `carTypeOptions`
  - `priceItems`, `priceById`, `activePriceSet`, `DISCOUNT_LIMIT`
  - `remindFrom/remindTo`
- **localStorage**: hiện main chưa dùng cho dữ liệu đơn. Nhánh `giu-dong-chua-luu` lưu tạm các dòng đang nhập.
- **Ghi dữ liệu**: luôn dùng `dbRoot().update({...})` theo từng đường dẫn, **không ghi đè cả nút**. Mỗi đơn phải ghi cả `trips/` và `users_trips/`.

## 4. Quy ước code & giao diện
- **Một file `index.html`** chứa HTML, CSS và JS. Code gốc do Gemini Canvas tạo. Giao diện tạo bằng chuỗi template trong JS (`innerHTML`).
- **Thư viện ngoài**:
  - Tailwind CDN.
  - SheetJS xlsx 0.18.5.
  - ExcelJS 4.4.0, chỉ tải khi cần qua `loadExcelJS()`.
  - Firebase compat 9.22 (app/auth/database).
- **Giao diện**:
  - Nền slate. Thẻ bo `rounded-3xl`, có shadow.
  - Màu: xanh dương = Bán vé/hệ thống, tím/indigo = Kế hoạch, cam/vàng = Chủ xe hoặc chờ, xanh lá = khớp/lưu, đỏ = lệch/lỗi.
  - Chữ đậm (font-extrabold). Emoji làm icon. Phải dùng tốt trên điện thoại.
- **Bắt buộc**:
  - `escHtml()` cho mọi dữ liệu chèn vào HTML.
  - Ngày "hôm nay" dùng giờ địa phương (`localDateKey`), không dùng `toISOString`.
  - Dùng id cố định.
- **Excel**: dùng các helper `xlTitle`, `xlTable`, `xlSignature` (cần lastCol ≥ 6), `xlSheetSetup`, `XL`, `xlFill`, `xlFont`. Người dùng thích có màu theo logic, kẻ ô, dòng tổng, chỗ ký tên.

## 5. Các việc lớn đã làm trong phiên này
- Khóa DB bằng Firebase Auth và rules; chuyển tài khoản cũ (mật khẩu dạng chữ) sang Auth.
- Excel có màu, trang MISA phẳng. Sau đó làm đúng 18 cột mẫu MISA. Biển số ghi dạng SỐ để sửa lỗi #N/A trong file đẩy.
- Luật khớp thanh toán, Free nội bộ, lý do lệch.
- Tải dữ liệu theo ngày (dateKey); gợi ý địa chỉ.
- Bảng giá MỚI/CŨ, tự điền giá, theo dõi giảm giá âm thầm, chỉnh được mức %.
- Quy ước điểm đến:
  - Ban đầu bắt buộc ghi quận cũ.
  - Sau đó nhận phường/xã mới sau sáp nhập (01/7/2025).
  - Rồi nới thêm: tỉnh/huyện cả nước, viết tắt, địa danh, đơn đặc biệt, Free nội bộ.
- Bỏ giới hạn mật khẩu 6 ký tự.
- Xuất riêng tài xế thì dòng tổng không còn ra 0.
- Kế hoạch không bắt buộc biển số.
- Sửa ngày tại chỗ trong bảng đối soát.

## 6. TUYỆT ĐỐI KHÔNG lặp lại
1. **Không chạy thử app nối vào Firebase thật.** Chỉ dùng Firebase Emulator (xem `CLAUDE.md` mục "Cách thử") hoặc vùng `test_env`. Không ghi dữ liệu thật khi người dùng chưa đồng ý.
2. **Không tự đổi giá hay dữ liệu đơn cũ.** Bảng giá chỉ để lọc. Số phiếu `-1/1` chỉ đổi lúc hiển thị và xuất file.
3. **Không lên `main` khi chưa được phép** với thay đổi lớn. Đưa lên nhánh thử, gửi link, đợi người dùng nói "đưa lên bản chính". Sửa nhỏ, an toàn và đã thử thì có thể lên thẳng main (người dùng hay nói "sửa xong đưa lên luôn").
4. **Kiểm tra tên trùng khi làm việc với địa chỉ.** Ví dụ:
   - "tinh" khớp nhầm "Tỉnh lộ"; "hue" khớp nhầm "Nguyễn Huệ".
   - Đường Tam Đảo, Ba Vì, Điện Biên Phủ, Xa lộ Hà Nội trùng tên huyện/tỉnh.
   - "D1" trùng đường D2.
   - "Hà Huy Giáp" chứa chữ "huy" (nhầm với "hủy").
   - Trước khi đưa lên, luôn thử bằng một bộ mẫu gồm cả "phải lưu được" và "phải nhắc".
5. **Không xóa trắng dữ liệu người dùng đang gõ.** Trên main hiện vẫn có lỗi: lưu xong là xóa cả bảng, kể cả dòng lỗi. Nhánh `giu-dong-chua-luu` đã sửa nhưng chưa lên main.
6. **Kế toán cần đúng KIỂU dữ liệu trong Excel**: số là số, ngày là ngày, không gộp ô ở trang MISA. Không thêm cột thừa vào trang MISA (người dùng đã yêu cầu bỏ).
7. **Đường dẫn Firebase**:
   - Không đọc cả nút `settings`, vì quy tắc chặn. Phải đọc từng mục.
   - Ghi `test_env` phải ghi theo từng id.
   - Sửa quy tắc thì sửa script `sinh-quy-tac.js` rồi sinh lại cả 2 file, và hướng dẫn người dùng dán vào Firebase Console, bấm Publish.
8. Khi đổi ngôn từ thông báo, hỏi mẫu trước nếu người dùng muốn duyệt. Người dùng **không muốn** gợi ý Quận trong khung nhắc, chỉ nhắc thôi.
9. Không hỏi lại những thứ đã chốt. Không giải thích dài dòng. Không dùng thuật ngữ kỹ thuật với người dùng.

## 7. Ràng buộc khi viết code mới
- Giữ **1 file `index.html`** chứa HTML/CSS/JS. Dữ liệu tĩnh lớn (bảng giá) để trong file JSON riêng như hiện tại.
- Sửa có vị trí rõ ràng (theo tên hàm hoặc ID). Trả về code hoàn chỉnh, không viết dở dang kiểu "// code cũ".
- Giữ nguyên ID, class, tên hàm, cấu trúc dữ liệu Firebase hiện có, trừ khi người dùng yêu cầu đổi.
- Sửa xong:
  - Kiểm tra cú pháp (chạy `new Function` cho từng thẻ `<script>`).
  - Thử trên emulator.
  - Commit có dòng `Co-Authored-By` theo hướng dẫn của phiên.
  - Push lên nhánh (thử hoặc main), đợi Vercel báo "Deployment has completed", rồi gửi link.
  - Cập nhật `CLAUDE.md`.
- Nhắc người dùng **tải lại trang (F5)** sau mỗi lần cập nhật.

## 8. Việc đang dở / tiếp theo
| Việc | Nhánh | Trạng thái |
|---|---|---|
| Hiệu Quả Kinh Doanh: lời/lỗ, lợi nhuận từng nhân viên, hòa vốn, cài % tài xế 64%, % hoa hồng và lương theo nhóm QT/QN 3% 160k, C10/T1/T3/KH 7% 320k, CTV 15% 0đ, KIOT 3% 160k (lưu `meta/biz`), xuất Excel | `hieu-qua-kinh-doanh` | Bản thử. **Chờ người dùng xác nhận**: % hoa hồng của T1/T3/KH/KIOT; lương tính theo "ngày có bán"; có tính đơn Kế hoạch không |
| Giữ dòng chưa lưu khi nhập hàng loạt + lưu tạm trên máy + khôi phục sau F5 | `giu-dong-chua-luu` | Bản thử, đã thử chạy. Chờ "đưa lên bản chính" (chạy lại thử trước) |
| Sao lưu, thùng rác, chặn bản app cũ | `sao-luu-thung-rac` | Chưa lên main. Khác main nhiều, có thể phải sửa lại theo main mới |
| Cột F "Mã khách hàng" của MISA | — | App chưa có mã chủ xe theo biển số. Có thể làm bảng tra biển số → mã KH (Quản lý nhập) |
| Thông báo điện thoại, ô gõ địa chỉ có bản đồ (Goong, trả phí) | — | Người dùng chưa quyết |
| Chuyển repo sang **Private** | — | Nhắc người dùng (repo đang công khai) |

Các nhánh thử đều tách ra từ main cũ. Khi đưa lên, nhớ gộp với main mới nhất và chạy thử lại.
