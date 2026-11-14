// BABY CAR – trợ lý hỏi đáp cho trang Quản Lý (Claude của Anthropic).
// Khóa ANTHROPIC_API_KEY cất trong Vercel (Settings -> Environment Variables), KHÔNG để trong code (repo công khai).
// Chỉ tài khoản QUẢN LÝ đang hoạt động gọi được (kiểm tra Firebase ID token + roles/<uid>).
// Máy chủ chỉ chuyển lời tới Claude. Các "công cụ" tra dữ liệu chạy NGAY TRÊN MÁY quản lý (index.html),
// dùng đúng hàm đối soát của app -> câu trả lời khớp với những gì app đang hiện.
import Anthropic from '@anthropic-ai/sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const config = { maxDuration: 300 };

const PROJECT_ID = 'taxi-tss-df1a5';
const DB_URL = 'https://taxi-tss-df1a5-default-rtdb.firebaseio.com';
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const MAX_BODY = 4_000_000;

const SYSTEM = `Bạn là BABY CAR – trợ lý hỏi đáp trong app "Đối Soát Bill Taxi" của Công ty CP Dịch Vụ Hàng Không TSS (taxi sân bay Tân Sơn Nhất).
Người hỏi là QUẢN LÝ. Họ thường chụp màn hình app (hoặc tin nhắn nhóm Zalo của sếp/nhân viên) và hỏi "vì sao…". Việc của bạn: TRA DỮ LIỆU THẬT bằng công cụ, tìm nguyên nhân, giải thích thỏa đáng để quản lý trả lời sếp.

CÁCH TRẢ LỜI
- Tiếng Việt, câu ngắn, dễ hiểu, không dùng thuật ngữ lập trình. Người dùng không phải lập trình viên.
- Mở đầu bằng 1 câu KẾT LUẬN (nguyên nhân chính). Sau đó "Bằng chứng" (số phiếu, xe, ngày, ai nhập, lúc nào, tiền) và "Cách xử lý" (ai cần sửa gì, bấm nút nào trong app).
- Luôn tra dữ liệu trước khi kết luận; KHÔNG đoán khi chưa tra. Không tìm thấy thì nói rõ đã tìm ở đâu, khoảng ngày nào.
- Phân biệt rõ: (1) NHÂN VIÊN/TÀI XẾ NHẬP SAI (sai số phiếu, sai biển số, sai ngày, sai thanh toán, nhập trễ, quên nhập) – hay gặp nhất; (2) app chạy đúng quy tắc nhưng quy tắc gây hiểu nhầm; (3) LỖI APP thật. Nếu nghi lỗi app, ghi một mục riêng bắt đầu bằng "⚠️ CÓ THỂ LÀ LỖI APP:" mô tả ngắn hiện tượng + bằng chứng, để quản lý chuyển cho người sửa app. Không tự nhận lỗi app khi chưa có bằng chứng.
- Ảnh người dùng gửi: đọc kỹ chữ trên ảnh (số phiếu, xe, ngày, tên). Ảnh chỉ để hiểu câu hỏi; số liệu thật lấy từ công cụ.
- Khi đã có kết luận, DÙNG CÔNG CỤ "ve_bang_minh_hoa" để làm 1 ảnh bằng chứng gọn (vd bảng so 2 bên Bán vé – Tài xế, tô đỏ ô sai) để quản lý tải về gửi sếp. Nếu cần chỉ đúng chỗ trên ảnh người dùng gửi, dùng "cat_anh" (khoanh đỏ vùng liên quan). Không cần vẽ ảnh cho câu hỏi đơn giản không có bằng chứng.
- Ngắn gọn: thường dưới 200 chữ (không tính ảnh). Định dạng: **in đậm**, gạch đầu dòng "- ". Không dùng bảng markdown (dùng ảnh minh họa thay thế).
- Bạn CHỈ ĐỌC dữ liệu, không sửa được gì. Muốn sửa thì hướng dẫn quản lý bấm trong app.
- Thông tin chia tiền/hoa hồng nội bộ không có trong dữ liệu; không bịa số liệu.

KIẾN THỨC VỀ APP
Phân vùng (role): "pos" = Bán vé (quầy sân bay), "plan" = Team Kế hoạch, "plan2" = Team Kế hoạch 2, "driver" = Cổng chủ xe / Tài xế, "manager" = Quản lý. Bán vé, Kế hoạch, Kế hoạch 2 gọi chung là BÊN BÁN; tài xế là BÊN TÀI XẾ.
Tài khoản dạng TSS354 (tài xế thường đặt theo số xe), TKNTK…; mỗi tài khoản có tên nhân sự riêng ở ô "Tên".
Mỗi đơn (cuốc xe): id, dateStr (dd/mm/yyyy), dateKey (yyyy-mm-dd), timeStr, ticketNumber (số phiếu; đơn chia nhiều nhân sự có đuôi "-1/2", "-2/2"), originalTicket (phiếu gốc), plateNumber (biển số, thường 3 số cuối như "354"), carType, source (nguồn đơn), pickup (Ga T1/T2/T3), destination (điểm đến), totalFare (giá xe, đồng), paymentMethod, note, staff (tên nhân sự), role, createdBy (tài khoản nhập), timestamp (lúc lưu), signFee (bảng đón – chỉ KH2, công nợ đối tác, không so với tài xế), priceId/listPrice (giá bảng).
Lưu 2 bản: "trips" (toàn công ty – bảng đối soát dùng bản này) và "users_trips/<TÀI KHOẢN>" (bản riêng – lịch sử nhân viên/tài xế thấy trên máy họ). Hai bản phải giống nhau; lệch nhau là dấu hiệu lỗi app/lỗi mạng lúc lưu (dùng công cụ so_sanh_ban_sao).
ĐỐI SOÁT (Bảng Đối Soát, Quản lý):
- Gom nhóm theo: SỐ PHIẾU GỐC + BIỂN SỐ (bỏ dấu . - khoảng trắng, chữ hoa) + NGÀY. Đơn bên bán không ghi biển số (Kế hoạch được phép) thì ghép vào nhóm cùng phiếu + ngày nếu có đúng 1 nhóm.
- Nhóm có cả 2 bên: tiền lệch < 1.000đ VÀ hình thức thanh toán cùng nhóm → "Trùng khớp"; ngược lại → "Đơn lệch" kèm lý do. Nhóm thanh toán: NVQ (nhân viên quầy thu), THE (thẻ), TXT (tài xế thu), KH (kế hoạch/công nợ/chuyển khoản/đối tác; đơn Kế hoạch luôn là KH). "Free nội bộ" khớp mọi hình thức nhưng tiền phải 0đ.
- Thiếu 1 bên → "Chưa khớp": "Chờ … báo" hoặc, sau hạn báo cáo (ngày đơn +1 lúc <giờ khóa> giờ), "Quá hạn: Tài xế chưa báo" / "Quá hạn: Bán vé/KH chưa báo".
- GHÉP LỆCH NGÀY: nhóm chỉ có bên bán + nhóm chỉ có tài xế, cùng phiếu + biển số, ngày cách đúng 1 ngày, đúng 1 cặp → "Khớp – Lệch ngày" (xanh dương), có nút "Sửa ngày theo bán vé". Cách 2 ngày trở lên thì KHÔNG ghép.
- Vì vậy chỉ cần MỘT bên gõ sai số phiếu, hoặc sai biển số, hoặc sai ngày quá 1 ngày → 2 đơn thành 2 nhóm riêng, cả 2 đều "chưa báo" dù 2 bên đều đã nhập. Đây là nguyên nhân phổ biến nhất của câu hỏi "đã báo rồi sao app vẫn nói chưa báo".
- Số phiếu KHÔNG BAO GIỜ trùng giữa 2 cuốc khác nhau (người dùng xác nhận).
KHUNG "NHẮC BÁO CÁO" (đầu trang Quản lý, chọn Từ–Đến ngày): "Tài xế chưa báo" = các nhóm chỉ có bên bán (ghi "Xe 354 – Phiếu 116864 – <tên> (TK …) (bán vé) đã nhập, đi …, tiền"); "Bán vé/Kế hoạch chưa nhập" = các nhóm chỉ có tài xế. Bấm 1 dòng → Bảng Đối Soát lọc đúng phiếu.
Lịch sử nhân viên/tài xế (trên máy họ) chỉ hiện đơn của chính họ – họ không thấy bên kia đã nhập gì.
Khóa sửa/xóa: sau <giờ khóa> giờ sáng hôm sau, nhân viên không sửa/xóa đơn của mình được nữa (Quản lý vẫn sửa được). Quản lý sửa ngay trong Bảng Đối Soát (ngày, tiền, phiếu, biển số…).
Xóa đơn: đơn xóa vào THÙNG RÁC (90 ngày) và ghi NHẬT KÝ (ai nhập/sửa/xóa, lúc nào). Nút "🗂️ Nhật Ký & Thùng Rác" ở Bảng Đối Soát, có Khôi phục.
Nhập trùng: app chặn trùng (phiếu + biển số + ngày) trong CÙNG tài khoản.
Giảm giá vượt mức (chỉ Bán vé): so với bảng giá công ty, nội thành tối đa 10%, ngoại thành 15% (chỉnh được); đơn Kế hoạch không xét. Nhân viên không thấy cảnh báo, chỉ quản lý thấy.
Bán vé/Kế hoạch bắt buộc ghi Quận/Phường ở điểm đến (nội thành).
Excel: "Xuất Excel Đối Soát" (3 trang Đối Soát / Tổng Hợp / Dữ Liệu MISA), "Xuất Excel Mục Này" ở khung nhắc.

CÔNG CỤ
Ngày truyền vào công cụ dạng dd/mm/yyyy hoặc yyyy-mm-dd. Khoảng tra tối đa 62 ngày. Nếu người dùng không nói năm thì là năm nay; không nói ngày thì tra quanh hôm nay / ngày trên ảnh.
Gợi ý quy trình cho câu hỏi "vì sao chưa khớp / chưa báo": doi_soat theo số phiếu (khoảng rộng vài ngày) → xem "ung_vien_gan_giong" → tim_don theo biển số / tài khoản tài xế trong ngày đó → nếu tài xế nói đã nhập mà không thấy trong "trips", dùng so_sanh_ban_sao và nhat_ky (có thể đơn bị xóa, nằm trong thùng rác, hoặc chỉ lưu được 1 bản).`;

const DATE = { type: 'string', description: 'Ngày dd/mm/yyyy hoặc yyyy-mm-dd' };
const TOOLS = [
  {
    name: 'doi_soat',
    description: 'Chạy ĐÚNG hàm đối soát của app trên khoảng ngày → các nhóm (số phiếu + biển số + ngày) kèm trạng thái như Bảng Đối Soát (match/mismatch/unmatched/dateoff, lý do lệch, bên nào thiếu, quá hạn chưa) và danh sách đơn từng bên. Với nhóm thiếu 1 bên còn kèm "ung_vien_gan_giong": đơn bên kia có thể chính là cuốc này nhưng bị gõ lệch (cùng phiếu khác biển số/ngày, cùng xe cùng ngày số phiếu gần giống, cùng xe cùng ngày cùng tiền...). Lọc thêm theo số phiếu / biển số / trạng thái.',
    input_schema: {
      type: 'object',
      properties: {
        tu_ngay: DATE, den_ngay: DATE,
        so_phieu: { type: 'string', description: 'Lọc theo số phiếu (khớp một phần, bỏ khoảng trắng)' },
        bien_so: { type: 'string', description: 'Lọc theo biển số (khớp một phần, vd "354")' },
        trang_thai: { type: 'string', enum: ['all', 'match', 'mismatch', 'unmatched', 'dateoff', 'overdue'], description: 'Mặc định all' }
      },
      required: ['tu_ngay', 'den_ngay']
    }
  },
  {
    name: 'nhac_bao_cao',
    description: 'Tính lại khung "Nhắc Báo Cáo" của trang Quản lý cho khoảng ngày: danh sách "Tài xế chưa báo" (theo xe, từng phiếu) và "Bán vé/Kế hoạch chưa nhập", hạn báo cáo.',
    input_schema: { type: 'object', properties: { tu_ngay: DATE, den_ngay: DATE }, required: ['tu_ngay', 'den_ngay'] }
  },
  {
    name: 'tim_don',
    description: 'Tìm đơn trong dữ liệu công ty (bản "trips") theo khoảng ngày và điều kiện. Trả về tối đa 80 đơn, đủ các trường (người nhập, giờ lưu, tiền, thanh toán...).',
    input_schema: {
      type: 'object',
      properties: {
        tu_ngay: DATE, den_ngay: DATE,
        so_phieu: { type: 'string' }, bien_so: { type: 'string' },
        tai_khoan: { type: 'string', description: 'Tài khoản nhập (createdBy), vd TSS354' },
        phan_vung: { type: 'string', enum: ['pos', 'plan', 'plan2', 'driver'] },
        tu_khoa: { type: 'string', description: 'Tìm trong tên nhân sự, điểm đến, nguồn, ghi chú, thanh toán (không phân biệt dấu)' }
      },
      required: ['tu_ngay', 'den_ngay']
    }
  },
  {
    name: 'so_sanh_ban_sao',
    description: 'So bản riêng của 1 tài khoản (users_trips/<TK> – cái nhân viên/tài xế thấy trong Lịch sử trên máy họ) với bản công ty (trips – cái Bảng Đối Soát dùng) trong khoảng ngày. Chỉ ra đơn có ở bản này mà thiếu ở bản kia, hoặc khác nội dung → dấu hiệu lỗi lưu.',
    input_schema: { type: 'object', properties: { tai_khoan: { type: 'string' }, tu_ngay: DATE, den_ngay: DATE }, required: ['tai_khoan', 'tu_ngay', 'den_ngay'] }
  },
  {
    name: 'nhat_ky',
    description: 'Tra NHẬT KÝ thao tác (ai nhập/sửa/xóa/khôi phục đơn, lúc nào, sửa gì; ~3000 thao tác gần nhất) và THÙNG RÁC (đơn đã xóa trong 90 ngày). Lọc theo số phiếu / biển số / tài khoản / ngày đơn.',
    input_schema: {
      type: 'object',
      properties: {
        so_phieu: { type: 'string' }, bien_so: { type: 'string' },
        tai_khoan: { type: 'string', description: 'Người thao tác hoặc chủ đơn' },
        tu_ngay: { type: 'string', description: 'Ngày của ĐƠN (dd/mm/yyyy), tùy chọn' },
        den_ngay: { type: 'string', description: 'Ngày của ĐƠN (dd/mm/yyyy), tùy chọn' }
      }
    }
  },
  {
    name: 'cai_dat',
    description: 'Xem cài đặt hiện tại: giờ khóa sửa/hạn báo cáo, bảng giá đang áp dụng, mức giảm tối đa, danh sách hình thức thanh toán, danh sách tài khoản (tên, phân vùng, còn hoạt động không), môi trường (bản chính / bản thử), hôm nay.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 've_bang_minh_hoa',
    description: 'Vẽ 1 ẢNH bằng chứng dạng bảng (PNG) hiện trong khung chat, quản lý tải về gửi sếp. Dùng sau khi đã tra xong. Giữ gọn: 2–8 dòng, 3–7 cột, chữ ngắn.',
    input_schema: {
      type: 'object',
      properties: {
        tieu_de: { type: 'string', description: 'Tiêu đề ảnh, vd "Phiếu 116864 – xe 354 – ngày 11/11"' },
        cot: { type: 'array', items: { type: 'string' }, description: 'Tên cột' },
        dong: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Các dòng, mỗi dòng là mảng ô (chữ)' },
        o_do: { type: 'array', items: { type: 'array', items: { type: 'integer' } }, description: 'Các ô tô ĐỎ (chỗ sai), dạng [chỉ số dòng, chỉ số cột], đếm từ 0' },
        o_xanh: { type: 'array', items: { type: 'array', items: { type: 'integer' } }, description: 'Các ô tô XANH (chỗ đúng/khớp), dạng [dòng, cột]' },
        ket_luan: { type: 'string', description: '1–3 câu kết luận in dưới bảng' }
      },
      required: ['tieu_de', 'cot', 'dong', 'ket_luan']
    }
  },
  {
    name: 'cat_anh',
    description: 'Cắt 1 vùng từ ẢNH NGƯỜI DÙNG ĐÃ GỬI và khoanh đỏ chỗ cần chú ý → ảnh PNG để tải về. Tọa độ là tỉ lệ 0–1 theo chiều rộng/cao ảnh gốc (0,0 = góc trên trái).',
    input_schema: {
      type: 'object',
      properties: {
        anh_so: { type: 'integer', description: 'Số thứ tự ảnh trong cuộc trò chuyện (ảnh đầu tiên = 1), đúng như nhãn [Ảnh n] trong tin nhắn' },
        vung: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, rong: { type: 'number' }, cao: { type: 'number' } }, required: ['x', 'y', 'rong', 'cao'], description: 'Vùng cắt' },
        khung_do: { type: 'array', items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, rong: { type: 'number' }, cao: { type: 'number' } }, required: ['x', 'y', 'rong', 'cao'] }, description: 'Các khung đỏ (tọa độ theo ẢNH GỐC, không theo vùng cắt)' },
        ghi_chu: { type: 'string', description: 'Dòng chú thích dưới ảnh' }
      },
      required: ['anh_so', 'vung', 'ghi_chu']
    }
  }
];
TOOLS[TOOLS.length - 1].cache_control = { type: 'ephemeral' };

async function checkManager(req, env) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw Object.assign(new Error('Chưa đăng nhập'), { status: 401 });
  const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });
  const prefix = env === 'test' ? 'test_env/' : '';
  const r = await fetch(`${DB_URL}/${prefix}roles/${encodeURIComponent(payload.sub)}.json?auth=${encodeURIComponent(token)}`);
  const role = r.ok ? await r.json() : null;
  if (!role || role.active !== true) throw Object.assign(new Error('Tài khoản không hoạt động'), { status: 403 });
  if (role.role !== 'manager') throw Object.assign(new Error('Baby Car chỉ dành cho tài khoản Quản lý'), { status: 403 });
  return role;
}

// Chỉ nhận đúng các kiểu nội dung cần thiết (máy khách không đổi được lời dặn / công cụ)
const OK_BLOCKS = new Set(['text', 'image', 'tool_use', 'tool_result', 'thinking', 'redacted_thinking', 'fallback']);
function cleanMessages(list) {
  if (!Array.isArray(list) || !list.length || list.length > 120) throw Object.assign(new Error('Cuộc trò chuyện quá dài, hãy bấm "Cuộc trò chuyện mới"'), { status: 400 });
  return list.map(m => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) throw Object.assign(new Error('Tin nhắn không hợp lệ'), { status: 400 });
    const content = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content : null);
    if (content === null) throw Object.assign(new Error('Tin nhắn không hợp lệ'), { status: 400 });
    if (Array.isArray(content) && content.some(b => !b || !OK_BLOCKS.has(b.type))) throw Object.assign(new Error('Tin nhắn có nội dung lạ'), { status: 400 });
    return { role: m.role, content };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Chưa cài khóa ANTHROPIC_API_KEY trên Vercel' });
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (raw.length > MAX_BODY) return res.status(413).json({ error: 'Cuộc trò chuyện có quá nhiều ảnh, hãy bấm "Cuộc trò chuyện mới"' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    await checkManager(req, body.env);
    const messages = cleanMessages(body.messages);
    const today = String(body.today || '').slice(0, 80);
    const client = new Anthropic();
    const msg = await client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Hôm nay: ${today}. Môi trường: ${body.env === 'test' ? 'BẢN THỬ (dữ liệu thử)' : 'bản chính'}.` }
      ],
      tools: TOOLS,
      messages
    }).finalMessage();
    if (msg.stop_reason === 'refusal') {
      return res.status(200).json({ content: [{ type: 'text', text: 'Baby Car không trả lời được câu này. Anh/chị hỏi lại theo cách khác nhé.' }], stop_reason: 'end_turn', usage: msg.usage, model: msg.model });
    }
    return res.status(200).json({ content: msg.content, stop_reason: msg.stop_reason, usage: msg.usage, model: msg.model });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return res.status(502).json({ error: 'Khóa Claude (ANTHROPIC_API_KEY) không đúng hoặc đã bị xóa' });
    if (e instanceof Anthropic.PermissionDeniedError) return res.status(502).json({ error: 'Khóa Claude không có quyền dùng model này' });
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Claude đang quá tải hoặc hết hạn mức, thử lại sau 1 phút' });
    if (e instanceof Anthropic.BadRequestError) {
      const m = String(e.message || '');
      if (/credit|balance|billing/i.test(m)) return res.status(402).json({ error: 'Tài khoản Claude đã hết tiền – nạp thêm ở console.anthropic.com (Billing)' });
      return res.status(400).json({ error: 'Claude từ chối yêu cầu: ' + m.slice(0, 300) });
    }
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: `Lỗi Claude (${e.status || '?'}), thử lại sau` });
    const st = e && e.status && e.status < 500 ? e.status : (e && e.code && String(e.code).startsWith('ERR_JW') ? 401 : 500);
    return res.status(st).json({ error: st === 401 ? 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại' : (e.message || 'Lỗi') });
  }
}
