// Trả về mã bản app đang chạy trên Vercel (mã commit). App ở máy nhân viên hỏi định kỳ: khác mã lúc mở trang -> có bản mới -> tải lại.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).json({ v: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || '' });
}
