// (21/11) Tailwind dựng sẵn thành app.css (trước đây dùng cdn.tailwindcss.com: máy người dùng tự tạo CSS, chậm/lag).
// Sửa giao diện có thêm class mới -> chạy lại: npx tailwindcss@3.4.17 -c tailwind/tailwind.config.cjs -i tailwind/input.css -o app.css --minify
module.exports = { content: ['./index.html'], theme: { extend: {} }, plugins: [] };
