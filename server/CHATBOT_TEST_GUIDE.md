# 🧪 Hướng Dẫn Test Chatbot - Đầy Đủ

## 📋 Mục Lục
1. [Test Training - Quản lý Policies](#1-test-training---quản-lý-policies)
2. [Test Chat với AI](#2-test-chat-với-ai)
3. [Test Chat với Staff](#3-test-chat-với-staff)
4. [Test Staff Dashboard](#4-test-staff-dashboard)

---

## 1. Test Training - Quản lý Policies

### 🔐 Yêu Cầu
- Phải đăng nhập với role **staff** hoặc **admin**
- Lấy token từ login response

### 📝 1.1. Tạo Policy Mới

#### Request:
```http
POST http://localhost:3000/api/training/policy
Authorization: Bearer YOUR_STAFF_TOKEN
Content-Type: application/json

{
  "type": "shipping",
  "title": "Miễn phí ship đơn trên 500k",
  "content": "Áp dụng cho tất cả đơn hàng từ 500,000đ trở lên. Giao hàng trong 2-3 ngày làm việc tại TP.HCM và Hà Nội.",
  "order": 1,
  "metadata": {
    "minOrderValue": 500000,
    "estimatedDays": "2-3",
    "regions": ["TP.HCM", "Hà Nội"],
    "priority": "high"
  }
}
```

#### Expected Response:
```json
{
  "success": true,
  "message": "Policy created successfully",
  "data": {
    "_id": "673f1234567890abcdef1234",
    "type": "shipping",
    "title": "Miễn phí ship đơn trên 500k",
    "content": "Áp dụng cho tất cả đơn hàng...",
    "order": 1,
    "isActive": true,
    "metadata": {
      "minOrderValue": 500000,
      "estimatedDays": "2-3",
      "regions": ["TP.HCM", "Hà Nội"],
      "priority": "high"
    }
  }
}
```

#### Tạo Thêm Policies Khác:

**FAQ:**
```json
{
  "type": "faq",
  "title": "Làm thế nào để chọn size?",
  "content": "Bạn có thể xem bảng size chi tiết trong phần mô tả sản phẩm. Mỗi sản phẩm có bảng size riêng với số đo cụ thể. Nếu không chắc chắn, hãy chọn size lớn hơn hoặc liên hệ với chúng tôi để được tư vấn.",
  "order": 1,
  "metadata": {
    "category": "size_guide",
    "tags": ["size", "hướng dẫn", "đo lường"],
    "viewCount": 0,
    "helpful": 0
  }
}
```

**Return Policy:**
```json
{
  "type": "return",
  "title": "Đổi trả trong 7 ngày",
  "content": "Chúng tôi chấp nhận đổi trả sản phẩm trong vòng 7 ngày kể từ ngày nhận hàng. Điều kiện: sản phẩm chưa qua sử dụng, còn nguyên tag và bao bì. Không áp dụng cho đồ lót và sản phẩm sale.",
  "order": 1,
  "metadata": {
    "days": 7,
    "conditions": ["chưa sử dụng", "còn nguyên tag", "còn bao bì"],
    "refundMethod": "original",
    "exceptions": ["đồ lót", "sale items"]
  }
}
```

**Payment:**
```json
{
  "type": "payment",
  "title": "Thanh toán COD và Online",
  "content": "Chúng tôi hỗ trợ thanh toán COD (ship COD) và thanh toán online qua VNPay, MoMo, ZaloPay. Thanh toán online được ưu đãi giảm thêm 2%.",
  "order": 1,
  "metadata": {
    "methods": ["COD", "VNPay", "MoMo", "ZaloPay"],
    "onlineDiscount": 2,
    "codFee": 0
  }
}
```

**Warranty:**
```json
{
  "type": "warranty",
  "title": "Bảo hành 6 tháng",
  "content": "Sản phẩm được bảo hành 6 tháng với các lỗi do nhà sản xuất như phai màu bất thường, đường may sai kỹ thuật. Không bảo hành rách do sử dụng, bám bẩn.",
  "order": 1,
  "metadata": {
    "months": 6,
    "covers": ["lỗi sản xuất", "phai màu bất thường", "đường may lỗi"],
    "notCovers": ["rách do sử dụng", "bám bẩn", "mất nút"],
    "claimProcess": "Chụp ảnh sản phẩm lỗi gửi về email hoặc chat"
  }
}
```

**About:**
```json
{
  "type": "about",
  "title": "TnQ Fashion - Thời trang trẻ trung",
  "content": "TnQ Fashion là thương hiệu thời trang dành cho giới trẻ, mang đến những sản phẩm chất lượng cao với giá cả phải chăng. Chúng tôi cam kết mang đến trải nghiệm mua sắm tốt nhất.",
  "order": 1,
  "metadata": {
    "founded": "2020",
    "locations": ["TP.HCM", "Hà Nội", "Đà Nẵng"],
    "specialties": ["áo thun", "quần jeans", "váy", "phụ kiện"]
  }
}
```

---

### 📋 1.2. Lấy Tất Cả Policies

#### Request:
```http
GET http://localhost:3000/api/training/policies
Authorization: Bearer YOUR_STAFF_TOKEN
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "policies": {
      "shipping": [
        {
          "_id": "...",
          "title": "Miễn phí ship đơn trên 500k",
          "content": "...",
          "order": 1,
          "isActive": true,
          "metadata": { ... },
          "createdAt": "2025-11-09T...",
          "updatedAt": "2025-11-09T..."
        }
      ],
      "return": [ ... ],
      "payment": [ ... ],
      "warranty": [ ... ],
      "faq": [ ... ],
      "about": [ ... ]
    },
    "total": 6,
    "types": ["shipping", "return", "payment", "warranty", "faq", "about"]
  }
}
```

---

### 🔍 1.3. Lấy Chi Tiết 1 Policy

#### Request:
```http
GET http://localhost:3000/api/training/policy/673f1234567890abcdef1234
Authorization: Bearer YOUR_STAFF_TOKEN
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "_id": "673f1234567890abcdef1234",
    "type": "shipping",
    "title": "Miễn phí ship đơn trên 500k",
    "content": "Áp dụng cho tất cả đơn hàng...",
    "order": 1,
    "isActive": true,
    "metadata": {
      "minOrderValue": 500000,
      "estimatedDays": "2-3",
      "regions": ["TP.HCM", "Hà Nội"],
      "priority": "high"
    },
    "createdAt": "2025-11-09T...",
    "updatedAt": "2025-11-09T..."
  }
}
```

---

### ✏️ 1.4. Sửa Policy

#### Request:
```http
PUT http://localhost:3000/api/training/policy/673f1234567890abcdef1234
Authorization: Bearer YOUR_STAFF_TOKEN
Content-Type: application/json

{
  "title": "Miễn phí ship đơn trên 300k",
  "content": "Áp dụng cho tất cả đơn hàng từ 300,000đ trở lên. Giao hàng toàn quốc trong 3-5 ngày.",
  "metadata": {
    "minOrderValue": 300000,
    "estimatedDays": "3-5",
    "regions": ["Toàn quốc"],
    "priority": "high"
  }
}
```

#### Expected Response:
```json
{
  "success": true,
  "message": "Policy updated successfully",
  "data": {
    "_id": "673f1234567890abcdef1234",
    "type": "shipping",
    "title": "Miễn phí ship đơn trên 300k",
    "content": "Áp dụng cho tất cả đơn hàng từ 300,000đ...",
    "order": 1,
    "isActive": true,
    "metadata": {
      "minOrderValue": 300000,
      "estimatedDays": "3-5",
      "regions": ["Toàn quốc"],
      "priority": "high"
    }
  }
}
```

---

### 🔄 1.5. Bật/Tắt Policy

#### Request (Toggle):
```http
PATCH http://localhost:3000/api/training/policy/673f1234567890abcdef1234/toggle
Authorization: Bearer YOUR_STAFF_TOKEN
```

#### Expected Response (Tắt):
```json
{
  "success": true,
  "message": "Policy deactivated",
  "data": {
    "_id": "673f1234567890abcdef1234",
    "title": "Miễn phí ship đơn trên 300k",
    "isActive": false
  }
}
```

#### Expected Response (Bật lại):
```json
{
  "success": true,
  "message": "Policy activated",
  "data": {
    "_id": "673f1234567890abcdef1234",
    "title": "Miễn phí ship đơn trên 300k",
    "isActive": true
  }
}
```

---

### 🗑️ 1.6. Xóa Policy (Admin Only)

#### Request:
```http
DELETE http://localhost:3000/api/training/policy/673f1234567890abcdef1234
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Expected Response:
```json
{
  "success": true,
  "message": "Policy deleted successfully"
}
```

---

## 2. Test Chat với AI

### 👤 2.1. Customer Chat - Không Cần Đăng Nhập

#### Request:
```http
POST http://localhost:5000/api/chatbot/message
Content-Type: application/json

{
  "sessionId": "guest-session-12345",
  "text": "Tôi muốn mua áo thun nam",
  "customerInfo": {
    "name": "Khách vãng lai",
    "email": "",
    "phone": ""
  }
}
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "_id": "...",
      "from": "user",
      "text": "Tôi muốn mua áo thun nam",
      "createdAt": "2025-11-09T..."
    },
    "botMessage": {
      "_id": "...",
      "from": "bot",
      "text": "Chào bạn! TnQ Fashion có rất nhiều mẫu áo thun nam đẹp:\n\n1. Áo Thun Nam Basic - 150,000đ - 200,000đ\n   Link: /products/ao-thun-nam-basic\n\n2. Áo Thun Nam Form Rộng - 180,000đ\n   Link: /products/ao-thun-nam-form-rong\n\nBạn thích kiểu nào? Basic hay form rộng? 😊",
      "createdAt": "2025-11-09T..."
    },
    "session": {
      "sessionId": "guest-session-12345",
      "status": "active",
      "aiEnabled": true
    }
  }
}
```

---

### 💬 2.2. Tiếp Tục Chat với AI

#### Request:
```http
POST http://localhost:5000/api/chatbot/message
Content-Type: application/json

{
  "sessionId": "guest-session-12345",
  "text": "Form rộng có màu gì?",
  "customerInfo": {
    "name": "Khách vãng lai"
  }
}
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "_id": "...",
      "from": "user",
      "text": "Form rộng có màu gì?",
      "createdAt": "2025-11-09T..."
    },
    "botMessage": {
      "_id": "...",
      "from": "bot",
      "text": "Áo Thun Nam Form Rộng có các màu:\n- Đen\n- Trắng\n- Xám\n- Be\n\nGiá: 180,000đ\nCòn hàng: 50 sản phẩm\nLink: /products/ao-thun-nam-form-rong\n\nBạn muốn xem thêm chi tiết không? 😊",
      "createdAt": "2025-11-09T..."
    },
    "session": {
      "sessionId": "guest-session-12345",
      "status": "active",
      "aiEnabled": true
    }
  }
}
```

---

### 📜 2.3. Xem Lịch Sử Chat

#### Request:
```http
GET http://localhost:3000/api/chatbot/history/guest-session-12345
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "...",
        "from": "user",
        "text": "Tôi muốn mua áo thun nam",
        "createdAt": "2025-11-09T..."
      },
      {
        "_id": "...",
        "from": "bot",
        "text": "Chào bạn! TnQ Fashion có rất nhiều mẫu...",
        "createdAt": "2025-11-09T..."
      },
      {
        "_id": "...",
        "from": "user",
        "text": "Form rộng có màu gì?",
        "createdAt": "2025-11-09T..."
      },
      {
        "_id": "...",
        "from": "bot",
        "text": "Áo Thun Nam Form Rộng có các màu...",
        "createdAt": "2025-11-09T..."
      }
    ]
  }
}
```

---

### 📞 2.4. Hỏi về Chính Sách (AI dùng Policies)

#### Request:
```http
POST http://localhost:3000/api/chatbot/message
Content-Type: application/json

{
  "sessionId": "guest-session-12345",
  "text": "Ship có miễn phí không?"
}
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "_id": "...",
      "from": "user",
      "text": "Ship có miễn phí không?",
      "createdAt": "2025-11-09T..."
    },
    "botMessage": {
      "_id": "...",
      "from": "bot",
      "text": "Có bạn ơi! 🎉\n\nMinh miễn phí ship cho đơn hàng từ 300,000đ trở lên. Giao hàng toàn quốc trong 3-5 ngày làm việc.\n\nĐơn của bạn dưới 300k thì có phí ship 30,000đ nhé. Bạn có muốn xem thêm sản phẩm để đủ 300k miễn ship không? 😊",
      "createdAt": "2025-11-09T..."
    },
    "session": {
      "sessionId": "guest-session-12345",
      "status": "active",
      "aiEnabled": true
    }
  }
}
```

---

## 3. Test Chat với Staff

### 👨‍💼 3.1. Customer Yêu Cầu Staff

#### Request:
```http
POST http://localhost:3000/api/chatbot/request-staff
Content-Type: application/json

{
  "sessionId": "guest-session-12345"
}
```

#### Expected Response:
```json
{
  "success": true,
  "message": "Staff requested. Please wait..."
}
```

#### Kiểm Tra Lịch Sử:
```http
GET http://localhost:3000/api/chatbot/history/guest-session-12345
```

**Expected:** Có thêm message từ bot:
```json
{
  "_id": "...",
  "from": "bot",
  "text": "Đã chuyển cho nhân viên tư vấn. Vui lòng chờ trong giây lát nhé! 👨‍💼",
  "createdAt": "2025-11-09T..."
}
```

---

### 📋 3.2. Staff Xem Danh Sách Sessions

#### Request:
```http
GET http://localhost:3000/api/chatbot/staff/sessions
Authorization: Bearer YOUR_STAFF_TOKEN
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "guest-session-12345",
        "status": "waiting_staff",
        "aiEnabled": false,
        "customerInfo": {
          "name": "Khách vãng lai",
          "email": "",
          "phone": ""
        },
        "lastMessageAt": "2025-11-09T...",
        "assignedStaff": null
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "pages": 1,
      "limit": 20
    }
  }
}
```

---

### 💬 3.3. Staff Trả Lời Customer

#### Request:
```http
POST http://localhost:3000/api/chatbot/staff/message
Authorization: Bearer YOUR_STAFF_TOKEN
Content-Type: application/json

{
  "sessionId": "guest-session-12345",
  "text": "Xin chào! Tôi là Quỳnh - nhân viên tư vấn của TnQ Fashion. Tôi có thể giúp gì cho bạn?"
}
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "message": {
      "_id": "...",
      "from": "staff",
      "text": "Xin chào! Tôi là Quỳnh - nhân viên tư vấn của TnQ Fashion. Tôi có thể giúp gì cho bạn?",
      "staffName": "Quỳnh",
      "createdAt": "2025-11-09T..."
    }
  }
}
```

---

### 💬 3.4. Customer Trả Lời Staff

#### Request:
```http
POST http://localhost:3000/api/chatbot/message
Content-Type: application/json

{
  "sessionId": "guest-session-12345",
  "text": "Tôi muốn mua áo thun size L nhưng không biết có vừa không?"
}
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "_id": "...",
      "from": "user",
      "text": "Tôi muốn mua áo thun size L nhưng không biết có vừa không?",
      "createdAt": "2025-11-09T..."
    },
    "botMessage": null,
    "session": {
      "sessionId": "guest-session-12345",
      "status": "with_staff",
      "aiEnabled": false
    }
  }
}
```

**Lưu ý:** `botMessage` là `null` vì AI đã tắt, staff phải trả lời thủ công.

---

### 💬 3.5. Staff Tiếp Tục Tư Vấn

#### Request:
```http
POST http://localhost:3000/api/chatbot/staff/message
Authorization: Bearer YOUR_STAFF_TOKEN
Content-Type: application/json

{
  "sessionId": "guest-session-12345",
  "text": "Bạn cao bao nhiêu và nặng bao nhiêu kg để mình tư vấn size chính xác nhất nhé?"
}
```

#### Request:
```http
POST http://localhost:3000/api/chatbot/message
Content-Type: application/json

{
  "sessionId": "guest-session-12345",
  "text": "Tôi cao 1m70, nặng 65kg"
}
```

#### Request:
```http
POST http://localhost:3000/api/chatbot/staff/message
Authorization: Bearer YOUR_STAFF_TOKEN
Content-Type: application/json

{
  "sessionId": "guest-session-12345",
  "text": "Với chiều cao 1m70 và cân nặng 65kg, bạn nên chọn size L sẽ vừa vặn nhé! Size L của shop có:\n- Dài áo: 70cm\n- Rộng vai: 48cm\n- Ngực: 104cm\n\nBạn thích form vừa hay rộng? Nếu thích rộng có thể lên size XL."
}
```

---

### 🔄 3.6. Staff Bật Lại AI

#### Request:
```http
POST http://localhost:3000/api/chatbot/staff/toggle-ai
Authorization: Bearer YOUR_STAFF_TOKEN
Content-Type: application/json

{
  "sessionId": "guest-session-12345",
  "enabled": true
}
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "session": {
      "sessionId": "guest-session-12345",
      "aiEnabled": true,
      "status": "with_staff"
    }
  }
}
```

---

### ✅ 3.7. Đánh Dấu Session Đã Xong

#### Request:
```http
POST http://localhost:3000/api/chatbot/resolve
Content-Type: application/json

{
  "sessionId": "guest-session-12345"
}
```

#### Expected Response:
```json
{
  "success": true,
  "message": "Session resolved"
}
```

---

## 4. Test Staff Dashboard

### 📊 4.1. Xem Tất Cả Sessions

#### Request:
```http
GET http://localhost:3000/api/chatbot/staff/sessions
Authorization: Bearer YOUR_STAFF_TOKEN
```

---

### 🔍 4.2. Filter Sessions Đang Chờ Staff

#### Request:
```http
GET http://localhost:3000/api/chatbot/staff/sessions?status=waiting_staff
Authorization: Bearer YOUR_STAFF_TOKEN
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "guest-session-99999",
        "status": "waiting_staff",
        "aiEnabled": false,
        "customerInfo": {
          "name": "Nguyễn Văn A"
        },
        "lastMessageAt": "2025-11-09T..."
      }
    ]
  }
}
```

---

### 👤 4.3. Filter Sessions Của Mình

#### Request:
```http
GET http://localhost:3000/api/chatbot/staff/sessions?assignedToMe=true
Authorization: Bearer YOUR_STAFF_TOKEN
```

---

### 🗑️ 4.4. Xóa Session

#### Request:
```http
DELETE http://localhost:3000/api/chatbot/session/guest-session-12345
```

#### Expected Response:
```json
{
  "success": true,
  "message": "Session cleared"
}
```

---

## 🎯 Tổng Kết Flow

### Flow 1: Customer Chat AI → Staff Join
```
1. Customer: POST /api/chatbot/message (AI trả lời)
2. Customer: POST /api/chatbot/request-staff
3. Staff: GET /api/chatbot/staff/sessions (thấy session mới)
4. Staff: POST /api/chatbot/staff/message (trả lời)
5. Customer & Staff chat qua lại...
6. Staff: POST /api/chatbot/resolve (xong)
```

### Flow 2: Admin Quản Lý Policies
```
1. Admin: POST /api/training/policy (tạo mới)
2. Admin: GET /api/training/policies (xem tất cả)
3. Admin: PUT /api/training/policy/:id (sửa)
4. Admin: PATCH /api/training/policy/:id/toggle (bật/tắt)
5. Admin: DELETE /api/training/policy/:id (xóa)
```

### Flow 3: AI Học từ Policies
```
1. Admin tạo policy mới về shipping
2. Customer hỏi "Ship có miễn phí không?"
3. AI tự động load policies từ DB
4. AI trả lời dựa trên policy vừa tạo
```

---

## ⚠️ Troubleshooting

### Issue 1: AI không trả lời
**Check:**
```bash
node test-llama-free.js
```

### Issue 2: 401 Unauthorized
**Check:** Token có đúng? Role có đủ quyền?

### Issue 3: AI trả lời sai
**Check:**
```http
GET /api/training/policies
```
Xem policies có đủ không? Có `isActive: true` không?

### Issue 4: Staff không thấy session
**Check:** Session `status` phải là `waiting_staff` hoặc `with_staff`

---

## 🚀 Ready to Test!

**Bắt đầu từ:**
1. ✅ Tạo 5-6 policies đầy đủ
2. ✅ Test chat với AI
3. ✅ Test request staff
4. ✅ Test staff dashboard

**Happy Testing! 🎉**
