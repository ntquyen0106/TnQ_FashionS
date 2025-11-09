 🎯 Thuật toán Chat Nhân Viên - Khách Hàng

## 📋 Tổng quan Flow

Hệ thống hỗ trợ **3 chế độ chat**:
1. **Khách chat với AI** (mặc định)
2. **Khách yêu cầu nhân viên** → Nhân viên vào chat
3. **Nhân viên chủ động vào chat** (từ dashboard)

---

## 🔄 Flow 1: Khách Chat với AI (Mặc định)

```
┌─────────────┐
│   KHÁCH     │
│ Gửi tin nhắn│
└──────┬──────┘
       │
       ▼
┌────────────────────┐
│ POST /chatbot/     │
│ message            │
│                    │
│ sessionId: "abc"   │
│ text: "Xin chào"   │
└──────┬─────────────┘
       │
       ▼
┌─────────────────────────┐
│ Backend kiểm tra:       │
│ - session.aiEnabled?    │
│ - status: "active"      │
└──────┬──────────────────┘
       │
       ├─ YES → AI trả lời
       │
       ▼
┌────────────────────┐
│ 1. Lưu tin user    │
│ 2. Gọi AI          │
│ 3. Lưu tin bot     │
│ 4. Trả về cả 2     │
└────────────────────┘
```

**Code Backend (đã có):**
```javascript
// chatbot.service.js - sendMessage()
async sendMessage({ sessionId, userId, text, customerInfo }) {
  const session = await this.getOrCreateSession(sessionId, userId, customerInfo);
  
  // Lưu tin user
  const userMessage = await ChatMessage.create({
    sessionId,
    userId,
    from: 'user',
    text,
  });
  
  let botMessage = null;
  
  // Chỉ AI trả lời nếu aiEnabled = true
  if (session.aiEnabled) {
    const history = await this.getHistory(sessionId, 8);
    const aiResponse = await this.getAIResponse(text, history);
    
    botMessage = await ChatMessage.create({
      sessionId,
      from: 'bot',
      text: aiResponse,
    });
  }
  
  return { userMessage, botMessage, session };
}
```

---

## 🙋 Flow 2: Khách Yêu Cầu Nhân Viên

```
┌─────────────┐
│   KHÁCH     │
│ Click button│
│"Tư vấn NV"  │
└──────┬──────┘
       │
       ▼
┌────────────────────┐
│ POST /chatbot/     │
│ request-staff      │
│                    │
│ sessionId: "abc"   │
└──────┬─────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Backend:                     │
│ 1. session.status =          │
│    "waiting_staff"           │
│ 2. session.aiEnabled = false │
│ 3. Lưu auto message:         │
│    "Đã chuyển yêu cầu..."    │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Nhân viên thấy trong     │
│ Dashboard Staff          │
│ (GET /staff/sessions)    │
│                          │
│ Filter:                  │
│ status=waiting_staff     │
└──────────────────────────┘
```

**Code Backend (đã có):**
```javascript
// chatbot.service.js - requestStaff()
async requestStaff(sessionId) {
  const session = await BotSession.findOne({ sessionId });
  
  if (!session) {
    throw { code: 404, message: 'Session not found' };
  }
  
  // Chuyển trạng thái
  session.status = 'waiting_staff';
  session.aiEnabled = false;
  session.lastMessageAt = new Date();
  await session.save();
  
  // Lưu auto message
  await ChatMessage.create({
    sessionId,
    from: 'bot',
    text: 'Đã chuyển yêu cầu đến nhân viên hỗ trợ. Vui lòng chờ trong giây lát...',
  });
  
  return session;
}
```

**Frontend Khách:**
```jsx
// ChatWidget.jsx
const handleRequestStaff = async () => {
  const res = await fetch('http://localhost:5000/api/chatbot/request-staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
  
  if (res.ok) {
    alert('Đã yêu cầu nhân viên! Vui lòng chờ...');
  }
};

return (
  <div className="chat-widget">
    {/* Messages */}
    {messages.map(msg => (
      <div key={msg._id} className={msg.from}>
        {msg.text}
      </div>
    ))}
    
    {/* Input + Button */}
    <input value={message} onChange={e => setMessage(e.target.value)} />
    <button onClick={sendMessage}>Gửi</button>
    <button onClick={handleRequestStaff}>Tư vấn nhân viên</button>
  </div>
);
```

---

## 👨‍💼 Flow 3: Nhân Viên Vào Chat

### **3.1. Dashboard Nhân Viên**

```
┌──────────────────────────┐
│ STAFF DASHBOARD          │
│                          │
│ GET /staff/sessions      │
│ ?status=waiting_staff    │
└──────┬───────────────────┘
       │
       ▼
┌────────────────────────────┐
│ Hiển thị danh sách:        │
│                            │
│ 📱 Session ABC             │
│ 👤 Nguyễn Văn A            │
│ 📧 a@gmail.com             │
│ ⏰ 2 phút trước            │
│ [Vào chat]                │
│                            │
│ 📱 Session XYZ             │
│ 👤 Trần Thị B              │
│ ⏰ 5 phút trước            │
│ [Vào chat]                │
└────────────────────────────┘
```

**Frontend Staff Dashboard:**
```jsx
// StaffDashboard.jsx
const [sessions, setSessions] = useState([]);
const token = localStorage.getItem('token');

useEffect(() => {
  const fetchSessions = async () => {
    const res = await fetch(
      'http://localhost:5000/api/chatbot/staff/sessions?status=waiting_staff',
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await res.json();
    setSessions(data.data.sessions);
  };
  
  fetchSessions();
  
  // Polling mỗi 5 giây để cập nhật
  const interval = setInterval(fetchSessions, 5000);
  return () => clearInterval(interval);
}, []);

return (
  <div className="staff-dashboard">
    <h1>Danh sách chờ hỗ trợ</h1>
    
    {sessions.map(session => (
      <div key={session.sessionId} className="session-card">
        <h3>{session.customerInfo?.name || 'Khách vãng lai'}</h3>
        <p>{session.customerInfo?.email}</p>
        <p>Chờ: {getTimeDiff(session.lastMessageAt)}</p>
        <button onClick={() => openChat(session.sessionId)}>
          Vào chat
        </button>
      </div>
    ))}
  </div>
);
```

### **3.2. Nhân Viên Gửi Tin Nhắn**

```
┌──────────────┐
│   NHÂN VIÊN  │
│ Gửi tin nhắn │
└──────┬───────┘
       │
       ▼
┌────────────────────────────┐
│ POST /chatbot/staff/message│
│                            │
│ sessionId: "abc"           │
│ text: "Em là NV, em giúp   │
│       anh nhé"             │
└──────┬─────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Backend:                         │
│ 1. session.status = "with_staff" │
│ 2. session.aiEnabled = false     │
│ 3. session.assignedStaffId = ... │
│ 4. Lưu tin staff                 │
│ 5. Emit socket event (real-time) │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────┐
│ Khách nhận tin   │
│ ngay lập tức     │
│ (qua Socket.IO)  │
└──────────────────┘
```

**Code Backend (đã có):**
```javascript
// chatbot.service.js - sendStaffMessage()
async sendStaffMessage({ sessionId, staffId, staffName, text }) {
  const session = await BotSession.findOne({ sessionId });
  
  if (!session) {
    throw { code: 404, message: 'Session not found' };
  }
  
  // Cập nhật session
  session.status = 'with_staff';
  session.aiEnabled = false;
  session.assignedStaffId = staffId;
  session.lastMessageAt = new Date();
  await session.save();
  
  // Lưu tin staff
  const message = await ChatMessage.create({
    sessionId,
    from: 'staff',
    text,
    staffId,
    staffName,
  });
  
  return { message, session };
}
```

**Frontend Staff Chat:**
```jsx
// StaffChatWindow.jsx
const [messages, setMessages] = useState([]);
const [input, setInput] = useState('');
const token = localStorage.getItem('token');

const sendStaffMessage = async () => {
  const res = await fetch('http://localhost:5000/api/chatbot/staff/message', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId,
      text: input
    })
  });
  
  if (res.ok) {
    setInput('');
    fetchMessages(); // Refresh messages
  }
};

return (
  <div className="staff-chat">
    <div className="messages">
      {messages.map(msg => (
        <div key={msg._id} className={`message-${msg.from}`}>
          <strong>{msg.from === 'staff' ? msg.staffName : 'Khách'}</strong>
          <p>{msg.text}</p>
          <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
    
    <div className="input-area">
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && sendStaffMessage()}
      />
      <button onClick={sendStaffMessage}>Gửi</button>
    </div>
  </div>
);
```

### **3.3. Khách Tiếp Tục Chat**

```
┌──────────────┐
│   KHÁCH      │
│ Gửi tin tiếp │
└──────┬───────┘
       │
       ▼
┌────────────────────┐
│ POST /chatbot/     │
│ message            │
│                    │
│ text: "Cảm ơn anh" │
└──────┬─────────────┘
       │
       ▼
┌───────────────────────┐
│ Backend kiểm tra:     │
│ - aiEnabled = false   │
│ - status = with_staff │
└──────┬────────────────┘
       │
       ├─ NO AI → Chỉ lưu tin user
       │
       ▼
┌──────────────────────┐
│ Nhân viên thấy tin   │
│ mới trong chat window│
│ và trả lời tiếp      │
└──────────────────────┘
```

---

## 🔌 Real-time với Socket.IO (Tùy chọn)

### **Setup Socket.IO**

**Backend:**
```javascript
// src/index.js hoặc app.js
import { Server } from 'socket.io';
import http from 'http';

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true
  }
});

// Socket events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join room theo sessionId
  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
    console.log(`User joined session: ${sessionId}`);
  });
  
  // Leave room
  socket.on('leave_session', (sessionId) => {
    socket.leave(sessionId);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Export để dùng trong controller
export const getIO = () => io;
```

**Trong Controller:**
```javascript
// chatbot.controller.js
import { getIO } from '../app.js';

export const postStaffSendMessage = async (req, res) => {
  // ... existing code ...
  
  const result = await chatbotService.sendStaffMessage({...});
  
  // Emit event để khách nhận real-time
  const io = getIO();
  io.to(sessionId).emit('new_message', {
    _id: result.message._id,
    from: 'staff',
    text: result.message.text,
    staffName: result.message.staffName,
    createdAt: result.message.createdAt
  });
  
  res.json({ success: true, data: {...} });
};
```

**Frontend (Khách):**
```jsx
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

useEffect(() => {
  // Join session room
  socket.emit('join_session', sessionId);
  
  // Listen for new messages
  socket.on('new_message', (message) => {
    setMessages(prev => [...prev, message]);
    
    // Hiển thị notification nếu cần
    if (message.from === 'staff') {
      showNotification(`${message.staffName}: ${message.text}`);
    }
  });
  
  return () => {
    socket.emit('leave_session', sessionId);
    socket.off('new_message');
  };
}, [sessionId]);
```

---

## 📊 Thuật Toán Chi Tiết

### **Decision Tree**

```
Khách gửi message
    │
    ▼
┌─────────────────────┐
│ Session exists?     │
└────┬────────────┬───┘
     │ NO         │ YES
     ▼            ▼
 Create new   Load session
 session          │
     │            ▼
     └───────► ┌──────────────┐
               │ aiEnabled?   │
               └┬────────────┬┘
                │ TRUE       │ FALSE
                ▼            ▼
          ┌─────────┐   ┌──────────┐
          │ AI trả  │   │ Chỉ lưu  │
          │ lời    │   │ tin user │
          └─────────┘   └──────────┘
                             │
                             ▼
                        ┌──────────────┐
                        │ Nhân viên    │
                        │ sẽ thấy &    │
                        │ trả lời      │
                        └──────────────┘
```

### **Status Lifecycle**

```
active (AI chat)
    │
    ▼
┌───────────────────┐
│ User click        │
│ "Tư vấn NV"       │
└────┬──────────────┘
     │
     ▼
waiting_staff
     │
     ▼
┌───────────────────┐
│ Staff gửi tin đầu │
└────┬──────────────┘
     │
     ▼
with_staff (Staff chat)
     │
     ▼
┌───────────────────┐
│ Xong → Click      │
│ "Giải quyết xong" │
└────┬──────────────┘
     │
     ▼
resolved (Kết thúc)
```

---

## 💡 Tips Implementation

### **1. Polling vs WebSocket**

**Polling (Đơn giản hơn):**
```jsx
useEffect(() => {
  const interval = setInterval(() => {
    fetchMessages(); // Gọi API mỗi 3-5s
  }, 3000);
  
  return () => clearInterval(interval);
}, []);
```

**WebSocket (Real-time):**
```jsx
socket.on('new_message', (msg) => {
  setMessages(prev => [...prev, msg]);
});
```

### **2. Notification Sound**

```jsx
const playNotificationSound = () => {
  const audio = new Audio('/notification.mp3');
  audio.play();
};

socket.on('new_message', (msg) => {
  if (msg.from === 'staff') {
    playNotificationSound();
  }
});
```

### **3. Typing Indicator**

```jsx
// Khách đang gõ
socket.emit('typing', { sessionId, userName });

// Nhân viên thấy
socket.on('typing', (data) => {
  setTypingUser(data.userName);
  setTimeout(() => setTypingUser(null), 3000);
});
```

---

## 🎨 UI Components Needed

### **1. Customer Side**
- ChatWidget (floating button)
- ChatWindow (messages + input)
- RequestStaffButton

### **2. Staff Side**
- StaffDashboard (danh sách sessions)
- StaffChatWindow (chat với khách)
- SessionInfo (thông tin khách)

---

## ✅ Checklist Implementation

### Backend (✅ Đã có):
- [x] `POST /chatbot/message` - Chat thường
- [x] `GET /chatbot/history/:sessionId` - Lấy lịch sử
- [x] `POST /chatbot/request-staff` - Yêu cầu NV
- [x] `POST /chatbot/staff/message` - NV gửi tin
- [x] `GET /chatbot/staff/sessions` - Dashboard NV
- [x] `POST /chatbot/staff/toggle-ai` - Bật/tắt AI
- [x] `POST /chatbot/resolve` - Kết thúc session

### Frontend Cần làm:
- [ ] ChatWidget component (khách)
- [ ] StaffDashboard component (NV)
- [ ] StaffChatWindow component (NV)
- [ ] Socket.IO integration (optional)
- [ ] Notification sound
- [ ] Typing indicator (optional)

---

**🎉 Hoàn thành! Hệ thống đã sẵn sàng cho nhân viên chat với khách!**
