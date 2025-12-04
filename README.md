cd TnQ_FashionS/server
npm install
cp .env.example .env   # hoặc tự tạo .env thủ công
cd ../client
npm install

## Smoke test sau deploy

1. **Đăng nhập**: mở bản deploy FE trên Vercel, thực hiện luồng đăng nhập bằng tài khoản thật; xác minh token lưu hợp lệ và API `/auth/profile` trả về 200.
2. **Giỏ hàng**: chọn sản phẩm, thêm vào giỏ và kiểm tra socket/toast hiển thị; refresh lại trang để chắc chắn dữ liệu cart được đồng bộ từ API.
3. **Đặt hàng nhanh**: đi qua luồng checkout đơn giản (COD/PayOS) để chắc chắn các webhook chính phản hồi OK.
4. **API cốt lõi**: gọi nhanh các endpoint `/products`, `/orders`, `/chatbot/messages` bằng tool như Thunder Client/Postman với base URL Render để kiểm tra response < 1s và không lỗi CORS.
5. **Giám sát**: xem log trên Render & Vercel ngay sau khi chạy các bước trên để đảm bảo không có error stack hay cảnh báo bảo mật.