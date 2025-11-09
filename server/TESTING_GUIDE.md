# 🚀 Quick Test Guide - Chatbot với Llama 3.3 8B Free

## Test Model AI

```bash
cd server
node test-llama-free.js
```

Expected result: ✅ AI trả lời về áo thun nam

## Test APIs (Postman/Thunder Client)

### 1. Customer APIs (Public)

#### Gửi tin nhắn
```http
POST http://localhost:3000/api/chatbot/message
Content-Type: application/json

{
  "sessionId": "test-session-123",
  "text": "Tôi muốn mua áo thun",
  "customerInfo": {
    "name": "Test User"
  }
}
```

Expected: AI response về áo thun

#### Lấy lịch sử chat
```http
GET http://localhost:3000/api/chatbot/history/test-session-123
```

Expected: Danh sách messages

#### Yêu cầu nhân viên
```http
POST http://localhost:3000/api/chatbot/request-staff
Content-Type: application/json

{
  "sessionId": "test-session-123"
}
```

Expected: Status chuyển sang `waiting_staff`, AI disabled

### 2. Staff APIs (Requires Auth)

#### List sessions
```http
GET http://localhost:3000/api/chatbot/staff/sessions
Authorization: Bearer YOUR_TOKEN
```

#### Staff trả lời
```http
POST http://localhost:3000/api/chatbot/staff/message
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "sessionId": "test-session-123",
  "text": "Xin chào, tôi có thể giúp gì cho bạn?"
}
```

Expected: Status chuyển sang `with_staff`, AI disabled

### 3. Training APIs (Staff/Admin)

#### Lấy tất cả policies
```http
GET http://localhost:5000/api/training/policies
Authorization: Bearer YOUR_TOKEN
```

#### Tạo policy mới
```http
POST http://localhost:5000/api/training/policy
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "type": "faq",
  "title": "Làm thế nào để chọn size?",
  "content": "Bạn có thể xem bảng size trong mô tả sản phẩm..."
}
```

#### Toggle policy
```http
PATCH http://localhost:5000/api/training/policy/POLICY_ID/toggle
Authorization: Bearer YOUR_TOKEN
```

## Test Flow

### Flow 1: Customer chat với AI
1. POST `/api/chatbot/message` - User hỏi
2. ✅ AI tự động trả lời
3. GET `/api/chatbot/history/:id` - Xem lịch sử

### Flow 2: Customer yêu cầu staff
1. POST `/api/chatbot/message` - User hỏi phức tạp
2. POST `/api/chatbot/request-staff` - User yêu cầu staff
3. ✅ Status = `waiting_staff`, AI disabled
4. GET `/api/chatbot/staff/sessions` - Staff xem danh sách
5. POST `/api/chatbot/staff/message` - Staff trả lời
6. ✅ Status = `with_staff`

### Flow 3: Training AI
1. GET `/api/training/policies` - Xem policies hiện tại
2. POST `/api/training/policy` - Thêm policy mới
3. ✅ AI tự động sử dụng policy mới trong lần chat tiếp theo

## Expected Behaviors

### AI Enabled (aiEnabled: true)
- ✅ User gửi message → AI tự động trả lời
- ✅ AI load knowledge từ DB (products, categories, policies, promotions)
- ✅ Response thời gian: 2-5 giây

### AI Disabled (aiEnabled: false)
- ✅ User gửi message → Chỉ save message, không có AI response
- ✅ Staff phải trả lời thủ công
- ✅ Status = `waiting_staff` hoặc `with_staff`

### Training
- ✅ Thêm policy mới → AI dùng ngay lần chat sau
- ✅ Toggle policy off → AI không dùng policy đó nữa
- ✅ Update policy → AI dùng content mới

## Common Issues

### Issue 1: AI không trả lời
**Check:**
- `.env` có `OPENROUTER_API_KEY`?
- `OPENROUTER_MODEL = meta-llama/llama-3.3-70b-instruct:free`?
- Network có kết nối được OpenRouter không?

**Fix:** 
```bash
node test-llama-free.js
```

### Issue 2: 401 Unauthorized (Staff APIs)
**Check:**
- Header có `Authorization: Bearer TOKEN`?
- Token còn valid không?
- User có role `staff` hoặc `admin`?

### Issue 3: AI trả lời sai
**Check:**
- Policies trong DB có đầy đủ không?
- Products có data không?
- Promotions có active không?

**Fix:**
```http
GET /api/training/policies
```
Xem policies hiện có, thêm nếu thiếu

## Logs To Watch

### Normal Logs
```
[Chatbot] Lỗi: timeout
[Training] Lỗi createPolicy: duplicate key
```

### No More Logs (Removed)
```
❌ 🔍 [Chatbot] Building knowledge base...
❌ 📤 [Chatbot] Calling OpenRouter...
❌ ✅ [Chatbot] Response: ...
```

## Performance Expectations

- **AI Response Time:** 2-5 seconds
- **DB Query Time:** < 500ms
- **Total Request Time:** < 6 seconds

## Model Info

- **Model:** Llama 3.3 70B Instruct (8B variant)
- **Provider:** OpenRouter
- **Cost:** FREE ✅
- **Max Tokens:** 800
- **Temperature:** 0.7
- **Context:** Last 6 messages + system prompt

## Next Steps

1. ✅ Test model: `node test-llama-free.js`
2. ✅ Test customer API: POST `/api/chatbot/message`
3. ✅ Test training API: GET `/api/training/policies`
4. ✅ Monitor logs: Check console cho lỗi
5. ✅ Deploy: Ready for production!

**Happy Testing! 🎉**
