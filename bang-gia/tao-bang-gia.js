// Chuyển file Excel bảng giá (BANG_GIA_XE.xlsx) thành bang-gia.json cho app đọc.
// Chạy: node bang-gia/tao-bang-gia.js bang-gia/BANG_GIA_XE.xlsx bang-gia.json            (bảng giá MỚI)
//       node bang-gia/tao-bang-gia.js bang-gia/BANG_GIA_XE_CU.xlsx bang-gia-cu.json BGC  (bảng giá CŨ)
// (cần: npm i exceljs). Tham số thứ 3 = tiền tố mã mục (mặc định BG) để 2 bảng không trùng mã.
// Quy ước vùng (để tính mức giảm tối đa): các quận TP.HCM = nội thành; các huyện (Bình Chánh, Cần Giờ, Hóc Môn, Củ Chi, Nhà Bè)
// và trang "TOUR" (đi tỉnh) = ngoại thành. City tour = nội thành.
const ExcelJS = require('exceljs');
const fs = require('fs');
const [,, src, out, prefix = 'BG'] = process.argv;
const val = v => v && v.richText ? v.richText.map(x => x.text).join('') : (v && v.result !== undefined ? v.result : (v && v.error ? null : v));
const txt = v => { const x = val(v); return x == null ? '' : String(x).replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim(); };
const num = v => { const x = val(v); return typeof x === 'number' ? x : null; };
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(src);
  const items = [];
  // --- Trang DON SB ---
  const sb = wb.worksheets.find(w => /DON\s*SB/i.test(w.name)) || wb.worksheets[0];
  let district = '';
  sb.eachRow({ includeEmpty: false }, (r, i) => {
    if (i < 8) return;
    // Chỉ đọc 7 cột: Điểm đón, Phường mới, Khu vực, Km, Giá 4 / 7 / 16 chỗ. BỎ QUA các cột sau đó (vd "XUẤT SGN – TAXI / DV" của bảng cũ).
    const c = [1, 2, 3, 4, 5, 6, 7].map(k => r.getCell(k).value);
    const a = c.map(txt);
    if (a[0] && a.slice(1).every(x => x === a[0] || x === '')) { district = a[0].replace(/\s*\(.*\)\s*$/, '').trim(); return; }
    if (!/^sân bay$/i.test(a[0])) return;
    const p4 = num(c[4]), p7 = num(c[5]), p16 = num(c[6]);
    if (p4 == null && p7 == null) return;
    const isTour = /^city tour/i.test(district);
    const ngoai = /^(huyện|thị trấn)\b|bình chánh|cần giờ|hóc môn|củ chi|nhà bè/i.test(district);
    items.push({ kind: isTour ? 'citytour' : 'sb', zone: (!isTour && ngoai) ? 'ngoai' : 'noi', district: isTour ? 'City tour' : district, ward: a[1], area: a[2], km: num(c[3]), p4, p7, p16 });
  });
  // --- Trang TOUR (đi tỉnh) ---
  const tour = wb.worksheets.find(w => /TOUR/i.test(w.name));
  if (tour) tour.eachRow({ includeEmpty: false }, (r, i) => {
    if (i < 9) return;
    const c = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => r.getCell(k).value);
    const province = txt(c[0]), route = txt(c[1]);
    const p7a = num(c[6]), p7b = num(c[7]), p16a = num(c[8]), p16b = num(c[9]);
    if (!province || !route || (p7a == null && p16a == null)) return;
    items.push({ kind: 'tinh', zone: 'ngoai', district: province, ward: route, area: '1 chiều', km: num(c[2]), p4: null, p7: p7a, p16: p16a });
    items.push({ kind: 'tinh', zone: 'ngoai', district: province, ward: route, area: '2 chiều', km: num(c[3]), p4: null, p7: p7b, p16: p16b });
  });
  items.forEach((it, k) => { it.id = prefix + String(k + 1).padStart(3, '0'); });
  fs.writeFileSync(out, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), source: require('path').basename(src), items }, null, 1) + '\n');
  console.log('Đã tạo', out, ':', items.length, 'mục (', items.filter(x => x.kind === 'sb').length, 'nội thành,', items.filter(x => x.kind === 'tinh').length, 'đi tỉnh,', items.filter(x => x.kind === 'citytour').length, 'city tour)');
})();
