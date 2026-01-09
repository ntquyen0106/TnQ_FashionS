# TnQ_FashionS

Dự án web phục vụ hoạt động bán hàng thời trang: khách hàng xem sản phẩm, quản lý tài khoản, giỏ hàng, đặt hàng và thanh toán; phía máy chủ cung cấp API, xử lý đơn hàng, thanh toán và các tích hợp liên quan.

## Ai nên đọc tài liệu này?

- **Chủ doanh nghiệp/Quản lý vận hành**: hiểu dự án làm gì, gồm những phần nào, cách kiểm tra sau khi triển khai.
- **Đội kỹ thuật**: biết cách cài đặt, chạy local, cấu hình môi trường và triển khai.

## Thành phần hệ thống

- **Client**: ứng dụng web (React + Vite) trong thư mục `client/`.
- **Server**: API (Node.js + Express) trong thư mục `server/`.

## Các module/chức năng chính (theo mã nguồn hiện có)

- **Sản phẩm & danh mục**: hiển thị danh sách, chi tiết, tìm/duyệt theo danh mục.
- **Giỏ hàng**: thêm/xoá/cập nhật số lượng, đồng bộ dữ liệu qua API.
- **Đơn hàng**: tạo đơn, xem trạng thái đơn (tuỳ cấu hình).
- **Thanh toán**: hỗ trợ luồng COD và tích hợp PayOS (tuỳ cấu hình môi trường).
- **Khuyến mãi/Voucher**: áp dụng mã/ưu đãi (tuỳ cấu hình).
- **Chatbot**: gửi/nhận tin nhắn qua API.

Ghi chú: dự án còn có các API liên quan báo cáo/nhân sự (attendance/shifts/staff...) trong `client/src/api/`. Việc có “bật” và sử dụng trong UI phụ thuộc cấu hình và màn hình hiện tại của dự án.

## Công nghệ

- **Client**: React, React Router, TanStack React Query, Axios, MUI, Socket.IO client.
- **Server**: Node.js (ESM), Express, MongoDB (Mongoose), Socket.IO, JWT, Helmet, Cloudinary, Firebase Admin.

Yêu cầu phiên bản:

- Node.js `>= 18.18.0`
- npm `>= 9.0.0`

## Cấu trúc thư mục (tóm tắt)

```
client/   # giao diện web (React)
server/   # API backend (Express)
docs/     # tài liệu bổ trợ (nếu có)
```

## Chạy dự án trên máy (Local Development)

### 1) Cài đặt dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 2) Cấu hình môi trường (Server)

- Tạo file `server/.env`.
- Nếu có `server/.env.example` thì copy và điền giá trị tương ứng.

Các biến môi trường thường gặp (tuỳ cấu hình dự án):

- Kết nối DB (MongoDB)
- JWT secret
- CORS origin (URL của client)
- Thông tin PayOS
- Cloudinary/Firebase (nếu dùng upload/notification)

### 3) Chạy dev

Mở 2 terminal:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

## Triển khai (Deployment) – gợi ý theo cách đang dùng

- **Client**: thường deploy lên Vercel.
- **Server**: thường deploy lên Render.

Khi deploy cần đảm bảo:

- Server đã set đầy đủ biến môi trường.
- CORS cho phép domain của client.
- Client trỏ đúng API base URL (theo cấu hình trong `client/src/api`).

## Smoke test sau deploy (Checklist cho doanh nghiệp)

1. **Đăng nhập**: mở bản deploy, đăng nhập bằng tài khoản thật; xác minh trang tài khoản load được và API hồ sơ trả về OK.
2. **Sản phẩm**: vào trang sản phẩm/danh mục, tải danh sách và mở chi tiết sản phẩm.
3. **Giỏ hàng**: thêm sản phẩm vào giỏ; refresh trang để đảm bảo giỏ vẫn còn.
4. **Đặt hàng**: đi qua luồng checkout (COD/PayOS nếu đang bật); xác nhận đơn được tạo và trạng thái cập nhật đúng.
5. **Khuyến mãi/Voucher** (nếu có): áp dụng thử 1 voucher hợp lệ và 1 voucher sai để kiểm tra validate.
6. **Giám sát**: kiểm tra log trên nền tảng deploy (Vercel/Render) ngay sau khi test để đảm bảo không có lỗi hệ thống.

## Lệnh hữu ích

- Build client (kiểm tra nhanh trước khi deploy):

```bash
cd client
npm run build
```

- Chạy server production mode:

```bash
cd server
npm start
```

## Hỗ trợ

Nếu bạn muốn mình viết thêm phần “Hướng dẫn vận hành” (vai trò người dùng, luồng tạo sản phẩm/đơn hàng, quy trình xử lý đơn) theo đúng nghiệp vụ doanh nghiệp của bạn, hãy gửi:

- Các vai trò (Admin/Staff/Customer?)
- Các màn hình đang dùng thực tế
- Quy trình đặt hàng/thanh toán mong muốn
