# 🤖 CHATBOT AI - TnQ Fashion

## 📋 TỔNG QUAN

### **AI Engine:** OpenRouter API (GPT-3.5-turbo)

- Provider: OpenRouter
- Model: `openai/gpt-3.5-turbo`
- Tích hợp: Backend Node.js

### **Luồng hoạt động:**

```
User gửi tin nhắn
    ↓
Frontend (ChatbotWidget)
    ↓
POST /api/chatbot/message
    ↓
Backend (chatbot.service.js)
    ↓
1. Load Knowledge Base từ DB:
   - Products (30 sản phẩm mới nhất)
   - Categories (danh mục)
   - Policies (chính sách từ Training Data)
   - Promotions (khuyến mãi)
    ↓
2. Build System Prompt với knowledge
    ↓
3. Gọi OpenRouter API (GPT-3.5)
    ↓
4. Nhận response từ AI
    ↓
5. Lưu vào ChatMessage DB
    ↓
Response trả về Frontend
    ↓
Hiển thị cho user
```

---

## 🔑 CÁC TÍNH NĂNG

### ✅ **Chatbot có thể:**

1. **Tư vấn sản phẩm**

   - Gợi ý sản phẩm phù hợp
   - So sánh giá cả
   - Chọn size, màu sắc
   - Phối đồ

2. **Trả lời về chính sách**

   - Vận chuyển
   - Đổi trả
   - Thanh toán
   - Bảo hành
   - FAQ

3. **Hỗ trợ khuyến mãi**

   - Mã giảm giá hiện có
   - Điều kiện áp dụng
   - Cách sử dụng

4. **Giới thiệu shop**
   - Thông tin về TnQ Fashion
   - Liên hệ, địa chỉ

### 🔄 **Chuyển sang Staff Support:**

- Khi câu hỏi phức tạp
- Khi user yêu cầu
- Khi AI không tự tin (confidence < threshold)

---

## 📊 DATABASE

### **Collections:**

#### 1. **BotSession** - Phiên chat

```javascript
{
  sessionId: String,      // "web_1699999999_abc123"
  userId: ObjectId,       // Nếu đã đăng nhập
  channel: 'web',
  status: 'active',       // 'active', 'resolved', 'waiting'
  aiEnabled: Boolean,     // true = AI trả lời, false = chờ staff
  customerInfo: {
    name: String,
    email: String,
    phone: String
  },
  context: Map,           // Lưu context chat
  lastMessageAt: Date,
  assignedStaff: ObjectId
}
```

#### 2. **ChatMessage** - Tin nhắn

```javascript
{
  sessionId: String,
  userId: ObjectId,
  from: String,          // 'user', 'bot', 'staff'
  text: String,
  confidence: Number,    // 0-1, độ tự tin của AI
  createdAt: Date
}
```

#### 3. **Policy** - Training Data

```javascript
{
  type: String,          // 'shipping', 'return', 'payment', ...
  title: String,
  content: String,       // Nội dung AI sẽ học
  order: Number,
  isActive: Boolean
}
```

---

## 🔧 CONFIG

### **Backend ENV:**

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_MODEL=openai/gpt-3.5-turbo
```

### **Frontend:**

- Session ID lưu trong `localStorage`
- Key: `chatbot_session_id`
- Format: `web_timestamp_randomstring`

---

## 📡 API ENDPOINTS

### **1. POST /api/chatbot/message**

**Gửi tin nhắn từ user**

**Request:**

```json
{
  "sessionId": "web_1699999999_abc123",
  "text": "Shop có áo thun nam không?",
  "customerInfo": {
    "name": "Nguyễn Văn A",
    "email": "a@example.com"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "userMessage": {
      "_id": "...",
      "from": "user",
      "text": "Shop có áo thun nam không?",
      "createdAt": "2025-11-10T..."
    },
    "botMessage": {
      "_id": "...",
      "from": "bot",
      "text": "Dạ có ạ! Shop hiện có nhiều mẫu áo thun nam...",
      "createdAt": "2025-11-10T..."
    },
    "session": {
      "sessionId": "web_1699999999_abc123",
      "status": "active",
      "aiEnabled": true
    }
  }
}
```

---

### **2. GET /api/chatbot/history/:sessionId**

**Lấy lịch sử chat**

**Query params:**

- `limit` (optional): Số tin nhắn (default: 50)

**Response:**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "...",
        "from": "bot",
        "text": "Xin chào!",
        "createdAt": "..."
      },
      {
        "_id": "...",
        "from": "user",
        "text": "Hi",
        "createdAt": "..."
      }
    ]
  }
}
```

---

### **3. POST /api/chatbot/request-staff**

**Yêu cầu hỗ trợ staff**

**Request:**

```json
{
  "sessionId": "web_1699999999_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Staff support requested"
}
```

---

## 🧠 KNOWLEDGE BASE

### **Cấu trúc:**

AI được cung cấp thông tin real-time từ DB:

1. **Products** (30 sản phẩm)

   - Tên, mô tả
   - Giá, stock
   - Rating
   - Link: `/products/{slug}`

2. **Categories**

   - Danh mục sản phẩm
   - Mô tả

3. **Policies** (từ Training Data)

   - Vận chuyển
   - Đổi trả
   - Thanh toán
   - Bảo hành
   - FAQ
   - Giới thiệu

4. **Promotions**
   - Mã giảm giá
   - Điều kiện
   - Thời hạn

### **System Prompt:**

```
Bạn là trợ lý AI của cửa hàng thời trang TnQ Fashion.

**NHIỆM VỤ:**
- Tư vấn sản phẩm thời trang
- Giải đáp về giá cả, chính sách
- Hướng dẫn chọn size, phối đồ
- Hỗ trợ tìm sản phẩm phù hợp

**QUY TẮC:**
- Trả lời ngắn gọn, dễ hiểu, thân thiện
- LUÔN đề xuất sản phẩm CỤ THỂ với link
- KHÔNG bịa đặt thông tin
- Nếu phức tạp → chuyển staff

[DANH MỤC SẢN PHẨM]
[SẢN PHẨM HIỆN CÓ]
[KHUYẾN MÃI]
[CHÍNH SÁCH]
```

---

## 🎨 FRONTEND - ChatbotWidget

### **Component:** `ChatbotWidget.jsx`

### **Features:**

- ✅ Floating button (góc dưới phải)
- ✅ Popup chat window
- ✅ Load lịch sử chat từ DB
- ✅ Real-time chat với AI
- ✅ Typing indicator
- ✅ Quick questions
- ✅ Auto scroll to bottom
- ✅ Session persistence (localStorage)

### **States:**

```javascript
const [isOpen, setIsOpen] = useState(false);
const [messages, setMessages] = useState([]);
const [inputText, setInputText] = useState('');
const [isTyping, setIsTyping] = useState(false);
const [sessionId] = useState(generateSessionId());
const [isLoading, setIsLoading] = useState(true);
```

### **Session Management:**

```javascript
// Generate unique session ID
function generateSessionId() {
  const stored = localStorage.getItem('chatbot_session_id');
  if (stored) return stored;

  const newId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('chatbot_session_id', newId);
  return newId;
}
```

---

## 🔒 BẢO MẬT

### **Backend:**

- ✅ Rate limiting (tránh spam)
- ✅ Input sanitization
- ✅ XSS protection
- ✅ CORS configured

### **Frontend:**

- ✅ Session ID random + timestamp
- ✅ LocalStorage để lưu session
- ✅ Không lưu thông tin nhạy cảm

---

## 🐛 XỬ LÝ LỖI

### **1. API Error:**

```javascript
catch (error) {
  console.error('Error sending message:', error);
  const errorMessage = {
    sender: 'bot',
    text: 'Xin lỗi, em đang gặp sự cố. Vui lòng thử lại hoặc liên hệ hotline 1900-xxxx! 🙏',
  };
  setMessages((prev) => [...prev, errorMessage]);
}
```

### **2. Loading State:**

- Hiển thị typing indicator khi loading
- Disable send button khi đang gửi
- Show error message nếu thất bại

---

## 📊 PERFORMANCE

### **Optimizations:**

1. **Limit products trong knowledge base:** 30 sản phẩm
2. **Chat history limit:** 50 tin nhắn gần nhất
3. **AI context:** 8 tin nhắn gần nhất
4. **Caching:** Categories, Policies được cache

### **Response Time:**

- Load history: ~200-500ms
- Send message: ~2-5s (tùy OpenRouter API)

---

## 🚀 DEPLOYMENT

### **Backend:**

```bash
# Set env variables
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_MODEL=openai/gpt-3.5-turbo

# Start server
npm run dev
```

### **Frontend:**

- Widget tự động load khi vào trang
- Tự động ẩn ở `/dashboard`, `/login`, `/register`, `/checkout`

---

## 📝 TESTING

### **Test chatbot:**

1. Mở trang chủ
2. Click nút 💬 góc dưới phải
3. Hỏi: "Shop có áo thun nam không?"
4. → AI trả lời với sản phẩm cụ thể + link

### **Test training data:**

1. Admin thêm policy mới
2. User hỏi về policy đó
3. → AI trả lời dựa trên nội dung vừa thêm

### **Test session persistence:**

1. Chat với bot
2. Refresh trang
3. Mở lại widget
4. → Lịch sử chat vẫn còn

---

## 💡 CẢI TIẾN TƯƠNG LAI

### **Có thể thêm:**

1. ✨ Voice input/output
2. 📸 Upload ảnh để tìm sản phẩm tương tự
3. 🎯 Recommendation engine
4. 📊 Analytics (câu hỏi phổ biến)
5. 🌐 Multi-language support
6. 🔔 Push notification khi staff reply
7. 💬 Live chat handoff to Zalo/Facebook

---

## 🆘 TROUBLESHOOTING

### **Lỗi: "Chatbot không trả lời"**

✅ Kiểm tra:

1. `OPENROUTER_API_KEY` đã set chưa?
2. Network tab có lỗi API không?
3. Training data đã thêm chưa?

### **Lỗi: "Form chat bị khuất"**

✅ Fix:

- Đã fix z-index: chatButton (9997), chatWindow (9998), toast (9999)

### **Lỗi: "Session mất khi refresh"**

✅ Kiểm tra:

- localStorage có `chatbot_session_id` không?
- Có lỗi CORS không?

---

## 📚 TÀI LIỆU LIÊN QUAN

- `BE_TRAINING_API_SUMMARY.md` - API Training Data
- `HUONG_DAN_CHATBOT_TRAINING.md` - Hướng dẫn quản lý
- `CHANGELOG_CHATBOT.md` - Changelog chi tiết

---

## 🎉 KẾT LUẬN

**AI Engine:** OpenRouter (GPT-3.5-turbo)  
**Knowledge:** Real-time từ DB (Products, Policies, Promotions)  
**Session:** Persistent với localStorage  
**UI:** Professional, responsive

**Chatbot đã sẵn sàng phục vụ khách hàng! 🚀**
