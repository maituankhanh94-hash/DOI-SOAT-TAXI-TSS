// Đọc ảnh tờ giấy ghi đơn bằng Google Gemini (gói miễn phí) -> trả về JSON để app điền bảng nhập hàng loạt.
// Khóa GEMINI_API_KEY cất trong Vercel (Settings -> Environment Variables), KHÔNG để trong code (repo công khai).
// Chỉ nhân viên đã đăng nhập app và đang hoạt động mới gọi được (kiểm tra Firebase ID token + roles/<uid>.active).
import { GoogleGenAI } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const config = { maxDuration: 60 };

const PROJECT_ID = 'taxi-tss-df1a5';
const DB_URL = 'https://taxi-tss-df1a5-default-rtdb.firebaseio.com';
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
// Thử lần lượt: model trong GEMINI_MODEL (nếu có), rồi các model Flash. Hết hạn mức / không có model -> thử model sau.
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter(Boolean);

const SCHEMA = {
  type: 'object',
  properties: {
    head: {
      type: 'object',
      properties: {
        staff: { type: 'string', description: 'Tên nhân viên/tài xế ghi ở đầu trang' },
        date: { type: 'string', description: 'Ngày ghi ở đầu trang, dạng dd/mm/yyyy (thiếu năm thì để dd/mm)' },
        source: { type: 'string', description: 'Nguồn đơn ghi ở đầu trang' },
        car: { type: 'string', description: 'Số chỗ của loại xe ghi ở đầu trang: "4", "7", "16"...' },
        pickup: { type: 'string', description: 'Điểm đón ghi ở đầu trang: "T1", "T2" hoặc "T3"' },
        plate: { type: 'string', description: 'Biển số / số xe ghi ở đầu trang (tờ của tài xế)' }
      },
      required: ['staff', 'date', 'source', 'car', 'pickup', 'plate']
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ticket: { type: 'string', description: 'Số phiếu / số HĐ, chỉ chữ số, bỏ khoảng trắng (vd "113 944" -> "113944")' },
          plate: { type: 'string', description: 'Biển số ghi riêng ở dòng này (để trống nếu không ghi)' },
          pickup: { type: 'string', description: 'Ga đón ghi riêng ở dòng này: T1/T2/T3 (trống nếu không ghi)' },
          dest: { type: 'string', description: 'Điểm đến, chép đúng như viết (giữ viết tắt Q1, BT, TB...)' },
          fare: { type: 'integer', description: 'Số tiền ĐỒNG. Viết 350 = 350000; 1tr2 = 1200000. 0 nếu không ghi' },
          payment: { type: 'string', enum: ['NVQ', 'TXT', 'THE', 'CK', 'CN', 'FREE', ''], description: 'Hình thức thanh toán' },
          car: { type: 'string', description: 'Số chỗ nếu dòng này ghi riêng loại xe (vd "16"), trống nếu không' },
          note: { type: 'string', description: 'Ghi chú khác của dòng (nếu có)' },
          unsure: { type: 'array', items: { type: 'string', enum: ['ticket', 'plate', 'dest', 'fare', 'payment', 'pickup'] }, description: 'Các ô đọc KHÔNG chắc chắn' }
        },
        required: ['ticket', 'plate', 'pickup', 'dest', 'fare', 'payment', 'car', 'note', 'unsure']
      }
    }
  },
  required: ['head', 'rows']
};

function prompt(role, lists) {
  const driver = role === 'driver';
  return `Bạn đọc ảnh chụp tờ giấy VIẾT TAY ghi các cuốc xe taxi sân bay (tiếng Việt) của công ty TSS và chép lại thành dữ liệu.
Đây là tờ của ${driver ? 'TÀI XẾ / CHỦ XE' : (role === 'plan' ? 'TEAM KẾ HOẠCH' : 'NHÂN VIÊN BÁN VÉ (quầy)')}.
Phần ghi 1 LẦN ở đầu trang (áp cho mọi đơn): ${driver ? 'Tên tài xế, Ngày, Biển số/Số xe, Loại xe, Điểm đón' : 'Tên nhân viên, Ngày, Nguồn đơn, Loại xe, Điểm đón'}.
Mỗi dòng có số phiếu (thường 5-7 chữ số) là 1 đơn: ${driver ? 'Số phiếu (Số HĐ), Điểm đến, Tiền, Thanh toán' : 'Số phiếu, Biển số xe (thường 3 chữ số hoặc dạng 51A-123.45), Điểm đến, Tiền, Thanh toán'}. Dòng nào ghi riêng ga đón / loại xe / biển số thì ghi vào dòng đó.
Quy tắc:
- Bỏ qua dòng tiêu đề cột, dòng trống, dòng TỔNG (Tổng, TDT, Tổng DT, Tổng TX thu...).
- Tiền viết tắt nghìn đồng: 350 = 350000, 1.200 hoặc 1tr2 = 1200000, 450k = 450000.
- Thanh toán: NVQ / "Q thu" / "quầy thu" / tiền ghi ở cột "Quầy" => NVQ; TXT / "TX thu" / tiền ghi ở cột "TX Thu" => TXT; Thẻ / quẹt => THE; CK / chuyển khoản => CK; CN / công nợ => CN; Free / FNB / nội bộ => FREE. Không xác định được thì để "".
- Dấu " hoặc 〃 hoặc "nt" (như trên) = giống dòng trên: chép giá trị của dòng trên.
- Ga đón: T1, T2, T3. Điểm đến có thể là "Ga T3", "T3" (đi tới ga T3).
- Điểm đến chép đúng chữ viết, giữ viết tắt quận: Q1, Q3, BT (Bình Thạnh), TB (Tân Bình), PN, GV, TĐ, BD (Bình Dương)...
- Ngày: dd/mm/yyyy; nếu chỉ có ngày/tháng thì ghi dd/mm.
- Chữ khó đọc: đoán hợp lý nhất và thêm tên ô vào "unsure". KHÔNG bịa đơn không có trên giấy.
${lists.staff && lists.staff.length ? `- Tên nhân sự có trong danh sách: ${lists.staff.slice(0, 300).join(', ')}.` : ''}
${lists.sources && lists.sources.length ? `- Nguồn đơn có trong danh sách: ${lists.sources.slice(0, 100).join(', ')}.` : ''}
Nhiều ảnh = nhiều trang của cùng 1 lần nhập, chép nối tiếp theo thứ tự.`;
}

async function checkUser(req, env) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw Object.assign(new Error('Chưa đăng nhập'), { status: 401 });
  const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });
  const prefix = env === 'test' ? 'test_env/' : '';
  const r = await fetch(`${DB_URL}/${prefix}roles/${encodeURIComponent(payload.sub)}.json?auth=${encodeURIComponent(token)}`);
  const role = r.ok ? await r.json() : null;
  if (!role || role.active !== true) throw Object.assign(new Error('Tài khoản không hoạt động'), { status: 403 });
  return role;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Chưa cài khóa GEMINI_API_KEY trên Vercel' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const role = await checkUser(req, body.env);
    const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
    if (!images.length) return res.status(400).json({ error: 'Không có ảnh' });
    const parts = images.map(d => ({ inlineData: { mimeType: 'image/jpeg', data: String(d).replace(/^data:[^,]+,/, '') } }));
    parts.push({ text: prompt(role.role, body.lists || {}) });
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let lastErr = null;
    for (const model of MODELS) {
      try {
        const r = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: { responseMimeType: 'application/json', responseJsonSchema: SCHEMA, temperature: 0 }
        });
        const data = JSON.parse(r.text || '{}');
        return res.status(200).json({ model, head: data.head || {}, rows: Array.isArray(data.rows) ? data.rows : [] });
      } catch (e) {
        lastErr = e;
        const st = e && e.status;
        if (st === 404 || st === 429 || st === 503 || st === 500) continue;   // model không có / hết hạn mức / quá tải -> thử model khác
        throw e;
      }
    }
    const quota = lastErr && lastErr.status === 429;
    return res.status(quota ? 429 : 502).json({ error: quota ? 'Đã hết lượt quét miễn phí của hôm nay / phút này. Thử lại sau ít phút, hoặc dùng cách dán chữ.' : 'Không đọc được ảnh: ' + (lastErr && lastErr.message || '') });
  } catch (e) {
    const st = e && e.status && e.status < 500 ? e.status : (e && e.code && String(e.code).startsWith('ERR_JW') ? 401 : 500);
    return res.status(st).json({ error: st === 401 ? 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại' : (e.message || 'Lỗi') });
  }
}
