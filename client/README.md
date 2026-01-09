# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Client (Web UI)

Thư mục `client/` chứa giao diện web của dự án (React + Vite).

## Yêu cầu

- Node.js `>= 18.18.0`
- npm `>= 9.0.0`

## Chạy local

```bash
npm install
npm run dev
```

## Build (trước khi deploy)

```bash
npm run build
```

## Cấu hình API

Client gọi API từ server thông qua các file trong `src/api/`.
Nếu cần đổi môi trường (local/staging/production), hãy kiểm tra nơi khai báo base URL (thường nằm trong `src/api/apiBase.js` hoặc `src/api/http.js`).

## Tài liệu tổng quan

Xem README ở thư mục gốc của dự án để hiểu kiến trúc hệ thống và checklist kiểm tra sau deploy.
