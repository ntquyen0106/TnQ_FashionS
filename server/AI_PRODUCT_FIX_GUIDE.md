# Hướng Dẫn: AI Không Tự Bịa Slug Sản Phẩm

## ✅ Đã Implement

### 1. **Controller mới: `ai-products.controller.js`**

- Endpoint: `GET /api/ai/products`
- Query products từ MongoDB theo: category, price range, search
- Trả về format chuẩn cho AI: `{ name, slug, price, rating, image, inStock }`
- Function helper `queryProductsForAI()` để service gọi trực tiếp

### 2. **Chatbot Service đã được cập nhật**

- ✅ Thêm function `analyzeIntent()` - phân tích ý định user
- ✅ Query products từ DB **TRƯỚC KHI** gọi AI
- ✅ Inject danh sách sản phẩm thật vào AI context
- ✅ System prompt mới với quy tắc NGHIÊM NGẶT:
  - CHỈ dùng slug từ database
  - KHÔNG tự bịa slug
  - Nếu không có sản phẩm → nói thật

### 3. **Routes đã được thêm**

- `server/src/routes/ai.routes.js` → mount vào `/api/ai`
- Đã import và register trong `app.js`

---

## 🧪 Cách Test

### Test 1: Endpoint AI Products

```bash
# Test lấy tất cả sản phẩm active
curl http://localhost:5000/api/ai/products?limit=10

# Test filter theo category
curl http://localhost:5000/api/ai/products?category=ao-thun-nu&limit=5

# Test filter theo giá
curl http://localhost:5000/api/ai/products?minPrice=100000&maxPrice=300000

# Test search
curl http://localhost:5000/api/ai/products?search=polo
```

**Kết quả mong đợi:**

```json
{
  "success": true,
  "products": [
    {
      "name": "Áo Thun Basic Trắng",
      "slug": "ao-thun-basic-trang",
      "price": 179000,
      "rating": 4.5,
      "image": "products/ao-thun-basic-1",
      "inStock": true
    }
  ],
  "count": 1
}
```

### Test 2: Chatbot với User

1. Mở chatbot widget
2. Hỏi: "Cho tôi xem áo thun nữ"
3. **TRƯỚC ĐÂY:** AI tự bịa slug như `day-dong-ho-da`, `kinh-ram-nam`
4. **BÂY GIỜ:** AI chỉ trả slug có trong DB

**Debug trong console server:**

```
[Chatbot] Intent: { needsProducts: true, category: 'ao-thun-nu' }
[Chatbot] Queried 5 products from DB
[Chatbot] AI context injected with real slugs
```

### Test 3: Kiểm tra AI không bịa slug

Hỏi: "Có dây đồng hồ da không?"

**TRƯỚC:**

```json
{
  "type": "product_list",
  "items": [
    { "slug": "day-dong-ho-da", ... }  ❌ TỰ BỊA
  ]
}
```

**SAU:**

```
"Em xin lỗi, hiện shop chưa có sản phẩm này. Anh/Chị có thể xem các sản phẩm khác ạ."
✅ ĐÚNG - không bịa slug
```

---

## 📋 Checklist Sau Khi Deploy

- [ ] Restart server: `npm run dev` (hoặc restart PM2)
- [ ] Test endpoint `/api/ai/products`
- [ ] Test chatbot hỏi về sản phẩm có trong DB
- [ ] Test chatbot hỏi về sản phẩm KHÔNG có trong DB
- [ ] Kiểm tra console không còn lỗi 404 cho slug lạ
- [ ] Clear localStorage cache: `localStorage.removeItem('chatbot_ai_missing_products')`

---

## 🔧 Nếu Vẫn Gặp Lỗi

### Lỗi: AI vẫn trả slug lạ

**Nguyên nhân:** Model chưa học được quy tắc mới

**Giải pháp:**

1. Kiểm tra log server xem có query products không:
   ```
   [Chatbot] Queried X products from DB
   ```
2. Nếu không có log → check `analyzeIntent()` có trigger đúng không
3. Thử prompt rõ ràng hơn: "Cho tôi xem danh sách áo thun nữ shop đang bán"

### Lỗi: Query products trống

**Nguyên nhân:** Filter không khớp hoặc DB không có sản phẩm

**Debug:**

```javascript
// Trong chatbot.service.js
console.log('[Debug] Intent:', intent);
console.log('[Debug] Real products:', realProducts);
```

### Lỗi: Import fail

```
Error: Cannot find module 'ai-products.controller.js'
```

**Giải pháp:**

- Check file path: `server/src/controllers/ai-products.controller.js`
- Restart server hoàn toàn (kill process)
- Check syntax ES6 import

---

## 🚀 Nâng Cấp Sau Này

### 1. **Caching Products**

Để giảm query DB:

```javascript
const productCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Trong queryProductsForAI
const cacheKey = JSON.stringify(filters);
if (productCache.has(cacheKey)) {
  const cached = productCache.get(cacheKey);
  if (Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
}
```

### 2. **Vector Search cho Products**

Dùng MongoDB Atlas Search hoặc Elasticsearch:

```javascript
// Tìm sản phẩm gần nghĩa với query
const vectorResults = await Product.aggregate([
  {
    $search: {
      text: { query: userMessage, path: 'name' },
    },
  },
]);
```

### 3. **Fallback khi không có sản phẩm**

```javascript
if (realProducts.length === 0) {
  // Query similar category hoặc bestseller
  realProducts = await queryProductsForAI({ limit: 5 });
  productContext += '\n\n(Hiện không có sản phẩm đúng yêu cầu, đây là bestseller)';
}
```

---

## 📝 Notes

- **Không xóa** file cũ trong `chatbot.service.js` → chỉ sửa logic
- **Giữ nguyên** API response format để FE không cần sửa
- **AI training data** (`CHATBOT_AI_DOCUMENTATION.md`) nên update để sync với quy tắc mới

---

## ✨ Kết Quả Mong Đợi

### Trước:

```
User: "Cho tôi xem dây đồng hồ"
AI: {products: [{slug: "day-dong-ho-da"}]}  ❌
FE: GET /api/products/slug/day-dong-ho-da → 404
Console: ❌ Product not found (đỏ rực)
```

### Sau:

```
User: "Cho tôi xem dây đồng hồ"
AI query DB: 0 results
AI: "Em xin lỗi, hiện shop chưa có sản phẩm này..."  ✅
Console: ✅ Clean (không có lỗi 404)
```

```
User: "Cho tôi xem áo thun nữ"
AI query DB: 5 results [{slug: "ao-thun-nu-basic"}, ...]
AI: {products: [{slug: "ao-thun-nu-basic"}]}  ✅
FE: GET /api/products/slug/ao-thun-nu-basic → 200 ✅
```

---

**Tác giả:** GitHub Copilot  
**Ngày:** 2025-01-13  
**Status:** ✅ READY TO TEST
